// The Book editor's gestures on the structure: a paragraph made a heading (gathering what follows),
// a heading made a paragraph again, a chapter promoted or demoted, a paragraph or chapter moved one
// place, a paragraph split at the caret or joined to the one before, text pasted as paragraphs.
// Each is one step (t.together). Only the plugin API (t); tested in tests/editing.test.js.

import { BOOK, CHAPTER, isBook, isChapter, booksIn } from './rules.js';
import { HEADS, ABOUT, headOf, headed, read, titleOf, flow, aboutOf } from './column.js';

const isHolder = (m) => isBook(m) || isChapter(m);

// The book or chapter holding a mark (its first, where a mark sits in two).
export function holderOf(t, id) {
  return t.links.holders(id).find((g) => isHolder(t.marks.get(g))) || null;
}
// The room's first book, made (with the room's name as its title) when there is none. Inside a step.
export function bookOf(t, room) {
  const b = booksIn(t, room)[0];
  if (b) return b.id;
  const made = t.marks.make({ kind: 'group', content: { title: t.marks.text(room) || 'Book', of: BOOK }, in: room });
  return made.ok ? made.id : null;
}

// Puts `id` into `to` at `at` (0 first, counted among the parts it has without `id`), out of the
// book or chapter it was in. Inside a step.
export function moveTo(t, id, to, at) {
  const from = holderOf(t, id);
  if (from === to) {
    const rest = t.links.members(to).filter((x) => x !== id);
    rest.splice(Math.max(0, Math.min(at, rest.length)), 0, id);
    return t.links.order(to, rest).ok;
  }
  for (const r of t.links.from(id, 'part of')) if (isHolder(t.marks.get(r.to))) t.links.unlink(r.id);
  const n = t.links.members(to).length;
  return t.links.link(id, to, 'part of', null, at >= n ? {} : { at: Math.max(0, at) }).ok;
}

// The chosen thought made a heading, at the level of the heading it sits under: a paragraph of a
// chapter becomes the next chapter, a paragraph of a section the next section (in 3, chapter 4;
// in 3.1, section 3.2), placed right after the one it was in, and it takes with it everything
// after it there (its paragraphs and sections, so the book reads in the same order). A paragraph
// directly in the book (before any chapter) becomes a chapter, gathering what follows up to the
// next chapter. Never deeper than it was: Ctrl+] makes it a section of the one before. A thought
// not in a book goes to the end of the room's book (made when there is none). Returns the
// chapter's id.
//
// The first paragraph of a chapter with no heading thought (an unnamed chapter, or one named only
// by its title) names it instead: it becomes that chapter's heading, first in it, and the chapter
// keeps its place and everything in it.
export function makeHeading(t, room, mark) {
  return t.together(() => {
    let holder = holderOf(t, mark);
    if (!holder) { holder = bookOf(t, room); if (!holder) return null; moveTo(t, mark, holder, t.links.members(holder).length); }
    if (isChapter(t.marks.get(holder)) && !headOf(t, holder) && firstParagraph(t, holder) === mark) return nameWith(t, holder, mark);
    const parts = t.links.members(holder);
    const i = parts.indexOf(mark);
    const outer = isChapter(t.marks.get(holder)) ? holderOf(t, holder) : null;
    const follow = [];
    for (const id of parts.slice(i + 1)) { if (!outer && isChapter(t.marks.get(id))) break; follow.push(id); }
    const ch = t.marks.make({ kind: 'group', content: { title: (t.marks.text(mark) || '').split('\n')[0].slice(0, 120) || 'Untitled', of: CHAPTER }, in: room });
    if (!ch.ok) return null;
    if (outer) moveTo(t, ch.id, outer, t.links.members(outer).indexOf(holder) + 1); // beside the one it was in
    else moveTo(t, ch.id, holder, i);
    for (const id of [mark, ...follow]) moveTo(t, id, ch.id, t.links.members(ch.id).length);
    t.links.link(mark, ch.id, HEADS);
    return ch.id;
  });
}

// The first paragraph among a chapter's own parts (never a section), or null.
export function firstParagraph(t, chapter) {
  return t.links.members(chapter).find((p) => { const m = t.marks.get(p); return m && m.kind !== 'group'; }) || null;
}
// `mark` (a paragraph of the chapter) made the chapter's heading: first in it, linked `heads`, its
// words the chapter's title. Inside a step; returns the chapter's id.
export function nameWith(t, chapter, mark) {
  moveTo(t, mark, chapter, 0);
  t.links.link(mark, chapter, HEADS);
  t.marks.edit(chapter, { title: (t.marks.text(mark) || '').split('\n')[0].slice(0, 120) });
  return chapter;
}

