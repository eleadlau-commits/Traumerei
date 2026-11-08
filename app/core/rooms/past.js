// Part of the rooms feature: the rooms page on a past day, drawn when the Time dock goes back (the
// time feature gives the day's board through the time.place slot's showDay). View only: the
// squares of that day sit where they were, named as they were; a room deleted since is a faint
// ghost; a room written in that day glows; rooms made later are not there. Nothing can be pressed.
//
// past = { day, rooms: { [id]: { name, page, col, row, size, archived, tint, light, opacity } },
//          written: [id], counts: { [id]: n } }

import { el } from './shared.js';
import { room, cells, span, squareLook, MESSY } from './world.js';

// The drawn floor's cells and squares as they were that day (f: the rooms feature).
export function pastFloor(f, cols, rows) {
  const { rooms, written, counts } = f.past;
  const lit = new Set(written);
  const taken = new Set();
  const tiles = Object.entries(rooms)
    .filter(([, s]) => !s.archived && (s.page || 0) === f.page && s.col != null && s.row != null)
    .map(([id, s]) => {
      const now = room(f.world, id);
      const r = { ...(now || {}), ...s, id, kind: 'room' };
      for (const [c, d] of cells(r, r)) taken.add(`${c},${d}`);
      const look = squareLook(r, id === MESSY, f.prefs, f.palette);
      const { w: across, h: down } = span(r);
      const n = counts[id] || 0;
      const on = lit.has(id);
      return el('div', {
        class: 'rooms-tile rooms-past-tile' + (on ? ' lit' : '') + (now ? '' : ' ghost') + (id === MESSY ? ' messy' : '') + (look.alpha > 0.4 ? ' deep' : ''),
        style: `--lit:${on ? 1 : 0};--square:${look.fill};grid-column:${r.col + 1} / span ${across};grid-row:${r.row + 1} / span ${down}`,
        title: now ? `${r.name}${on ? ' · written in that day' : ''}` : `${r.name} · deleted since`,
        'aria-label': `${r.name}, ${n} thought${n === 1 ? '' : 's'}${now ? '' : ', deleted since'}`,
      }, el('div', { class: 'rooms-tile-label' },
        el('span', { class: 'rooms-tile-name' }, r.name),
        el('span', { class: 'rooms-tile-count' }, n ? String(n) : '')));
    });
  const empty = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (!taken.has(`${col},${row}`)) empty.push(el('div', { class: 'rooms-cell', style: `grid-column:${col + 1};grid-row:${row + 1}` }));
  }
  return [...empty, ...tiles];
}

// What the status bar says while a past day shows.
export const pastWords = (day) => `As on ${new Date(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;
