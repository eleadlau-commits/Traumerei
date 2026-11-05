// Groups as shared objects. A group (a Joyce train, a Russell chapter) belongs to the ontology that
// made it, but it is one object for the whole room: every other ontology there sees it as one
// thought. Until that ontology places it, it waits in its tray, tagged by the kind of its
// outermost group (a train of trains is a Train); it can be opened there and dragged onto the
// canvas. Its members stay wherever they are in that ontology.
//
// A group made in an ontology's tray (from loose thoughts) stays in the tray too (`loose`), until
// it is dragged onto the canvas.
//
// Each ontology that places foreign groups by a point keeps it in its own data: own(w, room, of)[id]
// = { x, y } (Pessoa does so for every thought). No screen here (tests/groups.test.js).

import { groupsIn, groupsOf, itemsIn, isGroup, own, shut } from './model.js';

// The groups no group holds (with something inside), oldest first: what a room's other ontologies
// see of its groups.
export const outermost = (w, roomId) => groupsIn(w, roomId).filter((g) => !groupsOf(w, g.id).length && itemsIn(w, g.id).length);

// The outermost groups another ontology made, which ontology `of` sees as one thought each.
export const foreign = (w, roomId, of) => outermost(w, roomId).filter((g) => g.of !== of);

// Where ontology `of` placed a foreign group, or null (it waits in the tray).
export const spot = (w, roomId, of, id) => {
  const p = own(w, roomId, of, false)[id];
  return p && Number.isFinite(p.x) ? p : null;
};
// Places a thing at x, y in ontology `of` (its own data).
export function putAt(w, roomId, of, id, x, y) {
  if (shut(w, roomId)) return false;
  own(w, roomId, of)[id] = { x: Math.round(x), y: Math.round(y) };
  return true;
}

// The foreign groups ontology `of` has placed, and those still in its tray.
export const placedForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => spot(w, roomId, of, g.id));
export const trayForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => !spot(w, roomId, of, g.id));

// Whether a group of its own ontology waits in the tray (made there), and taking it out.
export const isLoose = (g) => isGroup(g) && !!g.loose;
export function place(w, id) {
  const g = w.things[id];
  if (!isGroup(g) || !g.loose) return false;
  delete g.loose;
  return true;
}

// The kind word a thought shows in a tray: a group's ontology's name for its groups ("Train",
// "Chapter"), or '' for a single thought. names: { [ontology]: word }.
export const kindTag = (th, names = {}) => (isGroup(th) ? names[th.of] || 'Group' : '');