// A heading made a paragraph again: its chapter goes, and everything in it joins the end of the
// chapter (or section) just before it, at its level, as a paragraph read on from there would; with
// none before it, everything in it takes its place. Ctrl+Alt+H twice: as it was.
export function unmakeHeading(t, chapter) {
  return t.together(() => {
    const holder = holderOf(t, chapter);
    if (!holder) return false;
    const siblings = t.links.members(holder);
    const at = siblings.indexOf(chapter);
    const prev = at > 0 && isChapter(t.marks.get(siblings[at - 1])) ? siblings[at - 1] : null;
    const parts = t.links.members(chapter);
    for (const r of t.links.to(chapter, HEADS)) t.links.unlink(r.id);
    if (prev) parts.forEach((id) => moveTo(t, id, prev, t.links.members(prev).length));
    else parts.forEach((id, k) => moveTo(t, id, holder, at + 1 + k));
    t.marks.delete(chapter);
    return true;
  });
}

// One level deeper (Ctrl+]): the chapter goes into the chapter before it, at its end. Refused in
// words when there is none.
export function demote(t, chapter) {
  const holder = holderOf(t, chapter);
  const parts = holder ? t.links.members(holder) : [];
  const i = parts.indexOf(chapter);
  const above = parts.slice(0, i).reverse().find((id) => isChapter(t.marks.get(id)));
  if (!above) return { ok: false, reason: 'There is no chapter above it to go under.' };
  t.together(() => moveTo(t, chapter, above, t.links.members(above).length));
  return { ok: true };
}

// One level up (Ctrl+[): the chapter goes after the chapter holding it, and what followed it
// there comes with it (a heading gathers what follows, up to the next of its level).
export function promote(t, chapter) {
  const holder = holderOf(t, chapter);
  if (!holder || !isChapter(t.marks.get(holder))) return { ok: false, reason: 'It is already a chapter of the book.' };
  const outer = holderOf(t, holder);
  if (!outer) return { ok: false, reason: 'It is already a chapter of the book.' };
  t.together(() => {
    const parts = t.links.members(holder);
    const follow = parts.slice(parts.indexOf(chapter) + 1);
    for (const id of follow) moveTo(t, id, chapter, t.links.members(chapter).length);
    moveTo(t, chapter, outer, t.links.members(outer).indexOf(holder) + 1);
  });
  return { ok: true };
}

// One place up or down (Ctrl+Up, Ctrl+Down): a heading moves its whole chapter past the part
// beside it; a paragraph moves past the one beside it, into a chapter it meets (at its end going
// up, first after its heading going down), and out of its chapter at either end.
export function moveOne(t, room, mark, dir) {
  const ch = headed(t, mark) || (isChapter(t.marks.get(mark)) ? mark : null); // (a chapter's frame chosen: Book · blocks)
  const id = ch || mark;
  const holder = holderOf(t, id);
  if (!holder) return { ok: false, reason: 'It is not in the book.' };
  const parts = t.links.members(holder);
  const i = parts.indexOf(id);
  const head = headOf(t, holder);
  const first = head && parts[0] === head ? 1 : 0; // nothing goes above a chapter's heading
  const j = i + dir;
  t.together(() => {
    if (j >= first && j < parts.length) {
      const next = parts[j];
      if (!ch && isChapter(t.marks.get(next))) { // a paragraph meets a chapter: into it
        const inner = t.links.members(next);
        const top = headOf(t, next) && inner[0] === headOf(t, next) ? 1 : 0;
        moveTo(t, id, next, dir < 0 ? inner.length : top);
      } else moveTo(t, id, holder, j);
    } else if (!ch || isChapter(t.marks.get(holder))) { // past the end of its chapter: out of it
      const outer = holderOf(t, holder);
      if (outer) moveTo(t, id, outer, t.links.members(outer).indexOf(holder) + (dir < 0 ? 0 : 1));
    }
  });
  return { ok: true };
}

// Moves a mark (a heading: its chapter) into another chapter or the book: a chapter at its end,
// a paragraph at the end of its own words (before its first section, so it reads in it).
export function moveInto(t, mark, to) {
  const id = headed(t, mark) || mark;
  if (id === to) return { ok: false, reason: 'A chapter does not go into itself.' };
  let up = to;
  while (up) { if (up === id) return { ok: false, reason: 'A chapter does not go into one it holds.' }; up = holderOf(t, up); }
  const parts = t.links.members(to).filter((x) => x !== id);
  const first = isChapter(t.marks.get(id)) ? -1 : parts.findIndex((p) => isChapter(t.marks.get(p)));
  return t.together(() => ({ ok: moveTo(t, id, to, first < 0 ? parts.length : first) }));
}

