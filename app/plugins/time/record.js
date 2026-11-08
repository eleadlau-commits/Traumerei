// The rooms page on a past day, read off the moments log (the API's moments table): where each
// room sat and what it was called at that day's end, which rooms were written in that day, and
// how many thoughts each held. Pure of the screen (tests/record.test.js). The log keeps as many
// days as Settings → History says (`moments.kept()`); the days before are one starting picture.

import { dayOf, squareOf } from './days.js';

export const DAY = 864e5;
export const KEEP = [{ days: 30, words: '1 month' }, { days: 365, words: '1 year' }, { days: 0, words: 'Forever' }];

// The squares on the rooms page in a set of things: the rooms that are not a Twin's sides.
export function snapshot(things) {
  const rooms = {};
  for (const r of Object.values(things)) {
    if (r?.kind !== 'room' || r.parent) continue;
    rooms[r.id] = {
      name: r.name || '', page: r.page || 0, col: r.col ?? null, row: r.row ?? null, size: r.size || 1,
      archived: !!r.archived, tint: r.tint ?? null, light: r.light ?? null, opacity: r.opacity ?? null,
    };
  }
  return rooms;
}

// The first day the slider reaches: the log's first, or the first thought's, whichever is earlier.
export function earliest(w, moments, when = Date.now()) {
  let first = moments.first() ?? when;
  for (const th of Object.values(w.things)) if (th?.at > 0 && th.at < first) first = th.at;
  return dayOf(first);
}

// The rooms page as it was at the end of `day`: { day, rooms, written, counts }. Rooms and counts
// come from the things as they were then; written is the squares whose thoughts were written
// that day.
export function pastBoard(m, w, moments, day) {
  const end = day + DAY - 1;
  const things = {};
  for (const th of moments.at(end)) things[th.id] = th;
  const then = { things };
  const rooms = snapshot(things);
  const written = new Set();
  const counts = {};
  for (const th of Object.values(things)) {
    if (!m.isLeaf(th)) continue;
    const sq = squareOf(then, th);
    if (!sq) continue;
    counts[sq.id] = (counts[sq.id] || 0) + 1;
    if (dayOf(moments.changed(th.id) ?? th.at ?? 0) === day) written.add(sq.id);
  }
  return { day, rooms, written: [...written].filter((id) => rooms[id]), counts };
}
