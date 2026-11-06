// A Twin: a room on the rooms page, two cells wide and one high (Borges's rule: it holds two
// ontologies), whose two sides are rooms of their own, side by side: each with its own mode (the
// same as the other's or not), its own thoughts and its own data. Nothing is shared between them;
// a thought or group can be moved across (`across`), and then it belongs to the other side alone.
// The sides are the only rooms inside a room (model.js: canHold, isTwin).

import { addRoom, create, children, kindOf, view, room, move, isTwin, isLeaf, isGroup, rooms, shut, MESSY } from './model.js';

export { isTwin };

// Makes a Twin on floor `page` (where.page), its sides seen through `modes` ([left, right], e.g.
// ['joyce', 'russell']). Returns the Twin (with no cell yet: the floors feature places it), or null.
export function addTwin(w, name = 'Untitled', now = Date.now(), where = {}, modes = []) {
  const t = addRoom(w, name, now, where);
  if (!t) return null;
  t.size = 'twin';
  for (const side of [0, 1]) {
    const s = create(w, t.id, { kind: 'room', name: side ? 'Right' : 'Left', side }, now);
    if (s && modes[side]) view(w, s.id).mode = modes[side];
  }
  return t;
}

// A Twin's two sides, left then right ([] for any other room).
export function sides(w, id) {
  if (!isTwin(room(w, id))) return [];
  return children(w, id).filter((th) => kindOf(th) === 'room').sort((a, b) => (a.side || 0) - (b.side || 0));
}

// The Twin a side belongs to, or null (any other room).
export const twinOf = (w, id) => { const r = room(w, id); const t = r && w.things[r.parent]; return isTwin(t) ? t : null; };

// The other side of a Twin's side, or null.
export function otherSide(w, id) {
  const t = twinOf(w, id);
  return t ? sides(w, t.id).find((s) => s.id !== id) || null : null;
}

// A room's name as a place to move to: a Twin's side is "Pair · Left" / "Pair · Right", any other
// room its own name.
export function placeName(w, id) {
  const r = room(w, id);
  const t = twinOf(w, id);
  return t ? `${t.name} · ${r.side ? 'Right' : 'Left'}` : r?.name ?? '';
}

// The rooms a thought in room `from` can be moved to, as [{ id, name }]: every room on the rooms
// page but `from`, a Twin as its two sides (a Twin itself holds no thoughts), none locked. Inside a
// side, the other side comes first; then Messy thoughts, then the rest by name.
export function moveTargets(w, from) {
  const out = [];
  for (const r of rooms(w)) for (const x of isTwin(r) ? sides(w, r.id) : [r]) {
    if (x.id !== from && !shut(w, x.id)) out.push({ id: x.id, name: placeName(w, x.id) });
  }
  const other = otherSide(w, from)?.id;
  const rank = (x) => (x.id === other ? 0 : x.id === MESSY ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// A thought or a whole group moved from its side to the other, at (x, y) there: it leaves every
// group on its own side and belongs to the other side alone. False when it can't (not on a side,
// locked). A group going to a side seen through another mode becomes shared (groups.js): one
// object there, standing for its thoughts, so they don't also wait loose in that mode's tray.
export function across(w, id, x = 0, y = 0) {
  const th = w.things[id];
  if (!th || !(isLeaf(th) || isGroup(th))) return false;
  const to = otherSide(w, th.parent);
  if (!to || !move(w, id, to.id, x, y)) return false;
  if (isGroup(th) && th.of !== view(w, to.id).mode) th.shared = true;
  return true;
}
