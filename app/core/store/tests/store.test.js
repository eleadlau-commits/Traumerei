// The plugin store (store.js over the memory backend): small state per plugin, files held to a
// quota, and downloads asked for first, written in pieces, and taken away again when they fail.

import { test, assert } from 'folio/testing';
import { makeStore, size } from '../keeper.js';
import { memory } from '../backends.js';

const area = () => { const kept = {}; return { get: (k, d) => (k in kept ? kept[k] : d), set: (k, v) => { if (v == null) delete kept[k]; else kept[k] = v; }, keys: () => Object.keys(kept) }; };
const areas = new Map();
const make = (o = {}) => makeStore({ backend: memory(), area: (id) => { if (!areas.has(id)) areas.set(id, area()); return areas.get(id); }, quota: () => 100, ...o });
// A response whose body comes in the pieces given.
const body = (pieces, status = 200) => ({ ok: status === 200, status, body: { getReader: () => { let i = 0; return { read: async () => (i < pieces.length ? { done: false, value: pieces[i++] } : { done: true }) }; } } });

test('store: small state is each plugin\'s own', () => {
  areas.clear();
  const s = make();
  const a = s.for('alpha'), b = s.for('beta');
  a.set('seen', 3);
  assert.equal(a.get('seen'), 3);
  assert.equal(b.get('seen', 0), 0);
  assert.deepEqual(a.keys(), ['seen']);
  a.remove('seen');
  assert.equal(a.get('seen'), null);
  assert.throws(() => s.for('Not An Id'), /isn't a plugin id/);
});

test('store: files are held to the quota and to plain names', async () => {
  const f = make().for('alpha').files;
  assert.equal(await f.put('a.bin', new Uint8Array(60)), 60);
  assert.equal(await f.append('a.bin', 'abc'), 63);
  await f.put('b.txt', 'hello');
  assert.deepEqual((await f.list()).map((x) => [x.name, x.bytes]), [['a.bin', 63], ['b.txt', 5]]);
  assert.equal(new TextDecoder().decode(await f.get('b.txt')), 'hello');
  let refused = null;
  try { await f.put('c.bin', new Uint8Array(40)); } catch (err) { refused = err.message; }
  assert.match(refused, /over its quota/);
  assert.equal(await f.get('c.bin'), null);
  assert.equal(await f.used(), 68);
  for (const bad of ['../x', '.hidden', 'a/b', '']) { let threw = false; try { await f.get(bad); } catch { threw = true; } assert.ok(threw, bad); }
  await f.clear();
  assert.equal(await f.used(), 0);
  assert.equal(size(274 * 1024 * 1024), '274 MB');
  assert.equal(size(1.25 * 1024 ** 3), '1.3 GB');
});

test('store: a download is asked for with its size, written in pieces, kept once, and taken away when it fails', async () => {
  const asked = [];
  let pieces = [new Uint8Array(30).fill(1), new Uint8Array(20).fill(2)];
  const s = make({ ask: async (o) => { asked.push(o); return true; }, fetcher: async () => body(pieces) });
  const f = s.for('alpha').files;
  const seen = [];
  const r = await f.download('https://example.org/m.bin', 'm.bin', { bytes: 50, label: 'a model', progress: (p) => seen.push(p) });
  assert.ok(r.ok, r.reason);
  assert.deepEqual(asked.map((a) => [a.id, a.label, a.bytes]), [['alpha', 'a model', 50]]);
  assert.equal(seen.at(-1), 1);
  const got = await f.get('m.bin');
  assert.equal(got.length, 50);
  assert.equal(got[49], 2);
  assert.ok((await f.download('https://example.org/m.bin', 'm.bin', { bytes: 50 })).kept, 'there already: not asked again');
  assert.equal(asked.length, 1);
  pieces = [new Uint8Array(10)];
  const short = await f.download('https://example.org/n.bin', 'n.bin', { bytes: 20 });
  assert.match(short.reason, /came to/);
  assert.equal(await f.get('n.bin'), null, 'a failed download leaves nothing');
  assert.match((await f.download('https://example.org/x', 'x', { bytes: 500 })).reason, /more than this plugin may keep/);
  assert.match((await f.download('http://example.org/x', 'x', { bytes: 5 })).reason, /https/);
  const no = make({ ask: async () => false }).for('beta').files;
  assert.equal((await no.download('https://example.org/x', 'x', { bytes: 5 })).reason, 'Not now');
});
