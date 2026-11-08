// Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they were
// written, and stays where it is dragged. Pessoa makes no groups: a group another mode made (a
// train, a chapter) is one thought here, in the tray until it is dragged onto the canvas, and its
// thoughts don't float on their own as well. Where a thought was dragged to is its 'pessoa' rule row (places.js); Pessoa keeps nothing itself.

import { roomUnits, shut, hash, isGroup } from '../model.js';
import { placedForeign, trayForeign, spot, putAt, unput, spotsOf, unplace, inForeign, waiting, wait } from '../groups.js';

// The room's thoughts Pessoa floats on their own: all but those inside another mode's group,
// which stands for them (one card, on the canvas once it is placed, or in the tray), and those
// added away from the canvas that wait in the tray (groups.js: waiting) until they are dragged out.
function ownThoughts(w, roomId) {
  const inside = inForeign(w, roomId, 'pessoa');
  return roomUnits(w, roomId).filter((th) => !inside(th.id));
}
export const ownUnits = (w, roomId) => ownThoughts(w, roomId).filter((th) => !waiting(w, roomId, 'pessoa', th.id));
const waitingThoughts = (w, roomId) => ownThoughts(w, roomId).filter((th) => waiting(w, roomId, 'pessoa', th.id));

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
  lays: true, // places every thought itself

  units: (w, roomId) => [...ownUnits(w, roomId), ...placedForeign(w, roomId, 'pessoa')],
  // New thoughts added away from the canvas, and other modes' groups not placed yet.
  tray: (w, roomId) => [...waitingThoughts(w, roomId), ...trayForeign(w, roomId, 'pessoa')].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
  placed: (w, roomId, id) => (isGroup(w.things[id]) ? !!spot(w, roomId, 'pessoa', id) : !waiting(w, roomId, 'pessoa', id)),
  // Thrown back: another mode's group loses its spot; a thought loses its place and waits in the
  // tray until it is dragged out again.
  unplace: (w, roomId, id) => unplace(w, roomId, 'pessoa', id, { lays: true }),

  // Where it was dragged to, or its place on the spiral.
  point(w, roomId, id) {
    const placed = spot(w, roomId, 'pessoa', id);
    if (placed) return placed;
    if (isGroup(w.things[id]) || waiting(w, roomId, 'pessoa', id)) return null; // in the tray
    const units = ownUnits(w, roomId);
    const i = units.findIndex((u) => u.id === id);
    return spiralPoint(i < 0 ? units.length : i, id);
  },

  // The whole room at once (rules.js), the same points as point() in one pass: each unit where it
  // was dragged, or its place on the spiral; another mode's group where it was placed.
  layout(w, roomId) {
    const out = new Map(), spots = spotsOf(w, roomId, 'pessoa');
    const units = ownUnits(w, roomId);
    units.forEach((u, i) => { const p = spots.get(u.id); out.set(u.id, p && Number.isFinite(p.x) ? p : spiralPoint(i, u.id)); });
    for (const g of placedForeign(w, roomId, 'pessoa')) out.set(g.id, spots.get(g.id));
    return out;
  },

  // Dragged: placed by hand.
  drop(w, roomId, id, x, y) {
    if (shut(w, roomId)) return;
    putAt(w, roomId, 'pessoa', id, x, y);
  },

  // Clear space (clear.js): each thought is a block; one dragged was placed by hand. One pushed
  // clear keeps its new place (marked auto, so it still counts as laid out by Pessoa).
  blocks(w, roomId) {
    const places = spotsOf(w, roomId, 'pessoa');
    return this.units(w, roomId).map((u) => ({ id: u.id, thoughts: [u.id], hand: !!places.get(u.id) && !places.get(u.id).auto, at: u.at ?? 0 }));
  },

  shift(w, roomId, id, dx, dy) {
    if (shut(w, roomId)) return;
    const p = this.point(w, roomId, id);
    if (!p) return;
    const was = spot(w, roomId, 'pessoa', id);
    putAt(w, roomId, 'pessoa', id, p.x + dx, p.y + dy, was && !was.auto ? null : { auto: true });
  },

  draftPoint: (w, roomId) => spiralPoint(roomUnits(w, roomId).length, 'draft'),

};
