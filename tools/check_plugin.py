"""`python build.py check <id> [--out DIR] [--no-pack]`: everything a plugin must pass, in one step,
without opening the app, then the file a person imports.

1. **Compiles.** The app is built in test mode with the plugin in it; the compiler checks its
   feature.json, its plugin block (kind, needs, api) and that it reaches the app only through the
   plugin API. A plugin it leaves out fails here, with the compiler's reason.
2. **Its own tests.** Every `app/plugins/<id>/tests/*.test.js`.
3. **The conformance suite** (`app/core/api/tests/conformance.js`, the corpus's own): the eight
   laws hold with it on and after everything it adds has been used; nothing it adds throws;
   switching it off takes away all it added and loses no row, and on again it works the same; a
   `.traum` round-trip of a room is stable with it on.
4. **The speed budgets** on a 1,500-thought room: starting, a rule's layout and boxes, decorators,
   strip lines (`BUDGETS` in conformance.js).
5. **Packs** `<id>.traumplug` (`--out`, default `packed/`) once all of that passed.

Steps 2 to 4 run in a hidden Chrome or Edge (as `python build.py test` does; FOLIO_BROWSER names
another). A plugin module that exports `install(t)` is run as is; one with only a default class
is started on a stand-in app whose `traumerei` service hands it the API. A module may export
`samples = { kind: fields }`, the fields of a mark of each kind it adds, for the suite to make.
"""

import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'folio' / 'compiler'))


def suite_file(pid: str, main: str, block: dict) -> str:
    """The conformance suite and the budgets for this plugin, as one more test file. It runs after
    the plugin's own tests (the files run in order), so the plugin starts only once they are done."""
    return (f"import {{ test }} from 'folio/testing';\n"
            f"import * as mod from './features/{pid}/{main}';\n"
            f"import {{ pluginChecks }} from './features/api/tests/conformance.js';\n"
            f"for (const [name, fn] of pluginChecks({json.dumps(pid)}, mod, {json.dumps(block)})) test(name, fn);\n")


