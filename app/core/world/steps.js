// Steps: how far below one thought the next sits when thoughts are read in a column (a Joyce
// train, a Russell chapter, a book). A part of the rule kit (the plugin API's parts.trains), so
// any rule can read thoughts in the same rhythm; it keeps the heights measured as drawn.

import { kindOf } from './model.js';
import { kindFor } from './items/index.js';

// How far below the one before a thought sits, until it is dragged somewhere else.
// A line's step and a closed group's; every other kind says its own (its `step`; a passage's 190).
export const STEP = { line: 58, group: 190 };
const stepOf = (kind) => STEP[kind] ?? kindFor(kind).step ?? STEP.group;
const LINE = 29; // each extra line of a thought written over several lines; the gap under a thought

// Each thought's height as drawn (world units), measured after each drawing (measured() below),
// so a thought that wraps onto several lines pushes the next one down by as much.
const HEIGHTS = new Map();

// Takes the heights just measured ({ id: { h } }); true if any changed enough to draw again.
export function setHeights(sizes) {
  let changed = false;
  for (const [id, { h }] of sizes) {
    const was = HEIGHTS.get(id);
    if (!(h > 0)) continue;
    if (was == null || Math.abs(was - h) > 1) { HEIGHTS.set(id, h); changed = true; }
  }
  return changed;
}
export const clearHeights = () => HEIGHTS.clear();

// How far below a thought the next one sits: its real height and a gap, once it has been drawn;
// until then, a guess from the lines written.
export function stepAfter(th) {
  const kind = kindOf(th);
  const guess = kind !== 'line' ? stepOf(kind) : STEP.line + LINE * ((String(th.text || '').match(/\n/g) || []).length);
  const h = HEIGHTS.get(th.id);
  return h > 0 ? Math.max(stepOf(kind), Math.ceil(h) + LINE) : guess;
}
