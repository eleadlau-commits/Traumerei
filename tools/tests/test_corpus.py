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

    def test_the_product_keeps_the_real_plugins(self):
        for pid in ('gaps', 'returns', 'desk', 'export', 'provoke', 'home', 'account', 'renderer'):
            self.assertNotIn(pid, CORPUS)


if __name__ == '__main__':
    unittest.main()
