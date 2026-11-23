// The Book editor on the canvas: the Book rule (the room as pages, or one column), headings
// drawn as headings, and the keys of a book: a heading from the chosen paragraph, its level, moving
// a paragraph or chapter, splitting and joining paragraphs, the caret running on from one
// paragraph to the next, and pasting as paragraphs. Only the plugin API (app/core/API.md).
//
// Where a new paragraph goes: the rule's land() hears the centre of the paragraph it was written
// after (the one chosen, or the one kept just before) and proposes { join: chapter, at }, so it
// lands in that chapter right after it, in the same step as Enter. Click anywhere in a chapter to
// write there (slots.js): a tap on the blank space after a chapter's last paragraph, under an
// empty chapter's heading or between two paragraphs chooses a slot, typing there begins the
// paragraph under the heading or paragraph above it, and Enter keeps it exactly there.

import { isChapter } from './rules.js';
import { RULE, HEADS, ABOUT, after, flow, headed, aboutOf, TYPES } from './column.js';
import { shape, textWidth, SIZES, COUNTS } from './pages.js';
import { BLOCKS, frameChosen } from './blocks.js';
import { chapterOf, wrap, addSection, toggleName, toggleNumbered } from './nest.js';
import { isNumbered } from './rules.js';
import { holderOf, makeHeading, unmakeHeading, demote, promote, moveOne, split, before, pasteParagraphs, makeNote, unmakeNote, noteOn, noteInto, leaveBook, afterGesture } from './editing.js';
import { flowDrop, inOwnRow } from './flowdrop.js';
import { slotAt, SLOT } from './slots.js';

const ICON = '<path d="M7 4h10M7 8h10M7 12h10M7 16h6"/><path d="M4 3v18"/>';

