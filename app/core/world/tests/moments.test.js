// Tests for the moments log: every change is a moment (Law 6), undo walks the log back, replay
// rebuilds the world, and compaction keeps the replay exact.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as L from '../moments.js';

const { emptyLog, record, undo, stateAt, diff, visit, visits, compact, loadLog, changed, since, day, changedOn, first, DAY, COMPACT, STEPS } = L;
const state = (w) => JSON.parse(JSON.stringify(L.stateOf(w)));
const { same } = L;

// A small deterministic random source, so a failing run can be repeated.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// Takes one random step in the world: makes, edits, moves, joins, removes. Returns a word for it.
function randomEdit(w, rand, now) {
  const room = model.MESSY;
  const items = model.roomItems(w, room);
  const groups = model.groupsIn(w, room);
  const r = rand();
  if (r < 0.3 || !items.length) return model.create(w, room, { kind: 'line', text: `t${Math.floor(rand() * 1e6)}` }, now) ? 'made' : 'nothing';
  const th = pick(rand, items);
  if (r < 0.5) return model.update(w, th.id, { text: `${th.text} ${Math.floor(rand() * 100)}` }, now) ? 'edited' : 'nothing';
  if (r < 0.65) return model.move(w, th.id, room, Math.floor(rand() * 900), Math.floor(rand() * 600)) ? 'moved' : 'nothing';
  if (r < 0.8 && groups.length) return model.join(w, pick(rand, groups).id, th.id) ? 'linked' : 'nothing';
  if (r < 0.9) { model.remove(w, th.id); return 'removed'; }
  model.own(w, room, 'russell').note = `n${Math.floor(rand() * 100)}`;
  return 'arranged';
}

test('the rows that take one state to another name what changed, and nothing else', () => {
  const w = model.emptyWorld(1000);
  const a = state(w);
  const th = model.create(w, model.MESSY, { kind: 'line', text: 'one' }, 2000);
  assert.deepEqual(diff(a, state(w)).map((r) => [r.kind, r.table, r.mark]), [['made', 'marks', th.id]]);
  const b = state(w);
  model.update(w, th.id, { text: 'two' }, 3000);
  assert.deepEqual(diff(b, state(w)).map((r) => r.kind), ['edited']);
  const c = state(w);
  w.things[th.id].x = 40; w.things[th.id].y = 50;
  assert.deepEqual(diff(c, state(w)).map((r) => [r.kind, r.table]), [['moved', 'places']]);
  const d = state(w);
  const g = model.create(w, model.MESSY, { kind: 'group', of: 'pessoa' }, 4000);
  model.join(w, g.id, th.id);
  assert.deepEqual(diff(d, state(w)).map((r) => [r.kind, r.table, r.mark ?? r.link]), [['made', 'marks', g.id], ['linked', 'links', `part:${g.id}:${th.id}`]]); // the thought itself is unchanged: a part-of row holds it
  const e = state(w);
  model.join(w, g.id, model.create(w, model.MESSY, { kind: 'line', text: 'three' }, 4500).id);
  const rows = diff(e, state(w));
  assert.deepEqual(rows.filter((r) => r.link).map((r) => [r.kind, r.table, r.after.to]), [['linked', 'links', g.id]]); // a part-of row made: a links row, not a change to the group
  const f = state(w);
  model.own(w, model.MESSY, 'russell').x = 1;
  w.pages = 3;
  assert.deepEqual(diff(f, state(w)).map((r) => [r.kind, r.table, r.context]), [['arranged', 'links', model.MESSY], ['floors', 'places', 'floors']]);
  assert.deepEqual(diff(state(w), state(w)), []);
});

