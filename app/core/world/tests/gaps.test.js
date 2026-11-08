// Tests for the gaps table (Law 5: one open gap per mark, with a direction; a group's gap is
// derived, never stored). The gate of kernel phase 5: after any run of changes every mark has one
// gap row at most, under its own id, on a mark that exists; what a mark derives from its parts
// agrees with a slow scan of the links; a Russell tree of twelve plans shows its progress and
// resolves its root when every leaf resolves; the log replays and undoes gaps; a big room's
// reads stay within budget.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as L from '../links.js';
import * as P from '../places.js';
import * as G from '../gaps.js';
import * as M from '../moments.js';

const { MESSY, emptyWorld, loadWorld, create, join, remove, roomItems, groupsIn, memberIds } = model;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const state = (w) => JSON.parse(JSON.stringify(M.stateOf(w)));
const up = (w, child, parent, rule = 'russell') => L.set(w, L.relId(rule, child, parent), { from: child, to: parent, kind: 'relation', rule, label: 'under' });

// The slow way: every mark below `mark` through part-of and relation rows, by scanning the table.
function scanParts(w, mark) {
  const out = new Set(), stack = [mark];
  while (stack.length) {
    const m = stack.pop();
    for (const r of Object.values(w.links)) if (G.UP.includes(r.kind) && r.to === m && r.from !== mark && !out.has(r.from)) { out.add(r.from); stack.push(r.from); }
  }
  return out;
}

// The invariants of Law 5, checked on a world.
function lawFive(w) {
  const seen = new Set();
  for (const [id, r] of Object.entries(w.gaps)) {
    assert.ok(w.things[r.mark], `${id}: a gap on a mark that is gone`);
    assert.equal(id, G.idOf(r.mark), `${id}: not under its mark's id`);
    assert.ok(!seen.has(r.mark), `${r.mark}: two gaps`); seen.add(r.mark);
    assert.ok(G.DIRECTIONS.includes(r.direction) && G.STATES.includes(r.state), `${id}: no such direction or state`);
    if (r.state === 'open') assert.equal(r.resolvedBy, undefined, `${id}: open yet resolved by something`);
    else assert.ok(r.resolvedBy === G.JUDGEMENT || w.links[r.resolvedBy] || r.resolvedBy, `${id}: resolved by nothing`);
  }
  for (const th of Object.values(w.things)) {
    const parts = scanParts(w, th.id);
    const want = { open: 0, resolved: 0, of: 0 };
    const hasRowBelow = (m) => [...scanParts(w, m)].some((x) => w.gaps[G.idOf(x)]);
    for (const m of parts) { const g = w.gaps[G.idOf(m)]; if (g && !hasRowBelow(m)) { want[g.state]++; want.of++; } } // (a derived mark's own row counts for nothing)
    assert.deepEqual(G.progress(w, th.id), want, `progress of ${th.id}`);
    const read = G.of(w, th.id);
    if (want.of) { assert.ok(read.derived, `${th.id} derives yet reads its own`); assert.equal(read.state, want.open ? 'open' : 'resolved'); }
    else assert.equal(read?.derived, undefined, `${th.id} reads derived with no parts`);
  }
  // Nothing derived is stored: a row's state is its own, never a tally.
  for (const r of Object.values(w.gaps)) assert.equal(r.open, undefined);
}

