// Chapters as nested blocks: the gestures that make, name, unname and number a chapter, beside the
// ones in editing.js. A chapter may have no name (no heading thought, an empty title) and may be
// unnumbered (its own field `numbered: false`, kept in the tables by slots.groups `fields`). Each
// gesture is one step (t.together). Only the plugin API (t); tested in
// app/core/api/tests/book-nest.test.js.
//
//   wrap(t, room, ids)        an unnamed chapter around the chosen blocks (Alt+C)
//   addSection(t, room, ch)   a new, empty, unnamed chapter at the end of `ch` (Alt+Shift+C)
//   unname(t, ch)             its heading back to a paragraph, the chapter kept (Alt+Shift+H)
//   nameFirst(t, ch)          its first paragraph its heading (Alt+Shift+H on an unnamed one)
//   rename(t, room, ch, words) its name typed (the dock's Title): a heading thought made or edited
//   setNumbered(t, ch, on)    numbered or not (Alt+U, the dock's Numbered · Unnumbered)

import { CHAPTER, NUMBERED, isBook, isChapter, isNumbered } from './rules.js';
import { HEADS, headOf, headed, nameOf } from './column.js';
import { holderOf, moveTo, bookOf, firstParagraph, nameWith } from './editing.js';
import { DEEPEST, depthOf, levels } from './treedrop.js';

const TOO_DEEP = 'A book goes three levels deep: it does not fit there.';
const isHolder = (m) => isBook(m) || isChapter(m);

// The chapter a mark is about: a heading's chapter, a chapter itself, else the chapter holding it
// (a paragraph's), or null (a paragraph directly in the book, or not in it).
export function chapterOf(t, id) {
  if (!id || !t.marks.get(id)) return null;
  const ch = headed(t, id) || (isChapter(t.marks.get(id)) ? id : null);
  if (ch) return ch;
  const h = holderOf(t, id);
  return h && isChapter(t.marks.get(h)) ? h : null;
}

// A new chapter group in the room, unnamed (an empty title) unless `title` says. Inside a step.
const newGroup = (t, room, title = '') => t.marks.make({ kind: 'group', content: { title, of: CHAPTER }, in: room });

// An unnamed chapter around the chosen blocks (paragraphs, or headings: their chapters), in their
// order, where the first of them was: they must sit side by side in one book or chapter. Refused in
// words when they don't, or when it would go deeper than three levels. → { ok, id } or { ok: false, reason }.
export function wrap(t, room, ids) {
  const units = [...new Set((ids || []).filter((id) => t.marks.get(id)).map((id) => headed(t, id) || id))];
  if (!units.length) return { ok: false, reason: 'Choose a block (or several, Shift+click) first.' };
  const holders = new Set(units.map((id) => holderOf(t, id)));
  if (holders.has(null)) return { ok: false, reason: 'Choose blocks in the book (not in the tray).' };
  if (holders.size > 1) return { ok: false, reason: 'Choose blocks side by side in one chapter.' };
  const [holder] = holders;
  const deepest = Math.max(0, ...units.map((id) => (isChapter(t.marks.get(id)) ? levels(t, id) : 0)));
  if (depthOf(t, holder) + 1 + deepest > DEEPEST) return { ok: false, reason: TOO_DEEP };
  const parts = t.links.members(holder);
  units.sort((a, b) => parts.indexOf(a) - parts.indexOf(b));
  // Nothing above a chapter's heading: the new one goes after it, at the earliest.
  const head = headOf(t, holder);
  const at = Math.max(head && parts[0] === head ? 1 : 0, parts.indexOf(units[0]));
  return t.together(() => {
    const ch = newGroup(t, room);
    if (!ch.ok) return { ok: false, reason: ch.reason || 'The chapter could not be made here.' };
    moveTo(t, ch.id, holder, at);
    for (const id of units) moveTo(t, id, ch.id, t.links.members(ch.id).length);
    return { ok: true, id: ch.id };
  });
}

