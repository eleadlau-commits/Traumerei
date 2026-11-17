// Book: click anywhere in a chapter to write there. The rule draws invisible slots in the same
// layout pass as the pages (column.js, pages.js): one after each heading and paragraph of the book,
// filling the space down to what comes next. Between two paragraphs (or a heading and its first
// paragraph) the slot is thin; after the last paragraph of a chapter or section it runs down to
// the next heading, or to the page's foot when the next chapter starts a page, at least a line
// tall, and right under an empty chapter's heading too. A tap on one chooses it (the room does:
// a tap on a box chooses it), the style shows a caret there (style.css), and the paragraph typed
// lands exactly there: right after the heading or paragraph above it, in its chapter, as one step
// with Enter (the rule's land, editor.js).
//
// Slots are drawn first among the rule's boxes, the last in reading order first, so that the box
// the room keeps chosen (by its place in the list) is, after Enter, the slot right after the
// paragraph just kept: the caret goes on under it. The page boxes are drawn behind them by the
// plugin's style (z-index), the other boxes and the marks over them.
//
// Plain functions: tested in app/core/api/tests/book-slots.test.js.

export const HINT = 'Click here, or choose a paragraph, and type';
export const SLOT = 'shelf'; // the box style a slot is drawn with (only in a room seen as Book: style.css)

// Where a thought written after item k of read()'s items goes: { join, at, anchor } (anchor: the
// mark it is written after, or null for a book's title or a chapter with no heading thought).
export function targetOf(reads, it, at) {
  if (it.t === 'title') return { join: it.book, at: 0, anchor: null };
  if (it.t === 'chapter') return { join: it.chapter, at: 0, anchor: null };
  if (it.t === 'heading') {
    const i = reads.links.members(it.chapter).indexOf(it.mark);
    return { join: it.chapter, at: i < 0 ? 0 : i + 1, anchor: it.mark };
  }
  const p = at.get(it.mark);
  return p ? { join: p.holder, at: p.i + 1, anchor: it.mark } : null;
}

// The slots, in reading order: boxes { x, y, w, h, style, level, label?, slot: { join, at, anchor,
// end } }; level 1 a slot at the end of a chapter (or of the book, or of a page), 2 a thin one
// between two paragraphs. The geometry is the layout's before the pages move into a grid.
//   items, at   read()'s
//   spans       Map(item index → { top, bottom }): where each item of the book is drawn
//   L, W, lh    the column's left edge, width and line height
//   footAt(y)   the foot of the page's words at y (pages), or null (one column)
//   writing     a thought is being written in the room (reads.marks.draft): no slot says how to
//               write, since you already are (the hint comes back once it is kept or dropped)
export function slotsOf(reads, items, at, spans, { L, W, lh, footAt = null, writing = false }) {
  const out = [];
  let end = items.findIndex((x) => x.t === 'loose');
  if (end < 0) end = items.length;
  const isHead = (x) => x && (x.t === 'heading' || x.t === 'chapter' || x.t === 'title');
  for (let k = 0; k < end; k++) {
    const it = items[k], s = spans.get(k);
    if (!s) continue;
    const next = k + 1 < end ? items[k + 1] : null;
    // After a title: only when the book starts with paragraphs, or has nothing yet.
    if (it.t === 'title' && next && next.t !== 'para') continue;
    const target = targetOf(reads, it, at);
    if (!target) continue;
    const ends = !next || isHead(next);
    const y0 = s.bottom;
    const foot = footAt ? footAt(y0 - 0.5) : null;
    const n = next ? spans.get(k + 1) : null;
    let y1;
    if (n && n.top >= y0 - 0.5 && (foot == null || n.top <= foot + 0.5)) y1 = n.top;
    else y1 = foot != null ? Math.max(foot, y0) : y0 + lh * 2;
    let top = y0, h = y1 - y0;
    const min = ends ? lh * 1.2 : lh * 0.5;
    if (h < min) { if (ends) h = min; else { top = (y0 + y1) / 2 - min / 2; h = min; } }
    // An empty chapter (only its heading) or an empty book: a quiet line says how to write in it.
    let label = '';
    if (writing) label = '';
    else if (it.t === 'heading' || it.t === 'chapter') {
      if (!reads.links.members(it.chapter).some((id) => id !== it.mark)) label = HINT;
    } else if (it.t === 'title' && !reads.links.members(it.book).length) label = HINT;
    out.push({ x: L, y: top, w: W, h, style: SLOT, level: ends ? 1 : 2, ...(label ? { label } : {}), slot: { ...target, end: ends } });
  }
  return out;
}

// Where each item of the book is drawn, from the rows (a heading's or paragraph's, its pieces
// first to last) and the boxes recorded for the title and the chapters with no heading thought.
// → Map(item index → { top, bottom }).
export function spansOf(items, rows, own) {
  const first = new Map(), last = new Map();
  for (const r of rows) {
    const top = r.y - r.height / 2, bottom = r.y + r.height / 2;
    if (!first.has(r.mark)) first.set(r.mark, top);
    last.set(r.mark, bottom);
  }
  const out = new Map(own);
  items.forEach((it, k) => {
    if ((it.t === 'heading' || it.t === 'para') && first.has(it.mark)) out.set(k, { top: first.get(it.mark), bottom: last.get(it.mark) });
  });
  return out;
}

// The slot whose box has its centre at (x, y) (as land hears a chosen box), or null.
export function slotAt(slots, x, y) {
  return (slots || []).find((b) => Math.abs(b.x + b.w / 2 - x) < 1 && Math.abs(b.y + b.h / 2 - y) < 1) || null;
}
