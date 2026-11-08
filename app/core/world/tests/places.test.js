// The gate of kernel phase 3: the places table (KERNEL.md). Law 1, only marks exist: every place
// row and every link points at marks there are. Law 2, a mark is never lost: every mark but a
// context of the top has exactly one home, removing or changing a place never removes a mark, and
// only delete does. The index agrees with the table after any run of changes, the moments log
// replays and undoes place rows, a world saved before the table is read into it once, and a big
// room's reads stay within budget.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as P from '../places.js';
import * as L from '../links.js';
import * as M from '../moments.js';
import * as twin from '../twin.js';
import * as groups from '../groups.js';

const { MESSY, FLOOR, ARCHIVE, emptyWorld, loadWorld, kindOf, isContext } = model;
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Every law of this phase, checked on a world; `was`: the mark ids before a change that deletes
// nothing (none may be gone).
function laws(w, was = null, where = '') {
  for (const [id, r] of Object.entries(w.places)) {
    assert.ok(w.things[r.mark], `${where} Law 1: place ${id} names a mark that is gone`);
    assert.ok(w.things[r.context], `${where} Law 1: place ${id} names a context that is gone`);
    assert.equal(P.idOf(r), id, `${where} a place row is under its own id`);
  }
  for (const [id, r] of Object.entries(w.links)) assert.ok(w.things[r.from] && w.things[r.to], `${where} Law 1: link ${id} names a mark that is gone`);
  const homes = new Map();
  for (const r of Object.values(w.places)) if (r.rule == null) homes.set(r.mark, (homes.get(r.mark) || 0) + 1);
  for (const th of Object.values(w.things)) {
    const n = homes.get(th.id) || 0;
    if (isContext(th)) { assert.equal(n, 0, `${where} ${th.id}: a context of the top is in nothing`); continue; }
    assert.equal(n, 1, `${where} Law 2: ${th.id} has ${n} homes`);
    const there = w.things[P.home(w, th.id)];
    if (kindOf(th) === 'room') assert.ok(isContext(there) || (model.isTwin(there) && !model.isTwin(th)), `${where} ${th.id}: a room on a floor, in the Archive, or a Twin's side`);
    else assert.ok(kindOf(there) === 'room' && !model.isTwin(there), `${where} ${th.id}: a thought is in a room`);
    assert.ok(!('parent' in th || 'page' in th || 'archived' in th), `${where} ${th.id}: where it is lives only in places`);
  }
  // The index agrees with the table.
  for (const th of Object.values(w.things)) {
    const fromTable = Object.values(w.places).filter((r) => r.context === th.id && r.rule == null).map((r) => r.mark).sort();
    assert.deepEqual(P.marksIn(w, th.id).sort(), fromTable, `${where} the index of ${th.id} differs from the table`);
  }
  if (was) for (const id of was) assert.ok(w.things[id], `${where} Law 2: ${id} was lost`);
}

// One random change. Returns [what it was, whether it may delete marks].
function step(w, rand, now) {
  const rooms = model.rooms(w).flatMap((r) => (model.isTwin(r) ? twin.sides(w, r.id) : [r]));
  const room = pick(rand, rooms);
  const things = model.children(w, room.id);
  const th = things.length ? pick(rand, things) : null;
  const r = rand();
  if (r < 0.2) return ['make', !!model.create(w, room.id, { kind: 'line', text: `t${Math.floor(rand() * 1e6)}` }, now), false];
  if (r < 0.27) return ['group', !!model.create(w, room.id, { kind: 'group', of: pick(rand, ['joyce', 'pessoa']), x: 1, y: 2 }, now), false];
  if (r < 0.34 && th) { const g = model.groupsIn(w, room.id); return ['join', g.length ? model.join(w, pick(rand, g).id, th.id) : false, false]; }
  if (r < 0.44 && th) return ['move', model.move(w, th.id, pick(rand, rooms).id, 5, 5, { loose: rand() < 0.5 }), false];
  if (r < 0.48 && th && model.isLeaf(th) && twin.twinOf(w, room.id)) return ['across', twin.across(w, th.id, 1, 1), false];
  if (r < 0.52 && things.length > 1) return ['fold', !!groups.fold(w, room.id, things.slice(0, 2).map((x) => x.id), now), false];
  if (r < 0.58 && th) { model.remove(w, th.id); return ['remove', true, true]; }
  if (r < 0.63) return ['room', !!model.addRoom(w, 'R', now, { page: Math.floor(rand() * model.pageCount(w)) }, 'pessoa'), false];
  if (r < 0.66) return ['twin', !!twin.addTwin(w, 'T', now, { page: 0 }, ['joyce', 'pessoa']), false];
  if (r < 0.69) return ['floor', model.addPage(w, now) > 0, false];
  if (r < 0.74) { const top = pick(rand, model.rooms(w)); return ['archive', model.archive(w, top.id, now), false]; }
  if (r < 0.79) { const a = model.archived(w); return ['restore', a.length ? model.restore(w, pick(rand, a).id) : false, false]; }
  if (r < 0.85) { const top = pick(rand, model.rooms(w)); return ['to floor', model.toPage(w, top.id, Math.floor(rand() * model.pageCount(w))), false]; }
  if (r < 0.88) return ['drop floor', model.dropPage(w), true]; // (an empty floor's own mark goes, by hand)
  if (r < 0.91) { const top = pick(rand, model.rooms(w)); return ['copy', !!model.copyRoom(w, top.id, now), false]; }
  if (r < 0.95) { const top = pick(rand, [...model.rooms(w), ...model.archived(w)].filter((x) => x.id !== MESSY)); if (!top) return ['nothing', false, false]; model.remove(w, top.id); return ['remove room', true, true]; }
  model.update(w, (th || room).id, kindOf(th || room) === 'room' ? { name: `renamed ${now}` } : { text: `renamed ${now}`, title: `renamed ${now}` }, now);
  return ['edit', true, true]; // (an item edited empty goes)
}

