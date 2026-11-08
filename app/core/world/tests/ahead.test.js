// Tests for moments ahead (ahead.js), the gate of kernel phase 7 (return): a mark due yesterday
// is in the Returns tray when the app opens, and refusing it is a moment, in the record for good
// and undone with Ctrl+Z; a note for the next visit comes back when its room is gone into; coming
// back is the world's doing (no step), asking and answering the maker's; after any run of changes
// every row is whole, one per mark, on a mark that is there; the log replays and carries the rows
// to another copy; a file carries them out and back; reads stay within budget in a big world.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as P from '../places.js';
import * as A from '../ahead.js';
import * as M from '../moments.js';
import * as T from '../tables.js';
import * as traum from '../traum.js';

const { emptyWorld, loadWorld, addRoom, create, remove } = model;
const DAY = M.DAY;
const NOW = Date.UTC(2026, 10, 8, 12);
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// A world as the World feature keeps it: the world, its log, and the state the log last saw.
function app(w, log = M.emptyLog(NOW - 3 * DAY, state(w))) {
  const s = { w, log, last: state(w) };
  s.save = (now) => { const next = state(s.w); const rows = M.record(s.log, s.last, next, now); s.last = next; return rows; };
  s.come = (now, how = (x) => A.come(x, now)) => { const r = M.arrive(s.log, s.last, s.w, how, now); s.last = r.last; return r; };
  s.undo = (back = true) => { const rows = M.undo(s.log, s.w, back); s.last = state(s.w); return rows; };
  // Shut the app and open it again: the world and its log as they were saved, read back.
  s.reopen = (now) => {
    const again = app(loadWorld(JSON.parse(JSON.stringify(s.w))), M.loadLog(JSON.parse(JSON.stringify(s.log))));
    again.opened = again.come(now);
    return again;
  };
  return s;
}

function small() {
  const w = emptyWorld(NOW - 3 * DAY);
  const room = addRoom(w, 'Thesis', NOW - 3 * DAY);
  const a = create(w, room.id, { kind: 'line', text: 'Send chapter two' }, NOW - 3 * DAY);
  const b = create(w, room.id, { kind: 'line', text: 'Read the reviews' }, NOW - 3 * DAY);
  return { w, room, a, b, s: app(w) };
}

test('the gate: a mark due yesterday is in the tray on open; refusing it is a moment, in the record and undone', () => {
  const { w, a, b, s } = small();
  assert.ok(A.ask(w, a.id, 'due', { at: NOW - DAY }, NOW - 2 * DAY).id);
  assert.ok(A.ask(w, b.id, 'revisit', { at: NOW + DAY }, NOW - 2 * DAY).id);
  assert.deepEqual(s.save(NOW - 2 * DAY).map((r) => r.kind), ['due', 'revisit']);
  assert.deepEqual(A.back(w), [], 'nothing back while the app was shut');

  // The app opens a day after the due time: the mark is back, and only it.
  const open = s.reopen(NOW);
  assert.deepEqual(open.opened.came, [a.id]);
  assert.deepEqual(A.back(open.w).map((r) => r.mark), [a.id]);
  assert.equal(A.back(open.w)[0].back, NOW);
  assert.deepEqual(A.waiting(open.w).map((r) => r.mark), [b.id]);
  const returned = open.log.rows.at(-1);
  assert.equal(returned.kind, 'returned');
  assert.equal(returned.step, undefined, 'coming back is the world\'s doing, not a step');
  const steps = open.log.undo.length;

  // Refusing it is a moment: a step, a 'refused' row, gone from the tray, in the record.
  assert.ok(A.answer(open.w, a.id, 'refused', NOW + 1000).id);
  const rows = open.save(NOW + 1000);
  assert.deepEqual(rows.map((r) => [r.kind, r.table, r.ahead]), [['refused', 'moments', A.idOf(a.id)]]);
  assert.equal(open.log.undo.length, steps + 1);
  assert.deepEqual(A.back(open.w), []);
  assert.ok(M.of(open.log, a.id).some((r) => r.kind === 'refused'), 'the refusal is in the mark\'s record');
  assert.ok(T.history(open.log, new Set([a.id])).some((r) => r.kind === 'refused'));

  // Ctrl+Z brings it back to the tray; the refusal stays in the log as what was undone.
  open.undo();
  assert.deepEqual(A.back(open.w).map((r) => r.mark), [a.id]);
  open.undo(false);
  assert.deepEqual(A.back(open.w), []);
  assert.ok(M.same(M.stateAt(open.log).ahead, open.w.ahead), 'the log replays to the world');

  // Opening again changes nothing: it came back once.
  assert.deepEqual(open.reopen(NOW + DAY / 2).opened.came, []);
});

