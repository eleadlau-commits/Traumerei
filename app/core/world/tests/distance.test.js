// Tests for the distance table (Law 7: distance is inherited and only lengthens by hand). Part of
// the gate of kernel phase 6: a mark's reader is the farthest declared on its way up, by a slow
// scan too; a shut context refuses every change; nothing automatic (moving, copying, archiving,
// removing, loading, the log replaying) shortens or drops a declared reader; Lock is a row of the
// table, logged, undone and replayed; a world saved with `locked` on its rooms is read once.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as P from '../places.js';
import * as D from '../distance.js';
import * as M from '../moments.js';

const { MESSY, emptyWorld, loadWorld, create, update, remove, addRoom, lock, shut, copyRoom, archive, restore, move, FLOOR } = model;
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// The slow way: walk the home rows by scanning the places table, and take the farthest reader.
function scan(w, mark) {
  let best = 0;
  const seen = new Set();
  for (let at = mark; at != null && !seen.has(at); at = Object.values(w.places).find((r) => r.mark === at && r.rule == null)?.context) {
    seen.add(at);
    const r = Object.values(w.distance).find((x) => x.context === at);
    if (r) best = Math.max(best, D.READERS.indexOf(r.reader));
  }
  return D.READERS[best];
}

function world() {
  const w = emptyWorld(1000);
  const a = addRoom(w, 'A', 2000), b = addRoom(w, 'B', 2100);
  const lines = [];
  for (let i = 0; i < 6; i++) lines.push(create(w, i % 2 ? a.id : b.id, { kind: 'line', text: `t${i}` }, 3000 + i));
  return { w, a, b, lines };
}

test('Law 7: a mark reads the farthest reader on its way up; a context for others or a machine is shut', () => {
  const { w, a, b, lines } = world();
  assert.equal(D.of(w, lines[1].id), 'me now');
  assert.equal(D.declare(w, a.id, 'me later').id, D.idOf(a.id));
  assert.equal(D.of(w, lines[1].id), 'me later');
  assert.ok(!shut(w, lines[1].id), 'me later is still the maker\'s');
  D.declare(w, FLOOR(0), 'others');
  for (const th of [a, b, ...lines]) { assert.equal(D.of(w, th.id), 'others'); assert.ok(shut(w, th.id)); }
  D.declare(w, a.id, 'machine');
  assert.equal(D.of(w, lines[1].id), 'machine');
  assert.equal(D.of(w, lines[0].id), 'others', 'a room\'s own reader reaches only what is in it');
  D.declare(w, FLOOR(0), 'me now');
  assert.equal(D.declared(w, FLOOR(0)), null, 'me now is no row');
  assert.equal(D.of(w, lines[0].id), 'me now');
  assert.equal(D.declare(w, a.id, 'everyone').why, 'A reader is one of me now, me later, others, machine');
});

test('a shut context refuses every change to what is in it; Lock and unlock are rows of the table', () => {
  const { w, a, lines } = world();
  assert.ok(lock(w, a.id));
  assert.deepEqual(w.distance, { [D.idOf(a.id)]: { context: a.id, reader: 'others' } });
  assert.equal(w.things[a.id].locked, undefined, 'no field on the room');
  assert.equal(create(w, a.id, { kind: 'line', text: 'no' }), null);
  assert.equal(update(w, lines[1].id, { text: 'changed' }), null);
  remove(w, lines[1].id);
  assert.ok(w.things[lines[1].id], 'not deleted');
  assert.equal(archive(w, a.id), false, 'a locked room keeps its place');
  assert.ok(update(w, a.id, { name: 'A, renamed' }), 'the room itself can still be renamed');
  assert.ok(lock(w, a.id, false));
  assert.deepEqual(w.distance, {});
  assert.ok(update(w, lines[1].id, { text: 'changed' }));
});

