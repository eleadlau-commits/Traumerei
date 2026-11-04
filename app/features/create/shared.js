// Part of Create: what its files share (sizes, keys, and the one rule for Enter).

import { ui } from 'folio';

export const { el } = ui;
export const ZOOM = { min: 0.25, max: 4 };
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
