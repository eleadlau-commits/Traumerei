// The distance table: the kernel's fourth table (KERNEL.md), who a context is written for.
//
//   { context, reader }
//
// reader  'me now' · 'me later' · 'others' · 'machine', nearest to farthest
//
// w.distance = { [id]: row }, one row per context at most, id dist:<context>. A context with no
// row is written for me now. A mark's reader is the farthest declared on its way up: itself if it
// is a context, then its home, and that one's home, to the top (Law 7: inherited). So a room on a
// floor declared for others is for others whatever its own row says, and a reader only lengthens
// on the way down; nothing here or elsewhere declares a row but a maker's hand (Lock, the API's
// declare). A context declared for others or a machine is shut: nothing in it can be written,
// moved or deleted (model.shut). No screen here (tests/distance.test.js).

import * as P from './places.js';

export const READERS = Object.freeze(['me now', 'me later', 'others', 'machine']);
export const NEAREST = READERS[0];
const RANK = Object.freeze(Object.fromEntries(READERS.map((r, i) => [r, i])));
// From this reader on, a context is shut: written for someone who reads, not for its maker.
export const SHUT = RANK.others;

export const idOf = (context) => `dist:${context}`;
export const table = (w) => (w.distance ||= {});
export const rank = (reader) => RANK[reader] ?? 0;
export const farther = (a, b) => (rank(a) >= rank(b) ? a : b);

// The reader declared on a context itself, or null.
export const declared = (w, context) => table(w)[idOf(context)]?.reader ?? null;
export const all = (w) => Object.entries(table(w)).map(([id, r]) => ({ id, ...r }));
export const count = (w) => Object.keys(table(w)).length;

// The reader of a mark: the farthest declared on it (a context) and on every context it sits in,
// up its home rows to the top (a loop of homes, which repair never leaves, is cut).
export function of(w, mark) {
  const t = table(w);
  if (!Object.keys(t).length) return NEAREST; // (the usual world: nothing declared, nothing to walk)
  let best = NEAREST;
  const seen = new Set();
  for (let at = mark; at != null && !seen.has(at); at = P.home(w, at)) {
    seen.add(at);
    const r = t[idOf(at)];
    if (r && rank(r.reader) > rank(best)) best = r.reader;
  }
  return best;
}
export const isShut = (w, mark) => rank(of(w, mark)) >= SHUT;

// Declares a context for a reader; the nearest (me now) takes the row away, as no row says the
// same. Returns { id } or { why }. Whether `context` is a context (a room, a floor, a Twin) is
// the caller's check, as is the hand: nothing automatic calls this.
export function declare(w, context, reader) {
  if (!READERS.includes(reader)) return { why: `A reader is one of ${READERS.join(', ')}` };
  const id = idOf(context);
  if (reader === NEAREST) delete table(w)[id];
  else table(w)[id] = { context: String(context), reader };
  return { id };
}

// A context's row goes with it (model.remove); a copied context takes its copy's (model.copyRoom
// leaves it out: a copy starts for me now).
export const drop = (w, context) => { delete table(w)[idOf(context)]; };

// A saved table, checked: rows on contexts that are there, with a reader there is (Law 1).
export function repair(w, isContext) {
  const t = table(w);
  for (const [id, r] of Object.entries(t)) {
    if (!r || typeof r !== 'object' || !READERS.includes(r.reader) || r.reader === NEAREST || id !== idOf(r.context) || !isContext(r.context)) delete t[id];
  }
}
