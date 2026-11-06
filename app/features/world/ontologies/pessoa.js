// Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they were
// written, and stays where it is dragged. Pessoa makes no groups: a group another mode made (a
// train, a chapter) is one thought here, in the tray until it is dragged onto the canvas, and its
// thoughts don't float on their own as well. Its own data: where each thought was dragged to.

import { roomUnits, own, shut, hash, isGroup } from '../model.js';
import { placedForeign, trayForeign, spot, unplace, inForeign, waiting, wait } from '../groups.js';

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

// In a .traum file (the roomfile feature): its # In pessoa section.
//   at: ^a 120 40 [auto]   placed at a point (auto: pushed there to keep clear, not dragged); a
//                          group another mode made is on the canvas only when it has one
//   on canvas: ^b ^c        on the spiral, where Pessoa lays it (the same as no line)
//   tray: ^g ^n             another mode's group not placed yet (the same as no line), or a thought
//                          added away from the canvas, waiting until it is dragged out
const traum = {
  write(w, roomId, c) {
    const places = own(w, roomId, 'pessoa', false);
    const out = [];
    const spiral = [];
    for (const th of ownUnits(w, roomId)) {
      const p = places[th.id];
      if (!c.ref(th.id)) continue;
      if (p && Number.isFinite(p.x)) out.push(`at: ${c.ref(th.id)} ${p.x} ${p.y}${p.auto ? ' auto' : ''}`);
      else spiral.push(c.ref(th.id));
    }
    for (const g of placedForeign(w, roomId, 'pessoa')) { const p = spot(w, roomId, 'pessoa', g.id); if (c.ref(g.id)) out.push(`at: ${c.ref(g.id)} ${p.x} ${p.y}${p.auto ? ' auto' : ''}`); }
    if (spiral.length) out.push(`on canvas: ${spiral.join(' ')}`);
    const tray = [...waitingThoughts(w, roomId), ...trayForeign(w, roomId, 'pessoa')].map((g) => c.ref(g.id)).filter(Boolean);
    if (tray.length) out.push(`tray: ${tray.join(' ')}`);
    return out;
  },
  read(w, roomId, lines, c) {
    const placed = new Set();
    for (const l of lines) {
      if (l.key === 'at') {
        const id = c.thing(l.values[0], l.line);
        const [x, y] = [l.values[1], l.values[2]].map((v) => (v?.t === 'num' ? v.v : null));
        if (!id) continue;
        if (x == null || y == null) { c.report(l.line, 'at: needs a ^reference and two numbers.'); continue; }
        if (placed.has(id)) { c.report(l.line, 'Pessoa places a thing once; this second at: was left out.'); continue; }
        placed.add(id);
        own(w, roomId, 'pessoa')[id] = { x: Math.round(x), y: Math.round(y), ...(l.values.slice(3).some((v) => v.v === 'auto') ? { auto: true } : {}) };
      } else if (l.key === 'on canvas' || l.key === 'tray') {
        for (const v of l.values) {
          const id = c.thing(v, l.line);
          if (id && l.key === 'on canvas' && !placed.has(id)) delete own(w, roomId, 'pessoa')[id]; // back on the spiral
          else if (id && l.key === 'tray' && !isGroup(w.things[id]) && !placed.has(id)) { delete own(w, roomId, 'pessoa')[id]; wait(w, roomId, id, 'pessoa'); }
        }
      } else c.keep(l);
    }
  },
};

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
    const placed = own(w, roomId, 'pessoa', false)[id];
    if (placed) return placed;
    if (isGroup(w.things[id]) || waiting(w, roomId, 'pessoa', id)) return null; // in the tray
    const units = ownUnits(w, roomId);
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
    return this.units(w, roomId).map((u) => ({ id: u.id, thoughts: [u.id], hand: !!places[u.id] && !places[u.id].auto, at: u.at ?? 0 }));
  },

  shift(w, roomId, id, dx, dy) {
    if (shut(w, roomId)) return;
    const p = this.point(w, roomId, id);
    if (!p) return;
    const places = own(w, roomId, 'pessoa');
    places[id] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy), ...(places[id] && !places[id].auto ? {} : { auto: true }) };
  },

  draftPoint: (w, roomId) => spiralPoint(roomUnits(w, roomId).length, 'draft'),

  traum,
};