test('Laws 1 and 2 hold after any run of changes; the log replays and undoes every place row (property, 400 changes × 3 seeds)', () => {
  for (const seed of [3, 5, 8]) {
    const rand = rng(seed);
    const w = emptyWorld(1000);
    const log = M.emptyLog(1000, state(w));
    const states = [state(w)];
    let prev = states[0];
    laws(w, null, `seed ${seed} start:`);
    const seen = new Set();
    for (let i = 1; i <= 400; i++) {
      const was = Object.keys(w.things).filter((id) => !model.isGroup(w.things[id])); // (a group left empty goes: it was only structure)
      const [what, , deletes] = step(w, rand, 1000 + i * 1000);
      seen.add(what);
      laws(w, deletes ? null : was, `seed ${seed} step ${i} (${what}):`);
      const now = state(w);
      if (M.record(log, prev, now, 1000 + i * 1000).length) states.push(now);
      prev = now;
    }
    assert.ok(seen.size >= 15, `seed ${seed}: most kinds of change were tried (${[...seen].join(', ')})`);
    assert.ok(M.same(M.stateAt(log), state(w)), `seed ${seed}: the replay is the world ${JSON.stringify(M.diff(M.stateAt(log), state(w))).slice(0, 600)}`);
    assert.ok(log.rows.some((r) => r.table === 'places' && r.place), 'place rows are moments');
    // all the way back: each state as it was, with the laws holding and the index made afresh
    const s = state(w);
    const steps = Math.min(states.length - 1, M.STEPS);
    for (let k = 0; k < steps; k++) {
      assert.ok(M.undo(log, s, true, 2e6 + k));
      assert.ok(M.same(s, states[states.length - 2 - k]), `seed ${seed}: undo ${k}`);
    }
    const back = loadWorld({ v: 3, ...s, views: {}, own: s.own, settings: {} });
    laws(back, null, `seed ${seed} after undo:`);
  }
});

test('removing a place never removes a mark: a home only moves, and a context of the top is never anyone\'s', () => {
  const w = emptyWorld(1);
  const r = model.addRoom(w, 'R', 2);
  const a = model.create(w, r.id, { kind: 'line', text: 'a' }, 3);
  const ids = () => Object.keys(w.things).sort();
  const before = ids();
  P.setHome(w, a.id, MESSY); // a new home takes the old one's place
  assert.equal(P.of(w, a.id).filter((x) => x.rule == null).length, 1);
  assert.equal(model.parentOf(w, a.id), MESSY);
  P.set(w, { mark: a.id, context: MESSY, rule: 'pessoa', position: { x: 1, y: 2 } });
  assert.ok(P.drop(w, P.ruleId(MESSY, a.id, 'pessoa'))); // a rule's row goes: the mark is loose there, and still here
  assert.deepEqual(ids(), before);
  assert.ok(model.archive(w, r.id, 4));
  assert.equal(model.archivedAt(w, r.id), 4);
  assert.ok(!model.archive(w, r.id, 5), 'archived once');
  assert.ok(model.restore(w, r.id));
  assert.ok(!model.dropPage(w), 'the first floor stays');
  model.addPage(w, 6);
  assert.ok(model.toPage(w, r.id, 1));
  assert.ok(!model.dropPage(w), 'a floor with a room stays');
  assert.ok(model.toPage(w, r.id, 0));
  assert.ok(model.dropPage(w));
  assert.deepEqual(ids(), before, 'nothing was lost on the way');
  assert.equal(P.home(w, FLOOR(0)), null);
  assert.equal(P.home(w, ARCHIVE), null);
  assert.ok(!model.canHold(w, r.id, 'room'), 'a room goes in no room but a Twin');
  model.remove(w, r.id); // only delete removes, and takes what is in it
  assert.equal(w.things[r.id], undefined);
  assert.ok(!Object.values(w.places).some((x) => x.mark === r.id || x.context === r.id));
  laws(w);
});

