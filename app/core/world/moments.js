// The moments log: the kernel's sixth table (KERNEL.md), an append-only record of every change
// to the world. Undo, Timeline, the daily record, the time scrub and the account's sync all read
// it; nothing else remembers history. Pure maths, no screen (tests/moments.test.js).
//
// A row is one change to one thing at one time:
//   { seq, time, kind, table, mark | link | place | gap | context, step?, before?, after? }
// kind: made · edited · moved · removed (a thought, group or room: `mark`), linked (a row of the
// links table made, changed or gone: `link`, its id; before and after the row), moved (also a row
// of the places table made, changed or gone: `place`, its id), opened · resolved (a row of the
// gaps table made or changed: `gap`, its id; gone with its mark: `removed`), arranged (an
// ontology's own data in a room: `context`), visited
// (a room was gone into: `context`), undone · redone (a step taken back or forward: `step`).
// `table` names the kernel table the change is to (marks, places, links, moments). `before` and
// `after` are the whole thing as it was and as it is, so a step can be taken back (before) or
// replayed (after). Rows that land together from one save share a `step` (the seq of the first).
//
// The log is { v, seq, base, rows, undo, redo, keep }:
//   base  the state ({ things, links, places, own }, at `time`) the rows build on, or null for nothing
//   undo  steps that can be taken back, oldest first; redo: steps taken back, oldest first
//   keep  days of history kept (0: forever); COMPACT days back, rows lose their `before`
// Replaying the base and the rows, in order, gives the world as it was at any time (`stateAt`).
//
// Compaction (compact) keeps the log small and the replay exact: rows older than COMPACT days are
// squashed to one row per thing per day (the thing as it was at the day's end, no `before`), so
// undo reaches COMPACT days back and the record reaches `keep` days back; rows older than `keep`
// days fold into the base; visits older than COMPACT days are forgotten (a room's light has long
// faded).

import * as L from './links.js';
import * as P from './places.js';
import * as G from './gaps.js';

export const VERSION = 2; // 2: the places table (a log of version 1 starts afresh)
export const DAY = 864e5;
export const COMPACT = 30;          // days a row keeps its `before` (how far undo reaches)
export const STEPS = 400;           // steps undo reaches back, at most
export const VISIT_GAP = 60e3;      // going into a room again within this is the same visit
export const MOST_VISITS = 40;      // visits of a room kept in `visits`
export const KINDS = Object.freeze(['made', 'edited', 'moved', 'linked', 'removed', 'opened', 'resolved', 'arranged', 'visited', 'undone', 'redone']);
export const CHANGES = Object.freeze(['made', 'edited', 'moved', 'linked', 'removed', 'opened', 'resolved', 'arranged']);

// A thing's fields that say where it is (a places row).
const PLACE = new Set(['x', 'y', 'col', 'row', 'side', 'loose', 'size']);

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// The same value, whatever order its keys are in (a thing undone comes back with its keys in
// another order).
const canon = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',').replace(/^/, '{').concat('}') : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : JSON.stringify(v) ?? 'undefined');
export const same = (a, b) => canon(a) === canon(b);
export const dayOf = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const keyOf = (r) => (r.mark != null ? `m:${r.mark}` : r.link != null ? `l:${r.link}` : r.place != null ? `p:${r.place}` : r.gap != null ? `g:${r.gap}` : `c:${r.context}`);
// Which thing a row speaks of, as a row's keys: { mark } | { link } | { place } | { context }.
const who = (r) => (r.mark != null ? { mark: r.mark } : r.link != null ? { link: r.link } : r.place != null ? { place: r.place } : r.gap != null ? { gap: r.gap } : { context: r.context });
// The value a row's thing has in `state` now.
const valueIn = (state, r) => (r.mark != null ? state.things[r.mark] : r.link != null ? state.links?.[r.link] : r.place != null ? state.places?.[r.place] : r.gap != null ? state.gaps?.[r.gap] : state.own[r.context]);
const empty = () => ({ things: {}, links: {}, places: {}, gaps: {}, own: {} });
// The kind a gaps row has, from what the gap became: opened, resolved, or removed with its mark.
const gapKind = (after) => (after == null ? 'removed' : after.state === 'open' ? 'opened' : 'resolved');
// A row's kind when the step it is in is taken back: made and removed swap; a gap's kind follows
// what the gap becomes.
const inverse = (s) => (s.gap != null ? gapKind(s.before) : s.kind === 'made' ? 'removed' : s.kind === 'removed' ? 'made' : s.kind);

