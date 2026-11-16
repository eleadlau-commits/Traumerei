import json
import unittest
from pathlib import Path

from tools.corpus import CORPUS

ROOT = Path(__file__).resolve().parents[2]


class CorpusTest(unittest.TestCase):
    def test_every_corpus_plugin_is_there_starts_off_and_is_listed_in_the_doc(self):
        doc = (ROOT / 'docs' / 'CORPUS.md').read_text('utf-8')
        for pid in CORPUS:
            manifest = json.loads((ROOT / 'app' / 'plugins' / pid / 'feature.json').read_text('utf-8'))
            self.assertEqual(manifest['plugin'].get('starts'), 'off', pid)
            self.assertIn(f'`{pid}`', doc, pid)

    def test_every_plugin_that_starts_off_is_corpus(self):
        off = {p.parent.name for p in (ROOT / 'app' / 'plugins').glob('*/feature.json')
               if json.loads(p.read_text('utf-8'))['plugin'].get('starts') == 'off'}
        self.assertEqual(off, set(CORPUS))

    def test_only_corpus_plugins_are_built_in(self):
        from tools.corpus import LEFT_OUT, APART, ROOM_TYPES, plugins
        self.assertEqual(set(plugins()) - set(LEFT_OUT), set(ROOM_TYPES))
        for pid in ('book', 'provoke', 'home', 'search', 'gaps', 'returns', 'desk', 'export'):
            self.assertIn(pid, APART)
        self.assertFalse(set(APART) & set(CORPUS))

    def test_a_build_that_carries_a_plugin_outside_the_corpus_is_refused(self):
        import standalone
        ok = [{'id': 'world'}, {'id': 'russell', 'plugin': {}}]
        self.assertEqual(standalone.built_in_strays(ok), [])
        self.assertEqual(standalone.built_in_strays(ok + [{'id': 'book', 'plugin': {}}]), ['book'])

    def test_new_plugin_joins_the_corpus_only_when_asked(self):
        import tempfile, shutil
        from tools import new_plugin
        tmp = Path(tempfile.mkdtemp())
        try:
            (tmp / 'tools').mkdir()
            shutil.copy(ROOT / 'tools' / 'corpus.py', tmp / 'tools' / 'corpus.py')
            (tmp / 'app' / 'plugins' / 'haiku').mkdir(parents=True)
            (tmp / 'app' / 'plugins' / 'haiku' / 'feature.json').write_text(json.dumps({'plugin': {'api': 2}}), 'utf-8')
            new_plugin.join_corpus('haiku', tmp)
            self.assertIn("    'haiku',\n)", (tmp / 'tools' / 'corpus.py').read_text('utf-8'))
            self.assertEqual(json.loads((tmp / 'app' / 'plugins' / 'haiku' / 'feature.json').read_text('utf-8'))['plugin']['starts'], 'off')
        finally:
            shutil.rmtree(tmp)

    def test_every_plugin_shipped_apart_packs(self):
        import tempfile, shutil
        from tools import pack_plugin
        from tools.corpus import APART
        tmp = Path(tempfile.mkdtemp())
        try:
            paths = pack_plugin.pack_all(tmp)
            self.assertEqual([p.stem for p in paths], [*APART, 'starter-set'])
            starter = json.loads(paths[-1].read_text('utf-8'))
            self.assertEqual(starter['format'], 'traumset/1')
            self.assertEqual(len(starter['plugins']), len(APART) - 2)  # all but Provoke and Book
            self.assertFalse(any('"id": "provoke"' in p for p in starter['plugins']))
            self.assertFalse(any('"id": "book"' in p for p in starter['plugins']), 'Book ships on its own')
            self.assertIn('book', [p.stem for p in paths])
        finally:
            shutil.rmtree(tmp)


if __name__ == '__main__':
    unittest.main()