test('a note for the next visit comes back when its room, or the room of its mark, is gone into', () => {
  const { w, room, a, b, s } = small();
  const other = addRoom(w, 'Elsewhere', NOW);
  assert.match(A.ask(w, room.id, 'return', { note: '  ' }).why, /words/);
  assert.ok(A.ask(w, room.id, 'return', { note: 'Start from the second draft' }, NOW).id);
  assert.ok(A.ask(w, a.id, 'return', { note: 'Is this still true?' }, NOW).id);
  assert.ok(A.ask(w, b.id, 'revisit', { at: NOW + 7 * DAY }, NOW).id);
  s.save(NOW);
  assert.deepEqual(s.come(NOW + DAY).came, [], 'time alone does not bring a return');
  assert.deepEqual(s.come(NOW + DAY, (x) => A.opened(x, other.id, NOW + DAY)).came, [], 'nor a visit elsewhere');
  const r = s.come(NOW + DAY, (x) => A.opened(x, room.id, NOW + DAY));
  assert.deepEqual(r.came.sort(), [room.id, a.id].sort());
  assert.deepEqual(r.rows.map((x) => x.kind), ['returned', 'returned']);
  assert.deepEqual(A.back(w, room.id).map((x) => x.note).sort(), ['Is this still true?', 'Start from the second draft']);
  assert.deepEqual(A.waiting(w, room.id).map((x) => x.mark), [b.id], 'the revisit waits for its day');
  assert.ok(A.answer(w, room.id, 'met', NOW + DAY).id);
  assert.equal(A.get(w, room.id).state, 'met');
  assert.deepEqual(s.save(NOW + DAY).map((x) => x.kind), ['met']);
});

test('coming back leaves a change still to be saved to the maker, and undo where it was', () => {
  const { w, a, b, s } = small();
  A.ask(w, a.id, 'due', { at: NOW }, NOW - DAY);
  s.save(NOW - DAY);
  w.things[b.id].text = 'Read the reviews twice'; // typed, not saved yet
  const r = s.come(NOW + 1);
  assert.deepEqual(r.rows.map((x) => x.kind), ['returned']);
  const rows = s.save(NOW + 2);
  assert.deepEqual(rows.map((x) => [x.kind, x.mark]), [['edited', b.id]], 'the edit is the maker\'s own step');
  s.undo();
  assert.equal(w.things[b.id].text, 'Read the reviews');
  assert.equal(A.get(w, a.id).state, 'back', 'undoing the edit leaves the return back');
});

test('asking refuses in words; one row per mark; a deleted mark takes its row; answers only once', () => {
  const { w, room, a } = small();
  assert.match(A.ask(w, 'nope', 'due', { at: NOW }).why, /No such mark/);
  assert.match(A.ask(w, a.id, 'later', { at: NOW }).why, /one of/);
  assert.match(A.ask(w, a.id, 'due', {}).why, /time/);
  assert.match(A.answer(w, a.id, 'met').why, /Nothing/);
  A.ask(w, a.id, 'due', { at: NOW }, NOW - DAY);
  A.ask(w, a.id, 'revisit', { at: NOW + DAY, note: 'again' }, NOW - DAY);
  assert.equal(A.all(w).length, 1);
  assert.equal(A.get(w, a.id).kind, 'revisit');
  assert.match(A.answer(w, a.id, 'refused').why, /not come back/);
  A.come(w, NOW + DAY);
  assert.match(A.answer(w, a.id, 'maybe').why, /one of/);
  assert.ok(A.answer(w, a.id, 'met').id);
  assert.match(A.answer(w, a.id, 'refused').why, /Answered already/);
  A.ask(w, room.id, 'return', { note: 'hello' });
  remove(w, room.id);
  assert.deepEqual(A.all(w), [], 'the room went, and its marks with their rows');
});

