// Tests for the links table (Law 4: links are the only structure). The gate of kernel phase 2:
// no group keeps a list of members; who holds what and what a group holds are served from the
// table's index and agree with the table itself after any run of changes; folds stand for what
// they folded; the log replays links; and a big room's reads stay within budget.

import { test, assert } from 'folio/testing';
import * as P from '../places.js';
import * as model from '../model.js';
import * as groups from '../groups.js';
import * as L from '../links.js';
import * as M from '../moments.js';

const { MESSY, emptyWorld, loadWorld, create, join, leave, remove, move, members, memberIds, groupsOf, isGroup, isLeaf, copyRoom, addRoom, roomItems, groupsIn, children } = model;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));

// What the table says, read the slow way, with no index.
const scanHolders = (w, id) => Object.entries(w.links).filter(([, r]) => r.kind === 'part of' && r.from === id).map(([, r]) => r.to).sort();
const scanParts = (w, g) => Object.entries(w.links).filter(([, r]) => r.kind === 'part of' && r.to === g).sort((a, b) => a[1].order - b[1].order).map(([, r]) => r.from);

// The invariants of Law 4, checked on a world.
function lawFour(w) {
  for (const th of Object.values(w.things)) assert.equal(th.members, undefined, `${th.id} keeps a list of its own`);
  for (const [id, r] of Object.entries(w.links)) {
    assert.ok(w.things[r.from] && w.things[r.to], `${id}: an end is gone`);
    assert.ok(L.KINDS.includes(r.kind), `${id}: no such kind`);
    if (r.kind === 'part of') {
      assert.ok(isGroup(w.things[r.to]), `${id}: a part of what is not a group`);
      assert.equal(model.parentOf(w, r.from), model.parentOf(w, r.to), `${id}: a part in another room`);
      assert.equal(id, L.partId(r.to, r.from));
      assert.ok(!model.holds(w, r.from, r.to), `${id}: a group holds itself`);
    }
    if (r.kind === 'stands for') assert.ok(isLeaf(w.things[r.to]), `${id}: a fold stands for a group`);
  }
  for (const th of Object.values(w.things)) {
    assert.deepEqual([...L.holders(w, th.id)].sort(), scanHolders(w, th.id), `who holds ${th.id}`);
    if (isGroup(th)) assert.deepEqual(memberIds(w, th.id), scanParts(w, th.id), `what ${th.id} holds`);
    if (L.stoodFor(w, th.id)) {
      assert.ok(!children(w, model.parentOf(w, th.id)).some((c) => c.id === th.id), `${th.id} is folded away yet shown`);
      assert.equal(L.holders(w, th.id).length, 0, `${th.id} is folded away yet in a group`);
    }
  }
}

// One random change to the messy room. Returns a word for it.
function step(w, rand, now) {
  const items = roomItems(w, MESSY), gs = groupsIn(w, MESSY);
  const r = rand();
  if (r < 0.25 || items.length < 3) return create(w, MESSY, { kind: 'line', text: `t${Math.floor(rand() * 1e6)}` }, now) ? 'made' : 'nothing';
  if (r < 0.4) return join(w, (gs.length && rand() < 0.7 ? pick(rand, gs) : create(w, MESSY, { kind: 'group', of: rand() < 0.5 ? 'joyce' : 'sets' }, now)).id, pick(rand, items).id) ? 'joined' : 'nothing';
  if (r < 0.5 && gs.length) { const g = pick(rand, gs); const m = memberIds(w, g.id); return m.length ? (leave(w, g.id, pick(rand, m)), 'left') : 'nothing'; }
  if (r < 0.6 && gs.length > 1) { const [a, b] = [pick(rand, gs), pick(rand, gs)]; return a !== b && join(w, a.id, b.id) ? 'nested' : 'nothing'; }
  if (r < 0.7) { const two = [pick(rand, items).id, pick(rand, items).id, ...(rand() < 0.3 && gs.length ? [pick(rand, gs).id] : [])]; return groups.fold(w, MESSY, two, now).why ? 'nothing' : 'folded'; }
  if (r < 0.8) return move(w, pick(rand, items).id, MESSY, Math.floor(rand() * 500), Math.floor(rand() * 500)) ? 'moved' : 'nothing';
  if (r < 0.9) { remove(w, pick(rand, [...items, ...gs]).id); return 'removed'; }
  if (gs.length) { const g = pick(rand, gs); model.setOrder(w, g.id, [...memberIds(w, g.id)].reverse()); return 'ordered'; }
  return 'nothing';
}

