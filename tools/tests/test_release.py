import shutil
import tempfile
import unittest
from pathlib import Path

from tools import release

ROOT = Path(__file__).resolve().parents[2]


class ReleaseTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        for rel in ('app/app.json', 'desktop/src-tauri/tauri.conf.json', 'desktop/src-tauri/Cargo.toml'):
            (self.tmp / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(ROOT / rel, self.tmp / rel)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_the_repo_agrees_with_itself(self):
        self.assertEqual(len(set(release.versions().values())), 1)

    def test_write_sets_all_three_and_check_holds(self):
        release.write('9.8.7', self.tmp)
        self.assertEqual(set(release.versions(self.tmp).values()), {'9.8.7'})
        self.assertEqual(release.check('v9.8.7', self.tmp), '')
        self.assertIn('9.8.6', release.check('v9.8.6', self.tmp))

    def test_write_leaves_the_rest_alone(self):
        cargo = self.tmp / 'desktop/src-tauri/Cargo.toml'
        before = cargo.read_text('utf-8')
        release.write('2.0.0', self.tmp)
        after = cargo.read_text('utf-8')
        self.assertEqual(before.count('version = "2"'), after.count('version = "2"'))

    def test_one_identifier(self):
        import json
        app = json.loads((ROOT / 'app/app.json').read_text('utf-8'))['native']['appId']
        conf = json.loads((ROOT / 'desktop/src-tauri/tauri.conf.json').read_text('utf-8'))['identifier']
        self.assertEqual(app, conf)


if __name__ == '__main__':
    unittest.main()
