"""Tests for the Folio compiler. Run with `python build.py test` (or `python -m unittest` in folio/tests)."""

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(os.path.abspath(__file__)).parents[2]
sys.path.insert(0, str(ROOT / 'folio' / 'compiler'))

import plistlib  # noqa: E402
from folioc import Log, Project, cmd_android_project, cmd_ios_project, cmd_new_plugin, deep_merge, merge_plist  # noqa: E402


def make_app(tmp: Path, features: dict) -> Path:
    """Creates app/app.json and one folder per feature: {id: feature.json dict, or (dict, {file: text})}."""
    app = tmp / 'app'
    (app / 'features').mkdir(parents=True)
    (app / 'app.json').write_text(json.dumps({'id': 'test-app', 'name': 'Test app'}), 'utf-8')
    for fid, spec in features.items():
        manifest, files = spec if isinstance(spec, tuple) else (spec, {})
        folder = app / 'features' / fid
        folder.mkdir()
        if manifest is not None:
            text = manifest if isinstance(manifest, str) else json.dumps(manifest)
            (folder / 'feature.json').write_text(text, 'utf-8')
        main = manifest.get('main', 'Main.js') if isinstance(manifest, dict) else 'Main.js'
        files.setdefault(main, "import { Feature } from 'folio';\nexport default class X extends Feature {}\n")
        for name, text in files.items():
            if text is None:  # a file that should be missing
                continue
            (folder / name).parent.mkdir(parents=True, exist_ok=True)
            (folder / name).write_text(text, 'utf-8')
    return app


# The parts of the iPhone project Capacitor makes (npx cap add ios) that cmd_ios_project changes.
# The Xcode project file from Capacitor 7's iPhone template.
TEMPLATE_PBX = Path(__file__).parent / 'fixtures' / 'capacitor-ios.pbxproj'
FAKE_PODFILE = "target 'App' do\n  capacitor_pods\n  # Add your Pods here\nend\n"


def fake_ios_project(folder: Path) -> Path:
    (folder / 'App.xcodeproj').mkdir(parents=True)
    (folder / 'App.xcodeproj' / 'project.pbxproj').write_text(TEMPLATE_PBX.read_text('utf-8'), 'utf-8')
    (folder / 'App').mkdir()
    with (folder / 'App' / 'Info.plist').open('wb') as f:
        plistlib.dump({'CFBundleDisplayName': 'Test app', 'UISupportedInterfaceOrientations': ['UIInterfaceOrientationPortrait']}, f)
    (folder / 'Podfile').write_text(FAKE_PODFILE, 'utf-8')
    return folder


def ios_args(out, ios, build=None, team=None):
    return type('Args', (), {'out': str(out), 'ios': str(ios), 'build': build, 'team': team})()


def feature(**extra):
    return {'name': 'A feature', 'description': 'Does a thing.', 'main': 'Main.js', **extra}


def make_plugin_app(tmp: Path, folders: dict, app_extra=None) -> Path:
    """Like make_app, for an app whose features live in several folders: {folder: {id: spec}}.
    app.json lists the folders and says "plugins" holds plugins (API 2), unless app_extra says otherwise."""
    app = tmp / 'app'
    app.mkdir(parents=True)
    config = {'id': 'test-app', 'name': 'Test app', 'version': '1.4.0',
              'folders': list(folders), 'plugins': {'folder': 'plugins', 'api': 2}, **(app_extra or {})}
    (app / 'app.json').write_text(json.dumps(config), 'utf-8')
    for group, features in folders.items():
        (app / group).mkdir()
        for fid, spec in features.items():
            manifest, body = spec if isinstance(spec, tuple) else (spec, '')
            folder = app / group / fid
            folder.mkdir()
            (folder / 'feature.json').write_text(json.dumps(manifest), 'utf-8')
            (folder / 'Main.js').write_text("import { Feature } from 'folio';\n"
                                            f"export default class X extends Feature {{ start() {{ {body} }} }}\n", 'utf-8')
    return app


def plugin(block=None, **extra):
    """A plugin's feature.json: block is added to its plugin block, extra to the rest."""
    return feature(plugin={'api': 1, 'minApp': '1.0.0', **(block or {})}, **extra)


class CompilerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='folio-compiler-test-'))

    def resolve(self, features, without=()):
        project = Project(ROOT, make_app(self.tmp, features))
        found = project.discover(Log(quiet=True))
        included = project.resolve(found, without)
        return [f.id for f in included], {f.id: f for f in found}

    def test_features_start_after_what_they_require_and_use(self):
        order, _ = self.resolve({
            'views': feature(requires=['core'], uses=['extras']),
            'core': feature(),
            'extras': feature(requires=['core']),
        })
        self.assertEqual(order, ['core', 'extras', 'views'])

    def test_missing_requirement_leaves_the_feature_out(self):
        order, found = self.resolve({'notes': feature(requires=['sessions'])})
        self.assertEqual(order, [])
        self.assertIn('needs "sessions", which is not installed', found['notes'].reason)

    def test_leaving_out_spreads_to_features_that_need_it(self):
        order, found = self.resolve({
            'a': feature(requires=['b']),
            'b': feature(requires=['c']),
            'other': feature(),
        })
        self.assertEqual(order, ['other'])
        self.assertIn('"b"', found['a'].reason)

    def test_uses_is_optional(self):
        order, _ = self.resolve({'maps': feature(uses=['rooms'])})
        self.assertEqual(order, ['maps'])

    def test_requirements_in_a_circle_are_left_out(self):
        order, found = self.resolve({
            'a': feature(requires=['b']),
            'b': feature(requires=['a']),
            'c': feature(),
        })
        self.assertEqual(order, ['c'])
        self.assertIn('circle', found['a'].reason)

    def test_switched_off_and_left_out_features(self):
        order, found = self.resolve({'a': feature(enabled=False), 'b': feature(), 'c': feature()}, without=('c',))
        self.assertEqual(order, ['b'])
        self.assertEqual(found['a'].kind, 'off')
        self.assertEqual(found['c'].kind, 'off')

    def test_mistakes_in_feature_json(self):
        _, found = self.resolve({
            'broken-json': '{ "name": "x", }',
            'no-main': (feature(main='Missing.js'), {'Missing.js': None}),
            'bad-platform': feature(platforms=['windows']),
            'BadName': feature(),
        })
        self.assertIn('line 1', found['broken-json'].reason)
        self.assertIn('Missing.js', found['no-main'].reason)
        self.assertIn('platforms', found['bad-platform'].reason)
        self.assertIn('lowercase', found['BadName'].reason)

    def test_importing_another_features_files_is_not_allowed(self):
        _, found = self.resolve({
            'a': (feature(), {'Main.js': "import { x } from '../b/Main.js';\n"}),
            'b': feature(),
            'c': (feature(), {'Main.js': "import { y } from './helper.js';\n", 'helper.js': 'export const y = 1;\n'}),
        })
        self.assertIn('outside its own folder', found['a'].reason)
        self.assertEqual(found['c'].reason, '')

    def test_folder_without_feature_json_is_ignored(self):
        order, found = self.resolve({'notes': feature(), 'scratch': (None, {'Main.js': ''})})
        self.assertEqual(order, ['notes'])
        self.assertNotIn('scratch', found)

    def test_build_output(self):
        app = make_app(self.tmp, {
            'core': (feature(styles=['core.css'], templates='templates.html'), {
                'core.css': '.core { color: red; }',
                'templates.html': '<template id="setup"><p>Hi</p></template>',
                'README.md': 'not shipped',
                'tests/x.test.js': '// not shipped',
            }),
            'camera': feature(requires=['core'], native={
                'packages': {'@capacitor/camera': '^7.0.0'},
                'android': {'permissions': ['CAMERA']},
                'capacitor': {'server': {'allowNavigation': ['a.example']}},
            }),
            'web-only': feature(platforms=['web'], native={'android': {'permissions': ['INTERNET']}},
                                web={'manifest': {'share_target': {'action': './'}}}),
        })
        out = self.tmp / 'dist'
        code, details = Project(ROOT, app).build(out, Log(quiet=True), build_number='7')
        self.assertEqual(code, 0)
        web = out / 'web'
        index = (web / 'index.html').read_text('utf-8')
        self.assertIn('<template id="core--setup">', index)
        self.assertIn('"folio": "./folio/folio.js"', index)
        start = (web / 'start.js').read_text('utf-8')
        self.assertLess(start.index('"id": "core"'), start.index('"id": "camera"'))
        self.assertIn('"build": "7"', start)
        self.assertIn('.core { color: red; }', (web / 'app.css').read_text('utf-8'))
        self.assertFalse((web / 'features' / 'core' / 'README.md').exists())
        self.assertFalse((web / 'features' / 'core' / 'tests').exists())
        self.assertTrue((web / 'folio' / 'App.js').exists())
        self.assertFalse((web / 'folio' / 'testing.js').exists())
        self.assertIn("'test-app-", (web / 'sw.js').read_text('utf-8').replace('"', "'"))
        manifest = json.loads((web / 'manifest.webmanifest').read_text('utf-8'))
        self.assertEqual(manifest['share_target'], {'action': './'})
        package = json.loads((out / 'package.json').read_text('utf-8'))
        self.assertIn('@capacitor/camera', package['dependencies'])
        native = json.loads((out / 'native.json').read_text('utf-8'))
        self.assertEqual(native['android']['permissions'], ['CAMERA'])  # not INTERNET: web-only feature
        capacitor = json.loads((out / 'capacitor.config.json').read_text('utf-8'))
        self.assertEqual(capacitor['server']['allowNavigation'], ['a.example'])
        self.assertTrue((out / 'report.html').exists())

    def test_android_files_and_settings(self):
        app = make_app(self.tmp, {
            'login': (feature(native={'android': {
                'files': {'app/google-services.json': 'native/google-services.json'},
                'gradle': {'includeGoogle': True, 'someVersion': '1.2.0'},
            }}), {'native/google-services.json': '{"project_info": {}}'}),
        })
        out = self.tmp / 'dist'
        code, _ = Project(ROOT, app).build(out, Log(quiet=True))
        self.assertEqual(code, 0)
        self.assertFalse((out / 'web' / 'features' / 'login' / 'native').exists())  # not shipped in the app
        native = json.loads((out / 'native.json').read_text('utf-8'))['android']
        self.assertEqual(native['gradle'], {'includeGoogle': True, 'someVersion': '1.2.0'})
        self.assertEqual(native['files'][0]['to'], 'app/google-services.json')

        android = self.tmp / 'android'
        android.mkdir()
        (android / 'variables.gradle').write_text('ext {\n    minSdkVersion = 23\n}\n')
        args = type('Args', (), {'out': str(out), 'android': str(android)})()
        self.assertEqual(cmd_android_project(None, args), 0)
        self.assertEqual((android / 'app' / 'google-services.json').read_text(), '{"project_info": {}}')
        gradle = (android / 'variables.gradle').read_text()
        self.assertIn('minSdkVersion = 23', gradle)
        self.assertIn('includeGoogle = true', gradle)
        self.assertIn("someVersion = '1.2.0'", gradle)

    def test_mistakes_in_android_files_and_settings(self):
        _, found = self.resolve({
            'missing': feature(native={'android': {'files': {'app/x.json': 'native/x.json'}}}),
            'outside': (feature(native={'android': {'files': {'../x.json': 'native/x.json'}}}), {'native/x.json': '{}'}),
            'badname': feature(native={'android': {'gradle': {'not a name': True}}}),
            'badvalue': feature(native={'android': {'gradle': {'ok': [1]}}}),
        })
        self.assertIn('is missing', found['missing'].reason)
        self.assertIn('inside the project', found['outside'].reason)
        self.assertIn('native.android.gradle', found['badname'].reason)
        self.assertIn('native.android.gradle', found['badvalue'].reason)

    def test_iphone_settings(self):
        app = make_app(self.tmp, {
            'camera': feature(native={'ios': {
                'plist': {'NSCameraUsageDescription': 'To scan cards.', 'UISupportedInterfaceOrientations': ['UIInterfaceOrientationLandscapeLeft']},
                'pods': ["pod 'Extra/Google', :path => '../../node_modules/extra'"],
            }}),
            'android-only': feature(platforms=['android'], native={'ios': {'plist': {'Ignored': True}}}),
        })
        settings = json.loads((app / 'app.json').read_text())
        settings['version'] = '3.2.0'
        settings['native'] = {'appId': 'io.example.app', 'ios': {'appId': 'io.example.iphone', 'devices': 'iphone',
                                                                  'plist': {'ITSAppUsesNonExemptEncryption': False}}}
        (app / 'app.json').write_text(json.dumps(settings))
        out = self.tmp / 'dist'
        code, _ = Project(ROOT, app).build(out, Log(quiet=True))
        self.assertEqual(code, 0)
        self.assertIn('@capacitor/ios', json.loads((out / 'package.json').read_text())['dependencies'])
        ios = json.loads((out / 'native.json').read_text())['ios']
        self.assertEqual(ios['appId'], 'io.example.iphone')
        self.assertNotIn('Ignored', ios['plist'])

        project = fake_ios_project(self.tmp / 'ios' / 'App')
        self.assertEqual(cmd_ios_project(None, ios_args(out, project, build='57', team='ABCDE12345')), 0)
        with (project / 'App' / 'Info.plist').open('rb') as f:
            info = plistlib.load(f)
        self.assertEqual(info['NSCameraUsageDescription'], 'To scan cards.')
        self.assertIs(info['ITSAppUsesNonExemptEncryption'], False)
        self.assertEqual(info['UISupportedInterfaceOrientations'], ['UIInterfaceOrientationPortrait', 'UIInterfaceOrientationLandscapeLeft'])
        self.assertEqual(info['CFBundleDisplayName'], 'Test app')
        pbx = (project / 'App.xcodeproj' / 'project.pbxproj').read_text()
        for line in ('PRODUCT_BUNDLE_IDENTIFIER = io.example.iphone;', 'MARKETING_VERSION = 3.2.0;',
                     'CURRENT_PROJECT_VERSION = 57;', 'DEVELOPMENT_TEAM = ABCDE12345;', 'TARGETED_DEVICE_FAMILY = 1;'):
            self.assertIn(line, pbx)
        podfile = (project / 'Podfile').read_text()
        self.assertIn("# Add your Pods here\n  pod 'Extra/Google', :path => '../../node_modules/extra'\nend", podfile)

        # Running it again changes nothing more.
        self.assertEqual(cmd_ios_project(None, ios_args(out, project, build='57', team='ABCDE12345')), 0)
        self.assertEqual((project / 'Podfile').read_text(), podfile)
        self.assertEqual((project / 'App.xcodeproj' / 'project.pbxproj').read_text().count('DEVELOPMENT_TEAM'), 2)  # Debug and Release
        self.assertNotEqual(cmd_ios_project(None, ios_args(out, project, team='not a team')), 0)
        self.assertNotEqual(cmd_ios_project(None, ios_args(out, self.tmp / 'nothing')), 0)

    def test_iphone_files(self):
        try:
            import pbxproj  # noqa: F401  (installed on GitHub's iPhone build only)
        except ImportError:
            self.skipTest('needs the pbxproj package')
        app = make_app(self.tmp, {
            'login': (feature(native={'ios': {'files': {'GoogleService-Info.plist': 'native/GoogleService-Info.plist'}}}),
                      {'native/GoogleService-Info.plist': '<plist><dict/></plist>'}),
        })
        out = self.tmp / 'dist'
        self.assertEqual(Project(ROOT, app).build(out, Log(quiet=True))[0], 0)
        self.assertFalse((out / 'web' / 'features' / 'login' / 'native').exists())
        project = fake_ios_project(self.tmp / 'ios' / 'App')
        pbx = project / 'App.xcodeproj' / 'project.pbxproj'
        self.assertEqual(cmd_ios_project(None, ios_args(out, project)), 0)
        self.assertTrue((project / 'App' / 'GoogleService-Info.plist').is_file())
        self.assertIn('GoogleService-Info.plist in Resources', pbx.read_text())

    def test_mistakes_in_iphone_settings(self):
        _, found = self.resolve({
            'missing': feature(native={'ios': {'files': {'X.plist': 'native/X.plist'}}}),
            'outside': (feature(native={'ios': {'files': {'../X.plist': 'native/X.plist'}}}), {'native/X.plist': '<plist/>'}),
            'badpods': feature(native={'ios': {'pods': ['rm -rf /']}}),
            'unknown': feature(native={'ios': {'gradle': {}}}),
        })
        self.assertIn('is missing', found['missing'].reason)
        self.assertIn('inside the project', found['outside'].reason)
        self.assertIn('native.ios.pods', found['badpods'].reason)
        self.assertIn('native.ios', found['unknown'].reason)
        self.assertIn('appId', Project.check_app_ios({'appId': 'not an id'}))
        self.assertIn('devices', Project.check_app_ios({'devices': 'watch'}))
        self.assertEqual(Project.check_app_ios({'appId': 'io.example.app', 'devices': 'iphone', 'plist': {}}), '')

    def test_merge_plist(self):
        base = {'A': 1, 'List': ['x'], 'Dict': {'k': 1}}
        merge_plist(base, {'A': 2, 'List': ['x', 'y'], 'Dict': {'j': 2}, 'New': True})
        self.assertEqual(base, {'A': 2, 'List': ['x', 'y'], 'Dict': {'k': 1, 'j': 2}, 'New': True})

    def test_output_folder_with_other_files_is_not_emptied(self):
        app = make_app(self.tmp, {'core': feature()})
        out = self.tmp / 'precious'
        out.mkdir()
        (out / 'my-file.txt').write_text('keep me')
        code, _ = Project(ROOT, app).build(out, Log(quiet=True))
        self.assertEqual(code, 1)
        self.assertTrue((out / 'my-file.txt').exists())


    # ---- Feature folders and plugins (Folio 1.12) ----

    def discover_plugins(self, folders, app_extra=None):
        project = Project(ROOT, make_plugin_app(self.tmp, folders, app_extra))
        log = Log(quiet=True)
        self.assertIsNotNone(project.load_app(log))
        found = project.discover(log)
        return project, found, {f.id: f for f in found}

    def test_features_are_read_from_every_folder_in_order(self):
        project, found, by_id = self.discover_plugins({
            'core': {'world': feature(), 'room': feature(requires=['world'])},
            'plugins': {'mode': plugin({'kind': ['mode']}), 'extra': plugin(requires=['room'])},
        })
        self.assertEqual([f.id for f in found], ['room', 'world', 'extra', 'mode'])
        self.assertEqual(by_id['world'].folder, 'core')
        self.assertEqual(by_id['mode'].folder, 'plugins')
        self.assertEqual([f.id for f in project.resolve(found)], ['world', 'room', 'extra', 'mode'])
        self.assertEqual(project.features_dir.name, 'core')  # new features go in the first folder

    def test_an_app_without_folders_keeps_app_features(self):
        project = Project(ROOT, make_app(self.tmp, {'core': feature()}))
        self.assertEqual(project.folder_names, ['features'])
        found = project.discover(Log(quiet=True))
        self.assertEqual([(f.id, f.folder, f.reason) for f in found], [('core', 'features', '')])

    def test_the_same_id_in_two_folders_is_a_mistake(self):
        _, found, _ = self.discover_plugins({'core': {'search': feature()}, 'plugins': {'search': plugin()}})
        first, second = found
        self.assertEqual((first.id, first.reason), ('search', ''))
        self.assertEqual(second.kind, 'mistake')
        self.assertIn('already in core/', second.reason)

    def test_plugin_blocks_belong_only_in_the_plugins_folder(self):
        _, _, by_id = self.discover_plugins({
            'core': {'world': plugin()},
            'plugins': {'bare': feature()},
        })
        self.assertIn('plugins live in plugins/', by_id['world'].reason)
        self.assertIn('has no "plugin" block', by_id['bare'].reason)
        self.assertEqual({by_id['world'].kind, by_id['bare'].kind}, {'mistake'})

    def test_mistakes_in_plugin_blocks(self):
        cases = {
            'not-object': feature(plugin=1),
            'no-api': feature(plugin={'minApp': '1.0.0'}),
            'bad-api': plugin({'api': 0}),
            'bool-api': plugin({'api': True}),
            'no-min': feature(plugin={'api': 1}),
            'bad-min': plugin({'minApp': '1.0'}),
            'bad-kind': plugin({'kind': 'mode'}),
            'bad-kind-word': plugin({'kind': ['Mode']}),
            'bad-load': plugin({'load': 'later'}),
            'bad-author': plugin({'author': ' '}),
            'bad-starts': plugin({'starts': 'later'}),
        }
        _, _, by_id = self.discover_plugins({'plugins': cases})
        for fid in cases:
            self.assertEqual(by_id[fid].kind, 'mistake', fid)
            self.assertIn('plugin', by_id[fid].reason, fid)

    def test_new_plugin_makes_a_plugin_that_compiles(self):
        app = make_plugin_app(self.tmp, {'core': {'api': feature()}, 'plugins': {}})
        project = Project(ROOT, app)
        args = lambda fid, **o: SimpleNamespace(id=fid, **{'name': None, 'description': None, 'requires': None,
                                                           'kind': None, 'author': None, **o})
        with redirect_stdout(io.StringIO()):
            self.assertEqual(cmd_new_plugin(project, args('word-count', kind='editor', author='E')), 0)
            self.assertEqual(cmd_new_plugin(project, args('word-count')), 1)  # it is there already
            self.assertEqual(cmd_new_plugin(project, args('Word count')), 1)  # not a folder name
            self.assertEqual(cmd_new_plugin(project, args('two', kind='Mode')), 1)  # not a kind
        folder = app / 'plugins' / 'word-count'
        manifest = json.loads((folder / 'feature.json').read_text('utf-8'))
        self.assertEqual(manifest['plugin'], {'api': 2, 'minApp': '1.4.0', 'kind': ['editor'], 'load': 'start', 'author': 'E'})
        self.assertEqual(manifest['main'], 'WordCount.js')
        self.assertTrue((folder / 'WordCount.js').is_file())
        self.assertFalse(any('__' in p.name for p in folder.rglob('*')))
        # Folio's feature template (this app has none of its own) gets a plugin block; it is a valid plugin
        found = project.discover(Log(quiet=True))
        self.assertEqual({f.id: f.reason for f in found}['word-count'], '')

    def test_new_plugin_needs_an_app_with_plugins(self):
        project = Project(ROOT, make_app(self.tmp, {}))
        with redirect_stdout(io.StringIO()):
            code = cmd_new_plugin(project, SimpleNamespace(id='x', name=None, description=None, requires=None, kind=None, author=None))
        self.assertEqual(code, 1)

    def test_a_typo_in_a_plugin_block_is_a_warning(self):
        _, _, by_id = self.discover_plugins({'plugins': {'p': plugin({'loads': 'start'})}})
        self.assertEqual(by_id['p'].reason, '')
        self.assertTrue(any('"loads"' in w for w in by_id['p'].warnings))

    def test_a_plugin_for_a_newer_api_or_app_is_left_out_with_the_reason(self):
        project, found, by_id = self.discover_plugins({'plugins': {
            'fits': plugin({'api': 2, 'minApp': '1.4.0'}),
            'new-api': plugin({'api': 3}),
            'new-app': plugin({'minApp': '1.10.0'}),  # 1.10 is newer than 1.4: compared as numbers
        }})
        self.assertEqual(by_id['fits'].reason, '')
        self.assertEqual(by_id['new-api'].kind, 'needs')
        self.assertIn('plugin API 3, but Test app offers API 2', by_id['new-api'].reason)
        self.assertEqual(by_id['new-app'].kind, 'needs')
        self.assertIn('needs Test app 1.10.0 or newer (this is 1.4.0)', by_id['new-app'].reason)
        self.assertEqual([f.id for f in project.resolve(found)], ['fits'])

    def test_plugin_blocks_need_the_app_to_have_plugins(self):
        project = Project(ROOT, make_app(self.tmp, {'p': plugin()}))
        found = project.discover(Log(quiet=True))
        self.assertIn('app.json has no "plugins"', found[0].reason)

    def test_mistakes_in_app_json_folders_and_plugins(self):
        for extra in ({'folders': 'core'}, {'folders': []}, {'folders': ['Core']}, {'folders': ['a', 'a']},
                      {'plugins': {'folder': 'elsewhere', 'api': 1}}, {'plugins': {'folder': 'plugins', 'api': 0}},
                      {'plugins': {'folder': 'plugins', 'api': 1, 'x': 1}}, {'version': '1.0'},
                      {'plugins': {'folder': 'plugins', 'api': 1, 'service': ''}},
                      {'plugins': {'folder': 'plugins', 'api': 1, 'exempt': 'time'}}):
            tmp = Path(tempfile.mkdtemp(prefix='folio-compiler-test-'))
            project = Project(ROOT, make_plugin_app(tmp, {'core': {}, 'plugins': {}}, extra))
            self.assertIsNone(project.load_app(Log(quiet=True)), extra)

    def test_plugins_reach_the_app_in_the_registry(self):
        app = make_plugin_app(self.tmp, {
            'core': {'world': feature()},
            'plugins': {'mode': plugin({'kind': ['mode'], 'load': 'when-used', 'author': 'E'}), 'tool': plugin()},
        })
        out = self.tmp / 'dist'
        code, _ = Project(ROOT, app).build(out, Log(quiet=True))
        self.assertEqual(code, 0)
        start = (out / 'web' / 'start.js').read_text('utf-8')
        features = json.loads(start.split('const features = ', 1)[1].split(';\n', 1)[0])
        by_id = {f['id']: f for f in features}
        self.assertNotIn('plugin', by_id['world'])
        self.assertEqual(by_id['mode']['plugin'], {'kind': ['mode'], 'load': 'when-used', 'api': 1, 'minApp': '1.0.0', 'author': 'E'})
        self.assertEqual(by_id['tool']['plugin'], {'kind': [], 'load': 'start', 'api': 1, 'minApp': '1.0.0'})
        self.assertEqual(by_id['mode']['path'], 'features/mode/Main.js')  # one flat folder in the app
        self.assertIn('"pluginApi": 2', start)
        self.assertTrue((out / 'web' / 'features' / 'world' / 'Main.js').exists())
        self.assertIn('plugins/mode', (out / 'report.html').read_text('utf-8'))


    def test_plugins_reach_the_core_only_through_the_plugin_service(self):
        core = {
            'world': (feature(), "this.provide('world', {}); this.defineSlot('world.modes', 'a mode');"),
            'api': (feature(requires=['world']), "this.provide('app-api', {});"),
        }
        plugins = {
            'good': (plugin(requires=['api']), "this.use('app-api'); this.use('mine'); this.add('settings', {}); this.add('mine.things', {});"),
            'mine': (plugin(), "this.provide('mine', {}); this.defineSlot('mine.things', 'a thing');"),
            'sneaky': (plugin(), "this.use('world').lib;"),
            'adder': (plugin(), "this.add('world.modes', {});"),
            'old': (plugin(), "this.use('world');"),
        }
        project, found, by_id = self.discover_plugins({'core': core, 'plugins': plugins},
                                                      {'plugins': {'folder': 'plugins', 'api': 2, 'service': 'app-api', 'exempt': ['old']}})
        order = [f.id for f in project.resolve(found)]
        self.assertIn('good', order)
        self.assertIn('old', order)  # exempt while it is moved onto the service
        self.assertEqual(by_id['sneaky'].kind, 'mistake')
        self.assertIn('uses the service "world" of world; plugins reach the app only through the "app-api" service', by_id['sneaky'].reason)
        self.assertIn('adds to the slot "world.modes" of world', by_id['adder'].reason)

    def test_without_a_plugin_service_plugins_may_use_anything(self):
        project, found, _ = self.discover_plugins({
            'core': {'world': (feature(), "this.provide('world', {});")},
            'plugins': {'p': (plugin(), "this.use('world');")},
        })
        self.assertIn('p', [f.id for f in project.resolve(found)])


    def test_file_names_that_differ_only_in_capitals_are_a_mistake(self):
        app = make_app(self.tmp, {'api': (feature(main='Api.js'), {
            'Api.js': "import { Feature } from 'folio';\nexport default class A extends Feature {}\n",
            'api.js': 'export const x = 1;\n'})})
        if len(list((app / 'features' / 'api').iterdir())) < 3:
            self.skipTest('this file system ignores capitals, so the two files are one')
        found = Project(ROOT, app).discover(Log(quiet=True))
        self.assertEqual(found[0].kind, 'mistake')
        self.assertIn('Api.js and api.js differ only in capital letters', found[0].reason)

    def test_deep_merge(self):
        base = {'a': {'b': 1, 'list': [1, 2]}, 'c': 1}
        deep_merge(base, {'a': {'d': 2, 'list': [2, 3]}, 'c': 5})
        self.assertEqual(base, {'a': {'b': 1, 'list': [1, 2, 3], 'd': 2}, 'c': 5})


if __name__ == '__main__':
    unittest.main()