test('a world saved before the table is read into it once: thoughts in rooms, rooms on floors, in the Archive, and a Twin\'s sides', () => {
  const old = { v: 3, pages: 3, links: {}, things: {
    messy: { id: 'messy', kind: 'room', parent: null, at: 1, name: 'Messy thoughts', col: 0, row: 0, size: 2 },
    up: { id: 'up', kind: 'room', parent: null, at: 2, name: 'Up', page: 2, col: 1, row: 1 },
    old: { id: 'old', kind: 'room', parent: null, at: 3, name: 'Old', page: 1, archived: 77 },
    tw: { id: 'tw', kind: 'room', parent: null, at: 4, name: 'Pair', size: 'twin' },
    left: { id: 'left', kind: 'room', parent: 'tw', at: 5, name: 'Left', side: 0 },
    a: { id: 'a', kind: 'line', parent: 'up', at: 6, text: 'a' },
    b: { id: 'b', kind: 'line', parent: 'left', at: 7, text: 'b' },
    stray: { id: 'stray', kind: 'line', parent: 'gone', at: 8, text: 'stray' },
  } };
  const w = loadWorld(old);
  laws(w);
  assert.equal(model.pageCount(w), 3);
  assert.deepEqual([P.home(w, 'up'), model.floorOf(w, 'up')], [FLOOR(2), 2]);
  assert.deepEqual([P.home(w, 'old'), model.archivedAt(w, 'old'), model.floorOf(w, 'old')], [ARCHIVE, 77, 1]);
  assert.deepEqual([P.home(w, 'left'), model.parentOf(w, 'left')], ['tw', 'tw']);
  assert.deepEqual([model.parentOf(w, 'a'), model.parentOf(w, 'b'), model.parentOf(w, 'stray')], ['up', 'left', MESSY]); // a thought whose room is gone goes to Messy
  assert.deepEqual(model.archived(w).map((r) => r.id), ['old']);
  assert.deepEqual(model.roomsOn(w, 2).map((r) => r.id), ['up']);
  assert.equal(w.pages, undefined);
  // and saved again, it loads the same
  const again = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.ok(M.same(M.stateOf(again), M.stateOf(w)));
});

test('a big room: its thoughts, their rooms and the rooms page read off the index within budget', () => {
  const w = emptyWorld(1);
  for (let f = 0; f < 4; f++) model.addPage(w, 2);
  for (let i = 0; i < 60; i++) model.addRoom(w, `R${i}`, 3, { page: i % 5 });
  const t = model.startTrain(w, MESSY, 0, 0, 4);
  for (let i = 0; i < 1500; i++) model.addThought(w, t.id, `thought ${i}`, 10 + i);
  const t0 = performance.now();
  let n = 0;
  for (let k = 0; k < 20; k++) n += model.children(w, MESSY).length;
  const children = (performance.now() - t0) / 20;
  const t1 = performance.now();
  for (const th of model.children(w, MESSY)) if (model.parentOf(w, th.id) !== MESSY) n = -1;
  const homes = performance.now() - t1;
  const t2 = performance.now();
  for (let k = 0; k < 20; k++) for (let p = 0; p < 5; p++) model.roomsOn(w, p);
  const floors = (performance.now() - t2) / 20;
  assert.equal(n, 20 * 1501);
  assert.ok(children < 15, `a 1,500-thought room's thoughts in ${children.toFixed(2)} ms (budget 15)`);
  assert.ok(homes < 15, `1,500 homes in ${homes.toFixed(2)} ms (budget 15)`);
  assert.ok(floors < 5, `every floor's rooms in ${floors.toFixed(2)} ms (budget 5)`);
});