// A new log, building on `state` (the world as it is when the log begins) or on nothing.
export const emptyLog = (now = Date.now(), state = null) => ({ v: VERSION, seq: 0, base: state ? { time: now, state: clone(state) } : null, rows: [], undo: [], redo: [], keep: 365, made: now });

// A saved log, checked: anything of another shape starts afresh.
export function loadLog(saved, now = Date.now()) {
  if (!saved || typeof saved !== 'object' || saved.v !== VERSION || !Array.isArray(saved.rows)) return emptyLog(now);
  const log = { ...emptyLog(now), ...saved };
  log.rows = log.rows.filter((r) => r && Number.isFinite(r.seq) && Number.isFinite(r.time) && KINDS.includes(r.kind));
  const steps = new Set(log.rows.filter((r) => r.step != null && CHANGES.includes(r.kind)).map((r) => r.step));
  log.undo = (Array.isArray(log.undo) ? log.undo : []).filter((s) => steps.has(s));
  log.redo = (Array.isArray(log.redo) ? log.redo : []).filter((s) => steps.has(s));
  log.seq = Math.max(+log.seq || 0, ...log.rows.map((r) => r.seq));
  if (!Number.isFinite(log.keep) || log.keep < 0) log.keep = 365;
  return log;
}

// The state the log speaks of: the saved parts of the world that hold things.
export const stateOf = (w) => ({ things: w.things, links: w.links || {}, places: w.places || {}, gaps: w.gaps || {}, own: w.own || {} });

// ---- Diffing: the rows that take `prev` to `next` ----

function kindOfChange(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)].filter((k) => !same(before[k], after[k])));
  keys.delete('edited');
  if (!keys.size) return null;
  if ([...keys].every((k) => PLACE.has(k))) return 'moved';
  return 'edited';
}
const TABLE = { made: 'marks', edited: 'marks', removed: 'marks', moved: 'places', linked: 'links', arranged: 'links', visited: 'moments', undone: 'moments', redone: 'moments' };

// The rows (without seq or time) that turn state `prev` into state `next`; [] when they are the same.
export function diff(prev, next) {
  const out = [];
  const things = new Set([...Object.keys(prev.things), ...Object.keys(next.things)]);
  for (const id of things) {
    const a = prev.things[id], b = next.things[id];
    if (!a) out.push({ kind: 'made', table: 'marks', mark: id, after: clone(b) });
    else if (!b) out.push({ kind: 'removed', table: 'marks', mark: id, before: clone(a), after: null });
    else {
      const kind = kindOfChange(a, b);
      if (kind) out.push({ kind, table: TABLE[kind], mark: id, before: clone(a), after: clone(b) });
    }
  }
  for (const id of new Set([...Object.keys(prev.links || {}), ...Object.keys(next.links || {})])) {
    const a = prev.links?.[id], b = next.links?.[id];
    if (!same(a, b)) out.push({ kind: 'linked', table: 'links', link: id, before: clone(a) ?? null, after: clone(b) ?? null });
  }
  for (const id of new Set([...Object.keys(prev.places || {}), ...Object.keys(next.places || {})])) {
    const a = prev.places?.[id], b = next.places?.[id];
    if (!same(a, b)) out.push({ kind: 'moved', table: 'places', place: id, before: clone(a) ?? null, after: clone(b) ?? null });
  }
  for (const id of new Set([...Object.keys(prev.gaps || {}), ...Object.keys(next.gaps || {})])) {
    const a = prev.gaps?.[id], b = next.gaps?.[id];
    if (!same(a, b)) out.push({ kind: gapKind(b), table: 'gaps', gap: id, before: clone(a) ?? null, after: clone(b) ?? null });
  }
  for (const id of new Set([...Object.keys(prev.own || {}), ...Object.keys(next.own || {})])) {
    const a = prev.own?.[id], b = next.own?.[id];
    if (!same(a, b)) out.push({ kind: 'arranged', table: 'links', context: id, before: clone(a) ?? null, after: clone(b) ?? null });
  }
  return out;
}

function push(log, row, now) {
  row.seq = ++log.seq;
  row.time = now;
  log.rows.push(row);
  return row;
}