test('Law 7: nothing automatic shortens or drops a reader, over a random run of changes', () => {
  const rand = rng(7);
  const { w, a, b } = world();
  lock(w, a.id);
  D.declare(w, b.id, 'me later');
  let declared = new Map(D.all(w).map((r) => [r.context, r.reader]));
  for (let step = 0; step < 300; step++) {
    const rooms = model.rooms(w).filter((r) => r.id !== MESSY);
    const r = pick(rand, rooms);
    const things = Object.values(w.things).filter((th) => model.isLeaf(th));
    const op = Math.floor(rand() * 8);
    if (op === 0) create(w, r.id, { kind: 'line', text: `n${step}` }, 5000 + step);
    else if (op === 1 && things.length) update(w, pick(rand, things).id, { text: `e${step}` }, 5000 + step);
    else if (op === 2 && things.length) move(w, pick(rand, things).id, r.id, 10, 10);
    else if (op === 3) copyRoom(w, r.id, 5000 + step);
    else if (op === 4) { if (model.isArchived(w, r.id)) restore(w, r.id); else archive(w, r.id, 5000 + step); }
    else if (op === 5 && things.length) remove(w, pick(rand, things).id);
    else if (op === 6) addRoom(w, `R${step}`, 5000 + step);
    else if (op === 7 && rand() < 0.2) remove(w, r.id);
    // every row still there, on a context that is there, reading as far as it did (or its context went)
    for (const [context, reader] of declared) if (w.things[context]) assert.equal(D.declared(w, context), reader, `step ${step}: ${context}`);
    assert.ok(D.all(w).every((x) => w.things[x.context]), 'a row on a context that is there (Law 1)');
    declared = new Map(D.all(w).map((x) => [x.context, x.reader]));
    assert.ok(D.all(w).every((x) => declared.has(x.context)), 'no row appears by itself');
  }
  for (const th of Object.values(w.things)) assert.equal(D.of(w, th.id), scan(w, th.id), th.id);
  const copy = copyRoom(w, a.id, 9e9);
  if (copy) assert.equal(D.declared(w, copy.id), null, 'a copy starts for me now');
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(back.distance, w.distance, 'saved and read back: the same rows');
});

test('Lock lands in the moments log as a declared row: undone, redone and replayed', () => {
  const { w, a, lines } = world();
  const log = M.emptyLog(1000, state(w));
  let before = state(w);
  lock(w, a.id);
  const rows = M.record(log, before, state(w), 4000);
  assert.deepEqual(rows.map((r) => [r.kind, r.table, r.dist]), [['declared', 'distance', D.idOf(a.id)]]);
  assert.equal(M.stateAt(log, 3999).distance[D.idOf(a.id)], undefined);
  assert.equal(M.stateAt(log).distance[D.idOf(a.id)].reader, 'others');
  M.undo(log, w, true, 5000);
  assert.ok(!shut(w, lines[1].id), 'undone: unlocked');
  M.undo(log, w, false, 6000);
  assert.ok(shut(w, lines[1].id), 'redone: locked');
  assert.ok(M.of(log, a.id).some((r) => r.kind === 'declared'), 'the room\'s history says it was locked');
  before = state(w);
  lock(w, a.id, false);
  remove(w, a.id);
  M.record(log, before, state(w), 7000);
  assert.equal(M.stateAt(log).distance[D.idOf(a.id)], undefined, 'a removed room takes its row with it');
  const out = M.outbox(log, 0);
  assert.ok(out.some((r) => r.dist === D.idOf(a.id)), 'the account carries it like any row');
  const other = emptyWorld(1000);
  M.absorb(M.emptyLog(1000), other, out.filter((r) => r.kind === 'declared'));
  assert.equal(D.count(other), 0, 'taken in elsewhere: locked, then unlocked');
});

test('a world saved with `locked` on its rooms is read into the table once', () => {
  const { w, a, b } = world();
  const saved = JSON.parse(JSON.stringify(w));
  saved.things[a.id].locked = true;
  saved.things[b.id].locked = false;
  saved.distance = { 'dist:gone': { context: 'gone', reader: 'others' }, [D.idOf(MESSY)]: { context: MESSY, reader: 'me now' } };
  const back = loadWorld(saved);
  assert.deepEqual(back.distance, { [D.idOf(a.id)]: { context: a.id, reader: 'others' } });
  assert.ok(!('locked' in back.things[a.id]) && !('locked' in back.things[b.id]));
  assert.ok(shut(back, a.id) && !shut(back, b.id));
});

test('budget: every mark of a 1,500-thought room reads its reader in a few ms', () => {
  const w = emptyWorld(1000);
  const r = addRoom(w, 'Big', 2000);
  for (let i = 0; i < 1500; i++) create(w, r.id, { kind: 'line', text: `t${i}` }, 3000 + i);
  D.declare(w, FLOOR(0), 'me later');
  const ids = P.marksIn(w, r.id);
  const t0 = performance.now();
  let n = 0;
  for (const id of ids) if (shut(w, id)) n++;
  const ms = performance.now() - t0;
  assert.equal(n, 0);
  assert.ok(ms < 20, `${ms.toFixed(1)} ms`);
});
