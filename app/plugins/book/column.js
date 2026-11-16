// The Book rule's plain functions: the book read in reading order, and laid out as one column, a
// page wide. No screen: only the read half of the tables (`reads`, as a rule's arrange is handed,
// or the plugin's own t), and a measure(text, width) and size(id, width) handed in, so the tests
// run them as they are. Tested in tests/column.test.js.
//
// The shape: a book is a group of the family `book`; its parts, in the maker's order, are
// chapters (family `book-chapter`, which hold sections, chapters again) and paragraphs (the
// room's thoughts). A chapter's heading is a thought too, linked to it by a `heads` link and kept
// as its first part, so the caret runs through it and it is written in like any paragraph.

import { BOOK, CHAPTER, isBook, isChapter, booksIn } from './rules.js';

export const RULE = 'book-page';
export const HEADS = 'heads';
export const ABOUT = 'about'; // a margin note: a thought linked about a paragraph of the book

// The column's measures, in world units (a thought is about 200 wide; the reading size is 19).
export const WIDTHS = Object.freeze({ narrow: 480, book: 600, wide: 760 });
export const SPACE = Object.freeze({ para: 0.55, before: [2.6, 1.9, 1.4], after: 0.5, title: 4.2, loose: 2.4 });

// One of the room's settings under the rule: from `set` (the values a hook is handed, the room's
// or else those for new rooms), else the room's own as it keeps them.
export function settingOf(reads, room, key, set = null) {
  if (set && set[key] !== undefined) return set[key];
  return reads.marks.get(room)?.rules?.[RULE]?.[key];
}
// The column width a room asked for (its settings under the rule), or the book's.
export function widthOf(reads, room, set = null) {
  return WIDTHS[settingOf(reads, room, 'width', set)] || WIDTHS.book;
}

// The heading thought of a chapter (the mark that heads it), or null.
export function headOf(reads, chapter) {
  for (const r of reads.links.to(chapter, HEADS)) if (reads.marks.get(r.from)) return r.from;
  return null;
}
// The chapter a thought heads, or null.
export function headed(reads, mark) {
  for (const r of reads.links.from(mark, HEADS)) { const g = reads.marks.get(r.to); if (isChapter(g)) return r.to; }
  return null;
}
// The paragraph a margin note is about, or null.
export function aboutOf(reads, mark) {
  for (const r of reads.links.from(mark, ABOUT)) if (reads.marks.get(r.to)) return r.to;
  return null;
}
// The title a chapter shows: its heading's words, else the group's own title.
export function titleOf(reads, chapter) {
  const h = headOf(reads, chapter);
  const words = h ? (reads.marks.text(h) || '').split('\n')[0].trim() : '';
  return words || reads.marks.get(chapter)?.title || 'Untitled';
}

// The room as the book reads: [{ t, … }] in order, and where each mark is.
//   { t: 'title', book }                          a book's title
//   { t: 'heading', mark, chapter, depth, num }   a chapter's heading thought
//   { t: 'chapter', chapter, depth, num }         a chapter with no heading thought (its title)
//   { t: 'para', mark, holder, depth }            a paragraph (or a table, a figure) in the book
//   { t: 'loose' }, { t: 'stray', mark }          then the room's thoughts not in a book
// `at` maps a mark (thought or chapter) to { holder, i } (its holder and place in its parts).
// `notes`: [{ mark, of }], the margin notes (thoughts linked `about` a mark in the book), in the
// order of what they are about; they are neither in the book's flow nor among the strays.
export function read(reads, room) {
  const items = [], at = new Map(), seen = new Set(), notes = [];
  const walk = (holder, depth, prefix) => {
    let n = 0;
    reads.links.members(holder).forEach((id, i) => {
      if (seen.has(id)) return; // a mark seen twice (in two chapters) reads once, where it comes first
      const m = reads.marks.get(id);
      if (!m) return;
      seen.add(id);
      at.set(id, { holder, i });
      if (isChapter(m)) {
        const num = `${prefix}${++n}`;
        const head = headOf(reads, id);
        if (head && !seen.has(head) && reads.links.holders(head).includes(id)) {
          // its heading is drawn first, wherever it sits in the chapter's parts
          seen.add(head);
          at.set(head, { holder: id, i: reads.links.members(id).indexOf(head) });
          items.push({ t: 'heading', mark: head, chapter: id, depth: Math.min(depth + 1, 3), num });
        } else items.push({ t: 'chapter', chapter: id, depth: Math.min(depth + 1, 3), num });
        walk(id, depth + 1, `${num}.`);
      } else if (m.kind !== 'group') items.push({ t: 'para', mark: id, holder, depth });
    });
  };
  for (const b of booksIn(reads, room)) {
    seen.add(b.id);
    items.push({ t: 'title', book: b.id });
    walk(b.id, 0, '');
  }
  const inBook = new Set(seen);
  for (const it of items) {
    if (it.t !== 'para' && it.t !== 'heading') continue;
    for (const r of reads.links.to(it.mark, ABOUT)) {
      if (seen.has(r.from) || !reads.marks.get(r.from) || inBook.has(r.from)) continue;
      seen.add(r.from);
      notes.push({ mark: r.from, of: it.mark });
    }
  }
  const strays = reads.marks.in(room).filter((m) => m.kind !== 'group' && m.kind !== 'room' && !seen.has(m.id)).sort((a, b) => a.at - b.at);
  if (strays.length) {
    items.push({ t: 'loose' });
    for (const m of strays) items.push({ t: 'stray', mark: m.id });
  }
  return { items, at, notes };
}