// Notes the change from `prev` to `next` as one step. Returns the rows that landed ([] if none).
export function record(log, prev, next, now = Date.now()) {
  const rows = diff(prev, next);
  if (!rows.length) return rows;
  const step = log.seq + 1;
  for (const r of rows) push(log, { ...r, step }, now);
  log.undo.push(step);
  if (log.undo.length > STEPS) log.undo.shift();
  log.redo = [];
  return rows;
}

// Notes the change from `prev` to `next` as part of the last step (or as a step of its own when
// there is none to join). Returns the rows that landed.
export function fold(log, prev, next, now = Date.now()) {
  if (!log.undo.length || log.redo.length) return record(log, prev, next, now);
  const step = log.undo[log.undo.length - 1];
  const rows = diff(prev, next);
  for (const r of rows) push(log, { ...r, step }, now);
  return rows;
}

// Notes that a room was gone into. Returns the row, or null when it is the same visit.
export function visit(log, roomId, now = Date.now()) {
  for (let i = log.rows.length - 1; i >= 0; i--) {
    const r = log.rows[i];
    if (r.kind === 'visited' && r.context === roomId) { if (now - r.time < VISIT_GAP) return null; break; }
    if (now - r.time >= VISIT_GAP) break;
  }
  return push(log, { kind: 'visited', table: 'moments', context: roomId }, now);
}

// ---- Applying rows to a state ----

function set(state, r, value) {
  if (r.mark != null) { if (value == null) delete state.things[r.mark]; else state.things[r.mark] = clone(value); return; }
  if (r.link != null) { const t = (state.links ||= {}); if (value == null) delete t[r.link]; else t[r.link] = clone(value); L.touched(state); return; }
  if (r.place != null) { const t = (state.places ||= {}); if (value == null) delete t[r.place]; else t[r.place] = clone(value); P.touched(state); return; }
  if (r.gap != null) { const t = (state.gaps ||= {}); if (value == null) delete t[r.gap]; else t[r.gap] = clone(value); G.touched(state); return; }
  if (value == null) delete state.own[r.context]; else state.own[r.context] = clone(value);
}
const apply = (state, rows) => { for (const r of rows) set(state, r, r.after); };
const revert = (state, rows) => { for (let i = rows.length - 1; i >= 0; i--) set(state, rows[i], rows[i].before); };
const stepRows = (log, step) => log.rows.filter((r) => r.step === step && CHANGES.includes(r.kind));

// A step back (back = true) or forward, applied to `state` in place. Returns the rows changed, or
// null when there is no step to take.
export function undo(log, state, back = true, now = Date.now()) {
  const from = back ? log.undo : log.redo, to = back ? log.redo : log.undo;
  if (!from.length) return null;
  const step = from.pop();
  const rows = stepRows(log, step);
  if (back) revert(state, rows); else apply(state, rows);
  to.push(step);
  push(log, { kind: back ? 'undone' : 'redone', table: 'moments', step }, now);
  return rows;
}

// The state as it was at `time` (the end of time: now), built from the base and the rows.
export function stateAt(log, time = Infinity) {
  const state = log.base ? { ...empty(), ...clone(log.base.state) } : empty();
  const steps = new Map();
  for (const r of log.rows) {
    if (r.time > time) continue; // (rows land in time order, but a clock may jump)
    if (CHANGES.includes(r.kind)) { apply(state, [r]); if (r.step != null) (steps.get(r.step) || steps.set(r.step, []).get(r.step)).push(r); }
    else if (r.kind === 'undone') revert(state, steps.get(r.step) || []);
    else if (r.kind === 'redone') apply(state, steps.get(r.step) || []);
  }
  return state;
}

// ---- Reading ----

// The change rows that speak of a mark, oldest first: its own, its visits, and the links at
// either end of which it is.
const touches = (r, mark) => (r.link != null && [r.before, r.after].some((v) => v && (v.from === mark || v.to === mark)))
  || ((r.place != null || r.gap != null) && [r.before, r.after].some((v) => v && v.mark === mark));
