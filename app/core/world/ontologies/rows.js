// Rows: the bare reading the core keeps for itself (open core, step 1a). Every thought of a room
// in one column, in the order it was written, nothing grouped and nothing placed by hand. It is
// what a room is seen through when no rule that sees everything is on (every plugin off), so a
// .traum still opens and can be written in. It keeps no rows of its own in the tables: nothing
// is lost or added by reading a room this way, and a rule switched on again finds the room as it was.

import { roomItems } from '../model.js';

export const ROW = 64; // world units between two rows
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
const thoughts = (w, roomId) => roomItems(w, roomId).slice().sort(byTime);

export default {
  id: 'rows',
  name: 'Rows',
  note: 'every thought in a row, as it was written',
  icon: '<path d="M5 7h14M5 12h14M5 17h14"/>',
  order: 1000,
  groups: null,
  seesAll: true,  // a room whose own rule is off may be seen through it
  bare: true,     // the core's own: listed only when no other rule is on
  units: (w, roomId) => thoughts(w, roomId),
  point(w, roomId, id) {
    const i = thoughts(w, roomId).findIndex((th) => th.id === id);
    return i < 0 ? null : { x: 0, y: i * ROW };
  },
  layout: (w, roomId) => new Map(thoughts(w, roomId).map((th, i) => [th.id, { x: 0, y: i * ROW }])),
  drop() {},      // rows are the order of writing: a drag changes nothing
  draftPoint: (w, roomId) => ({ x: 0, y: roomItems(w, roomId).length * ROW }),
};
