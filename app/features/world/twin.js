// A Twin: a room on the rooms page, two cells wide and one high (Borges's rule: it holds two
// ontologies), whose two sides are rooms of their own, side by side: each with its own mode (the
// same as the other's or not), its own thoughts and its own data. Nothing is shared between them;
// a thought or group can be moved across (`across`), and then it belongs to the other side alone.
// The sides are the only rooms inside a room (model.js: canHold, isTwin).

import { addRoom, create, children, kindOf, view, room, move, isTwin, isLeaf, isGroup } from './model.js';

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

// A thought or a whole group moved from its side to the other, at (x, y) there: it leaves every
// group on its own side and belongs to the other side alone. False when it can't (not on a side,
// locked).
export function across(w, id, x = 0, y = 0) {
  const th = w.things[id];
  if (!th || !(isLeaf(th) || isGroup(th))) return false;
  const to = otherSide(w, th.parent);
  return !!to && move(w, id, to.id, x, y);
}