// The column: rows for the marks (centre, width, height, words set flush left) and boxes behind
// them (the title, each heading's number, the line over the thoughts not yet in the book).
// measure(text, width) → { lines, lineHeight, height }; size(id, width) → { height } or null.
export function column(reads, room, measure, size = () => null, set = null) {
  const W = widthOf(reads, room, set);
  const { items, notes } = read(reads, room);
  const lh = measure('M', W).lineHeight || 27.5;
  const rows = [], boxes = [];
  const L = -W / 2; // the column is centred on x = 0, and starts a little above the room's middle
  let y = -lh * 10;
  const books = items.filter((x) => x.t === 'title').length;
  if (!books) { // no book yet: a quiet line says how to make one
    boxes.push({ x: L, y, w: W, h: lh * 2, label: 'No book in this room yet: Ctrl+Alt+J makes one', style: 'quiet' });
    y += lh * 3;
  }
  const heightOf = (id) => {
    const s = size(id, W);
    if (s && Number.isFinite(s.height) && s.height > 0 && s.lines == null) return s.height; // a kind that draws its own height
    return measure(reads.marks.text(id) || ' ', W).height;
  };
  const top = y;
  const place = (id, h, extra = {}) => { rows.push({ mark: id, x: 0, y: y + h / 2, width: W, height: h, align: 'start', ...extra }); y += h; };
  for (const it of items) {
    if (it.t === 'title') {
      if (y > top) y += lh * SPACE.title;
      const b = reads.marks.get(it.book);
      boxes.push({ x: L, y, w: W, h: lh * 2.4, label: b?.title || 'Untitled book', style: 'title', opens: it.book });
      y += lh * SPACE.title;
    } else if (it.t === 'heading' || it.t === 'chapter') {
      y += lh * SPACE.before[it.depth - 1];
      const label = it.num;
      if (it.t === 'heading') {
        const h = heightOf(it.mark);
        boxes.push({ x: L - lh * 2.2, y: y - lh * 0.15, w: lh * 1.9, h: lh * 1.3, label, style: 'heading', level: it.depth });
        place(it.mark, h, { far: titleOf(reads, it.chapter) }); // far off: its title, large
      } else {
        boxes.push({ x: L - lh * 2.2, y, w: W + lh * 2.2, h: lh * 1.3, label: `${label}  ${titleOf(reads, it.chapter)}`, style: 'heading', level: it.depth, opens: it.chapter });
        y += lh * 1.3;
      }
      y += lh * SPACE.after;
    } else if (it.t === 'loose') {
      y += lh * SPACE.loose;
      boxes.push({ x: L, y, w: W, h: lh * 1.2, label: 'Not in the book yet', style: 'line' });
      y += lh * 1.6;
    } else {
      place(it.mark, heightOf(it.mark));
      y += lh * SPACE.para;
    }
  }
  placeNotes(reads, rows, notes, measure, W / 2 + lh * 1.6);
  return { rows, boxes, width: W, lineHeight: lh };
}

// The margin notes, set beside what they are about: flush left from `x0` (the column's right edge
// and some air), NOTE wide, each level with the top of its paragraph's first piece, pushed down so
// that none covers the one above. Into `rows`.
export const NOTE = 260;
export function placeNotes(reads, rows, notes, measure, x0) {
  if (!notes.length) return;
  const first = new Map();
  for (const r of rows) if (!first.has(r.mark)) first.set(r.mark, r);
  const sorted = notes.map((n) => ({ ...n, row: first.get(n.of) })).filter((n) => n.row).sort((a, b) => a.row.y - b.row.y);
  let below = -Infinity;
  for (const n of sorted) {
    const m = measure(reads.marks.text(n.mark) || ' ', NOTE);
    const top = Math.max(n.row.y - (n.row.height || 0) / 2, below);
    rows.push({ mark: n.mark, x: x0 + NOTE / 2, y: top + m.height / 2, width: NOTE, height: m.height, align: 'start' });
    below = top + m.height + m.lineHeight * 0.6;
  }
}

// What sits at a point of the column (a mark's centre, as land hears it): the row or box there.
export function hit(reads, room, measure, size, x, y) {
  const { rows, boxes } = column(reads, room, measure, size);
  const row = rows.find((r) => Math.abs(r.y - y) <= r.height / 2 && Math.abs(r.x - x) <= r.width / 2);
  if (row) return { mark: row.mark };
  const box = boxes.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  return box ? { box } : null;
}

// Where a thought written after `anchor` goes: { join: holder, at } (into the book), or null.
// After a heading: first in its chapter; after a paragraph: right after it; after the title:
// first in the book.
export function after(reads, room, anchor) {
  const { at } = read(reads, room);
  const ch = headed(reads, anchor);
  if (ch && at.has(ch)) {
    const i = reads.links.members(ch).indexOf(anchor);
    return { join: ch, at: i < 0 ? 0 : i + 1 };
  }
  const p = at.get(anchor);
  if (p) return { join: p.holder, at: p.i + 1 };
  const m = reads.marks.get(anchor);
  if (isBook(m)) return { join: anchor, at: 0 };
  return null;
}

// The paragraphs (and headings) in reading order, as ids: what the caret runs through.
export function flow(reads, room) {
  return read(reads, room).items.filter((x) => x.t === 'heading' || x.t === 'para' || x.t === 'stray').map((x) => x.mark);
}

export { BOOK, CHAPTER };
