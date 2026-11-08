// The gaps table: the kernel's fifth table (KERNEL.md), the one that lets a project be finished.
// A gap is the distance between a mark and the world, or between a mark and its maker, that the
// mark was made to close:
//
//   { mark, direction, state, openedAt, resolvedAt?, resolvedBy? }
//
// direction  'to world' (check: is the world as the mark says?) · 'from world' (do: make the
//            world as the mark says) · 'to maker' (judge: is the mark right?)
// state      'open' | 'resolved'
// resolvedBy a link id (the row that answered or did it) or the word 'judgement' (the maker
//            said so); left out while the gap is open
//
// w.gaps = { [id]: row }, one row per mark, id gap:<mark>. That is Law 5 by construction: a mark
// has one gap at most, open or resolved; opening again on a resolved mark takes the row over, and
// the moments log keeps what was. A mark whose parts carry gaps (what is *part of* it, or in a
// *relation* up to it) has a DERIVED gap: open while any part's gap is open, resolved once every
// part's is, never stored (Law 5). Its own row, if it has one, lends the direction and says when
// it was opened; its state is the parts', and that row counts for nothing further up. Reads are
// served from the table and a memo of the tallies, dropped when the gaps or links change; anything that
// writes behind this file's back (the log replaying a row) says so with touched(). No screen
// here (tests/gaps.test.js).

import * as L from './links.js';
import * as P from './places.js';

export const DIRECTIONS = Object.freeze(['to world', 'from world', 'to maker']);
export const STATES = Object.freeze(['open', 'resolved']);
export const JUDGEMENT = 'judgement';
// The link kinds that point up from a part to what holds it: through these a gap is derived.
export const UP = Object.freeze(['part of', 'relation']);

export const idOf = (mark) => `gap:${mark}`;
export const table = (w) => (w.gaps ||= {});

// ---- Versions and the memo ----

const VERSION = new WeakMap(); // w.gaps → a number from one clock, changed by every write
let clock = 0;
const bump = (t) => VERSION.set(t, ++clock);
export const version = (w) => { const t = table(w); if (!VERSION.has(t)) bump(t); return VERSION.get(t); };
// The table was written to by other hands (the log replaying rows): every memo is dropped.
export const touched = (w) => { if (w.gaps) bump(w.gaps); };

const withId = (t, id) => ({ id, ...t[id] });
const tidy = (r) => {
  const out = { mark: String(r.mark), direction: r.direction, state: r.state, openedAt: +r.openedAt };
  if (r.state === 'resolved') { out.resolvedAt = +r.resolvedAt || out.openedAt; out.resolvedBy = r.resolvedBy ? String(r.resolvedBy) : JUDGEMENT; }
  return out;
};

// ---- Reading the stored rows ----

export const get = (w, mark) => (table(w)[idOf(mark)] ? withId(table(w), idOf(mark)) : null);
export const has = (w, mark) => !!table(w)[idOf(mark)];
export const isOpen = (w, mark) => table(w)[idOf(mark)]?.state === 'open';
export const all = (w) => Object.keys(table(w)).map((id) => withId(table(w), id));
export const count = (w) => Object.keys(table(w)).length;
// The stored open rows, in a context (the marks at home there) or anywhere, oldest first.
export function opened(w, context = null) {
  const out = [];
  for (const [id, r] of Object.entries(table(w))) if (r.state === 'open' && (context == null || P.home(w, r.mark) === context)) out.push(withId(table(w), id));
  return out.sort((a, b) => a.openedAt - b.openedAt || (a.mark < b.mark ? -1 : 1));
}
export const oldest = (w, context = null) => opened(w, context)[0] || null;

// ---- The derived gap ----

// The parts of a mark whose gaps it derives from: every mark linked up to it by part of or
// relation, and their parts in turn (a set of ids; the mark itself is left out, as is anything
// a loop would bring back).
export function parts(w, mark) {
  const out = new Set();
  const stack = [mark];
  while (stack.length) {
    const m = stack.pop();
    for (const r of L.to(w, m)) {
      if (!UP.includes(r.kind) || r.from === mark || out.has(r.from)) continue;
      out.add(r.from);
      stack.push(r.from);
    }
  }
  return out;
}