test('Law 6: after any run of edits, replaying the log gives exactly the world (property, 300 edits × 3 seeds)', () => {
  for (const seed of [1, 2, 3]) {
    const rand = rng(seed);
    const w = model.emptyWorld(1000);
    const log = emptyLog(1000);
    record(log, { things: {}, own: {}, pages: 1 }, state(w), 1000); // the world's first state is a moment too
    let prev = state(w);
    for (let i = 1; i <= 300; i++) {
      randomEdit(w, rand, 1000 + i * 1000);
      const now = state(w);
      const rows = record(log, prev, now, 1000 + i * 1000);
      assert.equal(rows.length > 0, !same(prev, now), `seed ${seed} step ${i}: a change with no moment, or a moment with no change`);
      prev = now;
      if (i % 50 === 0) assert.ok(same(stateAt(log), now), `seed ${seed} step ${i}: replay differs from the world`);
    }
    assert.ok(same(stateAt(log), state(w)));
    assert.ok(log.rows.every((r) => L.KINDS.includes(r.kind) && Number.isFinite(r.seq) && Number.isFinite(r.time)));
    assert.ok(log.rows.every((r, i) => i === 0 || r.seq > log.rows[i - 1].seq), 'seqs grow');
  }
});

test('undo round-trips 1,000 random edits: all the way back is the start, all the way forward is the end', () => {
  const rand = rng(7);
  const w = model.emptyWorld(1000);
  const start = state(w);
  const log = emptyLog(1000, start);
  const states = [start];
  let prev = start;
  for (let i = 1; i <= 1000; i++) {
    randomEdit(w, rand, 1000 + i * 1000);
    const now = state(w);
    if (record(log, prev, now, 1000 + i * 1000).length) states.push(now);
    prev = now;
  }
  const end = state(w);
  assert.ok(states.length > 400, `enough real steps: ${states.length}`);
  const steps = Math.min(states.length - 1, STEPS);
  assert.equal(log.undo.length, steps);
  const s = state(w);
  for (let i = 0; i < steps; i++) {
    assert.ok(undo(log, s, true, 2e6 + i), `undo ${i}`);
    assert.ok(same(s, states[states.length - 2 - i]), `after undo ${i} the world is as it was`);
  }
  assert.equal(undo(log, s, true), null, 'nothing more to undo');
  assert.ok(same(stateAt(log), s), 'the replay follows the undos');
  for (let i = 0; i < steps; i++) assert.ok(undo(log, s, false, 3e6 + i), `redo ${i}`);
  assert.ok(same(s, end), 'all the way forward is the end');
  assert.equal(undo(log, s, false), null);
  assert.ok(same(stateAt(log), end));
  // a new change after undoing forgets the redo
  undo(log, s, true, 4e6);
  s.things.fresh = { id: 'fresh', kind: 'line', text: 'x', parent: model.MESSY, at: 4e6 };
  record(log, stateAt(log), s, 4e6 + 1);
  assert.deepEqual(log.redo, []);
  assert.ok(same(stateAt(log), s));
});

test('a visit is a moment; the same visit within a minute is not; visits read back as the attention log', () => {
  const log = emptyLog(0);
  assert.ok(visit(log, 'r', 1000));
  assert.equal(visit(log, 'r', 30e3), null);
  assert.ok(visit(log, 'q', 31e3));
  assert.ok(visit(log, 'r', 70e3));
  assert.deepEqual(visits(log), { r: [1000, 70e3], q: [31e3] });
  for (let i = 0; i < 100; i++) visit(log, 'r', 1e6 + i * 120e3);
  assert.equal(visits(log).r.length, L.MOST_VISITS);
  assert.deepEqual(since(log, 1e6 + 99 * 120e3).map((r) => r.kind), ['visited']);
});

test('reading the log: a mark\'s rows, when it last changed, a day\'s rows and marks, the first time', () => {
  const w = model.emptyWorld(1000);
  const log = emptyLog(1000);
  assert.equal(first(log), null);
  let prev = state(w);
  const a = model.create(w, model.MESSY, { kind: 'line', text: 'a' }, 5000);
  record(log, prev, prev = state(w), 5000);
  model.update(w, a.id, { text: 'b' }, 6000);
  record(log, prev, prev = state(w), 6000);
  visit(log, model.MESSY, 7000);
  assert.deepEqual(L.of(log, a.id).map((r) => [r.kind, r.time]), [['made', 5000], ['edited', 6000]]);
  assert.deepEqual(L.of(log, model.MESSY).map((r) => r.kind), ['visited']);
  assert.equal(changed(log, a.id), 6000);
  assert.equal(changed(log, 'nobody'), null);
  assert.equal(first(log), 5000);
  assert.equal(day(log, new Date(5500)).length, log.rows.length);
  assert.deepEqual([...changedOn(log, 5000)], [[a.id, model.MESSY]]);
  assert.deepEqual(day(log, new Date(5000 + 2 * DAY)), []);
});

