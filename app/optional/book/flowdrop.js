// Book: a paragraph dragged on the pages. Where it is let go reads as a place in the book's flow:
// the gap between two rows (the row under it, before or after by its half; a piece of a paragraph
// that runs on counts as its paragraph), on whichever page of the grid or spread it is over, or in
// the one column of Pages: None. Onto a heading: first in that chapter. A heading dragged carries
// its whole chapter (never into itself). Under the last page, among the thoughts not yet in the
// book: out of it. Into the outer margin beside a paragraph: a margin note on it; a note dragged
// back into the flow is a paragraph there again. Let go where it is (or nudged inside its own row,
// as the room's clear-space does): nothing.
//
// A plain function of the read half of the tables and the rule's layout (shape(), pages.js), as
// blocks.js's dropAt. Tested in app/core/api/tests/book-drag.test.js.

import { read, headed, headOf, aboutOf, NOTE, SPACE, ABOUT } from './column.js';
import { placeOf, belowGrid, GAP } from './pages.js';
import { holderOf } from './editing.js';

// → a proposal { mark, join, at, from? } (into the flow, one step with the gesture), or what the
// plugin does just after it, as no proposal can (`later`):
//   { later: 'leave', mark }             out of the book (a heading: its chapter)
//   { later: 'note', mark, of }          a margin note on `of`
//   { later: 'unnote', mark, join, at }  a note a paragraph again, at `at` in `join`
//   { later: 'unnote', mark }            a note out of the book, among the thoughts not yet in it
// or null: where it is, or nowhere it can go.
export function flowDrop(reads, room, mark, x, y, lay) {
  const m = reads.marks.get(mark);
  if (!m || m.kind === 'group' || !lay?.rows) return null;
  const lh = lay.lineHeight || 27.5, W = lay.width;
  // Inside one of its own rows (half a line of air): no move at all.
  for (const r of lay.rows) {
    if (r.mark === mark && Math.abs(r.x - x) <= r.width / 2 && Math.abs(r.y - y) <= r.height / 2 + lh / 2) return null;
  }
  const { items } = read(reads, room);
  // The book's flow: each heading and paragraph, its place in reading order and its book.
  const pos = new Map(), order = [];
  let book = null;
  for (const it of items) {
    if (it.t === 'title') book = it.book;
    else if (it.t === 'heading' || it.t === 'para') { pos.set(it.mark, { i: order.length, book }); order.push(it.mark); }
  }
  if (!order.length && !book) return null;
  const note = aboutOf(reads, mark);
  const ch = headed(reads, mark);
  const id = ch || mark; // a heading carries its chapter
  const from = holderOf(reads, id);
  const out = () => (note ? { later: 'unnote', mark } : from ? { later: 'leave', mark: id } : null);
  const inFlow = (r) => pos.has(r.mark);

  // The region the point is over: a page (its flow rows) or the column; and whether it is in the
  // outer margin, where the notes are.
  let rows, outer, onPage = 0;
  if (lay.page && lay.pages) {
    if (y >= belowGrid(lay)) return out();
    const P = lay.page, reach = lh * 1.6 + NOTE + lh; // past the page's outer edge: as far as the notes
    let best = 0, bd = Infinity, q = null;
    for (let n = 1; n <= lay.pages; n++) {
      const p = placeOf(lay, n);
      const L = p.x - P.w / 2, R = p.x + P.w / 2;
      const dx = x < L ? L - x : x > R ? x - R : 0, dy = y < p.y ? p.y - y : y > p.y + P.h ? y - p.y - P.h : 0;
      const outside = p.left ? x < L : x > R;
      if (dy > GAP / 2 || dx > (outside ? reach : GAP / 2)) continue;
      if (dx + dy < bd) { bd = dx + dy; best = n; q = p; }
    }
    if (!best) return null;
    onPage = best;
    rows = lay.rows.filter((r) => inFlow(r) && Math.abs(r.x - q.x) < 1 && r.y >= q.y && r.y <= q.y + P.h);
    outer = q.left ? x < q.x - W / 2 : x > q.x + W / 2;
  } else {
    rows = lay.rows.filter(inFlow);
    const loose = lay.boxes.find((b) => b.style === 'line' && b.label === 'Not in the book yet');
    const last = rows.length ? Math.max(...rows.map((r) => r.y + r.height / 2)) : -Infinity;
    const looseTop = loose ? loose.y - lh * SPACE.loose / 2 : last + lh * 3;
    if (y >= looseTop) return out();
    outer = x > W / 2;
  }

  // Into the outer margin: a note on the paragraph beside the point (none for a heading).
  if (outer) {
    if (ch || !rows.length || reads.links.to(mark, ABOUT).length) return null;
    let of = null, d = Infinity;
    for (const r of rows) {
      const e = Math.max(0, Math.abs(r.y - y) - r.height / 2);
      if (e < d) { d = e; of = r.mark; }
    }
    if (!of || of === mark || of === note) return null;
    return { later: 'note', mark, of };
  }

  // Into the flow: the anchor row and the side of it.
  let anchor = null, side = 'after';
  if (!rows.length) { // a page with no flow on it (a title page): before what starts after it
    const next = order.find((k) => (lay.pageOf?.get(k) ?? 0) >= onPage);
    if (next) { anchor = next; side = 'before'; } else if (order.length) anchor = order[order.length - 1];
  } else {
    const r = rows.find((q) => Math.abs(q.y - y) <= q.height / 2);
    if (r) { anchor = r.mark; side = headed(reads, r.mark) && !ch ? 'after' : y < r.y ? 'before' : 'after'; }
    else {
      let above = null, below = null;
      for (const q of rows) { if (q.y < y) above = q; else if (!below) below = q; }
      if (below && (!above || (ch && headed(reads, below.mark)))) { anchor = below.mark; side = 'before'; }
      else anchor = above.mark;
    }
  }
  const spot = anchor ? spotOf(reads, anchor, side, mark, !!ch, pos, order) : (book ? { holder: book, at: 0 } : null);
  if (!spot) return null;
  const { holder } = spot;
  // Never into itself, nor a chapter it holds.
  for (let up = holder, k = 0; up && k < 64; up = holderOf(reads, up), k++) if (up === id) return null;
  const others = reads.links.members(holder).filter((k) => k !== id);
  let at = spot.before != null ? others.indexOf(spot.before) : spot.after != null ? others.indexOf(spot.after) + 1 : spot.at;
  if (at < 0) return null;
  const head = headOf(reads, holder);
  if (head && others[0] === head && head !== id) at = Math.max(1, at); // nothing goes above a heading
  if (note) return { later: 'unnote', mark, join: holder, at };
  if (from === holder && reads.links.members(holder).indexOf(id) === at) return null; // where it is
  return { mark: id, join: holder, at, ...(from && from !== holder ? { from } : {}) };
}

// Where "before" or "after" a row's mark is: { holder, before } or { holder, after }, or null.
// After a heading: first in its chapter. Before a heading: a paragraph goes after what comes before
// it (the end of the chapter above); a chapter goes before that chapter, at its level.
function spotOf(reads, anchor, side, mark, carrying, pos, order) {
  if (anchor === mark) return null; // beside itself: where it is
  const ch = headed(reads, anchor);
  if (side === 'after') {
    const h = ch || holderOf(reads, anchor);
    return h ? { holder: h, after: anchor } : null;
  }
  if (!ch) { const h = holderOf(reads, anchor); return h ? { holder: h, before: anchor } : null; }
  if (!carrying) {
    const p = pos.get(anchor), prev = p && p.i > 0 ? order[p.i - 1] : null;
    if (prev && pos.get(prev).book === p.book) return spotOf(reads, prev, 'after', mark, carrying, pos, order);
  }
  const h = holderOf(reads, ch);
  return h ? { holder: h, before: ch } : null;
}