// One random change to the messy room. Returns a word for it.
function step(w, rand, now) {
  const items = roomItems(w, MESSY), gs = groupsIn(w, MESSY), all = [...items, ...gs];
  const r = rand();
  if (r < 0.2 || items.length < 3) return create(w, MESSY, { kind: 'line', text: `t${Math.floor(rand() * 1e6)}` }, now) ? 'made' : 'nothing';
  if (r < 0.45) { const g = G.open(w, pick(rand, all).id, pick(rand, G.DIRECTIONS), now); return g.why ? 'refused' : 'opened'; }
  if (r < 0.6) { const open = G.opened(w); if (!open.length) return 'nothing'; const g = pick(rand, open); return G.resolve(w, g.mark, rand() < 0.3 ? (L.from(w, g.mark)[0]?.id ?? G.JUDGEMENT) : G.JUDGEMENT, now).why ? 'refused' : 'resolved'; }
  if (r < 0.68) { const done = G.all(w).filter((g) => g.state === 'resolved'); return done.length ? (G.reopen(w, pick(rand, done).mark, now), 'reopened') : 'nothing'; }
  if (r < 0.8) return join(w, (gs.length && rand() < 0.7 ? pick(rand, gs) : create(w, MESSY, { kind: 'group', of: rand() < 0.5 ? 'joyce' : 'sets' }, now)).id, pick(rand, items).id) ? 'joined' : 'nothing';
  if (r < 0.88) { const [a, b] = [pick(rand, items), pick(rand, items)]; if (a === b || L.has(w, L.relId('russell', b.id, a.id))) return 'nothing'; up(w, a.id, b.id); return 'related'; }
  if (r < 0.95) { remove(w, pick(rand, all).id); return 'removed'; }
  if (gs.length) { const g = pick(rand, gs); const m = memberIds(w, g.id); return m.length ? (model.leave(w, g.id, pick(rand, m)), 'left') : 'nothing'; }
  return 'nothing';
}

test('the table: one row per mark under gap:<mark>, open or resolved, by a link or by judgement', () => {
  const w = emptyWorld(1);
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 2), b = create(w, MESSY, { kind: 'line', text: 'b' }, 3);
  assert.equal(G.of(w, a.id), null);
  assert.equal(G.stateOf(w, a.id), null);
  assert.deepEqual(G.open(w, a.id, 'sideways'), { why: 'A direction is one of to world, from world, to maker' });
  assert.deepEqual(G.open(w, a.id, 'to world', 10), { id: `gap:${a.id}`, mark: a.id, direction: 'to world', state: 'open', openedAt: 10 });
  assert.match(G.open(w, a.id, 'to maker', 11).why, /One open gap per mark/);
  assert.ok(G.isOpen(w, a.id) && !G.isOpen(w, b.id));
  assert.equal(G.count(w), 1);
  // Resolved by a link that is there, or by judgement; not by a link that is not.
  assert.match(G.resolve(w, a.id, 'rel:nothing', 12).why, /link that exists/);
  const link = up(w, a.id, b.id).id;
  assert.deepEqual(G.resolve(w, a.id, link, 12), { id: `gap:${a.id}`, mark: a.id, direction: 'to world', state: 'resolved', openedAt: 10, resolvedAt: 12, resolvedBy: link });
  assert.match(G.resolve(w, a.id, G.JUDGEMENT, 13).why, /No open gap/);
  assert.deepEqual(G.reopen(w, a.id, 14), { id: `gap:${a.id}`, mark: a.id, direction: 'to world', state: 'open', openedAt: 14 });
  assert.match(G.reopen(w, a.id, 15).why, /is open/);
  assert.equal(G.resolve(w, a.id, undefined, 16).resolvedBy, 'judgement');
  // Opened again after resolving: the row is taken over, with the new direction.
  assert.equal(G.open(w, a.id, 'from world', 17).direction, 'from world');
  assert.deepEqual(G.opened(w).map((g) => g.mark), [a.id]);
  assert.deepEqual(G.opened(w, MESSY).map((g) => g.mark), [a.id]);
  assert.deepEqual(G.opened(w, 'floor:0'), []);
  assert.equal(G.oldest(w).mark, a.id);
  // Written behind the memo's back (as the log does), then told: read true.
  w.gaps[`gap:${b.id}`] = { mark: b.id, direction: 'to maker', state: 'open', openedAt: 5 };
  G.touched(w);
  assert.equal(G.oldest(w).mark, b.id);
  assert.ok(G.drop(w, a.id) && !G.drop(w, a.id));
  lawFive(w);
});

