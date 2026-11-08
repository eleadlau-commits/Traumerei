// The moments log: the kernel's sixth table (KERNEL.md), an append-only record of every change
// to the world. Undo, Timeline, the daily record, the time scrub and the account's sync all read
// it; nothing else remembers history. Pure maths, no screen (tests/moments.test.js).
//
// A row is one change to one thing at one time:
//   { seq, time, kind, table, mark | context, step?, before?, after? }
// kind: made · edited · moved · linked · removed (a thought, group or room: `mark`), arranged (a
// room's relations: `context`), floors (how many floors: context 'floors'), visited (a room was
// gone into: `context`), undone · redone (a step taken back or forward: `step`). `table` names the
// kernel table the change is to (marks, places, links, moments). `before` and `after` are the
// whole thing as it was and as it is, so a step can be taken back (before) or replayed (after).
// Rows that land together from one save share a `step` (the seq of the first).
//
// The log is { v, seq, base, rows, undo, redo, keep }:
//   base  the state ({ things, own, pages }, at `time`) the rows build on, or null for nothing
//   undo  steps that can be taken back, oldest first; redo: steps taken back, oldest first
//   keep  days of history kept (0: forever); COMPACT days back, rows lose their `before`
// Replaying the base and the rows, in order, gives the world as it was at any time (`stateAt`).
//
// Compaction (compact) keeps the log small and the replay exact: rows older than COMPACT days are
// squashed to one row per thing per day (the thing as it was at the day's end, no `before`), so
// undo reaches COMPACT days back and the record reaches `keep` days back; rows older than `keep`
// days fold into the base; visits older than COMPACT days are forgotten (a room's light has long
// faded).

export const VERSION = 1;
export const DAY = 864e5;
export const COMPACT = 30;          // days a row keeps its `before` (how far undo reaches)
export const STEPS = 400;           // steps undo reaches back, at most
export const VISIT_GAP = 60e3;      // going into a room again within this is the same visit
export const MOST_VISITS = 40;      // visits of a room kept in `visits`
export const KINDS = Object.freeze(['made', 'edited', 'moved', 'linked', 'removed', 'arranged', 'floors', 'visited', 'undone', 'redone']);
export const CHANGES = Object.freeze(['made', 'edited', 'moved', 'linked', 'removed', 'arranged', 'floors']);

// A thing's fields that say where it is (a places row), and the one that says what it holds.
const PLACE = new Set(['x', 'y', 'parent', 'page', 'col', 'row', 'side', 'loose', 'size']);
const LINK = new Set(['members']);

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// The same value, whatever order its keys are in (a thing undone comes back with its keys in
// another order).
const canon = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',').replace(/^/, '{').concat('}') : Array.isArray(v) ? `[${v.map(canon).join(',')}]` : JSON.stringify(v) ?? 'undefined');
export const same = (a, b) => canon(a) === canon(b);
export const dayOf = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const keyOf = (r) => (r.mark != null ? `m:${r.mark}` : `c:${r.context}`);
const inverse = (kind) => (kind === 'made' ? 'removed' : kind === 'removed' ? 'made' : kind);

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

// The state the log speaks of: the three saved parts of the world that hold things.
export const stateOf = (w) => ({ things: w.things, own: w.own || {}, pages: w.pages || 1 });

// ---- Diffing: the rows that take `prev` to `next` ----

function kindOfChange(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)].filter((k) => !same(before[k], after[k])));
  keys.delete('edited');
  if (!keys.size) return null;
  if ([...keys].every((k) => PLACE.has(k))) return 'moved';
  if ([...keys].every((k) => LINK.has(k))) return 'linked';
  return 'edited';
}
const TABLE = { made: 'marks', edited: 'marks', removed: 'marks', moved: 'places', linked: 'links', arranged: 'links', floors: 'places', visited: 'moments', undone: 'moments', redone: 'moments' };

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
  for (const id of new Set([...Object.keys(prev.own || {}), ...Object.keys(next.own || {})])) {
    const a = prev.own?.[id], b = next.own?.[id];
    if (!same(a, b)) out.push({ kind: 'arranged', table: 'links', context: id, before: clone(a) ?? null, after: clone(b) ?? null });
  }
  if ((prev.pages || 1) !== (next.pages || 1)) out.push({ kind: 'floors', table: 'places', context: 'floors', before: prev.pages || 1, after: next.pages || 1 });
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
  if (r.kind === 'floors') { state.pages = value || 1; return; }
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
  const state = log.base ? clone(log.base.state) : { things: {}, own: {}, pages: 1 };
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

