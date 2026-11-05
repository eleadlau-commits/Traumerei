// Time's rules, with no screen: a room's thoughts in time, and the days something was written.
// m: the world's model rules (the world service's lib.model), so this file imports nothing.

// When a thought last changed: written, or written in since.
export const changed = (th) => Math.max(th.at ?? 0, th.edited ?? 0);

// The start of the day (on this device's clock) that `ms` falls in.
export function dayOf(ms) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// A room's thoughts in the order they last changed, latest last (a Twin's: both sides').
export function timeline(m, w, roomId) {
  return m.roomThoughts(w, roomId).slice().sort((a, b) => changed(a) - changed(b) || a.at - b.at);
}

// The square on the rooms page a thought sits in: its room, or that room's Twin (a side's).
export function squareOf(w, th) {
  const r = w.things[th?.parent];
  if (r?.kind !== 'room') return null;
  const up = w.things[r.parent];
  return up?.kind === 'room' ? up : r;
}

// Every day something was written or written in, newest first: { day, rooms: [{ id, n }] }, the
// rooms written in most that day first.
export function days(m, w) {
  const by = new Map();
  for (const th of Object.values(w.things)) {
    if (!m.isLeaf(th)) continue;
    const r = squareOf(w, th);
    if (!r) continue;
    const day = dayOf(changed(th));
    if (!by.has(day)) by.set(day, new Map());
    const d = by.get(day);
    d.set(r.id, (d.get(r.id) || 0) + 1);
  }
  return [...by].sort((a, b) => b[0] - a[0])
    .map(([day, rooms]) => ({ day, rooms: [...rooms].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n) }));
}