test('a mark with gapped parts derives its gap: open while any part is open, resolved once all are, never stored', () => {
  const w = emptyWorld(1);
  const g = create(w, MESSY, { kind: 'group', of: 'sets' }, 2);
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 3), b = create(w, MESSY, { kind: 'line', text: 'b' }, 4);
  join(w, g.id, a.id); join(w, g.id, b.id);
  assert.equal(G.of(w, g.id), null);
  G.open(w, a.id, 'from world', 10);
  assert.deepEqual(G.progress(w, g.id), { open: 1, resolved: 0, of: 1 });
  const d = G.of(w, g.id);
  assert.deepEqual(d, { id: `gap:${g.id}`, mark: g.id, direction: 'from world', openedAt: 10, derived: true, open: 1, resolved: 0, of: 1, state: 'open' });
  assert.ok(G.derived(w, g.id) && !G.derived(w, a.id));
  assert.equal(w.gaps[`gap:${g.id}`], undefined); // never stored
  G.open(w, b.id, 'to world', 11);
  G.resolve(w, a.id, G.JUDGEMENT, 12);
  assert.deepEqual(G.progress(w, g.id), { open: 1, resolved: 1, of: 2 });
  assert.equal(G.stateOf(w, g.id), 'open');
  G.resolve(w, b.id, G.JUDGEMENT, 13);
  assert.deepEqual({ state: G.of(w, g.id).state, resolvedAt: G.of(w, g.id).resolvedAt, resolvedBy: G.of(w, g.id).resolvedBy }, { state: 'resolved', resolvedAt: 13, resolvedBy: 'parts' });
  // Its own row, when it has one, lends the direction and opening; the state stays the parts'.
  G.open(w, g.id, 'to maker', 14); // (the table allows it; the API refuses it: v2.js)
  assert.deepEqual({ direction: G.of(w, g.id).direction, openedAt: G.of(w, g.id).openedAt, state: G.of(w, g.id).state }, { direction: 'to maker', openedAt: 14, state: 'resolved' });
  // A part leaving the group takes its gap out of the tally; a diamond counts a gap once.
  model.leave(w, g.id, b.id);
  assert.deepEqual(G.progress(w, g.id), { open: 0, resolved: 1, of: 1 });
  const h = create(w, MESSY, { kind: 'group', of: 'sets' }, 15);
  join(w, h.id, a.id); up(w, h.id, g.id, 'web');
  assert.deepEqual(G.progress(w, g.id), { open: 0, resolved: 1, of: 1 });
  G.reopen(w, a.id, 16);
  assert.deepEqual(G.progress(w, g.id), { open: 1, resolved: 0, of: 1 });
  assert.deepEqual(G.progress(w, h.id), { open: 1, resolved: 0, of: 1 });
  lawFive(w);
});

test('the gate: a Russell tree of twelve plans shows its progress and resolves its root when every leaf resolves', () => {
  const w = emptyWorld(1);
  const room = model.addRoom(w, 'Thesis', 2);
  let t = 10;
  const plan = (text, parent = null) => { const th = create(w, room.id, { kind: 'line', text }, t++); if (parent) up(w, th.id, parent.id); G.open(w, th.id, 'from world', t++); return th; };
  // The root, two chapters under it, three sections under each chapter, three leaves under one section: twelve plans.
  const root = plan('Finish the thesis');
  const ch = [plan('Part one', root), plan('Part two', root)];
  const secs = ch.flatMap((c) => [1, 2, 3].map((i) => plan(`Section ${i}`, c)));
  const leaves = [1, 2, 3].map((i) => plan(`Leaf ${i}`, secs[0]));
  assert.equal(G.count(w), 12);
  const all = [root, ...ch, ...secs, ...leaves];
  // What counts up the tree is the leaves' rows (eight): a chapter's or section's own row is derived from them and counts for nothing above it.
  assert.deepEqual(G.progress(w, root.id), { open: 8, resolved: 0, of: 8 });
  assert.deepEqual(G.progress(w, ch[0].id), { open: 5, resolved: 0, of: 5 });
  assert.deepEqual(G.progress(w, secs[0].id), { open: 3, resolved: 0, of: 3 });
  assert.deepEqual(G.progress(w, leaves[0].id), { open: 0, resolved: 0, of: 0 });
  assert.equal(G.of(w, root.id).state, 'open');
  // Resolving leaves moves the progress up the tree.
  for (const l of leaves) G.resolve(w, l.id, G.JUDGEMENT, t++);
  assert.deepEqual(G.progress(w, secs[0].id), { open: 0, resolved: 3, of: 3 });
  assert.equal(G.of(w, secs[0].id).state, 'resolved'); // (its own row is still open: derived wins, never stored)
  assert.equal(w.gaps[G.idOf(secs[0].id)].state, 'open');
  assert.deepEqual(G.progress(w, root.id), { open: 5, resolved: 3, of: 8 });
  assert.deepEqual(G.progress(w, ch[0].id), { open: 2, resolved: 3, of: 5 });
  assert.equal(G.of(w, root.id).state, 'open');
  // The leaves of the tree are the plans with no gapped parts: resolve every one, and the root resolves.
  const isLeaf = (th) => G.progress(w, th.id).of === 0;
  for (const th of all) if (isLeaf(th) && G.isOpen(w, th.id)) G.resolve(w, th.id, G.JUDGEMENT, t++);
  assert.deepEqual(G.progress(w, root.id), { open: 0, resolved: 8, of: 8 });
  assert.equal(G.of(w, root.id).state, 'resolved');
  assert.equal(G.of(w, root.id).resolvedBy, 'parts');
  assert.deepEqual(G.opened(w, room.id).map((g) => g.mark).filter((m) => isLeaf(w.things[m])), []);
  // One leaf opened again: the root is open again, through every level.
  G.reopen(w, leaves[1].id, t++);
  for (const th of [secs[0], ch[0], root]) assert.equal(G.of(w, th.id).state, 'open', `${th.text} should be open again`);
  assert.equal(G.of(w, ch[1].id).state, 'resolved');
  lawFive(w);
});

