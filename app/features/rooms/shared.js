// Part of the rooms feature: what its files share (sizes, keys, and the one rule for Enter).

import { ui } from 'folio';

export const { el } = ui;
export const GRID = { gap: 14, pad: 32 }; // the rooms page's cells (px)
// A rail item's hairline icon (ui.ICONS name), or its number, and its word (Folio's .rail-*).
export const railIcon = (name) => { const s = ui.icon(name); s.classList.add('rail-icon'); return s; };
export const railNum = (n) => el('span', { class: 'rail-icon rail-num', 'aria-hidden': 'true' }, String(n));
export const railWord = (text) => el('span', { class: 'rail-word' }, text);
export const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
export const KEY = MAC ? '⌘K' : 'Ctrl+K';
export const HOLD = 520;          // ms: a long press opens properties, as a right-click does
export const HINT = 'Click to choose · double-click to go in · right-click for properties · or just start typing';

// One rule for every box: Enter keeps; Ctrl+Enter (Cmd+Enter) puts a new line in a box that takes lines.
// Returns true when the box should be kept.
export function enterKeeps(e) {
  e.preventDefault();
  if (!(e.ctrlKey || e.metaKey)) return true;
  if (e.target.tagName === 'TEXTAREA') e.target.setRangeText('\n', e.target.selectionStart, e.target.selectionEnd, 'end');
  return false;
}