// A paragraph split in two at `at` (Alt+Enter): its words up to `at` stay, the rest becomes a new
// paragraph right after it. text: its words now (the thought being written may be ahead of the
// tables). Returns the new paragraph's id, or null.
export function split(t, room, mark, text, at) {
  const before = text.slice(0, at).replace(/\s+$/, ''), rest = text.slice(at).replace(/^\s+/, '');
  if (!before || !rest) return null;
  return t.together(() => {
    const made = t.marks.make({ content: rest, in: room });
    if (!made.ok) return null;
    t.marks.edit(mark, { text: before });
    const holder = holderOf(t, mark);
    if (holder) moveTo(t, made.id, holder, t.links.members(holder).indexOf(mark) + 1);
    return made.id;
  });
}

// The paragraph before this one in the same chapter (what Backspace at its start joins it to),
// or null: never a heading, never across a chapter.
export function before(t, mark) {
  const holder = holderOf(t, mark);
  if (!holder || headed(t, mark)) return null;
  const parts = t.links.members(holder);
  const prev = parts[parts.indexOf(mark) - 1];
  const m = prev && t.marks.get(prev);
  return m && m.kind === 'line' && !headed(t, prev) ? prev : null;
}

// Words pasted as paragraphs (Ctrl+Shift+V): split at blank lines, each a paragraph, after
// `anchor` (or at the end of the room's book). Returns the new ids.
export function pasteParagraphs(t, room, words, anchor = null) {
  const parts = String(words || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return [];
  return t.together(() => {
    let holder = anchor ? (headed(t, anchor) || holderOf(t, anchor)) : null;
    let at;
    if (holder && headed(t, anchor) === holder) at = t.links.members(holder).indexOf(anchor) + 1;
    else if (holder) at = t.links.members(holder).indexOf(anchor) + 1;
    else { holder = bookOf(t, room); at = holder ? t.links.members(holder).length : 0; }
    const out = [];
    for (const words of parts) {
      const made = t.marks.make({ content: words, in: room });
      if (!made.ok) continue;
      if (holder) moveTo(t, made.id, holder, at++);
      out.push(made.id);
    }
    return out;
  });
}

// A paragraph made a margin note (Alt+N) on the paragraph (or heading) before it: out of its
// chapter, linked `about` that one, drawn beside it and left out of the export.
export function makeNote(t, room, mark) {
  if (headed(t, mark)) return { ok: false, reason: 'A heading is not a note: make it a paragraph first (Ctrl+Alt+H).' };
  const ids = flow(t, room);
  const i = ids.indexOf(mark);
  const of = i > 0 ? ids[i - 1] : null;
  if (!of || !holderOf(t, of)) return { ok: false, reason: 'A note goes beside a paragraph of the book: there is none before this one.' };
  return noteOn(t, mark, of);
}
// `mark` a margin note on `of` (a paragraph or heading of the book), one step: out of its chapter,
// no longer a note on anything else. (Alt+N, and a paragraph dragged into the outer margin.)
export function noteOn(t, mark, of) {
  if (headed(t, mark)) return { ok: false, reason: 'A heading is not a note.' };
  if (mark === of) return { ok: false, reason: 'A note is beside another paragraph.' };
  t.together(() => {
    for (const r of t.links.from(mark, 'part of')) if (isHolder(t.marks.get(r.to))) t.links.unlink(r.id);
    for (const r of t.links.from(mark, ABOUT)) t.links.unlink(r.id);
    t.links.link(mark, of, ABOUT);
  });
  return { ok: true };
}
// A margin note made a paragraph again, right after the one it was about.
export function unmakeNote(t, mark) {
  const of = aboutOf(t, mark);
  if (!of) return { ok: false, reason: 'It is not a margin note.' };
  const holder = headed(t, of) || holderOf(t, of);
  return noteInto(t, mark, holder, holder ? t.links.members(holder).indexOf(of) + 1 : 0);
}
// A margin note made a paragraph again in `holder` at `at` (none: not in the book), one step.
export function noteInto(t, mark, holder, at) {
  t.together(() => {
    for (const r of t.links.from(mark, ABOUT)) t.links.unlink(r.id);
    if (holder) moveTo(t, mark, holder, at);
  });
  return { ok: true };
}

// Out of the book (and every chapter of it), one step; false when it was in none.
export function leaveBook(t, mark) {
  const rows = t.links.from(mark, 'part of').filter((r) => isHolder(t.marks.get(r.to)));
  if (!rows.length) return false;
  t.together(() => { for (const r of rows) t.links.unlink(r.id); });
  return true;
}

// What no proposal can do (out of a group, a link of the plugin's own kind) is done by the plugin
// as soon as the room's gesture is over, as one step of its own: the drop itself changes nothing,
// so one Ctrl+Z still takes the whole gesture back. fn → truthy when it changed something; then
// `words` are said.
export function afterGesture(t, fn, words = '') {
  setTimeout(() => { const r = fn(); if (words && r && r.ok !== false) t.ui.toast(words); }, 0);
}

export { read, titleOf, headOf, headed };
