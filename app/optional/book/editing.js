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

// The chosen thought made a heading: a new chapter in its place, the thought its first part and
// heading, and every part after it up to the next chapter gathered into it. A thought not in a
// book goes to the end of the room's book (made when there is none). Returns the chapter's id.
export function makeHeading(t, room, mark) {
  return t.together(() => {
    let holder = holderOf(t, mark);
    if (!holder) { holder = bookOf(t, room); if (!holder) return null; moveTo(t, mark, holder, t.links.members(holder).length); }
    const parts = t.links.members(holder);
    const i = parts.indexOf(mark);
    const follow = [];
    for (const id of parts.slice(i + 1)) { if (isChapter(t.marks.get(id))) break; follow.push(id); }
    const ch = t.marks.make({ kind: 'group', content: { title: (t.marks.text(mark) || '').split('\n')[0].slice(0, 120) || 'Untitled', of: CHAPTER }, in: room });
    if (!ch.ok) return null;
    moveTo(t, ch.id, holder, i);
    for (const id of [mark, ...follow]) moveTo(t, id, ch.id, t.links.members(ch.id).length);
    t.links.link(mark, ch.id, HEADS);
    return ch.id;
  });
}

// A heading made a paragraph again: its chapter goes, and everything in it takes its place.
export function unmakeHeading(t, chapter) {
  return t.together(() => {
    const holder = holderOf(t, chapter);
    if (!holder) return false;
    const at = t.links.members(holder).indexOf(chapter);
    const parts = t.links.members(chapter);
    for (const r of t.links.to(chapter, HEADS)) t.links.unlink(r.id);
    parts.forEach((id, k) => moveTo(t, id, holder, at + 1 + k));
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
  const ch = headed(t, mark);
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

// Moves a mark (a heading: its chapter) into another chapter or the book, at its end.
export function moveInto(t, mark, to) {
  const id = headed(t, mark) || mark;
  if (id === to) return { ok: false, reason: 'A chapter does not go into itself.' };
  let up = to;
  while (up) { if (up === id) return { ok: false, reason: 'A chapter does not go into one it holds.' }; up = holderOf(t, up); }
  return t.together(() => ({ ok: moveTo(t, id, to, t.links.members(to).length) }));
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
  t.together(() => {
    for (const r of t.links.from(mark, 'part of')) if (isHolder(t.marks.get(r.to))) t.links.unlink(r.id);
    t.links.link(mark, of, ABOUT);
  });
  return { ok: true };
}
// A margin note made a paragraph again, right after the one it was about.
export function unmakeNote(t, mark) {
  const of = aboutOf(t, mark);
  if (!of) return { ok: false, reason: 'It is not a margin note.' };
  t.together(() => {
    for (const r of t.links.from(mark, ABOUT)) t.links.unlink(r.id);
    const ch = headed(t, of);
    const holder = ch || holderOf(t, of);
    if (holder) moveTo(t, mark, holder, t.links.members(holder).indexOf(of) + 1);
  });
  return { ok: true };
}

export { read, titleOf, headOf, headed };