// (A mark's home row made or gone with the mark itself is part of its made or removed row.)
export function of(log, mark) {
  const rows = log.rows.filter((r) => r.mark === mark || (r.kind === 'visited' && r.context === mark) || touches(r, mark));
  const born = new Set(rows.filter((r) => r.mark === mark && (r.kind === 'made' || r.kind === 'removed')).map((r) => r.step ?? r.seq));
  return rows.filter((r) => !(r.place != null && (r.before == null || r.after == null) && born.has(r.step ?? r.seq)));
}
// The last time a mark was written (made or edited; not moved or linked), or null if the log
// does not know it.
export function changed(log, mark) {
  for (let i = log.rows.length - 1; i >= 0; i--) { const r = log.rows[i]; if (r.mark === mark && (r.kind === 'made' || r.kind === 'edited')) return r.time; }
  return null;
}
// Every row from `time` on (all rows for 0), oldest first.
export const since = (log, time) => log.rows.filter((r) => r.time >= time);
// The rows of the day `date` falls in.
export function day(log, date) { const start = dayOf(+date); return log.rows.filter((r) => r.time >= start && r.time < start + DAY); }
// Where attention has been: { [roomId]: [times gone in] }, the latest MOST_VISITS of each.
export function visits(log) {
  const out = {};
  for (const r of log.rows) if (r.kind === 'visited') (out[r.context] ||= []).push(r.time);
  for (const id of Object.keys(out)) if (out[id].length > MOST_VISITS) out[id] = out[id].slice(-MOST_VISITS);
  return out;
}
// The marks changed (made, edited, moved, linked) on a day, with the context each was in then.
// (The context is the room a mark was in at the day's end, read off the place rows; null for a
// room on a floor or in the Archive.)
export function changedOn(log, date) {
  const start = dayOf(+date), end = start + DAY;
  const home = new Map(), seen = new Set();
  for (const r of Object.values(log.base?.state?.places || {})) if (r && r.rule == null) home.set(r.mark, r.context);
  for (const r of log.rows) {
    if (r.time >= end) break;
    const v = r.place != null ? r.after ?? r.before : null;
    if (v && v.rule == null) { if (r.after) home.set(v.mark, v.context); else if (home.get(v.mark) === v.context) home.delete(v.mark); }
    if (r.time < start || !CHANGES.includes(r.kind)) continue;
    const m = r.mark ?? v?.mark;
    if (m != null && r.kind !== 'removed') seen.add(m);
  }
  const roomish = (c) => (c == null || c === 'archive' || /^floor:\d+$/.test(c) ? null : c);
  return new Map([...seen].map((m) => [m, roomish(home.get(m))]));
}
// The first time the log knows of, or null for an empty log.
export const first = (log) => log.base?.time ?? log.rows[0]?.time ?? null;

// ---- Carrying rows to another copy of the world (the account's sync) ----

// The rows since `seq`, as another copy can take them: change rows and visits, with an undo or
// redo of a step turned into the plain changes it made (the other copy has its own undo).
export function outbox(log, seq) {
  const steps = new Map();
  for (const r of log.rows) if (r.step != null && CHANGES.includes(r.kind)) (steps.get(r.step) || steps.set(r.step, []).get(r.step)).push(r);
  const out = [];
  for (const r of log.rows) {
    if (r.seq <= seq) continue;
    if (CHANGES.includes(r.kind) || r.kind === 'visited') { out.push(clone(r)); continue; }
    const back = r.kind === 'undone';
    for (const s of steps.get(r.step) || []) {
      out.push({ seq: r.seq, time: r.time, kind: back ? inverse(s) : s.kind, table: s.table, ...who(s),
        before: clone(back ? s.after : s.before) ?? null, after: clone(back ? s.before : s.after) ?? null });
    }
  }
  return out;
}

// The whole of a state as rows another copy can take: everything made at `at`.
export const whole = (state, at) => diff(empty(), state).map((r, i) => ({ ...r, seq: i + 1, time: at }));

// Takes rows from another copy into this log and `state`, in their order: each change lands as
// a row of its own (with this copy's `before`; no step, so it is not this copy's to undo), each
// visit as a visit. On each thing the latest word wins, by time, so a row seen before, or older
// than what this copy did since, changes nothing. Returns the rows that landed.
export function absorb(log, state, rows) {
  const last = new Map();
  for (const r of log.rows) if (r.kind !== 'visited' && r.kind !== 'undone' && r.kind !== 'redone') last.set(keyOf(r), Math.max(r.time, last.get(keyOf(r)) || 0));
  const landed = [];
  for (const r of rows) {
    if (r.kind === 'visited') { const v = visit(log, r.context, r.time); if (v) landed.push(v); continue; }
    if (!CHANGES.includes(r.kind) || !Number.isFinite(r.time)) continue;
    const key = keyOf(r);
    if (r.time <= (last.get(key) || 0)) continue;
    last.set(key, r.time);
    const before = valueIn(state, r);
    if (same(before, r.after)) continue;
    set(state, r, r.after);
    const row = { kind: r.kind, table: r.table, ...who(r), before: clone(before) ?? null, after: clone(r.after) ?? null, from: 'account' };
    landed.push(push(log, row, r.time));
  }
  return landed;
}