// Sixty days of edits, with undos among them, as a fixture for compaction.
function sixtyDays(seed, undos = true) {
  const rand = rng(seed);
  const w = model.emptyWorld(0);
  const log = emptyLog(0, state(w));
  let prev = state(w);
  const days = [];
  for (let d = 0; d < 60; d++) {
    for (let k = 0; k < 6; k++) {
      const t = d * DAY + 3600e3 * (k + 1);
      randomEdit(w, rand, t);
      record(log, prev, prev = state(w), t);
      if (undos && rand() < 0.15 && undo(log, w, true, t + 1)) prev = state(w);
      if (undos && rand() < 0.05 && undo(log, w, false, t + 2)) prev = state(w);
      if (rand() < 0.3) visit(log, model.MESSY, t + 3);
    }
    days.push(state(w));
  }
  return { w, log, days };
}

test('compaction keeps the replay exact at now and at the end of every past day, and squashes old rows', () => {
  const { w, log, days } = sixtyDays(11);
  const now = 60 * DAY;
  const before = JSON.parse(JSON.stringify(log));
  const rowsBefore = log.rows.length;
  assert.ok(compact(log, now));
  assert.ok(log.rows.length < rowsBefore, `fewer rows: ${rowsBefore} → ${log.rows.length}`);
  assert.ok(same(stateAt(log), state(w)), 'now');
  for (let d = 0; d < 60; d++) assert.ok(same(stateAt(log, (d + 1) * DAY - 1), days[d]), `day ${d}`);
  // old rows have no before, one per thing per day; recent rows are untouched
  const horizon = L.dayOf(now - COMPACT * DAY);
  const old = log.rows.filter((r) => r.time < horizon);
  assert.ok(old.length && old.every((r) => r.before === undefined && r.step === undefined && r.kind !== 'visited' && r.kind !== 'undone'));
  const perDay = new Set(old.map((r) => `${L.dayOf(r.time)}:${r.mark ?? r.link ?? r.context}`));
  assert.equal(perDay.size, old.length);
  assert.ok(same(log.rows.filter((r) => r.time >= horizon && !['undone', 'redone'].includes(r.kind)), before.rows.filter((r) => r.time >= horizon && !['undone', 'redone'].includes(r.kind))));
  // undo reaches only into the kept rows, and still works
  assert.ok(log.undo.every((s) => log.rows.some((r) => r.step === s && L.CHANGES.includes(r.kind))));
  const s = state(w);
  const n = log.undo.length;
  assert.ok(n > 0);
  for (let i = 0; i < n; i++) assert.ok(undo(log, s, true, now + i));
  assert.ok(same(stateAt(log), s));
  // compacting again changes nothing
  const twice = JSON.stringify(log);
  compact(log, now);
  assert.equal(JSON.stringify(log), twice);
});

test('an undo after the horizon of a step before it stays replayable after compaction', () => {
  const w = model.emptyWorld(0);
  const log = emptyLog(0, state(w));
  let prev = state(w);
  const a = model.create(w, model.MESSY, { kind: 'line', text: 'old' }, 1000);
  record(log, prev, prev = state(w), 1000);
  model.update(w, a.id, { text: 'older' }, 2000);
  record(log, prev, prev = state(w), 2000);
  const now = (COMPACT + 2) * DAY;
  assert.ok(undo(log, w, true, now - 1000)); // taken back long after
  const was = state(w);
  compact(log, now);
  assert.ok(same(stateAt(log), was));
  assert.equal(w.things[a.id].text, 'old');
  assert.deepEqual(log.undo, []);
  assert.deepEqual(log.redo, []);
  assert.ok(log.rows.every((r) => r.kind !== 'undone'));
});

