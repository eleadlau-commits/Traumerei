// Borges: the rooms page's own ontology, the way the rooms page sees its rooms (named after
// Borges's Library of Babel, whose rooms are cells, floor on floor). It has the same shape as a
// room's ontologies (world/ontologies/index.js), but is marked roomsPage, so it is never a room's
// mode and shows in no list inside a room. Its "room" is a floor (a page number, from 0); its
// units are the rooms on that floor; a point is a room's cell; drop() moves a room to a cell, by
// the floor rule (rule.js). The floors feature adds it to the slot 'world.ontologies'.

import { room, floorOf, roomsOn, span, shapeOf } from './world.js';
import { move, toFloor } from './rule.js';

// board(): every floor's { cols, rows } (the preset chosen in Settings → Floors).
export function borges(board) {
  return {
    id: 'borges',
    name: 'Borges',
    note: 'rooms on the cells of the floors',
    roomsPage: true,
    order: 0,
    // The rooms on floor `page`, oldest first.
    units: (w, page) => roomsOn(w, page),
    // Where a room sits: its cell, or null while it has none (the floor rule places it).
    point: (w, page, id) => {
      const r = room(w, id);
      return r && r.col != null ? { x: r.col, y: r.row } : null;
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
    drop: (w, page, id, x, y) => {
      const r = room(w, id);
      if (!r) return false;
      const col = Math.round(x), row = Math.round(y);
      if (floorOf(w, id) === page) return move(w, id, col, row, board());
      return toFloor(w, id, page, board(), { col, row }) === true;
    },
  };
}
