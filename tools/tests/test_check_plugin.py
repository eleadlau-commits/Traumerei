"""`python build.py check <id>` and `check <file>.traumplug` (tools/check_plugin.py), and the
skill's no-repo packer (.claude/skills/traumerei-plugin/scripts/traumplug.py)."""

import contextlib
import importlib.util
import io
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from tools import check_plugin

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / 'folio' / 'compiler'))
import folioc  # noqa: E402

BROWSER = folioc.find_browser()


def quiet(fn, *args):
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        code = fn(*args)
    return code, out.getvalue()


def skill_packer():
    path = ROOT / '.claude' / 'skills' / 'traumerei-plugin' / 'scripts' / 'traumplug.py'
    spec = importlib.util.spec_from_file_location('traumplug', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class CheckPluginTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_usage_and_a_plugin_that_is_not_there(self):
        self.assertEqual(quiet(check_plugin.main, [])[0], 2)
        code, said = quiet(check_plugin.main, ['no-such-plugin', '--no-pack'])
        self.assertEqual(code, 1)
        self.assertIn('No plugin app/optional/starter/no-such-plugin/', said)

    @unittest.skipUnless(BROWSER, 'needs Chrome or Edge')
    def test_a_corpus_plugin_passes_and_is_packed(self):
        code, said = quiet(check_plugin.main, ['grid', '--out', str(self.tmp)])
        self.assertEqual(code, 0, said)
        self.assertIn('3-4. Conformance suite and speed budgets: 3 of 3 passed', said)
        self.assertTrue((self.tmp / 'grid.traumplug').is_file())

    @unittest.skipUnless(BROWSER, 'needs Chrome or Edge')
    def test_a_file_packed_without_the_repo_passes_the_same_checks(self):
        path = skill_packer().pack(ROOT / 'app' / 'plugins' / 'highlighter', self.tmp)
        code, said = quiet(check_plugin.main, [str(path)])
        self.assertEqual(code, 0, said)
        self.assertIn('passed every check', said)

    def test_the_skills_examples_are_the_corpus_plugins_as_they_are(self):
        examples = ROOT / '.claude' / 'skills' / 'traumerei-plugin' / 'examples'
        for f in sorted(p for p in examples.rglob('*') if p.is_file()):
            twin = ROOT / 'app' / 'plugins' / f.relative_to(examples)
            self.assertTrue(twin.is_file(), f'{f.relative_to(ROOT)} has no plugin file beside it')
            self.assertEqual(f.read_bytes(), twin.read_bytes(), f'{f.relative_to(ROOT)} differs from app/plugins: copy it again')

    def test_the_packer_refuses_what_the_app_would(self):
        packer = skill_packer()
        folder = self.tmp / 'odd-one'
        folder.mkdir()
        (folder / 'feature.json').write_text('{"name": "Odd", "main": "Odd.js", "requires": ["api"], '
                                             '"plugin": {"api": 3, "minApp": "1.1.2", "kind": ["widget"]}}', 'utf-8')
        (folder / 'Odd.js').write_text("import { Feature } from 'folio';\nexport default class Odd extends Feature {}\n", 'utf-8')
        with self.assertRaisesRegex(packer.Problem, 'widget'):
            packer.pack(folder, self.tmp)
        (folder / 'feature.json').write_text('{"name": "Odd", "main": "Odd.js", "requires": ["api"], '
                                             '"plugin": {"api": 3, "minApp": "1.1.2", "kind": ["tool"]}}', 'utf-8')
        (folder / 'Odd.js').write_text("import { Feature } from 'folio';\nimport x from 'lodash';\nexport default class Odd extends Feature {}\n", 'utf-8')
        with self.assertRaisesRegex(packer.Problem, 'bare import'):
            packer.pack(folder, self.tmp)

    def test_the_packer_keeps_each_file_in_its_own_scope(self):
        # core-gaps.md gap 9: the same top-level name in two files packs and runs, as with the repo's packer.
        packer = skill_packer()
        folder = self.tmp / 'two-files'
        folder.mkdir()
        (folder / 'feature.json').write_text('{"name": "Two", "main": "Two.js", "requires": ["api"], '
                                             '"plugin": {"api": 3, "minApp": "1.1.2", "kind": ["tool"]}}', 'utf-8')
        (folder / 'parts.js').write_text("import { ui } from 'folio';\nconst { el } = ui;\nexport const part = () => el('part');\n", 'utf-8')
        (folder / 'Two.js').write_text("import { Feature, ui } from 'folio';\nimport { part as p } from './parts.js';\nconst { el } = ui;\n"
                                       "export default class Two extends Feature { both() { return [p(), el('main')]; } }\n", 'utf-8')
        path = packer.pack(folder, self.tmp)
        node = shutil.which('node')
        if node:
            probe = self.tmp / 'probe.mjs'
            probe.write_text(path.read_text('utf-8'), 'utf-8')
            run = __import__('subprocess').run([node, '--input-type=module', '-e',
                f"const m = await import({str(probe.as_uri())!r}); class Feature {{}}; const C = m.default({{ Feature, ui: {{ el: (t) => t }} }});"
                " console.log(JSON.stringify(new C().both()));"], capture_output=True, text=True)
            self.assertEqual(run.stdout.strip(), '["part","main"]', run.stderr)
        (folder / 'Two.js').write_text("import { Feature } from 'folio';\nimport { nothing } from './parts.js';\nexport default class Two extends Feature {}\n", 'utf-8')
        with self.assertRaisesRegex(packer.Problem, 'exports no "nothing"'):
            packer.pack(folder, self.tmp)


if __name__ == '__main__':
    unittest.main()