// The tally over every part of `mark` that has a gap row: { open, resolved, of (= open +
// resolved), openedAt (the earliest), resolvedAt (the latest) }, read from a memo over the whole
// world that holds until the gaps or the links change. A row on a mark that is itself derived
// (some part of it has a row) does not count: that mark's gap is its parts', so its parts are
// what count above it, once (Law 5: nothing derived is stored, so nothing stored is derived).
const PROGRESS = new WeakMap(); // w.gaps → { key, map: mark → tally }
const tallyUp = (w, rows, map) => {
  for (const r of rows) {
    const seen = new Set([r.mark]);
    const stack = [r.mark];
    while (stack.length) {
      const m = stack.pop();
      for (const up of L.from(w, m)) {
        if (!UP.includes(up.kind) || seen.has(up.to)) continue;
        seen.add(up.to);
        let p = map.get(up.to);
        if (!p) map.set(up.to, (p = { open: 0, resolved: 0, of: 0, openedAt: Infinity, resolvedAt: 0 }));
        p[r.state]++; p.of++;
        p.openedAt = Math.min(p.openedAt, r.openedAt);
        if (r.state === 'resolved') p.resolvedAt = Math.max(p.resolvedAt, r.resolvedAt || 0);
        stack.push(up.to);
      }
    }
  }
  return map;
};
export function progressAll(w) {
  const t = table(w);
  const key = `${version(w)}:${L.version(w)}`;
  const memo = PROGRESS.get(t);
  if (memo && memo.key === key) return memo.map;
  const rows = Object.values(t);
  const above = tallyUp(w, rows, new Map()); // which marks have a row somewhere below them
  const map = tallyUp(w, rows.filter((r) => !above.has(r.mark)), new Map());
  PROGRESS.set(t, { key, map });
  return map;
}
const NONE = Object.freeze({ open: 0, resolved: 0, of: 0 });
export const progress = (w, mark) => { const p = progressAll(w).get(mark); return p ? { open: p.open, resolved: p.resolved, of: p.of } : { ...NONE }; };
// Whether a mark's gap is derived: some part of it carries a gap.
export const derived = (w, mark) => progress(w, mark).of > 0;

// The gap of a mark as the kernel reads it: its stored row, or, where parts carry gaps, the
// derived gap (state from the parts, direction and openedAt from its own row when it has one,
// else 'from world' and the oldest part's opening), with the progress on it. Null for a mark
// with neither.
export function of(w, mark) {
  const own = get(w, mark);
  const p = progressAll(w).get(mark);
  if (!p) return own;
  const base = own || { id: idOf(mark), mark, direction: 'from world', openedAt: p.openedAt };
  const out = { ...base, derived: true, open: p.open, resolved: p.resolved, of: p.of };
  if (p.open) { out.state = 'open'; delete out.resolvedAt; delete out.resolvedBy; }
  else { out.state = 'resolved'; out.resolvedAt = p.resolvedAt; out.resolvedBy = 'parts'; }
  return out;
}
// The effective state: 'open', 'resolved' or null.
export const stateOf = (w, mark) => of(w, mark)?.state ?? null;

// ---- Writing: the table's own writes; the world's checks (a locked context) are the caller's ----

// Puts a row in under its mark's id (a row there already is replaced). Returns the row.
export function set(w, row) {
  const t = table(w), r = tidy(row), id = idOf(r.mark);
  t[id] = r;
  bump(t);
  return withId(t, id);
}
// Takes a mark's row out. True if there was one.
export function drop(w, mark) {
  const t = table(w), id = idOf(mark);
  if (!t[id]) return false;
  delete t[id];
  bump(t);
  return true;
}

// Opens a gap on a mark: a new row, or a resolved row taken over. Returns the row, or a reason
// in words when one is open already (Law 5) or the direction is not one of the three.
export function open(w, mark, direction, now = Date.now()) {
  if (!DIRECTIONS.includes(direction)) return { why: `A direction is one of ${DIRECTIONS.join(', ')}` };
  if (isOpen(w, mark)) return { why: 'One open gap per mark: resolve it first' };
  return set(w, { mark, direction, state: 'open', openedAt: now });
}
// Resolves a mark's open gap, by a link's id or by judgement. Returns the row, or a reason.
export function resolve(w, mark, by = JUDGEMENT, now = Date.now()) {
  const r = table(w)[idOf(mark)];
  if (!r || r.state !== 'open') return { why: 'No open gap on this mark' };
  if (by !== JUDGEMENT && !L.has(w, String(by))) return { why: 'A gap is resolved by a link that exists, or by judgement' };
  return set(w, { ...r, state: 'resolved', resolvedAt: now, resolvedBy: by });
}
// Opens a resolved gap again, with its direction, from now. Returns the row, or a reason.
export function reopen(w, mark, now = Date.now()) {
  const r = table(w)[idOf(mark)];
  if (!r) return { why: 'No gap on this mark to open again' };
  if (r.state === 'open') return { why: 'The gap is open' };
  return set(w, { mark, direction: r.direction, state: 'open', openedAt: now });
}

// A copy of the rows of `ids` (a map old id → new id), each on its new mark (a copied room's
// gaps are its own).
export function copyFor(w, ids) {
  const out = {};
  for (const r of Object.values(table(w))) if (r && ids[r.mark]) out[idOf(ids[r.mark])] = { ...r, mark: ids[r.mark] };
  return out;
}

// A saved table, repaired against the marks there are: a row of no mark, of no direction or
// state, or under the wrong id, goes or is put right.
export function repair(w) {
  const t = table(w);
  for (const [id, r] of Object.entries(t)) {
    if (!r || typeof r !== 'object' || !w.things[r.mark] || !DIRECTIONS.includes(r.direction) || !STATES.includes(r.state) || !Number.isFinite(+r.openedAt) || id !== idOf(r.mark)) delete t[id];
    else t[id] = tidy(r);
  }
  touched(w);
  return t;
}
