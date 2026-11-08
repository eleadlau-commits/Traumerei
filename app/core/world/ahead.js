// Moments ahead: the part of the moments table still to come (KERNEL.md: due and return). The log
// (moments.js) is what happened; a row here is a moment that will happen, when a mark comes back
// to you:
//
//   { mark, kind, at?, note?, set, state, back?, answered? }
//
// kind      'due' (it must be done by `at`) · 'revisit' (come back to it at `at`) · 'return' (a
//           note for the next time it, or the context it sits in, is opened: `note`, no `at`)
// note      words to meet it with (any kind may carry them; a return always does)
// set       when it was asked for
// state     'waiting' (still to come) · 'back' (it came, at `back`: it is in the Returns tray) ·
//           'met' (taken up) · 'refused' (turned down); both answers at `answered`
//
// w.ahead = { [id]: row }, one row per mark, id ahead:<mark>: a mark comes back for one reason at a
// time, as it has one gap. Asking again takes the row over; the log keeps what was, so a refusal
// is in the record for good (every write here lands as a moment: due, revisit, return, returned,
// met, refused, cleared). A timed row comes back when the app is open on or after its time
// (come); a return comes back when its context is gone into (opened). Coming back is the world's
// doing, not a step Ctrl+Z takes back; asking and answering are the maker's, and are. No screen
// here (tests/ahead.test.js).

import * as P from './places.js';

export const KINDS = Object.freeze(['due', 'revisit', 'return']);
export const STATES = Object.freeze(['waiting', 'back', 'met', 'refused']);
export const ANSWERS = Object.freeze(['met', 'refused']);
// The moment a row's change is, from what the row became (moments.js names its rows by it).
export const MOMENTS = Object.freeze(['due', 'revisit', 'return', 'returned', 'met', 'refused', 'cleared']);
export const momentOf = (after) => (after == null ? 'cleared' : after.state === 'waiting' ? after.kind : after.state === 'back' ? 'returned' : after.state);

export const idOf = (mark) => `ahead:${mark}`;
export const table = (w) => (w.ahead ||= {});
const withId = (id, r) => ({ id, ...r });
const words = (s) => (typeof s === 'string' ? s.trim() : '');

// A row as it is kept: only the fields its state has.
export function tidy(r) {
  const out = { mark: String(r.mark), kind: r.kind, set: +r.set || 0, state: r.state };
  if (r.kind !== 'return') out.at = +r.at;
  if (words(r.note)) out.note = words(r.note);
  if (r.state !== 'waiting') out.back = +r.back || out.at || out.set;
  if (ANSWERS.includes(r.state)) out.answered = +r.answered || out.back;
  return out;
}
export const valid = (r) => !!r && r.mark != null && KINDS.includes(r.kind) && STATES.includes(r.state)
  && (r.kind === 'return' ? !!words(r.note) : Number.isFinite(+r.at));

// ---- Reading ----

export const get = (w, mark) => { const r = table(w)[idOf(mark)]; return r ? withId(idOf(mark), r) : null; };
export const all = (w) => Object.entries(table(w)).map(([id, r]) => withId(id, r));
// Whether a row speaks of `context`: its mark is the context, or sits there.
const inside = (w, r, context) => context == null || r.mark === context || P.home(w, r.mark) === context;
const select = (w, state, context) => all(w).filter((r) => r.state === state && inside(w, r, context));
// The rows still to come, soonest first (a return, which has no time, after the timed ones).
export const waiting = (w, context = null) => select(w, 'waiting', context).sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.set - b.set || (a.mark < b.mark ? -1 : 1));
// The rows that came back and wait for an answer: the Returns tray, oldest first.
export const back = (w, context = null) => select(w, 'back', context).sort((a, b) => a.back - b.back || (a.at ?? 0) - (b.at ?? 0) || (a.mark < b.mark ? -1 : 1));
// The soonest time a waiting row comes back, or null.
export function next(w) {
  let t = Infinity;
  for (const r of Object.values(table(w))) if (r.state === 'waiting' && r.kind !== 'return' && r.at < t) t = r.at;
  return Number.isFinite(t) ? t : null;
}

// ---- Writing (the caller saves: one step) ----

// Asks for a mark to come back: { id } or { why }. kind 'due' or 'revisit' takes a time, 'return'
// takes words (the note for the next visit).
export function ask(w, mark, kind, { at = null, note = '' } = {}, now = Date.now()) {
  if (!w.things[mark]) return { why: 'No such mark' };
  if (!KINDS.includes(kind)) return { why: `A return is one of ${KINDS.join(', ')}` };
  if (kind !== 'return' && (at == null || at === '' || !Number.isFinite(+at))) return { why: 'A time to come back at is needed' };
  if (kind === 'return' && !words(note)) return { why: 'A note for the next visit needs words' };
  const row = tidy({ mark, kind, at, note, set: now, state: 'waiting' });
  table(w)[idOf(mark)] = row;
  return { id: idOf(mark) };
}

// Answers a mark that came back: 'met' (taken up) or 'refused'. { id } or { why }.
export function answer(w, mark, how, now = Date.now()) {
  const r = table(w)[idOf(mark)];
  if (!ANSWERS.includes(how)) return { why: `An answer is one of ${ANSWERS.join(', ')}` };
  if (!r) return { why: 'Nothing is to come back for this mark' };
  if (r.state !== 'back') return { why: r.state === 'waiting' ? 'It has not come back yet' : `Answered already: ${r.state}` };
  table(w)[idOf(mark)] = tidy({ ...r, state: how, answered: now });
  return { id: idOf(mark) };
}

// Takes back what was asked: the row goes. { id } or { why }.
export function clear(w, mark) {
  if (!table(w)[idOf(mark)]) return { why: 'Nothing is to come back for this mark' };
  delete table(w)[idOf(mark)];
  return { id: idOf(mark) };
}

// ---- Coming back (the world's doing) ----

// Every timed row whose time has come is back. Returns the marks that came back.
export function come(w, now = Date.now()) {
  const out = [];
  for (const [id, r] of Object.entries(table(w))) {
    if (r.state !== 'waiting' || r.kind === 'return' || !(r.at <= now)) continue;
    table(w)[id] = tidy({ ...r, state: 'back', back: now });
    out.push(r.mark);
  }
  return out;
}

// A context was gone into: each return waiting on it, or on a mark that sits in it, is back.
// Returns the marks that came back.
export function opened(w, context, now = Date.now()) {
  const out = [];
  for (const [id, r] of Object.entries(table(w))) {
    if (r.state !== 'waiting' || r.kind !== 'return' || !inside(w, r, context)) continue;
    table(w)[id] = tidy({ ...r, state: 'back', back: now });
    out.push(r.mark);
  }
  return out;
}

// ---- Upkeep ----

// A mark that went takes its row with it.
export const drop = (w, mark) => { delete table(w)[idOf(mark)]; };
// Every row is whole and on a mark that is there (Law 1); anything else goes.
export function repair(w) {
  const t = table(w);
  for (const [id, r] of Object.entries(t)) {
    if (!valid(r) || !w.things[r.mark] || id !== idOf(r.mark)) { delete t[id]; continue; }
    t[id] = tidy(r);
  }
}
// Rows for carried marks, renamed ({ [old id]: new id }): what is still to come comes along, an
// answered row stays behind (its record is the log's).
export function copyFor(w, ids) {
  const out = [];
  for (const r of Object.values(table(w))) if (ids[r.mark] && r.state === 'waiting') out.push({ ...r, mark: ids[r.mark] });
  return out;
}
export const set = (w, r) => { if (valid(r)) table(w)[idOf(r.mark)] = tidy(r); };
