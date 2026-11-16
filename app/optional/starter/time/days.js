// Time's rules, with no screen: a room's thoughts in time, and the days something was written.
// m: the world's model rules (the world service's lib.model); moments: the API's moments table
// (the world's log), or nothing: then a thought's own times speak. This file imports nothing.

// When a thought was last written: made, or written in since. The log knows; a thought older
// than the history kept has its own times.
export const changed = (th, moments = null) => moments?.changed(th.id) ?? Math.max(th.at ?? 0, th.edited ?? 0);

// The start of the day (on this device's clock) that `ms` falls in.
export function dayOf(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// A room's thoughts in the order they last changed, latest last (a Twin's: both sides').
export function timeline(m, w, roomId, moments = null) {
  return m.roomThoughts(w, roomId).slice().sort((a, b) => changed(a, moments) - changed(b, moments) || a.at - b.at);
}

// The square on the rooms page a thought sits in: its room, or that room's Twin (a side's).
// up(id): the context a mark is in (its home row in the places table).
export function squareOf(w, th, up) {
  const r = w.things[up(th?.id)];
  if (r?.kind !== 'room') return null;
  const t = w.things[up(r.id)];
  return t?.kind === 'room' ? t : r;
}

// Every day something was written or written in, newest first: { day, rooms: [{ id, n }] }, the
// rooms written in most that day first.
export function days(m, w, moments = null) {
  const by = new Map();
  const up = (id) => m.parentOf(w, id);
  for (const th of Object.values(w.things)) {
    if (!m.isLeaf(th)) continue;
    const r = squareOf(w, th, up);
    if (!r) continue;
    const day = dayOf(changed(th, moments));
    if (!by.has(day)) by.set(day, new Map());
    const d = by.get(day);
    d.set(r.id, (d.get(r.id) || 0) + 1);
  }
  return [...by].sort((a, b) => b[0] - a[0])
    .map(([day, rooms]) => ({ day, rooms: [...rooms].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n) }));
}

const DAY = 864e5;

// A room on a past day, everything where it is now: the thoughts made after that day (`later`)
// and those written or written in that day (`lit`), by id.
export function roomBoard(m, w, roomId, day, moments = null) {
  const end = day + DAY - 1, later = [], lit = [];
  for (const th of m.roomThoughts(w, roomId)) {
    if ((th.at ?? 0) > end) later.push(th.id);
    else if (dayOf(th.at) === day || dayOf(changed(th, moments)) === day) lit.push(th.id);
  }
  return { day, later, lit };
}

// The first day a room knows of: when it, or its first thought, was made.
export function roomFirst(m, w, roomId, when = Date.now()) {
  let first = w.things[roomId]?.at || when;
  for (const th of m.roomThoughts(w, roomId)) if (th.at > 0 && th.at < first) first = th.at;
  return dayOf(first);
}