export function installEditor(t) {
  const measure = (text, width) => t.ui.measure(text, width);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  const room = () => t.ui.chosen()?.context || null;
  const inBook = () => { const r = room(); return !!r && t.marks.get(r)?.mode === RULE; };
  // Book or Book · blocks: the keys on the book's structure work in both.
  const inBoth = () => { const r = room(); const m = r && t.marks.get(r)?.mode; return m === RULE || m === BLOCKS; };
  const chosen = () => t.ui.chosen()?.mark || null;
  const say = (r) => { if (r && r.ok === false && r.reason) t.ui.toast(r.reason); };

  // ---- Where a new paragraph goes ----
  // The mark the thought being written was drawn under (reads.marks.draft's `after`), as the rule's
  // layout last saw it while it was written: Enter keeps it there, whatever box the room still
  // holds chosen. And the slot it was begun in (a key typed while a slot was chosen): exactly there.
  const drafted = new Map();  // room → the mark the draft is written after, or null
  const begun = new Map();    // room → { join, at } of the slot typing began in
  let landed = () => {};      // told whether a paragraph was kept in a slot (below)
  const drawn = new Map();    // room → the slots of the layout last drawn (with the room's settings)
  const last = new Map();     // room → the layout last drawn
  const laid = (reads, context, set) => {
    const d = reads.marks.draft?.(context);
    if (d) drafted.set(context, d.after || null);
    const lay = shape(reads, context, measure, size, set);
    drawn.set(context, lay.slots);
    last.set(context, lay);
    return lay;
  };

  // ---- The rule ----

  t.slots.linkKinds.add({ kind: HEADS, name: 'heads', note: 'the thought that is a chapter\'s heading', quiet: true,
    admit: (from, to, reads) => (isChapter(reads.marks.get(to)) ? true : 'Only a chapter has a heading') });
  t.slots.linkKinds.add({ kind: ABOUT, name: 'about', note: 'a margin note on a paragraph of the book', quiet: true });
  t.slots.rules.add({
    id: RULE, name: 'Book', note: 'the book on pages (or one column): headings, chapters, paragraphs in order', icon: ICON, order: 30,
    claims: ['book', 'book-chapter'],
    settings: [
      { key: 'pages', label: 'Pages', type: 'choice', default: 'a4', options: [...Object.entries(SIZES).map(([k, v]) => [k, v[2]]), ['none', 'None: one column']] },
      { key: 'margins', label: 'Margins', type: 'choice', default: 'normal', options: [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']] },
      { key: 'chapterPage', label: 'A chapter starts a page', type: 'switch', default: true },
      { key: 'grid', label: 'Pages side by side: fix', type: 'choice', default: 'columns', options: [['columns', 'Columns (rows follow)'], ['rows', 'Rows (columns follow)']] },
      { key: 'count', label: 'How many (2 columns: facing pages)', type: 'choice', default: '1', options: COUNTS.map((n) => [String(n), String(n)]) },
      { key: 'type', label: 'Type size (everything in proportion; the page stays)', type: 'choice', default: '100', options: TYPES.map((v) => [v, `${v}%`]) },
      { key: 'width', label: 'Column width (with Pages: None)', type: 'choice', default: 'book', options: [['narrow', 'Narrow'], ['book', 'Book'], ['wide', 'Wide']] },
    ],
    arrange: (reads, context, set) => laid(reads, context, set).rows,
    draw: (reads, context, set) => laid(reads, context, set).boxes,
    // A paragraph dragged on the pages (flowdrop.js): into the flow as one { join, at, from } step
    // with the gesture; out of the book, or into or out of the margin as a note, the plugin does
    // just after it, one step of its own (no proposal leaves a group or links a note).
    drop: (reads, context, mark, x, y, set) => {
      // The room's clear-space nudges a block it finds too close by calling drop, once a block on
      // every pass: inside its own row of the layout last drawn that is nothing, with no new layout
      // (one per nudge made a big room's open and Enter take seconds; Book 0.4.7).
      if (inOwnRow(last.get(context), mark, x, y)) return null;
      const p = flowDrop(reads, context, mark, x, y, shape(reads, context, measure, size, set));
      if (!p?.later) return p;
      if (p.later === 'leave') afterGesture(t, () => leaveBook(t, p.mark), 'Out of the book. Ctrl+Z puts it back.');
      else if (p.later === 'note') afterGesture(t, () => noteOn(t, p.mark, p.of), 'A margin note. Ctrl+Z puts it back.');
      else afterGesture(t, () => noteInto(t, p.mark, p.join || null, p.at ?? 0), p.join ? '' : 'Out of the book. Ctrl+Z puts it back.');
      return null;
    },
    land: (reads, context, mark, x, y, set) => {
      const slot = begun.get(context), was = drafted.get(context);
      begun.delete(context); drafted.delete(context);
      landed(!!slot);
      if (slot) return { join: slot.join, at: slot.at };
      if (was && was !== mark && reads.marks.get(was)) { const p = after(reads, context, was); if (p) return p; }
      const { rows, slots } = shape(reads, context, measure, size, set);
      const s = slotAt(slots, x, y);
      if (s) return { join: s.slot.join, at: s.slot.at };
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
    when: () => inBoth() && !!chosen(),
    run: () => {
      const id = chosen();
      const ch = headed(t, id);
      if (ch) unmakeHeading(t, ch); else if (!makeHeading(t, room(), id)) t.ui.toast('It could not become a heading here.');
    } });
  // A heading chosen, or (in Book · blocks) a chapter's frame: an unnamed chapter has no heading.
  const frame = () => (inBoth() && !chosen() && !t.ui.chosen()?.marks?.length ? frameChosen(t) : null);
  const headingOrFrame = () => headed(t, chosen()) || frame();
  cmd({ id: 'book.deeper', keys: ['Ctrl+]'], zone: 'room', words: 'the chosen heading (or chapter block) one level deeper',
    when: () => inBoth() && (!!chosen() || !!frame()), run: () => { const ch = headingOrFrame(); if (ch) say(demote(t, ch)); else t.ui.toast('Choose a heading.'); } });
  cmd({ id: 'book.higher', keys: ['Ctrl+['], zone: 'room', words: 'the chosen heading (or chapter block) one level up',
    when: () => inBoth() && (!!chosen() || !!frame()), run: () => { const ch = headingOrFrame(); if (ch) say(promote(t, ch)); else t.ui.toast('Choose a heading.'); } });
  cmd({ id: 'book.up', keys: ['Ctrl+ArrowUp'], zone: 'room', words: 'move the chosen paragraph or chapter up one place',
    when: () => inBoth() && (!!chosen() || !!frame()), run: () => say(moveOne(t, room(), chosen() || frame(), -1)) });
  cmd({ id: 'book.down', keys: ['Ctrl+ArrowDown'], zone: 'room', words: 'move the chosen paragraph or chapter down one place',
    when: () => inBoth() && (!!chosen() || !!frame()), run: () => say(moveOne(t, room(), chosen() || frame(), 1)) });

  // ---- Chapters as nested blocks (nest.js): named or not, numbered or not ----
  // The chapter in hand: a chosen heading's, a chosen chapter block's (its frame), or the chosen
  // paragraph's own chapter.
  const inHand = () => (chosen() ? chapterOf(t, chosen()) : frame());
  cmd({ id: 'book.wrap', keys: ['Alt+C'], zone: 'room', words: 'an unnamed chapter around the chosen blocks',
    when: () => inBoth() && (!!chosen() || !!t.ui.chosen()?.marks?.length || !!frame()),
    run: () => {
      const all = t.ui.chosen()?.marks || [];
      const ids = all.length ? [...all] : chosen() ? [chosen()] : [frame()];
      const r = wrap(t, room(), ids);
      if (r.ok) t.ui.toast('An unnamed chapter around them. Alt+Shift+H names it by its first paragraph; Ctrl+Z takes it back.'); else say(r);
    } });
  cmd({ id: 'book.section', keys: ['Alt+Shift+C'], zone: 'room', words: 'a new empty chapter inside the chapter in hand (none: at the end of the book)',
    when: () => inBoth(),
    run: () => { const r = addSection(t, room(), inHand()); if (r.ok) t.ui.toast('A new empty chapter, unnamed. Ctrl+Z takes it back.'); else say(r); } });
  cmd({ id: 'book.name', keys: ['Alt+Shift+H'], zone: 'room', words: 'the chapter in hand unnamed (its heading a paragraph), or named by its first paragraph',
    when: () => inBoth() && (!!chosen() || !!frame()),
    run: () => { const ch = inHand(); if (!ch) { t.ui.toast('Choose a chapter, or a block in one.'); return; } say(toggleName(t, ch)); } });
  cmd({ id: 'book.numbered', keys: ['Alt+U'], zone: 'room', words: 'the chapter in hand numbered or unnumbered',
    when: () => inBoth() && (!!chosen() || !!frame()),
    run: () => {
      const ch = inHand();
      if (!ch) { t.ui.toast('Choose a chapter, or a block in one.'); return; }
      const r = toggleNumbered(t, ch);
      if (r.ok) t.ui.toast(isNumbered(t.marks.get(ch)) ? 'Numbered.' : 'Unnumbered: no number, skipped in the numbering.'); else say(r);
    } });
  cmd({ id: 'book.note', keys: ['Alt+N'], zone: 'room', words: 'make the chosen paragraph a margin note on the one before it (again: a paragraph)',
    when: () => inBoth() && !!chosen(),
    run: () => { const id = chosen(); say(aboutOf(t, id) ? unmakeNote(t, id) : makeNote(t, room(), id)); } });
  cmd({ id: 'book.paste', keys: ['Ctrl+Shift+V'], zone: 'room', words: 'paste as paragraphs, split at blank lines, after the chosen one',
    when: () => inBoth(), run: () => pasteFromClipboard(chosen()) });

  // ---- Keys while writing a paragraph ----

  const caret = () => t.ui.text.caret();
  const kept = () => { const c = inBook() ? caret() : null; return c && c.mark ? c : null; };
  // The line the caret is on, counted from 0, and how many there are, at the column's width.
  const lineAt = (c) => {
    const W = textWidth(t, room());
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

  // A key that begins a paragraph while a slot is chosen (and no mark): the heading or paragraph
  // above the slot is chosen for that moment, so the room draws the words under it, in place, and
  // what follows makes room (column.js draftRoom); land() puts it in the slot. Heard before the
  // room hears the key (which begins the thought and lets the choice go). The room keeps no API
  // word for the box chosen, so it is read off the canvas (data-box, as zoom.js does), and it keeps
  // a box chosen after a mark is chosen: the slot counts (and its caret shows: the room's
  // data-book-slot, style.css) only from a press on a slot until a mark is chosen or a paragraph is
  // kept elsewhere; after Enter in a slot, the room's box is the slot after the paragraph kept.
  let live = null; // the room whose chosen slot counts, or null
  let quiet = false; // our own choice of the anchor: not the person's
  const flag = () => {
    if (typeof document === 'undefined') return;
    for (const n of document.querySelectorAll('.room')) n.setAttribute('data-book-slot', live && live === room() ? 'on' : 'off');
  };
  const chosenSlot = (r) => {
    if (typeof document === 'undefined') return null;
    const node = [...document.querySelectorAll(`.room[data-mode="${RULE}"] .room-cell-${SLOT}.chosen[data-box]`)].find((n) => n.offsetParent);
    const b = node ? t.rules.draws(RULE, r).boxes[+node.dataset.box] : null;
    return b && b.style === SLOT ? slotAt(drawn.get(r), b.x + b.w / 2, b.y + b.h / 2) : null;
  };
  const onKey = (e) => {
    try {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key?.length !== 1 || e.key === ' ') return;
      if (e.target?.closest?.('input, textarea, select, button, [contenteditable], dialog') || document.querySelector('dialog[open]')) return;
      if (!inBook() || chosen() || caret()) return;
      const r = room();
      if (live !== r) return;
      const s = chosenSlot(r);
      if (!s) return;
      begun.set(r, { join: s.slot.join, at: s.slot.at });
      if (s.slot.anchor && t.marks.get(s.slot.anchor)) { quiet = true; try { t.ui.choose([s.slot.anchor]); } finally { quiet = false; } }
    } catch { /* switched off */ }
  };
  const onPress = (e) => {
    try {
      if (e.button !== 0 || !e.target?.closest) return;
      const node = e.target.closest(`.room[data-mode="${RULE}"] .room-cell-${SLOT}`);
      if (!node) return;
      live = room(); flag();
      // A press on the slot already chosen keeps it (the caret stays, as in any editor): the room
      // would let it go on a second tap, so it does not hear this one. Not while words are being
      // written: the press keeps them, as anywhere else.
      if (node.classList.contains('chosen') && !caret() && !e.shiftKey && !e.ctrlKey && !e.metaKey) e.stopPropagation();
    } catch { /* switched off */ }
  };
  t.ui.chosen.on?.((c) => { if (quiet) return; if (c?.mark || c?.context !== live) { live = null; flag(); } });
  landed = (slot) => { if (!slot) { live = null; flag(); } };
  // The thought let go unkept (Escape): the slot it was begun in is forgotten.
  t.ui.text.on?.((c) => { if (!c) setTimeout(() => { if (!t.ui.text.caret()) { const r = room(); if (r) begun.delete(r); } }, 50); });
  if (typeof window !== 'undefined') { window.addEventListener('keydown', onKey, true); window.addEventListener('pointerdown', onPress, true); }
  const stop = () => { if (typeof window !== 'undefined') { window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onPress, true); } };

  return { inBook, inBoth, layout: (r) => shape(t, r, measure, size), stop };
}