// ---- Compaction ----

// The kind a squashed row has for a thing, given how its day began and ended: made if it was
// made that day, else the weightiest of the day's kinds (an edit outweighs a move).
const RANK = { edited: 3, resolved: 3, opened: 3, linked: 2, moved: 1, arranged: 1 };
const squashKind = (madeToday, best, after, row) => (row.gap != null ? gapKind(after) : after == null ? 'removed' : madeToday ? 'made' : best);

// Tidies the log at `now`: rows older than COMPACT days are squashed to one per thing per day
// (keeping only `after`), days older than `keep` days (0: never) fold into the base, visits
// older than COMPACT days go, and undo cannot reach past the squashed rows. Returns true when
// anything changed.
export function compact(log, now = Date.now()) {
  const horizon = dayOf(now - COMPACT * DAY);
  const floor = log.keep ? dayOf(now - log.keep * DAY) : -Infinity;
  const old = log.rows.filter((r) => r.time < horizon);
  const oldSteps = new Set(old.map((r) => r.step).filter((s) => s != null));
  const ties = new Set(log.rows.filter((r) => r.time >= horizon && (r.kind === 'undone' || r.kind === 'redone') && oldSteps.has(r.step)));
  if (!old.length && !ties.size) return false;
  const state = log.base ? { ...empty(), ...clone(log.base.state) } : empty();
  const steps = new Map();
  const squashed = [];
  let touched = new Map(); // key → { row, madeToday, last }
  let dayStart = null, baseState = null, folded = false;
  const flush = () => {
    if (dayStart == null) return;
    for (const { row, madeToday, best } of touched.values()) {
      const after = valueIn(state, row);
      const out = { seq: row.seq, time: row.time, kind: squashKind(madeToday, best, after, row), table: row.table, after: clone(after) ?? null, ...who(row) };
      if (dayStart >= floor) squashed.push(out);
    }
    if (dayStart < floor) { baseState = clone(state); folded = true; }
    touched = new Map();
  };
  const land = (r, kind, seq, time) => {
    const key = keyOf(r), was = touched.get(key);
    const best = was && (RANK[was.best] || 0) >= (RANK[kind] || 0) ? was.best : kind;
    touched.set(key, { row: { ...r, seq, time }, madeToday: was ? was.madeToday : kind === 'made', best: best === 'made' || best === 'removed' ? kind : best });
  };
  for (const r of old) {
    const d = dayOf(r.time);
    if (d !== dayStart) { flush(); dayStart = d; }
    if (CHANGES.includes(r.kind)) {
      set(state, r, r.after);
      if (r.step != null) (steps.get(r.step) || steps.set(r.step, []).get(r.step)).push(r);
      land(r, r.kind, r.seq, r.time);
    } else if (r.kind === 'undone' || r.kind === 'redone') {
      const rows = steps.get(r.step) || [];
      if (r.kind === 'undone') revert(state, rows); else apply(state, rows);
      for (const s of rows) land(s, r.kind === 'undone' ? inverse(s) : s.kind, r.seq, r.time);
    }
    // a visit older than the horizon is forgotten
  }
  flush();
  // An undo or redo newer than the horizon of a step older than it becomes plain changes, in place.
  const kept = log.rows.filter((r) => r.time >= horizon).flatMap((r) => {
    if (!ties.has(r)) return [r];
    const back = r.kind === 'undone';
    return (steps.get(r.step) || []).map((s) => ({ seq: r.seq, time: r.time, kind: back ? inverse(s) : s.kind, table: s.table, ...who(s),
      before: clone(back ? s.after : s.before) ?? null, after: clone(back ? s.before : s.after) ?? null }));
  });
  log.rows = [...squashed, ...kept];
  if (folded) log.base = { time: floor, state: baseState };
  log.undo = log.undo.filter((s) => !oldSteps.has(s));
  log.redo = log.redo.filter((s) => !oldSteps.has(s));
  return true;
}