test('days older than `keep` fold into the base, and the replay stays exact from the base on', () => {
  const { w, log, days } = sixtyDays(5, false);
  log.keep = 40;
  const now = 60 * DAY;
  compact(log, now);
  const floor = L.dayOf(now - 40 * DAY);
  assert.ok(log.base && log.base.time === floor, `base at the floor: ${log.base?.time} vs ${floor}`);
  assert.equal(first(log), floor);
  assert.ok(log.rows.every((r) => r.time >= floor));
  assert.ok(same(log.base.state, days[Math.round(floor / DAY) - 1]), 'the base is the state at the end of the day before');
  assert.ok(same(stateAt(log), state(w)));
  for (let d = Math.round(floor / DAY); d < 60; d++) assert.ok(same(stateAt(log, (d + 1) * DAY - 1), days[d]), `day ${d}`);
  // keep = forever never folds
  const other = sixtyDays(6, false);
  other.log.keep = 0;
  compact(other.log, now);
  assert.equal(other.log.base.time, 0, 'the base stays where the log began');
  assert.ok(same(stateAt(other.log), state(other.w)));
});

test('a saved log loads back whole; anything else starts afresh', () => {
  const { log } = sixtyDays(3);
  const back = loadLog(JSON.parse(JSON.stringify(log)));
  assert.deepEqual(back, log);
  assert.deepEqual(loadLog(null).rows, []);
  assert.deepEqual(loadLog({ v: 0, rows: [] }).rows, []);
  const torn = loadLog({ ...JSON.parse(JSON.stringify(log)), undo: [...log.undo, 99999], seq: 0 });
  assert.deepEqual(torn.undo, log.undo);
  assert.equal(torn.seq, log.seq);
});

test('the outbox carries the rows since a seq, with undos turned into plain changes; another copy absorbs them and ends the same', () => {
  const { w, log } = sixtyDays(21);
  const now = 61 * DAY;
  // another copy of the world, as it was when the first batch was taken
  const copy = model.emptyWorld(0);
  const copyLog = emptyLog(0, state(copy));
  const batch = L.outbox(log, 0);
  assert.ok(batch.every((r) => L.CHANGES.includes(r.kind) || r.kind === 'visited'), 'no undone or redone rows travel');
  assert.ok(batch.some((r) => r.kind === 'visited'));
  const landed = L.absorb(copyLog, copy, batch);
  assert.ok(same(state(copy), state(w)), 'the copy ends as the original');
  assert.ok(landed.every((r) => r.step === undefined), 'absorbed rows are not the copy\'s to undo');
  assert.deepEqual(copyLog.undo, []);
  assert.ok(same(stateAt(copyLog), state(copy)), 'the copy\'s log replays to its world');
  assert.deepEqual(L.visits(copyLog), L.visits(log));
  // nothing new: nothing to send, nothing lands
  assert.deepEqual(L.outbox(log, log.seq), []);
  assert.deepEqual(L.absorb(copyLog, copy, batch), []);
  // a change on the copy goes back the other way
  const prev = state(copy);
  model.create(copy, model.MESSY, { kind: 'line', text: 'from the copy' }, now);
  record(copyLog, prev, state(copy), now);
  const back = L.outbox(copyLog, copyLog.seq - 1);
  assert.equal(back.length, 1);
  L.absorb(log, w, back);
  assert.ok(same(state(copy), state(w)));
  assert.ok(same(stateAt(log), state(w)));
  // on one thing, the latest word wins: an older row from elsewhere changes nothing
  const id = back[0].mark;
  assert.deepEqual(L.absorb(log, w, [{ ...back[0], time: now - 1, after: { ...back[0].after, text: 'stale' } }]), []);
  assert.equal(w.things[id].text, 'from the copy');
  L.absorb(log, w, [{ ...back[0], kind: 'edited', time: now + 5, after: { ...back[0].after, text: 'newer' } }]);
  assert.equal(w.things[id].text, 'newer');
});
