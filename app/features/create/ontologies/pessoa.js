// Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they were
// written, and stays where it is dragged. A folded group floats as the one thought it is. Pessoa
// places everything itself, so it has no tray. Its own data: where each thought was dragged to.

import { roomUnits, own, shut, hash, isLeaf, groupsOf } from '../model.js';

// The i-th thought (in time order) sits on an Archimedean spiral r = bθ, spaced evenly along its
// length, nudged a little by its id so it doesn't look ruled.
export const SPIRAL = { step: 230, gap: 190 }; // px between neighbours along the spiral; between turns
export function spiralPoint(i, id = '') {
  const b = SPIRAL.gap / (2 * Math.PI);
  const theta = Math.sqrt((2 * SPIRAL.step * (i + 0.6)) / b);
  const r = b * theta;
  const h = hash(id);
  const jx = ((h & 0xff) / 255 - 0.5) * 36;
  const jy = (((h >> 8) & 0xff) / 255 - 0.5) * 28;
  return { x: r * Math.cos(theta) + jx, y: r * Math.sin(theta) + jy };
}

export default {
  id: 'pessoa',
  name: 'Pessoa',
  note: 'each thought on its own',
  order: 20,
  groups: null,

  units: (w, roomId) => roomUnits(w, roomId),

  // Where it was dragged to, or its place on the spiral. A thought inside a folded group is where
  // the group is.
  point(w, roomId, id) {
    const th = w.things[id];
    if (isLeaf(th)) {
      const folded = groupsOf(w, id).find((g) => g.folded && g.parent === roomId);
      if (folded) id = folded.id;
    }
    const placed = own(w, roomId, 'pessoa', false)[id];
    if (placed) return placed;
    const units = roomUnits(w, roomId);
    const i = units.findIndex((u) => u.id === id);
    return spiralPoint(i < 0 ? units.length : i, id);
  },

  drop(w, roomId, id, x, y) {
    if (shut(w, roomId)) return;
    own(w, roomId, 'pessoa')[id] = { x, y };
  },

  draftPoint: (w, roomId) => spiralPoint(roomUnits(w, roomId).length, 'draft'),
};
