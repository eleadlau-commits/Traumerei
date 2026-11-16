// Borges: the rooms page's own ontology, the way the rooms page sees its rooms (named after
// Borges's Library of Babel, whose rooms are cells, floor on floor). It has the same shape as a
// room's rules (app/core/world/ontologies/index.js), but is marked roomsPage, so it is never a
// room's mode and shows in no list inside a room. Its "room" is a floor (a page number, from 0);
// its units are the rooms on that floor; a point is a room's cell; drop() asks the tables to put a
// room on a cell (places.put), which the floor rule (the floors feature, in core) allows or not.
// Off, the rooms page places rooms by that same floor rule: nothing is lost.

import { room, cellOf, floorOf, roomsOn, span, shapeOf, put } from './world.js';

export default {
  id: 'borges',
  name: 'Borges',
  note: 'rooms on the cells of the floors',
  roomsPage: true,
  order: 0,
  // The rooms on floor `page`, oldest first.
  units: (w, page) => roomsOn(w, page),
  // Where a room sits: its cell, or null while it has none (the floor rule places it).
  point: (w, page, id) => {
    const at = room(w, id) && cellOf(w, id);
    return at ? { x: at.col, y: at.row } : null;
  },
  // Its rule: rooms sit on the floor's cells and never overlap, and a room's shape says how many
  // ontologies it holds: 1 × 1 one, a Twin (2 × 1) two side by side, 2 × 2 all of them.
  // { w, h, holds }: its cells across and down, and 1, 2 or 'all'.
  shape: (w, id) => {
    const r = room(w, id);
    if (!r) return null;
    return { ...span(r), holds: { one: 1, twin: 2, all: 'all' }[shapeOf(r)] };
  },
  // A room let go at (x, y) of floor `page` (cells): it moves there if the cells are on the board
  // and free; from another floor it comes to this one. True when it moved.
  drop: (w, page, id, x, y) => !!room(w, id) && put(id, `floor:${page}`, { col: Math.round(x), row: Math.round(y) }),
};
