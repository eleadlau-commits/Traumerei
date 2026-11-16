// Imported plugins (imported.js): a .traumplug from `python build.py pack-plugin` is read as a
// module, checked as the compiler would check it, and its class holds one way in at run time.
// The fixture is the Desk plugin, packed.

import { test, assert } from 'folio/testing';
import { Feature, ui, time, VERSION } from 'folio';
import { problem, loadModule, entry, oneWayIn, card, FORMAT, readSet, SET_FORMAT } from '../imported.js';

const APP = { version: '1.0.1', pluginApi: 2, pluginKinds: { command: 'commands', view: 'a view' }, pluginNeeds: { files: 'opens and saves files' } };
const fixture = async () => {
  const url = new URL('./fixtures/desk.traumplug', import.meta.url);
  if (url.protocol === 'file:') return (await import('node:fs')).readFileSync(url, 'utf8');
  return (await fetch(url)).text();
};
// The fixture as another plugin, so it doesn't collide with the built-in Desk.
const renamed = async (edit = (m) => m) => {
  const text = await fixture();
  return text.replace(/export const manifest = (\{.*\});/, (_, json) => `export const manifest = ${JSON.stringify(edit({ ...JSON.parse(json), id: 'desk-copy' }))};`);
};

test('imported: a packed plugin loads as a module whose factory gives a Feature', async () => {
  const mod = await loadModule(await renamed());
  assert.equal(mod.manifest.format, FORMAT);
  assert.equal(mod.manifest.id, 'desk-copy');
  assert.ok(mod.css.includes('.desk'));
  const Plugin = mod.default({ Feature, ui, time, VERSION });
  assert.ok(Plugin.prototype instanceof Feature);
  assert.equal(problem(mod, await renamed(), APP), '');
});

test('imported: the compiler\'s checks run again at import', async () => {
  const check = async (edit, taken = () => false) => { const text = await renamed(edit); return problem(await loadModule(text), text, APP, taken); };
  assert.match(await check((m) => m), /^$/);
  assert.match(await check((m) => m, (id) => id === 'desk-copy'), /already here/);
  assert.match(await check((m) => ({ ...m, format: 'traumplug/9' })), /format this app doesn't read/);
  assert.match(await check((m) => ({ ...m, plugin: { ...m.plugin, api: 3 } })), /plugin API 3/);
  assert.match(await check((m) => ({ ...m, plugin: { ...m.plugin, minApp: '9.0.0' } })), /needs Träumerei 9\.0\.0/);
  assert.match(await check((m) => ({ ...m, plugin: { ...m.plugin, kind: ['mode'] } })), /adds "mode"/);
  assert.match(await check((m) => ({ ...m, plugin: { ...m.plugin, needs: ['sidecar'] } })), /needs "sidecar"/);
  assert.match(await check((m) => ({ ...m, requires: ['api', 'world'] })), /feature "world"/);
  assert.match(await check((m) => ({ ...m, id: 'Desk Copy' })), /lowercase/);
  const sneaky = (await renamed()).replace(/this\.use\(["']traumerei["']\)/, 'this.use("world")');
  assert.match(problem(await loadModule(sneaky), sneaky, APP), /asks for "world"/);
  assert.match(problem({}, '', APP), /no manifest/);
});

test('imported: one way in holds at run time, and the card says what it adds and needs', async () => {
  const seen = [];
  const fake = { storage: { area: () => ({}) }, use: (name) => { seen.push(name); return { name }; } };
  class Base extends Feature {}
  const C = oneWayIn(Base);
  const f = new C(fake, { id: 'x' });
  assert.equal(f.use('world'), null);
  assert.deepEqual(f.use('traumerei'), { name: 'traumerei' });
  assert.deepEqual(seen, ['traumerei']);
  assert.throws(() => f.add('room.views', {}), /only through the plugin API/);
  const e = entry({ id: 'x', name: 'X', requires: ['api'], plugin: { api: 2, minApp: '1.0.0', kind: ['view'] } });
  assert.ok(e.imported && e.plugin.load === 'start' && e.plugin.needs.length === 0);
  const c = card({ id: 'x', name: 'X', version: '1.2.0', plugin: { kind: ['view'], needs: ['files'], author: 'E', sidecar: { program: 'x.exe' } } }, APP);
  assert.equal(c.title, 'X 1.2.0');
  assert.equal(c.adds, 'Adds a view.');
  assert.equal(c.needs, 'It opens and saves files.');
  assert.match(c.sidecar, /x\.exe/);
});

test('imported: a set (the starter set) is JSON with its packages; a single package is no set', async () => {
  const text = await renamed();
  assert.equal(readSet(text), null);
  const set = readSet(JSON.stringify({ format: SET_FORMAT, name: 'Starter set', plugins: [text, 3] }));
  assert.equal(set.name, 'Starter set');
  assert.deepEqual(set.plugins, [text]);
  const refused = (s) => { try { readSet(s); return ''; } catch (err) { return err.message; } };
  assert.ok(refused('{ nope').includes('couldn\'t be read'));
  assert.ok(refused(JSON.stringify({ format: 'traumset/9', plugins: [text] })).includes('traumset/9'));
  assert.ok(refused(JSON.stringify({ format: SET_FORMAT, plugins: [] })).includes('holds no plugins'));
});
