// Reading notes (app/optional/extra/reading/) through the plugin API, on a host: the sample
// library laid out as columns, a note kept after the chosen one landing in its source as one step,
// a new source with a unique citation key, the Details edits kept in the source's own fields and
// carried by a .traum file, a new library seen as Library, and a 1,500-note library laid out quickly.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(file) {
  try { return await import(new URL(`../../../optional/extra/reading/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../reading/${file}`, import.meta.url).href); }
}
const R = await load('Reading.js');
const X = await load('rules.js');
const D = await load('docks.js');
const S = await load('tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  let api = null;
  const { t, off } = host.plug('reading', (tt) => { api = R.install(tt); }, { api: 3 });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('reading').find((a) => a.slot === 'world.ontologies' && a.item.id === X.RULE).item;
  const measure = (text, width) => t.ui.measure(text, width);
  const lay = () => X.layout(t, s.room, measure);
  return { host, t, off, api, s, rule, lay };
}

test('reading: the sample library is four sources, each a column of its notes, Darwin first', () => {
  const { t, s, lay } = setUp();
  const L = lay();
  assert.deepEqual(L.columns.map((c) => t.marks.get(c.source).citekey), ['darwin1859origin', 'mill1859liberty', 'thoreau1854walden', 'wollstonecraft1792vindication']);
  assert.equal(L.rows.length, s.notes.length, 'every note placed');
  assert.deepEqual(X.notesOf(t, s.sources[0]), s.notes.slice(0, 3), 'in stream order');
});

test('reading: a note kept after the chosen one lands right after it, in its source, as one step', () => {
  const { host, t, s, rule, lay } = setUp();
  const [darwin] = s.sources;
  const [first] = X.notesOf(t, darwin);
  host.choose(s.room, first);
  const row = lay().rows.find((r) => r.mark === first);
  const th = host.lib.model.create(host.w, s.room, { kind: 'line', text: 'A new note.' }, host.tick());
  rule.land(host.w, s.room, th.id, row.x, row.y);
  host.world.save();
  assert.deepEqual(X.notesOf(t, darwin).slice(0, 2), [first, th.id]);
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.ok(!t.marks.get(th.id), 'one Ctrl+Z takes the note and its place back together');
});

test('reading: with no note under it, a note lands at the end of the open source', () => {
  const { host, t, s, rule, api } = setUp();
  const mill = s.sources[1];
  api.open(mill, { go: false });
  const th = host.lib.model.create(host.w, s.room, { kind: 'line', text: 'Another.' }, host.tick());
  rule.land(host.w, s.room, th.id, 0, -5000);
  host.world.save();
  assert.equal(X.notesOf(t, mill).at(-1), th.id);
});

test('reading: New source makes a source with a unique key, open; Details edits keep its fields', () => {
  const { host, t, s, api } = setUp();
  const a = api.newSource(), b = api.newSource();
  assert.ok(a && b, 'made');
  assert.equal(t.marks.get(a).citekey, 'anonnduntitled');
  assert.equal(t.marks.get(b).citekey, 'anonnduntitleda');
  assert.equal(api.openOf(s.room), b, 'the new one is open');
  const e = D.editFor(t.marks.get(a), 'authors', 'Darwin, Charles', X.keysIn(t, s.room, a));
  assert.ok(t.marks.edit(a, e.fields).ok);
  assert.ok(t.marks.edit(a, D.editFor(t.marks.get(a), 'year', '1871', X.keysIn(t, s.room, a)).fields).ok);
  assert.ok(t.marks.edit(a, D.editFor(t.marks.get(a), 'title', 'The Descent of Man', X.keysIn(t, s.room, a)).fields).ok);
  const src = t.marks.get(a);
  assert.deepEqual(src.authors, ['Darwin, Charles']);
  assert.equal(src.year, '1871');
  assert.equal(src.title, 'The Descent of Man');
  assert.equal(src.citekey, 'darwin1871descent', 'the key it was given follows');
  // Carried by a .traum file: read back into a new room, the fields are there.
  const text = t.carriers.text(s.room);
  const got = t.carriers.read(text);
  const out = t.carriers.land(got);
  assert.ok(out.ok);
  const back = t.marks.in(out.id).find((m) => m.citekey === 'darwin1871descent');
  assert.ok(back && back.year === '1871' && back.authors?.[0] === 'Darwin, Charles');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('reading: New library is a room seen as Library', () => {
  const { t, api } = setUp();
  const id = api.newLibrary();
  assert.ok(id);
  assert.equal(t.marks.get(id).mode, X.RULE);
});

test('reading: switched off and on, nothing of the library is lost', () => {
  const { host, t, off, s } = setUp();
  const before = JSON.stringify(t.carriers.tables(s.room));
  off();
  host.plug('reading', (tt) => R.install(tt), { api: 3 });
  assert.equal(JSON.stringify(host.world.carriers.tables(s.room)), before);
});

// The first layout measures every note's words (t.ui.measure, remembered after): it is part of
// the room opening (0.8 s, tests/speed.mjs). Each layout after a change, as at every Enter, is held
// to the API's 50 ms.
test('reading: a library of 1,500 notes in 20 sources: laid out again in under 50 ms after a note is kept', () => {
  const { host, t } = setUp();
  const r = host.lib.model.addRoom(host.w, 'Big', host.tick(), {}, X.RULE);
  const srcs = Array.from({ length: 20 }, (_, i) => host.lib.model.create(host.w, r.id, { kind: 'group', of: X.SOURCE, family: true, x: 0, y: 0, title: `Source ${i}`, citekey: `k${String(i).padStart(2, '0')}` }, host.tick()).id);
  for (let i = 0; i < 1500; i++) {
    const th = host.lib.model.create(host.w, r.id, { kind: 'line', text: `note ${i} ${'word '.repeat(i % 30)}` }, host.tick());
    host.lib.model.join(host.w, srcs[i % 20], th.id);
  }
  host.world.save();
  const t0 = performance.now();
  assert.equal(t.rules.layout(X.RULE, r.id).length, 1500);
  const cold = performance.now() - t0;
  assert.ok(cold < 400, `first laid out (every note measured) in ${cold.toFixed(1)} ms`);
  const th = host.lib.model.create(host.w, r.id, { kind: 'line', text: 'One more note, kept with Enter.' }, host.tick());
  host.lib.model.join(host.w, srcs[3], th.id);
  host.world.save();
  const t1 = performance.now();
  assert.equal(t.rules.layout(X.RULE, r.id).length, 1501);
  const again = performance.now() - t1;
  assert.ok(again < 50, `laid out again in ${again.toFixed(1)} ms`);
});
