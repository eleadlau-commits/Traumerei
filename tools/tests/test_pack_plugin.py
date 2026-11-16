import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from tools import pack_plugin

# Loads a package the way the app does (a module, no bare imports), with a stand-in folio, and
# prints what it found.
LOAD = r"""
const path = process.argv[process.argv.length - 1];
const text = require('fs').readFileSync(path, 'utf8');
class Feature { use() { return null; } }
const folio = { App: class {}, Feature, ui: { el: () => null }, time: {}, VERSION: '0' };
import('data:text/javascript;base64,' + Buffer.from(text).toString('base64')).then(m => {
  const Plugin = m.default(folio);
  console.log(JSON.stringify({ id: m.manifest.id, format: m.manifest.format, css: m.css.length,
    isFeature: Plugin.prototype instanceof Feature, name: Plugin.name, bare: /from\s*['"]folio['"]/.test(text) }));
});
"""


class PackPluginTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def test_desk_packs_into_one_loadable_file(self):
        path = pack_plugin.pack('desk', self.tmp)
        self.assertEqual(path.name, 'desk.traumplug')
        out = subprocess.run(['node', '-e', LOAD, str(path)], check=True, capture_output=True, text=True).stdout
        got = json.loads(out)
        self.assertEqual(got['id'], 'desk')
        self.assertEqual(got['format'], 'traumplug/1')
        self.assertTrue(got['isFeature'])
        self.assertGreater(got['css'], 0)
        self.assertFalse(got['bare'])

    def test_manifest_passes_the_plugin_block_through(self):
        m = pack_plugin.manifest_of(pack_plugin.ROOT / 'app' / 'optional' / 'starter' / 'desk', 'desk')
        block = json.loads((pack_plugin.ROOT / 'app/optional/starter/desk/feature.json').read_text('utf-8'))['plugin']
        self.assertEqual(m['plugin'], block)
        self.assertEqual(m['requires'], ['api'])

    def test_the_starter_set_is_what_app_optional_starter_holds(self):
        root = self.tmp / 'repo'
        for where, pid in (('optional/starter', 'aa'), ('optional/starter', 'bb'), ('optional/extra', 'cc')):
            d = root / 'app' / where / pid
            d.mkdir(parents=True)
            (d / 'feature.json').write_text(json.dumps({'name': pid, 'plugin': {'api': 3}}), 'utf-8')
            (d / 'index.js').write_text('export default class {}\n', 'utf-8')
        paths = pack_plugin.pack_all(self.tmp / 'out', root)
        self.assertEqual([p.name for p in paths], ['aa.traumplug', 'bb.traumplug', 'cc.traumplug', 'starter-set.traumplug'])
        ids = [json.loads(t.split('export const manifest = ', 1)[1].split(';\n', 1)[0])['id']
               for t in json.loads(paths[-1].read_text('utf-8'))['plugins']]
        self.assertEqual(ids, ['aa', 'bb'])

    def test_a_core_feature_is_not_a_plugin(self):
        with self.assertRaises(SystemExit):
            pack_plugin.pack('world', self.tmp)


if __name__ == '__main__':
    unittest.main()
