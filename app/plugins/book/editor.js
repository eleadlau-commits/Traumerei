// The Book editor on the canvas: the Book rule (the room as one column, a page wide), headings
// drawn as headings, and the keys of a book: a heading from the chosen paragraph, its level, moving
// a paragraph or chapter, splitting and joining paragraphs, the caret running on from one
// paragraph to the next, and pasting as paragraphs. Only the plugin API (app/core/API.md).
//
// Where a new paragraph goes: the rule's land() hears the centre of the paragraph it was written
// after (the one chosen, or the one kept just before) and proposes { join: chapter, at }, so it
// lands in that chapter right after it, in the same step as Enter.

import { isChapter } from './rules.js';
import { RULE, HEADS, column, after, flow, headed } from './column.js';
import { holderOf, makeHeading, unmakeHeading, demote, promote, moveOne, split, before, pasteParagraphs } from './editing.js';

const ICON = '<path d="M7 4h10M7 8h10M7 12h10M7 16h6"/><path d="M4 3v18"/>';

export function installEditor(t) {
  const measure = (text, width) => t.ui.measure(text, width);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  const room = () => t.ui.chosen()?.context || null;
  const inBook = () => { const r = room(); return !!r && t.marks.get(r)?.mode === RULE; };
  const chosen = () => t.ui.chosen()?.mark || null;
  const say = (r) => { if (r && r.ok === false && r.reason) t.ui.toast(r.reason); };

  // ---- The rule ----

  t.slots.linkKinds.add({ kind: HEADS, name: 'heads', note: 'the thought that is a chapter\'s heading',
    admit: (from, to, reads) => (isChapter(reads.marks.get(to)) ? true : 'Only a chapter has a heading') });
  t.slots.rules.add({
    id: RULE, name: 'Book', note: 'the book as one column: headings, chapters, paragraphs in order', icon: ICON, order: 30,
    claims: ['book', 'book-chapter'],
    settings: [{ key: 'width', label: 'Column', type: 'choice', default: 'book', options: [['narrow', 'Narrow'], ['book', 'Book'], ['wide', 'Wide']] }],
    arrange: (reads, context) => column(reads, context, measure, size).rows,
    draw: (reads, context) => column(reads, context, measure, size).boxes,
    land: (reads, context, mark, x, y) => {
      const { rows } = column(reads, context, measure, size);
      const near = rows.find((r) => r.mark !== mark && Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1);
      if (near) return after(reads, context, near.mark);
      return null;
    },
    hand: false,
  });

  // Headings read as headings: a chapter's in bold small capitals, a section's in bold, deeper
  // in italic (the room's span classes). Each heading's depth is read once per change of links.
  const depthOf = (id) => {
    let d = 0, g = headed(t, id);
    while (g && d < 4) { d++; g = holderOf(t, g); if (g && !isChapter(t.marks.get(g))) break; }
    return d;
  };
  const known = new Map(); // heading id → depth, filled on demand, emptied when links change
  t.links.on(() => known.clear());
  t.slots.decorators.add({ id: 'book.headings', decorate: (text, mark) => {
    if (!mark?.id || !text) return [];
    let d = known.get(mark.id);
    if (d == null) { d = headed(t, mark.id) ? depthOf(mark.id) : 0; known.set(mark.id, d); }
    if (!d) return [];
    const end = text.length;
    return d === 1 ? [{ from: 0, to: end, class: 'bold' }, { from: 0, to: end, class: 'caps' }] : d === 2 ? [{ from: 0, to: end, class: 'bold' }] : [{ from: 0, to: end, class: 'italic' }];
  } });

  // ---- Keys on the chosen thought (in a room seen as Book) ----

  const cmd = (o) => t.slots.commands.add({ order: 72, ...o });
  cmd({ id: 'book.heading', keys: ['Ctrl+Alt+H'], zone: 'room', words: 'make the chosen paragraph a heading, gathering what follows (again: a paragraph)',
    when: () => inBook() && !!chosen(),
    run: () => {
      const id = chosen();
      const ch = headed(t, id);
      if (ch) unmakeHeading(t, ch); else if (!makeHeading(t, room(), id)) t.ui.toast('It could not become a heading here.');
    } });
  cmd({ id: 'book.deeper', keys: ['Ctrl+]'], zone: 'room', words: 'the chosen heading one level deeper',
    when: () => inBook() && !!chosen(), run: () => { const ch = headed(t, chosen()); if (ch) say(demote(t, ch)); else t.ui.toast('Choose a heading.'); } });
  cmd({ id: 'book.higher', keys: ['Ctrl+['], zone: 'room', words: 'the chosen heading one level up',
    when: () => inBook() && !!chosen(), run: () => { const ch = headed(t, chosen()); if (ch) say(promote(t, ch)); else t.ui.toast('Choose a heading.'); } });
  cmd({ id: 'book.up', keys: ['Ctrl+ArrowUp'], zone: 'room', words: 'move the chosen paragraph or chapter up one place',
    when: () => inBook() && !!chosen(), run: () => say(moveOne(t, room(), chosen(), -1)) });
  cmd({ id: 'book.down', keys: ['Ctrl+ArrowDown'], zone: 'room', words: 'move the chosen paragraph or chapter down one place',
    when: () => inBook() && !!chosen(), run: () => say(moveOne(t, room(), chosen(), 1)) });
  cmd({ id: 'book.paste', keys: ['Ctrl+Shift+V'], zone: 'room', words: 'paste as paragraphs, split at blank lines, after the chosen one',
    when: () => inBook(), run: () => pasteFromClipboard(chosen()) });

  // ---- Keys while writing a paragraph ----

  const caret = () => t.ui.text.caret();
  const kept = () => { const c = inBook() ? caret() : null; return c && c.mark ? c : null; };
  // The line the caret is on, counted from 0, and how many there are, at the column's width.
  const lineAt = (c) => {
    const W = column(t, room(), measure, size).width;
    return { at: measure(c.text.slice(0, c.from), W).lines - 1, of: measure(c.text || ' ', W).lines };
  };
  const runOn = (dir) => {
    const c = kept();
    if (!c) return false;
    const ids = flow(t, room());
    const next = ids[ids.indexOf(c.mark) + dir];
    if (!next || t.marks.get(next)?.kind !== 'line') return false;
    return t.ui.text.edit(next, dir > 0 ? 0 : null).ok;
  };
  cmd({ id: 'book.run-down', keys: ['ArrowDown'], zone: 'editing', words: 'at the last line: on into the next paragraph',
    when: () => { const c = kept(); if (!c || c.from !== c.to) return false; const l = lineAt(c); return l.at >= l.of - 1; },
    run: () => runOn(1) });
  cmd({ id: 'book.run-up', keys: ['ArrowUp'], zone: 'editing', words: 'at the first line: back into the paragraph before',
    when: () => { const c = kept(); return !!c && c.from === c.to && lineAt(c).at === 0; },
    run: () => runOn(-1) });
  cmd({ id: 'book.split', keys: ['Alt+Enter'], zone: 'editing', words: 'split the paragraph at the caret',
    when: () => !!kept(),
    run: () => {
      const c = kept();
      const made = split(t, room(), c.mark, c.text, c.from);
      if (made) t.ui.text.edit(made, 0);
    } });
  cmd({ id: 'book.join', keys: ['Backspace'], zone: 'editing', words: 'at the start of a paragraph: join it to the one before',
    when: () => { const c = kept(); return !!c && c.from === 0 && c.to === 0 && !!before(t, c.mark); },
    run: () => {
      const c = kept();
      const prev = before(t, c.mark);
      const words = c.text, end = (t.marks.text(prev) || '').length;
      if (!t.ui.text.edit(prev, end).ok) return;
      const glue = end && words && !/\s$/.test(t.marks.text(prev)) ? ' ' : '';
      t.ui.text.replace(prev, end, end, glue + words);
      t.ui.text.select(end + glue.length);
      t.marks.delete(c.mark);
    } });
  // A heading from the words being written: a kept paragraph at once; a new one when Enter keeps
  // it (it lands where it goes first, then is made a heading, gathering what follows).
  let pending = null; // { room, since } while a new thought waits to be kept as a heading
  cmd({ id: 'book.heading-writing', keys: ['Ctrl+Alt+H'], zone: 'editing', words: 'make this paragraph a heading (a new one: when Enter keeps it)',
    when: () => inBook() && !!caret(),
    run: () => {
      const c = caret();
      if (c.mark) { const ch = headed(t, c.mark); if (ch) unmakeHeading(t, ch); else makeHeading(t, room(), c.mark); return; }
      pending = pending ? null : { room: room(), since: Date.now() - 1 };
      t.ui.toast(pending ? 'A heading, when Enter keeps it.' : 'Not a heading after all.');
    } });
  t.marks.on(() => {
    if (!pending) return;
    const { room: r, since } = pending;
    const made = t.marks.in(r).filter((m) => m.kind === 'line' && m.at >= since).sort((a, b) => b.at - a.at)[0];
    if (!made) return;
    pending = null;
    setTimeout(() => { if (t.marks.get(made.id) && !headed(t, made.id)) makeHeading(t, r, made.id); }, 0);
  });
  t.ui.text.on?.((c) => { if (pending && !c) setTimeout(() => { if (pending && !t.ui.text.caret()) pending = null; }, 50); });
  cmd({ id: 'book.paste-writing', keys: ['Ctrl+Shift+V'], zone: 'editing', words: 'paste as paragraphs after this one',
    when: () => inBook(), run: () => pasteFromClipboard(caret()?.mark || chosen()) });

  const pasteFromClipboard = async (anchor) => {
    let words = '';
    try { words = await navigator.clipboard.readText(); } catch { words = ''; }
    if (!words.trim()) { t.ui.toast('Nothing to paste (or the clipboard can\'t be read here).'); return; }
    const made = pasteParagraphs(t, room(), words, anchor);
    t.ui.toast(made.length === 1 ? 'One paragraph pasted.' : `${made.length} paragraphs pasted.`);
  };

  return { inBook };
}
