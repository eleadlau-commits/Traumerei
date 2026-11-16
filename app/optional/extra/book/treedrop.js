// Where a line dragged in the contents lands (docks.js): the part of the line it is let go on
// says where. Its top third: before that chapter, beside it in its holder. Its bottom third: after
// it (into it, before its first section, when it has sections: the line under it is that
// section). Its middle: into it, as its last section. Never into itself or a chapter it holds,
// never deeper than three levels. Only reads (no step): `landing` answers, `dropTo` moves.
// Tested in app/core/api/tests/book-tree.test.js.

import { isChapter } from './rules.js';
import { headed } from './column.js';
import { holderOf, moveTo } from './editing.js';

export const DEEPEST = 3; // chapter, section, and one deeper (column.js numbers no deeper)

// The part of a line the pointer is on: 'before' (top third), 'into' (middle), 'after' (bottom).
export function zoneOf(y, top, height) {
  const f = height > 0 ? (y - top) / height : 0.5;
  return f < 1 / 3 ? 'before' : f > 2 / 3 ? 'after' : 'into';
}

const sectionsOf = (t, ch) => t.links.members(ch).filter((p) => isChapter(t.marks.get(p)));
// How deep a holder sits: the book 0, a chapter 1, a section 2…
const depthOf = (t, g) => { let d = 0; for (let up = g; up && isChapter(t.marks.get(up)); up = holderOf(t, up)) d++; return d; };
// How many levels a chapter takes: 1, and one more for each level of sections in it.
const levels = (t, ch) => 1 + Math.max(0, ...sectionsOf(t, ch).map((s) => levels(t, s)));

// Where `id` (a chapter, or its heading) lands let go on the line of `target` (a chapter) in
// `zone`: { ok: true, holder, at } (`at` counted among the holder's parts without it, as
// editing.js moveTo takes it), { ok: false, reason } (refused, in words), or { ok: false } (let go
// where it already is: nothing to do).
export function landing(t, id, target, zone) {
  id = headed(t, id) || id;
  if (!t.marks.get(id) || !isChapter(t.marks.get(target))) return { ok: false };
  if (id === target) return zone === 'into' ? { ok: false, reason: 'A chapter does not go into itself.' } : { ok: false };
  for (let up = holderOf(t, target); up; up = holderOf(t, up))
    if (up === id) return { ok: false, reason: 'A chapter does not go into one it holds.' };
  let holder, at;
  const rest = (g) => t.links.members(g).filter((x) => x !== id);
  if (zone === 'into') { holder = target; at = rest(target).length; }
  else if (zone === 'after' && sectionsOf(t, target).length) {
    holder = target;
    const parts = rest(target);
    const first = parts.findIndex((p) => isChapter(t.marks.get(p)));
    at = first < 0 ? parts.length : first;
  } else {
    holder = holderOf(t, target);
    if (!holder) return { ok: false };
    at = rest(holder).indexOf(target) + (zone === 'after' ? 1 : 0);
  }
  if (depthOf(t, holder) + levels(t, id) > DEEPEST)
    return { ok: false, reason: 'A book goes three levels deep: it does not fit there.' };
  if (holderOf(t, id) === holder && t.links.members(holder).indexOf(id) === at) return { ok: false }; // where it is
  return { ok: true, holder, at };
}

// The move itself, one step: { ok: true }, or what `landing` refused.
export function dropTo(t, id, target, zone) {
  const where = landing(t, id, target, zone);
  if (!where.ok) return where;
  const ch = headed(t, id) || id;
  return t.together(() => ({ ok: !!moveTo(t, ch, where.holder, where.at) }));
}