test('the table: rows by id, read from either end and by rule, off an index that follows every write', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }), b = create(w, MESSY, { kind: 'line', text: 'b' });
  const id = L.set(w, L.relId('web', a.id, b.id), { from: a.id, to: b.id, kind: 'relation', rule: 'web', label: 'is', note: '' }).id;
  assert.deepEqual(L.get(w, id), { id, from: a.id, to: b.id, kind: 'relation', rule: 'web', label: 'is' }); // an empty note is not kept
  assert.deepEqual(L.from(w, a.id).map((r) => r.id), [id]);
  assert.deepEqual(L.to(w, b.id, 'relation').map((r) => r.id), [id]);
  assert.deepEqual(L.to(w, b.id, 'part of'), []);
  assert.deepEqual(L.ofRule(w, 'web').map((r) => r.id), [id]);
  assert.ok(L.amend(w, id, { label: 'was' }) && L.get(w, id).label === 'was');
  assert.ok(!L.amend(w, 'nothing', { label: 'x' }));
  // Written behind the index's back (as the log does, replaying a row), then told: read true.
  w.links[L.relId('web', b.id, a.id)] = { from: b.id, to: a.id, kind: 'relation', rule: 'web' };
  L.touched(w);
  assert.equal(L.from(w, b.id).length, 1);
  assert.equal(L.dropAll(w, a.id), 2);
  assert.equal(L.count(w), 0);
});

test('Law 4: after a thousand random changes, folds, moves, removals and reorders, nothing but the table says who holds what', () => {
  model.declareGroups('sets', { membership: 'many', order: 'kept' });
  for (const seed of [1, 2, 3]) {
    const w = emptyWorld(1000), rand = rng(seed), seen = {};
    for (let i = 0; i < 1000; i++) { seen[step(w, rand, 2000 + i)] = true; if (i % 50 === 0) lawFour(w); }
    lawFour(w);
    for (const k of ['made', 'joined', 'left', 'folded', 'removed', 'ordered', 'nested']) assert.ok(seen[k], `seed ${seed} never ${k}`);
    // Saved and read back, the same table; a copy of the room shares no row with it.
    const back = loadWorld(JSON.parse(JSON.stringify(w)));
    lawFour(back);
    assert.deepEqual(back.links, w.links);
    const c = copyRoom(w, MESSY, 5000);
    lawFour(w);
    const inRoom = (room) => Object.values(w.links).filter((r) => model.parentOf(w, r.from) === room).length;
    assert.equal(inRoom(c.id), inRoom(MESSY), 'as many rows in the copy as in the room');
    assert.ok(!Object.values(w.links).some((r) => model.parentOf(w, r.from) === c.id && model.parentOf(w, r.to) !== c.id), 'no row crosses from the copy');
  }
  model.declareGroups('sets', {});
});

test('a fold stands for what it folded: the old thoughts stay, show nowhere, and go with the fold', () => {
  const w = emptyWorld(1000);
  const t = create(w, MESSY, { kind: 'group', of: 'joyce' }, 1);
  const a = create(w, t.id, { kind: 'line', text: 'one' }, 2), b = create(w, t.id, { kind: 'line', text: 'two' }, 3), c = create(w, t.id, { kind: 'line', text: 'three' }, 4);
  P.putSpot(w, MESSY, a.id, 'pessoa', { x: 1, y: 2 });
  const f = groups.fold(w, MESSY, [a.id, b.id], 9);
  assert.equal(f.text, 'one\ntwo');
  assert.deepEqual(memberIds(w, t.id), [f.id, c.id]);
  assert.deepEqual(L.from(w, f.id, 'stands for').map((r) => r.to), [a.id, b.id]);
  assert.ok(w.things[a.id] && w.things[b.id], 'kept (Law 2)');
  assert.ok(!roomItems(w, MESSY).some((th) => th.id === a.id), 'shown nowhere');
  assert.deepEqual(P.spot(w, MESSY, f.id, 'pessoa'), { x: 1, y: 2 });
  assert.equal(P.spot(w, MESSY, a.id, 'pessoa'), null);
  assert.equal(model.search(w, 'one').length, 1, 'found once: as the fold');
  // The fold itself folds again: the new fold stands for the old fold, which stands for a and b.
  const g = groups.fold(w, MESSY, [f.id, c.id], 10);
  assert.deepEqual(L.from(w, g.id, 'stands for').map((r) => r.to), [f.id, c.id]);
  assert.deepEqual(L.from(w, f.id, 'stands for').map((r) => r.to), [a.id, b.id]);
  remove(w, g.id);
  assert.deepEqual([g.id, f.id, a.id, b.id, c.id].map((id) => !!w.things[id]), [false, false, false, false, false], 'deleting a fold deletes what it stood for');
  assert.equal(L.count(w), 0);
});