test('Law 5 holds through a thousand random changes, and a world read back keeps only true rows', () => {
  const rand = rng(5);
  let w = emptyWorld(1), now = 10;
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    seen.add(step(w, rand, now++));
    if (i % 50 === 49) { lawFive(w); w = loadWorld(JSON.parse(JSON.stringify(w)), now); lawFive(w); }
  }
  for (const word of ['made', 'opened', 'resolved', 'reopened', 'joined', 'related', 'removed']) assert.ok(seen.has(word), `never ${word}`);
  assert.ok(G.count(w) > 0);
  // A saved table with rubbish in it is repaired on load: a gap on a mark that is gone, a wrong id, a bad state.
  const saved = JSON.parse(JSON.stringify(w));
  saved.gaps['gap:nobody'] = { mark: 'nobody', direction: 'to world', state: 'open', openedAt: 1 };
  const some = Object.values(saved.gaps)[0].mark;
  saved.gaps['gap:wrong'] = { mark: some, direction: 'to world', state: 'open', openedAt: 1 };
  saved.gaps[G.idOf(some)].state = 'half';
  const back = loadWorld(saved, now);
  assert.equal(back.gaps['gap:nobody'], undefined);
  assert.equal(back.gaps['gap:wrong'], undefined);
  assert.equal(back.gaps[G.idOf(some)], undefined);
  lawFive(back);
  // Removing a mark takes its gap with it; a group left empty goes with its gap too.
  const g = create(w, MESSY, { kind: 'group', of: 'sets' }, now), m = create(w, MESSY, { kind: 'line', text: 'm' }, now);
  join(w, g.id, m.id); G.open(w, g.id, 'to maker', now);
  remove(w, m.id);
  assert.ok(!w.things[g.id] && !w.gaps[G.idOf(g.id)] && !w.gaps[G.idOf(m.id)]);
  lawFive(w);
});

