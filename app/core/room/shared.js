// Part of the room feature: what its files share (sizes, keys, and the one rule for Enter).

import { ui } from 'folio';

export const { el } = ui;
// A rail item's hairline icon (a ui.ICONS name, or a drawing on a 24 × 24 grid) and its word (Folio's .rail-*).
export const railIcon = (drawing) => { const s = ui.icon(drawing); s.classList.add('rail-icon'); return s; };
export const railWord = (text) => el('span', { class: 'rail-word' }, text);
export const ZOOM = { min: 0.25, max: 4 };
// The zoom's bands (t.ui.zoom.bands, since 1.1.0): far below 0.5 (the room as a map), near from
// 1.75 (close up), mid between (reading, where a room opens at 1). Each is [from, to): from
// included, to left out; near holds the most, 4. The room's stage has the class room-band-<band>.
export const BANDS = Object.freeze({ far: Object.freeze([ZOOM.min, 0.5]), mid: Object.freeze([0.5, 1.75]), near: Object.freeze([1.75, ZOOM.max]) });
export const bandOf = (zoom) => (zoom < BANDS.mid[0] ? 'far' : zoom < BANDS.near[0] ? 'mid' : 'near');
export const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export const KEY = MAC ? '⌘K' : 'Ctrl+K';
export const HOLD = 520;          // ms: a long press opens properties, as a right-click does
export const HINT = 'Type anywhere to write · Enter ends a thought · click to choose · right-click for properties · Ctrl+K searches · Ctrl+Z undoes';

// One rule for every box: Enter keeps; Ctrl+Enter (Cmd+Enter) puts a new line in a box that takes lines.
// Returns true when the box should be kept.
export function enterKeeps(e) {
  e.preventDefault();
  if (!(e.ctrlKey || e.metaKey)) return true;
  if (e.target.tagName === 'TEXTAREA') e.target.setRangeText('\n', e.target.selectionStart, e.target.selectionEnd, 'end');
  return false;
}