// A new, empty, unnamed chapter at the end of `holder` (a chapter: a section of it; the book: a
// chapter of it). Refused in words past three levels. → { ok, id } or { ok: false, reason }.
export function addSection(t, room, holder) {
  holder = holder || bookOf(t, room);
  if (!holder || !isHolder(t.marks.get(holder))) return { ok: false, reason: 'Choose a chapter first.' };
  if (depthOf(t, holder) + 1 > DEEPEST) return { ok: false, reason: TOO_DEEP };
  return t.together(() => {
    const ch = newGroup(t, room);
    if (!ch.ok) return { ok: false, reason: ch.reason || 'The chapter could not be made here.' };
    moveTo(t, ch.id, holder, t.links.members(holder).length);
    return { ok: true, id: ch.id };
  });
}

// Unnamed: its heading thought a paragraph again, first in the chapter as it was, and the title
// emptied; the chapter, its place and what it holds stay. → { ok } or { ok: false, reason }.
export function unname(t, chapter) {
  if (!isChapter(t.marks.get(chapter))) return { ok: false, reason: 'Choose a chapter first.' };
  if (!nameOf(t, chapter)) return { ok: false, reason: 'It has no name.' };
  t.together(() => {
    for (const r of t.links.to(chapter, HEADS)) t.links.unlink(r.id);
    t.marks.edit(chapter, { title: '' });
  });
  return { ok: true };
}

// Named by its first paragraph (it becomes the heading, as Ctrl+Alt+H on it does).
export function nameFirst(t, chapter) {
  if (!isChapter(t.marks.get(chapter))) return { ok: false, reason: 'Choose a chapter first.' };
  if (headOf(t, chapter)) return { ok: false, reason: 'It has a heading already.' };
  const first = firstParagraph(t, chapter);
  if (!first || t.marks.get(first)?.kind !== 'line') return { ok: false, reason: 'It has no paragraph to be its heading: type its title in the right dock.' };
  t.together(() => nameWith(t, chapter, first));
  return { ok: true };
}

// Alt+Shift+H: a named chapter unnamed, an unnamed one named by its first paragraph.
export function toggleName(t, chapter) {
  return nameOf(t, chapter) ? unname(t, chapter) : nameFirst(t, chapter);
}

// Its name typed (the right dock's Title): a heading thought's words changed, or, for a chapter with
// none, a heading thought made with them, first in it. Empty: unnamed (unname). One step.
export function rename(t, room, chapter, words) {
  const name = String(words || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!isChapter(t.marks.get(chapter))) return { ok: false, reason: 'Choose a chapter first.' };
  if (!name) return nameOf(t, chapter) ? unname(t, chapter) : { ok: true };
  if (name === nameOf(t, chapter) && headOf(t, chapter)) return { ok: true };
  return t.together(() => {
    const h = headOf(t, chapter);
    if (h) { t.marks.edit(h, { text: name }); t.marks.edit(chapter, { title: name }); return { ok: true }; }
    const made = t.marks.make({ content: name, in: room });
    if (!made.ok) return { ok: false, reason: made.reason || 'The heading could not be made.' };
    nameWith(t, chapter, made.id);
    return { ok: true };
  });
}

// Numbered or not, one step: an unnumbered chapter keeps `numbered: false`; numbered again, the
// field goes (null takes it off).
export function setNumbered(t, chapter, on) {
  if (!isChapter(t.marks.get(chapter))) return { ok: false, reason: 'Choose a chapter first.' };
  if (isNumbered(t.marks.get(chapter)) === !!on) return { ok: true };
  const r = t.marks.edit(chapter, { [NUMBERED]: on ? null : false });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason || 'It could not be changed.' };
}
export const toggleNumbered = (t, chapter) => setNumbered(t, chapter, !isNumbered(t.marks.get(chapter)));

// Whether a chapter's number is off because a chapter holding it is unnumbered (its own field is
// then kept, but shows no number while it sits there).
export function unnumberedAbove(t, chapter) {
  for (let up = holderOf(t, chapter); up && isChapter(t.marks.get(up)); up = holderOf(t, up)) if (!isNumbered(t.marks.get(up))) return true;
  return false;
}