test('Law 1 holds after any run of changes, the log replays it, and another copy takes it in', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rand = rng(seed);
    const { w, room, s } = small();
    const copy = app(loadWorld(JSON.parse(JSON.stringify(w))));
    let now = NOW;
    for (let i = 0; i < 60; i++) {
      now += Math.floor(rand() * DAY / 3);
      const marks = Object.keys(w.things).filter((id) => w.things[id] && P.home(w, id) === room.id);
      const m = pick(rand, marks.length ? marks : [room.id]);
      const roll = rand();
      if (roll < 0.2) create(w, room.id, { kind: 'line', text: `n${i}` }, now);
      else if (roll < 0.45) A.ask(w, m, pick(rand, ['due', 'revisit']), { at: now + (rand() - 0.3) * 3 * DAY }, now);
      else if (roll < 0.55) A.ask(w, m, 'return', { note: `note ${i}` }, now);
      else if (roll < 0.7) { const back = A.back(w); if (back.length) A.answer(w, pick(rand, back).mark, pick(rand, A.ANSWERS), now); }
      else if (roll < 0.75) A.clear(w, m);
      else if (roll < 0.8 && marks.length > 2) remove(w, m);
      else if (roll < 0.9) { s.save(now); s.come(now); continue; }
      else { s.save(now); s.come(now, (x) => A.opened(x, room.id, now)); continue; }
      s.save(now);
      for (const [id, r] of Object.entries(w.ahead)) {
        assert.equal(id, A.idOf(r.mark), `seed ${seed}: a row under its mark's id`);
        assert.ok(w.things[r.mark], `seed ${seed}: a row on a mark that is there`);
        assert.ok(A.valid(r), `seed ${seed}: a whole row`);
        assert.ok(M.same(r, A.tidy(r)), `seed ${seed}: a tidy row`);
      }
    }
    assert.ok(M.same(M.stateAt(s.log).ahead, w.ahead), `seed ${seed}: the log replays the rows`);
    M.absorb(copy.log, M.stateOf(copy.w), M.outbox(s.log, 0));
    assert.ok(M.same(copy.w.ahead, w.ahead), `seed ${seed}: another copy takes the rows in`);
    M.compact(s.log, now + 40 * DAY);
    assert.ok(M.same(M.stateAt(s.log).ahead, w.ahead), `seed ${seed}: compaction keeps what is still to come`);
  }
});

test('Law 8: a file carries what is to come and what came back, out and back, byte for byte', () => {
  const { w, room, a, b, s } = small();
  A.ask(w, a.id, 'due', { at: NOW + DAY, note: 'by Friday | firm' }, NOW);
  A.ask(w, room.id, 'return', { note: 'Start from the "second" draft' }, NOW);
  A.ask(w, b.id, 'revisit', { at: NOW - DAY }, NOW - 2 * DAY);
  A.come(w, NOW);
  s.save(NOW);
  const text = traum.write(T.read(w, room.id, { log: s.log }), { root: room.id });
  assert.match(text, /due \^\d+ \| state: waiting/);
  assert.match(text, /return \^1 \| state: waiting .*note: Start from the "second" draft$/m);
  const got = traum.read(text);
  assert.deepEqual(got.report, []);
  const w2 = emptyWorld(NOW);
  const out = model.landTables(w2, got.tables, got.root, { page: 0 });
  assert.ok(out.id);
  const rows = (x) => A.all(x).map(({ id, mark, ...r }) => [x.things[mark].text ?? x.things[mark].name, r]).sort((p, q) => (p[0] < q[0] ? -1 : 1));
  assert.deepEqual(rows(w2), rows(w));
  assert.equal(traum.write(T.read(w2, out.id), { root: out.id }).replace(/^.*(made|edited|visited|moved|returned) \^.*$\n/gm, ''), text.replace(/^.*(made|edited|visited|moved|returned) \^.*$\n/gm, ''));
});

test('budget: reads and the coming back of a big world stay quick', () => {
  const w = emptyWorld(NOW);
  const room = addRoom(w, 'Big', NOW);
  for (let i = 0; i < 1500; i++) {
    const th = create(w, room.id, { kind: 'line', text: `t${i}` }, NOW);
    if (i % 3 === 0) A.ask(w, th.id, i % 2 ? 'due' : 'revisit', { at: NOW + (i - 750) * 60e3 }, NOW);
    else if (i % 5 === 0) A.ask(w, th.id, 'return', { note: `n${i}` }, NOW);
  }
  const s = app(w);
  let t = performance.now();
  const r = s.come(NOW);
  const opened = s.come(NOW, (x) => A.opened(x, room.id, NOW));
  const coming = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < 20; i++) { A.back(w, room.id); A.waiting(w, room.id); A.next(w); }
  const reads = (performance.now() - t) / 20;
  assert.ok(r.came.length > 200 && opened.came.length > 100);
  assert.ok(coming < 150, `coming back took ${coming.toFixed(1)} ms`);
  assert.ok(reads < 20, `a read of the tray took ${reads.toFixed(1)} ms`);
});
