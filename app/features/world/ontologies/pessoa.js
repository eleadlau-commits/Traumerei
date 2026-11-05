// Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they were
// written, and stays where it is dragged. Pessoa places every thought itself, so it has no tray. Its own data: where each thought was dragged to.

import { roomUnits, own, shut, hash } from '../model.js';

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
  icon: '<circle cx="6" cy="7" r="2"/><circle cx="17" cy="6" r="2"/><circle cx="11" cy="13" r="2"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18" cy="17" r="2"/>', // each on its own
  order: 20,
  groups: null,

  units: (w, roomId) => roomUnits(w, roomId),

  // Where it was dragged to, or its place on the spiral.
  point(w, roomId, id) {
    const placed = own(w, roomId, 'pessoa', false)[id];
    if (placed) return placed;
    const units = roomUnits(w, roomId);
    const i = units.findIndex((u) => u.id === id);
    return spiralPoint(i < 0 ? units.length : i, id);
  },

  // Dragged: placed by hand.
  drop(w, roomId, id, x, y) {
    if (shut(w, roomId)) return;
    own(w, roomId, 'pessoa')[id] = { x, y };
  },

  // Clear space (clear.js): each thought is a block; one dragged was placed by hand. One pushed
  // clear keeps its new place (marked auto, so it still counts as laid out by Pessoa).
  blocks(w, roomId) {
    const places = own(w, roomId, 'pessoa', false);
    return roomUnits(w, roomId).map((u) => ({ id: u.id, thoughts: [u.id], hand: !!places[u.id] && !places[u.id].auto, at: u.at ?? 0 }));
  },

  shift(w, roomId, id, dx, dy) {
    if (shut(w, roomId)) return;
    const p = this.point(w, roomId, id);
    if (!p) return;
    const places = own(w, roomId, 'pessoa');
    places[id] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy), ...(places[id] && !places[id].auto ? {} : { auto: true }) };
  },

  draftPoint: (w, roomId) => spiralPoint(roomUnits(w, roomId).length, 'draft'),
};