def page(files: list[str]) -> str:
    """The check page: runs the files and reports back, as `python build.py test`'s page does."""
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Check</title>
<script type="importmap">{{ "imports": {{ "folio": "./folio/folio.js", "folio/": "./folio/", "folio/testing": "./folio/testing.js" }} }}</script>
<script type="module">
import {{ run }} from 'folio/testing';
const result = await run({json.dumps(files)});
document.getElementById('results').textContent = JSON.stringify(result);
fetch('/__folio_report', {{ method: 'POST', body: JSON.stringify({{ kind: 'tests', ...result }}) }}).catch(() => {{}});
</script></head><body><pre id="results">Running…</pre></body></html>
'''


def build(root: Path, tmp: Path):
    """The app built in test mode (the host and the suite are in its tests/), or None."""
    import folioc
    quiet = folioc.Log(quiet=True)
    code, details = folioc.Project(root).build(tmp / 'full', quiet, without=(), test=True)
    if code:
        print('✗ The app does not compile:')
        for _, line in quiet.lines:
            print(f'    {line}')
        return None
    return details


def run_page(web: Path, tests: list[str], suite: str, labels=('2. Its own tests', '3-4. Conformance suite and speed budgets')) -> int | None:
    """Runs the plugin's own test files, then the suite, in a hidden browser; prints what each
    said and returns how many failed (None when it could not run)."""
    import folioc
    browser = folioc.find_browser()
    if not browser:
        print('✗ No Chrome or Edge found to run the tests: set FOLIO_BROWSER to a browser\'s path.')
        return None
    (web / 'check-suite.test.js').write_text(suite, 'utf-8')
    (web / 'check.html').write_text(page(tests + ['./check-suite.test.js']), 'utf-8')
    server = folioc.start_server(web)
    try:
        report = folioc.browser_report(browser, server, 'check.html', timeout=120)
    finally:
        server.shutdown()
    if not report:
        print('✗ The check page did not finish (a plugin that never returns from start?).')
        return None
    own = [r for r in report['results'] if r['file'] != './check-suite.test.js']
    suite_rows = [r for r in report['results'] if r['file'] == './check-suite.test.js']
    failed = 0
    for label, rows in ((labels[0], own), (labels[1], suite_rows)):
        if label is None:
            continue
        bad = [r for r in rows if not r['ok']]
        if not rows and label.startswith('2'):
            print(f'! {label}: none (put plain functions in rules.js and test them in tests/rules.test.js)')
            continue
        print(f'{"✓" if not bad else "✗"} {label}: {len(rows) - len(bad)} of {len(rows)} passed')
        for r in bad:
            print(f'    ✗ {r["name"]}\n        {r["error"]}')
        failed += len(bad)
    return failed


def check(pid: str, out_dir: Path | None, root: Path = ROOT) -> int:
    folder = root / 'app' / 'plugins' / pid
    if not (folder / 'feature.json').is_file():
        print(f'✗ No plugin app/plugins/{pid}/ (make one with python build.py new-plugin {pid}).')
        return 1
    manifest = json.loads((folder / 'feature.json').read_text('utf-8'))
    block = manifest.get('plugin')
    if not isinstance(block, dict):
        print(f'✗ {pid}: feature.json has no "plugin" block, so it is not a plugin.')
        return 1
    main = manifest.get('main', 'index.js')

    print(f'Checking {pid}')
    tmp = Path(tempfile.mkdtemp(prefix=f'check-{pid}-'))
    try:
        details = build(root, tmp)
        if details is None:
            return 1
        mine = next((f for f in details['features'] if f.id == pid), None)
        if mine is None or mine.kind in ('mistake', 'needs') or pid not in [f.id for f in details['included']]:
            reason = getattr(mine, 'reason', '') or 'left out of the build'
            print(f'✗ 1. Compiles: {reason}')
            return 1
        print('✓ 1. Compiles: plugin block, kinds and needs fine; reaches the app only through the API')
        web = tmp / 'full' / 'web'
        tests = [f'./features/{pid}/tests/{t.name}' for t in sorted((web / 'features' / pid / 'tests').glob('*.test.js'))]
        failed = run_page(web, tests, suite_file(pid, main, block))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    if failed is None:
        return 1
    if failed:
        print(f'\n{pid} failed {failed} check(s); nothing was packed.')
        return 1
    if out_dir is None:
        print(f'\n{pid} passed every check.')
        return 0
    from tools.pack_plugin import pack
    path = pack(pid, out_dir, root)
    shown = path.relative_to(root) if path.is_relative_to(root) else path
    print(f'✓ 5. Packed {shown} ({max(1, path.stat().st_size // 1024)} KB): import it in Settings → Plugins → Import plugin…')
    return 0


def file_suite(app: dict) -> str:
    """The suite for a packed file: the app's own import checks, then the conformance suite on
    the class the package's factory gives (held to one way in, as an imported plugin is)."""
    return f"""import {{ test, assert }} from 'folio/testing';
import * as folio from 'folio';
import * as pkg from './plugin-under-check.js';
import {{ problem, oneWayIn }} from './features/plugins/imported.js';
import {{ pluginChecks }} from './features/api/tests/conformance.js';
test('it would import: the checks Settings → Plugins → Import plugin… makes', async () => {{
  const text = await (await fetch('./plugin-under-check.js')).text();
  const why = problem(pkg, text, {json.dumps(app)});
  assert.equal(why, '', why);
}});
const id = pkg.manifest?.id || 'plugin';
let Plugin = null;
try {{ Plugin = oneWayIn(pkg.default(folio)); }} catch (err) {{ test('its factory gives a class', () => {{ throw err; }}); }}
if (Plugin) for (const [name, fn] of pluginChecks(id, {{ default: Plugin }}, pkg.manifest?.plugin || {{}})) test(name, fn);
"""


def check_file(path: Path, root: Path = ROOT) -> int:
    """`build.py check <file>.traumplug`: a packed plugin, made anywhere (a chat with no repo, the
    skill's traumplug.py), held to the import checks, the conformance suite and the budgets."""
    if not path.is_file():
        print(f'✗ No file {path}.')
        return 1
    app_json = json.loads((root / 'app' / 'app.json').read_text('utf-8'))
    plugins = app_json.get('plugins', {})
    app = {'version': app_json.get('version', '0.0.0'), 'pluginApi': plugins.get('api', 1),
           'pluginKinds': plugins.get('kinds', {}), 'pluginNeeds': plugins.get('needs', {})}
    print(f'Checking {path.name}')
    tmp = Path(tempfile.mkdtemp(prefix='check-file-'))
    try:
        if build(root, tmp) is None:
            return 1
        web = tmp / 'full' / 'web'
        shutil.copyfile(path, web / 'plugin-under-check.js')
        failed = run_page(web, [], file_suite(app), labels=(None, '1-4. Import checks, conformance suite and speed budgets'))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if failed is None or failed:
        print(f'\n{path.name} failed {failed or "its"} check(s).')
        return 1
    print(f'\n{path.name} passed every check: import it in Settings → Plugins → Import plugin…')
    return 0


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith('--')]
    out: Path | None = ROOT / 'packed'
    if '--out' in argv:
        i = argv.index('--out')
        if i + 1 >= len(argv):
            print('--out needs a folder')
            return 2
        out = Path(argv[i + 1]).resolve()
        args = [a for a in args if a != argv[i + 1]]
    if '--no-pack' in argv:
        out = None
    if len(args) != 1:
        print('Usage: python build.py check <id> [--out folder] [--no-pack]   (default folder: packed/)\n'
              '       python build.py check <file>.traumplug                  (a packed plugin made anywhere)')
        return 2
    if args[0].endswith('.traumplug'):
        return check_file(Path(args[0]).resolve())
    return check(args[0], out)
