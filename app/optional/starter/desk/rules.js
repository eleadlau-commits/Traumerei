// Desk's rules: plain functions that don't need the screen, so tests can check them. The desk is
// what waits on you across every room: each open gap (to check, to do, to judge) and each moment
// that came back (due, revisit, a note for this visit), gathered by the room it is at home in, or
// by floor and then room. Done is no open gaps.

const DAY = 864e5;
export const WORDS = Object.freeze({ 'to world': 'To check', 'from world': 'To do', 'to maker': 'To judge' });
export const BY = Object.freeze(['room', 'floor']);

// A day, in words: "today", "yesterday", "6 Nov", "6 Nov 2025".
export function dayWords(ms, now = Date.now()) {
  const start = (x) => { const d = new Date(x); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((start(now) - start(ms)) / DAY);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(d.getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' }) });
}

// Why an item is on the desk: "To do, since 6 Nov", "Due yesterday", "Revisit", "Note for this visit".
export function why(item, now = Date.now()) {
  if (item.kind === 'gap') return `${WORDS[item.direction] || 'Open'}, since ${dayWords(item.at, now)}`;
  if (item.kind === 'due') return `Due ${dayWords(item.at, now)}`;
  if (item.kind === 'revisit') return 'Revisit';
  return 'Note for this visit';
}

// The desk's items from the API's rows: open gaps (t.gaps.opened()) and what came back
// (t.moments.returns()), each with the room it is at home in. `place(mark)` answers
// { room, roomName, floor, floorName, floorOrder } or null for a mark in no room (left out).
// A mark both back and gapped shows once, as back (it asked to be seen today).
export function items(gaps, back, place) {
  const out = [], seen = new Set();
  for (const r of back || []) {
    const p = place(r.mark);
    if (!p || seen.has(r.mark)) continue;
    seen.add(r.mark);
    out.push({ mark: r.mark, kind: r.kind, at: r.kind === 'due' ? r.at : (r.back ?? r.at), note: r.note || '', back: true, ...p });
  }
  for (const g of gaps || []) {
    const p = place(g.mark);
    if (!p || seen.has(g.mark)) continue;
    seen.add(g.mark);
    out.push({ mark: g.mark, kind: 'gap', direction: g.direction, at: g.openedAt, back: false, ...p });
  }
  return out;
}

// Back first, then the longest waiting.
const byWait = (a, b) => (b.back - a.back) || (a.at - b.at);

// Items gathered by room: [{ room, name, items, back }], a room with something back first, then
// the room whose oldest item has waited longest.
export function byRoom(list) {
  const rooms = new Map();
  for (const it of list) {
    if (!rooms.has(it.room)) rooms.set(it.room, { room: it.room, name: it.roomName, floorOrder: it.floorOrder, items: [] });
    rooms.get(it.room).items.push(it);
  }
  const out = [...rooms.values()];
  for (const r of out) { r.items.sort(byWait); r.back = r.items.filter((i) => i.back).length; }
  return out.sort((a, b) => ((b.back > 0) - (a.back > 0)) || byWait(a.items[0], b.items[0]));
}

// Items gathered by floor, then room: [{ floor, name, rooms }], floors in their order (the
// Archive, order Infinity, last).
export function byFloor(list) {
  const floors = new Map();
  for (const it of list) {
    if (!floors.has(it.floor)) floors.set(it.floor, { floor: it.floor, name: it.floorName, order: it.floorOrder, list: [] });
    floors.get(it.floor).list.push(it);
  }
  return [...floors.values()].sort((a, b) => a.order - b.order).map((f) => ({ floor: f.floor, name: f.name, rooms: byRoom(f.list) }));
}

// The count line at the top: "5 open gaps · 2 back", or '' for an empty desk.
export function summary(list) {
  const back = list.filter((i) => i.back).length, gaps = list.length - back;
  const parts = [];
  if (gaps) parts.push(`${gaps} open gap${gaps === 1 ? '' : 's'}`);
  if (back) parts.push(`${back} back`);
  return parts.join(' · ');
}

// The tab's name on the dock's strip: "Desk · 7", or "Desk".
export const label = (n) => (n ? `Desk · ${n}` : 'Desk');

// A mark's words cut to one line.
export const firstLine = (text, most = 80) => { const s = String(text || '').split('\n').find((l) => l.trim())?.trim() || 'Untitled'; return s.length > most ? `${s.slice(0, most - 1)}…` : s; };

// Arrow keys in the list: the next row's index from `i` of `n` (stops at the ends).
export const step = (i, n, key) => (key === 'ArrowDown' ? Math.min(n - 1, i + 1) : key === 'ArrowUp' ? Math.max(0, i - 1) : key === 'Home' ? 0 : key === 'End' ? n - 1 : i);