// The change rows that speak of a mark, oldest first.
export const of = (log, mark) => log.rows.filter((r) => r.mark === mark || (r.kind === 'visited' && r.context === mark));
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
export function changedOn(log, date) {
  const seen = new Map();
  for (const r of day(log, date)) if (r.mark != null && r.kind !== 'removed') seen.set(r.mark, r.after?.parent ?? null);
  return seen;
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
      out.push({ seq: r.seq, time: r.time, kind: back ? inverse(s.kind) : s.kind, table: s.table, ...(s.mark != null ? { mark: s.mark } : { context: s.context }),
        before: clone(back ? s.after : s.before) ?? null, after: clone(back ? s.before : s.after) ?? null });
    }
  }
  return out;
}

// The whole of a state as rows another copy can take: everything made at `at`.
export const whole = (state, at) => diff({ things: {}, own: {}, pages: 1 }, state).map((r, i) => ({ ...r, seq: i + 1, time: at }));

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
    const before = r.mark != null ? state.things[r.mark] : r.kind === 'floors' ? state.pages : state.own[r.context];
    if (same(before, r.after)) continue;
    set(state, r, r.after);
    const row = { kind: r.kind, table: r.table, ...(r.mark != null ? { mark: r.mark } : { context: r.context }), before: clone(before) ?? null, after: clone(r.after) ?? null, from: 'account' };
    landed.push(push(log, row, r.time));
  }
  return landed;
}

// ---- Compaction ----

// The kind a squashed row has for a thing, given how its day began and ended: made if it was
// made that day, else the weightiest of the day's kinds (an edit outweighs a move).
const RANK = { edited: 3, linked: 2, moved: 1, arranged: 1, floors: 1 };
const squashKind = (madeToday, best, after) => (after == null ? 'removed' : madeToday ? 'made' : best);

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
  const state = log.base ? clone(log.base.state) : { things: {}, own: {}, pages: 1 };
  const steps = new Map();
  const squashed = [];
  let touched = new Map(); // key → { row, madeToday, last }
  let dayStart = null, baseState = null, folded = false;
  const flush = () => {
    if (dayStart == null) return;
    for (const { row, madeToday, best } of touched.values()) {
      const after = row.mark != null ? state.things[row.mark] : row.kind === 'floors' ? state.pages : state.own[row.context];
      const out = { seq: row.seq, time: row.time, kind: squashKind(madeToday, best, after), table: row.table, after: clone(after) ?? null };
      if (row.mark != null) out.mark = row.mark; else out.context = row.context;
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
      for (const s of rows) land(s, r.kind === 'undone' ? inverse(s.kind) : s.kind, r.seq, r.time);
    }
    // a visit older than the horizon is forgotten
  }
  flush();
  // An undo or redo newer than the horizon of a step older than it becomes plain changes, in place.
  const kept = log.rows.filter((r) => r.time >= horizon).flatMap((r) => {
    if (!ties.has(r)) return [r];
    const back = r.kind === 'undone';
    return (steps.get(r.step) || []).map((s) => ({ seq: r.seq, time: r.time, kind: back ? inverse(s.kind) : s.kind, table: s.table,
      ...(s.mark != null ? { mark: s.mark } : { context: s.context }),
      before: clone(back ? s.after : s.before) ?? null, after: clone(back ? s.before : s.after) ?? null }));
  });
  log.rows = [...squashed, ...kept];
  if (folded) log.base = { time: floor, state: baseState };
  log.undo = log.undo.filter((s) => !oldSteps.has(s));
  log.redo = log.redo.filter((s) => !oldSteps.has(s));
  return true;
}
