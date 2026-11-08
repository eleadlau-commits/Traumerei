// Tests for the file law (Law 8: the file is the tables). The gate of kernel phase 6 with
// distance.test.js: the whole world goes out as traum/3 text and comes back as the same six
// tables with no plugin loaded; a room goes out, lands in another world and comes out as the same
// file, its history with it; a file written by hand from FORMAT.md loads; edited text is written
// back over a room or a group; anything that is not a row is reported, not kept.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as L from '../links.js';
import * as P from '../places.js';
import * as G from '../gaps.js';
import * as D from '../distance.js';
import * as M from '../moments.js';
import * as T from '../tables.js';
import * as X from '../traum.js';
import { fold } from '../groups.js';

const { emptyWorld, create, join, addRoom, lock, setRoomSetting, landTables, replaceTables, tablesOf } = model;
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));

// A room with everything the tables can say: words of every sort, a kind no plugin knows, groups,
// a fold, a relation, rule rows, gaps open and resolved, a reader, settings and a look.
function rich() {
  const w = emptyWorld(1000);
  const r = addRoom(w, 'Linear algebra', 2000);
  model.update(w, r.id, { tint: '#7a5c3e', tags: ['maths', 'book'], desc: 'A book where each chapter abstracts the last' }, 2050);
  setRoomSetting(w, r.id, 'russell', 'relations', ['forgets', 'is a case of']);
  w.views[r.id] = { mode: 'russell', x: 0, y: 0, zoom: 1 };
  const a = create(w, r.id, { kind: 'line', text: 'A vector is a list of numbers.' }, 3000);
  const b = create(w, r.id, { kind: 'passage', title: 'Why arrays', text: 'A passage keeps its paragraphs,\n\n# even one like this\n\\ and this | too' }, 3100);
  const c = create(w, r.id, { kind: 'line', text: 'true' }, 3200);
  const d = create(w, r.id, { kind: 'line', text: 'A matrix is a grid of numbers.' }, 3300);
  w.things.pdf1 = { id: 'pdf1', kind: 'pdf-page', at: 3400, title: 'Chapter 2', page: 12, src: 'data:application/pdf;base64,AAAA' };
  P.setHome(w, 'pdf1', r.id);
  const g = create(w, r.id, { kind: 'group', of: 'russell', title: 'Arrays' }, 3500);
  join(w, g.id, a.id); join(w, g.id, b.id);
  const h = create(w, r.id, { kind: 'group', of: 'russell', title: 'Matrices' }, 3600);
  join(w, h.id, d.id);
  L.set(w, L.relId('russell', g.id, h.id), { from: g.id, to: h.id, kind: 'relation', rule: 'russell', label: 'forgets', note: 'the individual | equations' });
  P.putSpot(w, r.id, c.id, 'pessoa', { x: 120, y: -40.5 });
  P.putSpot(w, r.id, g.id, 'russell', { x: 10, y: 20, hand: true });
  const f = fold(w, r.id, [c.id, 'pdf1'], 3700);
  G.open(w, a.id, 'from world', 3800);
  G.open(w, d.id, 'to world', 3900);
  G.resolve(w, d.id, L.partId(h.id, d.id), 4000);
  const locked = addRoom(w, 'Vault', 4100);
  create(w, locked.id, { kind: 'line', text: 'kept' }, 4150);
  lock(w, locked.id);
  return { w, r, a, b, c, d, g, h, f, locked };
}

test('Law 8: the whole world goes out as text and comes back as the same six tables, no plugin loaded', () => {
  const { w } = rich();
  const tables = tablesOf(w);
  assert.deepEqual(T.NAMES, ['marks', 'places', 'links', 'distance', 'gaps', 'moments']);
  const text = X.write(tables, { ids: 'real' });
  assert.match(text, /^---\nformat: traum\/3\n/);
  const back = X.read(text);
  assert.deepEqual(back.report, []);
  const rowsOf = (list) => list.map((r) => JSON.stringify(Object.fromEntries(Object.entries(r).sort()), (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v))).sort();
  for (const t of T.NAMES) assert.deepEqual(rowsOf(back.tables[t]), rowsOf(tables[t]), t);
  assert.equal(X.write(back.tables, { ids: 'real' }), text, 'and the text is the same again');
  // the tables say everything the world holds that is not the screen's
  const fresh = emptyWorld(1000);
  for (const id of Object.keys(fresh.things)) delete fresh.things[id];
  fresh.places = {};
  T.write(fresh, back.tables, Object.fromEntries(back.tables.marks.map((m) => [m.id, m.id])));
  const strip = (s) => { const o = JSON.parse(JSON.stringify(s)); delete o.own; return o; };
  assert.ok(M.same(strip(M.stateOf(fresh)), strip(M.stateOf(w))));
});