test('every gap is a moment: opened and resolved rows land in the log, undo takes them back, replay and compaction keep them', () => {
  const w = emptyWorld(1);
  const log = M.emptyLog(5, M.stateOf(w));
  let prev = state(w);
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 6);
  M.record(log, prev, state(w), 6); prev = state(w);
  G.open(w, a.id, 'from world', 10);
  let rows = M.record(log, prev, state(w), 10); prev = state(w);
  assert.deepEqual(rows.map((r) => [r.kind, r.table, r.gap]), [['opened', 'gaps', `gap:${a.id}`]]);
  assert.equal(rows[0].before, null);
  assert.equal(rows[0].after.state, 'open');
  G.resolve(w, a.id, G.JUDGEMENT, 20);
  rows = M.record(log, prev, state(w), 20); prev = state(w);
  assert.deepEqual(rows.map((r) => [r.kind, r.table]), [['resolved', 'gaps']]);
  assert.deepEqual(M.of(log, a.id).map((r) => r.kind), ['made', 'opened', 'resolved']);
  assert.equal(M.stateAt(log, 15).gaps[`gap:${a.id}`].state, 'open');
  assert.equal(M.stateAt(log, 25).gaps[`gap:${a.id}`].state, 'resolved');
  // Undo: the resolve is taken back in the world itself, and read back open.
  const undone = M.undo(log, w, true, 30);
  assert.equal(undone.length, 1);
  assert.equal(w.gaps[`gap:${a.id}`].state, 'open');
  assert.ok(G.isOpen(w, a.id)); // (the memo was told)
  M.undo(log, w, true, 31);
  assert.equal(w.gaps[`gap:${a.id}`], undefined);
  M.undo(log, w, false, 32);
  assert.equal(w.gaps[`gap:${a.id}`].state, 'open');
  // Removing the mark removes its gap, as one step; the outbox says what became of the gap.
  prev = state(w);
  remove(w, a.id);
  rows = M.record(log, prev, state(w), 40);
  assert.deepEqual(rows.filter((r) => r.gap).map((r) => r.kind), ['removed']);
  const out = M.outbox(log, 0);
  assert.ok(out.some((r) => r.gap && r.kind === 'opened') && out.some((r) => r.gap && r.kind === 'removed'));
  // An undo in the outbox reads as the plain change it made: the redo of the open is an 'opened'.
  const redoRows = out.filter((r) => r.gap && r.seq === log.rows.find((x) => x.kind === 'redone').seq);
  assert.deepEqual(redoRows.map((r) => r.kind), ['opened']);
  // Compaction, long after: the day squashes to one row per thing, the gap's by what it became.
  const old = M.emptyLog(5, M.stateOf(emptyWorld(1)));
  const w2 = emptyWorld(1), b = create(w2, MESSY, { kind: 'line', text: 'b' }, 2);
  let p = state(emptyWorld(1));
  M.record(old, p, (p = state(w2)), 100);
  G.open(w2, b.id, 'to world', 200); M.record(old, p, (p = state(w2)), 200);
  G.resolve(w2, b.id, G.JUDGEMENT, 300); M.record(old, p, (p = state(w2)), 300);
  assert.ok(M.compact(old, 300 + (M.COMPACT + 2) * M.DAY));
  const squashed = old.rows.filter((r) => r.gap);
  assert.deepEqual(squashed.map((r) => r.kind), ['resolved']);
  assert.equal(squashed[0].after.state, 'resolved');
  assert.equal(M.stateAt(old).gaps[`gap:${b.id}`].state, 'resolved');
});

test('budget: a 1,500-thought room with a gap on every thought reads its open gaps and its progress fast', () => {
  const w = emptyWorld(1);
  const room = model.addRoom(w, 'Big', 2);
  let t = 10;
  const chapters = [];
  for (let c = 0; c < 30; c++) {
    const ch = create(w, room.id, { kind: 'line', text: `Chapter ${c}` }, t++);
    if (c) up(w, ch.id, chapters[Math.floor(c / 3)].id);
    chapters.push(ch);
    for (let i = 0; i < 49; i++) { const th = create(w, room.id, { kind: 'line', text: `t${c}.${i}` }, t++); up(w, th.id, ch.id); G.open(w, th.id, i % 2 ? 'from world' : 'to world', t++); }
  }
  assert.equal(roomItems(w, room.id).length, 1500);
  const t0 = performance.now();
  const open = G.opened(w, room.id);
  const p = G.progress(w, chapters[0].id);
  const took = performance.now() - t0;
  assert.equal(open.length, 1470);
  assert.deepEqual(p, { open: 1470, resolved: 0, of: 1470 });
  assert.ok(took < 150, `reads took ${took.toFixed(1)} ms`);
  const t1 = performance.now();
  for (let i = 0; i < 1500; i++) G.of(w, chapters[i % 30].id); // memoised: the tally holds until a table changes
  assert.ok(performance.now() - t1 < 50, `1,500 reads off the memo took ${(performance.now() - t1).toFixed(1)} ms`);
  G.resolve(w, open[0].mark, G.JUDGEMENT, t++);
  const t2 = performance.now();
  assert.deepEqual(G.progress(w, chapters[0].id), { open: 1469, resolved: 1, of: 1470 });
  assert.ok(performance.now() - t2 < 150, `a read after a change took ${(performance.now() - t2).toFixed(1)} ms`);
});
