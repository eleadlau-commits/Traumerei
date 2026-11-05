// Time's daily record, with no screen: what the rooms page looked like at the end of each day, and
// which rooms were written in. Only changes are kept: each day holds the rooms that changed since
// the day before (`set`), the rooms that went (`gone`), and the rooms written in (`written`); a day
// with none of these holds nothing. Days older than the history kept are folded into `base`, the
// rooms page as it was on the first day still kept.
//
// record = { base: { day, rooms } | null, days: { [day]: { set?, gone?, written? } } }
// rooms  = { [id]: { name, page, col, row, size, archived, tint, light, opacity } }   (a square each)

import { dayOf, squareOf, changed } from './days.js';

export const DAY = 864e5;
// How long the history is kept (Settings → History): days, 0 for always.
export const KEEP = [{ days: 30, words: '1 month' }, { days: 365, words: '1 year' }, { days: 0, words: 'Forever' }];
export const KEEP_DEFAULT = 365;

export const emptyRecord = () => ({ base: null, days: {} });

// The rooms page now: every room on it (not a Twin's sides), as the record keeps it.
export function snapshot(w) {
  const rooms = {};
  for (const r of Object.values(w.things)) {
    if (r?.kind !== 'room' || r.parent) continue;
    rooms[r.id] = {
      name: r.name || '', page: r.page || 0, col: r.col ?? null, row: r.row ?? null, size: r.size || 1,
      archived: !!r.archived, tint: r.tint ?? null, light: r.light ?? null, opacity: r.opacity ?? null,
    };
  }
  return rooms;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortedDays = (rec) => Object.keys(rec.days).map(Number).sort((a, b) => a - b);

function apply(rooms, d) {
  for (const id of d.gone || []) delete rooms[id];
  Object.assign(rooms, d.set || {});
  return rooms;
}

// The rooms page at the end of `day` (from the record alone): { [id]: room }. A day before the
// record began gives what `base` holds, or nothing.
export function stateAt(rec, day = Infinity) {
  const rooms = { ...(rec.base?.rooms || {}) };
  for (const d of sortedDays(rec)) if (d <= day) apply(rooms, rec.days[d]);
  return rooms;
}

// The rooms written in on `day`, by the record.
export const writtenOn = (rec, day) => rec.days[dayOf(day)]?.written || [];

// The first day the record knows, or null.
export function firstDay(rec) {
  const all = sortedDays(rec);
  return rec.base ? rec.base.day : all.length ? all[0] : null;
}

// Writes today into the record: the rooms page as it is now (`now`, a snapshot), and the rooms
// written in today (`written`, ids to add). Returns the record (changed in place).
export function note(rec, now, written = [], when = Date.now()) {
  const today = dayOf(when);
  const before = stateAt(rec, today - 1);
  const set = {}, gone = [];
  for (const [id, r] of Object.entries(now)) if (!same(before[id], r)) set[id] = r;
  for (const id of Object.keys(before)) if (!(id in now)) gone.push(id);
  const was = rec.days[today]?.written || [];
  const all = [...new Set([...was, ...written])];
  const d = {};
  if (Object.keys(set).length) d.set = set;
  if (gone.length) d.gone = gone;
  if (all.length) d.written = all;
  if (Object.keys(d).length) rec.days[today] = d; else delete rec.days[today];
  return rec;
}

// Forgets the days older than `keep` days (0: keeps everything), folding them into `base`.
export function prune(rec, keep, when = Date.now()) {
  if (!keep) return rec;
  const from = dayOf(when - (keep - 1) * DAY); // the first day still kept
  const old = sortedDays(rec).filter((d) => d < from);
  if (!old.length) return rec;
  const rooms = { ...(rec.base?.rooms || {}) };
  for (const d of old) { apply(rooms, rec.days[d]); delete rec.days[d]; }
  rec.base = { day: from, rooms };
  return rec;
}

// ---- Going back: the rooms page on a past day ----

// The first day anything is known of: the record's first day, or the oldest stamp on a thought
// or room, whichever is earlier. Today when there is nothing.
export function earliest(w, rec, when = Date.now()) {
  let first = firstDay(rec) ?? dayOf(when);
  for (const th of Object.values(w.things)) if (th?.at > 0 && th.at < first) first = th.at;
  return dayOf(first);
}

// The rooms page at the end of `day`: { day, rooms, written, counts }. rooms: as the record kept
// them that day; before the record began, rebuilt from the stamps (the rooms made by then, where
// they sit now). written: the rooms written in that day (the record's, and any whose thoughts
// were last changed then). counts: per room, the thoughts made by then (those still here).
// m: the world's model rules.
export function pastBoard(m, w, rec, day) {
  const end = day + DAY - 1;
  const first = firstDay(rec);
  let rooms;
  if (first != null && day >= first) rooms = stateAt(rec, day);
  else {
    rooms = {};
    for (const [id, r] of Object.entries(snapshot(w))) if ((w.things[id].at ?? 0) <= end) rooms[id] = r;
  }
  const written = new Set(writtenOn(rec, day));
  const counts = {};
  for (const th of Object.values(w.things)) {
    if (!m.isLeaf(th)) continue;
    const sq = squareOf(w, th);
    if (!sq) continue;
    if ((th.at ?? 0) <= end) counts[sq.id] = (counts[sq.id] || 0) + 1;
    if (dayOf(changed(th)) === day) written.add(sq.id);
  }
  return { day, rooms, written: [...written].filter((id) => rooms[id]), counts };
}