test('a mark row is a body { kind, content } and its material; a room\'s settings and mode ride in its content', () => {
  const { w, r, b } = rich();
  const marks = tablesOf(w, r.id).marks;
  const room = marks.find((m) => m.id === r.id), p = marks.find((m) => m.id === b.id);
  assert.deepEqual(room.body.kind, 'room');
  assert.deepEqual(room.body.content.rules, { russell: { relations: ['forgets', 'is a case of'] } });
  assert.equal(room.body.content.mode, 'russell');
  assert.deepEqual(room.material, { size: 1, tint: '#7a5c3e' });
  assert.deepEqual(p.body, { kind: 'passage', content: { title: 'Why arrays', text: 'A passage keeps its paragraphs,\n\n# even one like this\n\\ and this | too' } });
  assert.equal(p.at, 3100);
  assert.ok(marks.find((m) => m.id === 'pdf1').body.content.page === 12, 'a kind no plugin knows keeps every field');
});

test('a room goes out, lands in another world, and comes out as the same file, its history with it', () => {
  const { w, r, a } = rich();
  const log = M.emptyLog(1000);
  M.record(log, { things: {}, links: {}, places: {}, gaps: {}, distance: {}, own: {} }, state(w), 5000);
  M.visit(log, r.id, 6000);
  const text = X.write(tablesOf(w, r.id, { log }), { root: r.id });
  assert.match(text, /\ncontext: \^1\n/);
  assert.match(text, /\n## \^1 room: Linear algebra\n/);
  assert.match(text, /\n# Moments\n/);
  assert.ok(!/Vault/.test(text), 'only the room');
  const got = X.read(text);
  assert.deepEqual(got.report, []);
  const other = emptyWorld(1000);
  const otherLog = M.emptyLog(1000, state(other));
  const before = state(other);
  const out = landTables(other, got.tables, got.root, { page: 0, now: 7000 });
  assert.ok(out.id && !out.why);
  M.record(otherLog, before, state(other), 7000);
  M.tell(otherLog, out.told);
  assert.equal(model.room(other, out.id).name, 'Linear algebra');
  assert.equal(other.views[out.id].mode, 'russell');
  assert.equal(P.home(other, out.id), 'floor:0');
  const again = X.write(tablesOf(other, out.id, { log: otherLog }), { root: out.id });
  assert.equal(again, text, again.split('\n').filter((l, i) => l !== text.split('\n')[i]).slice(0, 4).join(' ¶ ') + ' vs ' + text.split('\n').filter((l, i) => l !== again.split('\n')[i]).slice(0, 4).join(' ¶ '));
  assert.ok(!other.things[a.id], 'with ids of its own');
  // and once more, poured into a room that is there: the file's room gives only what is in it
  const into = addRoom(other, 'Elsewhere', 8000);
  const poured = landTables(other, got.tables, got.root, { into: into.id });
  assert.equal(poured.id, into.id);
  assert.equal(model.room(other, into.id).name, 'Elsewhere');
  assert.equal(model.roomItems(other, into.id).length, model.roomItems(other, out.id).length);
  assert.equal(landTables(other, got.tables, got.root, { into: 'nowhere' }).why, 'The room is locked, or not there.');
});

// What FORMAT.md shows, written by hand: short ids, bare keys, a kind no plugin knows, a line not
// understood. It loads with nothing but the core.
const BY_HAND = `---
format: traum/3
context: ^room
---

# Marks

## ^room room: Things to finish
mode: pessoa
tags: [home]
material.tint: "#3e5c7a"

## ^1 line
Fix the bike

## ^2 line
Call the bank

## ^list group: This week
of: joyce

## ^3 passage: Why
Because the spring comes.

## ^4 sketch: A plan
strokes: [[0, 0], [10, 10]]

# Places
^1 in ^room
^2 in ^room
^3 in ^room | rule: pessoa | at: {x: 40, y: 80}
^list in ^room
^4 in ^room

# Links
^1 part of ^list | order: 0
^2 part of ^list | order: 1

# Distance
^room for me later

# Gaps
^1 open from world | opened: 2026-11-08T09:00:00Z
^2 resolved from world | opened: 2026-11-08T09:00:00Z | resolved: 2026-11-08T12:00:00Z

# Moments
2026-11-01T08:00:00Z made ^1

# Wishes
a line that is not a table
`;

test('a file written by hand from FORMAT.md loads with no plugin on', () => {
  const got = X.read(BY_HAND);
  assert.equal(got.root, 'room');
  assert.deepEqual(got.report, ['Line 49: not a table: # Wishes', 'Line 50: outside every table: a line that is not a table']);
  const w = emptyWorld(1000);
  const out = landTables(w, got.tables, got.root, { now: 9000 });
  const r = model.room(w, out.id);
  assert.equal(r.name, 'Things to finish');
  assert.equal(r.tint, '#3e5c7a');
  assert.equal(w.views[r.id].mode, 'pessoa');
  const [one, two] = [out.ids['1'], out.ids['2']];
  assert.deepEqual(model.memberIds(w, out.ids.list), [one, two]);
  assert.equal(model.thoughtText(w, w.things[one]), 'Fix the bike');
  assert.equal(w.things[out.ids['3']].text, 'Because the spring comes.');
  assert.deepEqual(P.spot(w, r.id, out.ids['3'], 'pessoa'), { x: 40, y: 80 });
  assert.deepEqual(w.things[out.ids['4']].strokes, [[0, 0], [10, 10]], 'a kind no plugin knows comes in as it is');
  assert.equal(D.of(w, one), 'me later');
  assert.ok(G.isOpen(w, one) && G.get(w, two).state === 'resolved' && G.get(w, two).resolvedBy === 'judgement');
  assert.deepEqual(out.told, [{ time: Date.parse('2026-11-01T08:00:00Z'), kind: 'made', mark: one }]);
});

test('edited text with the world\'s ids is written back over its room: kept, changed, gone and new', () => {
  const { w, r, a, c, d } = rich();
  const text = X.write(tablesOf(w, r.id), { root: r.id, ids: 'real' });
  const edited = text
    .replace('A vector is a list of numbers.', 'A vector is an arrow.')
    .replace(new RegExp(`## \\^${d.id} line\\n[^#]*`), '')
    .replace('# Places\n', `# Places\n^new1 in ^${r.id}\n`)
    .replace('# Places', '## ^new1 line\nA new thought.\n\n# Places');
  const before = state(w);
  const out = replaceTables(w, r.id, X.read(edited).tables, r.id);
  assert.ok(out.ids, out.why);
  assert.equal(w.things[a.id].text, 'A vector is an arrow.');
  assert.ok(!w.things[d.id] && !G.get(w, d.id), 'gone, with its gap');
  assert.equal(w.things.new1.text, 'A new thought.');
  assert.equal(P.home(w, 'new1'), r.id);
  assert.ok(w.things[c.id], 'a folded-away mark stays folded');
  const rows = M.diff(before, state(w));
  assert.ok(rows.some((x) => x.kind === 'edited' && x.mark === a.id) && rows.some((x) => x.kind === 'removed' && x.mark === d.id));
  assert.ok(!rows.some((x) => x.mark === c.id), 'what was not touched did not change');
  assert.equal(replaceTables(w, r.id, X.read(edited.replace(`## ^${r.id} room`, '## ^zz room')).tables, r.id).why, 'The text no longer has its own heading, so nothing was changed.');
});

test('a group with its parts as text, and back: its parts change, the rest of the room does not', () => {
  const { w, r, g, a, b, d } = rich();
  const t = tablesOf(w, g.id);
  assert.deepEqual(t.marks.map((m) => m.id).sort(), [a.id, b.id, g.id].sort());
  const text = X.write(t, { root: g.id, ids: 'real' });
  assert.ok(text.includes(`^${a.id} in ^${r.id}`), 'its places name the room it sits in');
  const out = replaceTables(w, g.id, X.read(text.replace('A vector is a list of numbers.', 'Vectors.')).tables, g.id);
  assert.ok(out.ids, out.why);
  assert.equal(w.things[a.id].text, 'Vectors.');
  assert.equal(P.home(w, a.id), r.id);
  assert.deepEqual(model.memberIds(w, g.id), [a.id, b.id]);
  assert.ok(w.things[d.id] && L.has(w, L.relId('russell', g.id, model.groupOf(w, d.id, 'russell').id)), 'the relation to the next chapter stays');
});

test('values go out and back as themselves: words like true and 12, bars, quotes, empty, many lines', () => {
  for (const v of ['true', '12', 'a | b', '"quoted"', '', ' padded ', '#hash', 'line\nline', null, 0, false, [1, 'x'], { x: 1 }]) {
    assert.deepEqual(X.parse(X.value(v)), v, JSON.stringify(v));
  }
  const w = emptyWorld(1000);
  const r = addRoom(w, 'R', 2000);
  for (const text of ['12', 'true', 'key: value', '  spaced  ', '\\#not a heading', '## ^9 line']) create(w, r.id, { kind: 'line', text }, 3000);
  const t = tablesOf(w, r.id);
  const back = X.read(X.write(t, { root: r.id }));
  assert.deepEqual(back.tables.marks.map((m) => m.body.content.text).sort(), t.marks.map((m) => m.body.content.text).sort());
});

test('not traum/3 is not read', () => {
  assert.equal(X.read('---\nformat: room/2\n---\n'), null);
  assert.equal(X.read('# just markdown'), null);
});