test('the log carries link rows: a join is a linked row of its own, undo takes it back, replay rebuilds the table', () => {
  model.declareGroups('sets', { membership: 'many', order: 'kept' });
  const w = emptyWorld(1000), rand = rng(7);
  const log = M.emptyLog(1000, state(w));
  let prev = state(w);
  for (let i = 0; i < 300; i++) {
    step(w, rand, 2000 + i);
    const rows = M.record(log, prev, state(w), 2000 + i);
    for (const r of rows) if (r.table === 'links') assert.ok(r.link && r.kind === 'linked' && r.mark == null);
    prev = state(w);
  }
  assert.ok(log.rows.some((r) => r.link), 'links landed');
  assert.deepEqual(M.stateAt(log).links, w.links, 'replayed');
  const was = state(w);
  const undone = [];
  for (let i = 0; i < 40; i++) { const rows = M.undo(log, w, true, 9000 + i); if (!rows) break; undone.push(rows); }
  L.touched(w);
  lawFour(w);
  for (let i = undone.length; i > 0; i--) M.undo(log, w, false, 9500 + i);
  assert.deepEqual(state(w), was, 'redone');
  assert.deepEqual(M.stateAt(log).links, w.links);
  // A mark's moments include the links made at either end of it.
  const some = Object.values(w.links).find((r) => r.kind === 'part of');
  if (some) assert.ok(M.of(log, some.from).some((r) => r.link));
  model.declareGroups('sets', {});
});

test('a world saved before the table is read into it: members become part-of rows, arrows relation rows', () => {
  const old = emptyWorld(1000);
  delete old.links;
  old.things.g1 = { id: 'g1', kind: 'group', of: 'joyce', parent: MESSY, at: 1, members: ['a', 'b', 'gone', 'g1'] };
  old.things.a = { id: 'a', kind: 'line', parent: MESSY, at: 2, text: 'a' };
  old.things.b = { id: 'b', kind: 'line', parent: MESSY, at: 3, text: 'b' };
  old.things.c1 = { id: 'c1', kind: 'group', of: 'russell', parent: MESSY, at: 4, members: ['b'] };
  old.things.c2 = { id: 'c2', kind: 'group', of: 'russell', parent: MESSY, at: 5, members: ['a'] };
  old.own = { [MESSY]: { russell: { c2: { parents: ['c1'], rel: { c1: 'forgets' }, labels: { c1: 'why' } } }, pessoa: { a: { x: 1, y: 1 } } } };
  const w = loadWorld(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(memberIds(w, 'g1'), ['a', 'b']);
  assert.equal(w.things.g1.members, undefined);
  assert.deepEqual(L.get(w, L.relId('russell', 'c2', 'c1')), { id: 'rel:russell:c2:c1', from: 'c2', to: 'c1', kind: 'relation', rule: 'russell', label: 'forgets', note: 'why' });
  assert.equal(w.own[MESSY], undefined, 'the arrows left the own data, and Pessoa\'s spots too');
  assert.deepEqual(P.spot(w, MESSY, 'a', 'pessoa'), { x: 1, y: 1 }, 'a rule row now');
  lawFour(w);
});

test('budget: a room of 1,500 thoughts asks who holds each, and what every group holds, well within the frame', () => {
  const w = emptyWorld(1000);
  const trains = [];
  for (let i = 0; i < 300; i++) trains.push(create(w, MESSY, { kind: 'group', of: 'joyce', x: i, y: i }, 1000 + i));
  for (let i = 0; i < 1500; i++) create(w, trains[i % 300].id, { kind: 'line', text: `thought ${i}` }, 5000 + i);
  const items = roomItems(w, MESSY);
  const t0 = performance.now();
  let n = 0;
  for (const th of items) n += groupsOf(w, th.id).length;
  for (const g of trains) n += members(w, g.id).length;
  const read = performance.now() - t0;
  assert.equal(n, 3000);
  const t1 = performance.now();
  const fresh = create(w, trains[7].id, { kind: 'line', text: 'Enter' }, 9000); // what Enter does
  const enter = performance.now() - t1;
  assert.ok(fresh && memberIds(w, trains[7].id).includes(fresh.id));
  assert.ok(read < 60, `reading who holds what took ${read.toFixed(1)} ms`);
  assert.ok(enter < 10, `Enter took ${enter.toFixed(1)} ms`);
});
