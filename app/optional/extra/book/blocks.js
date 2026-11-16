// Book · blocks: the book as a board of blocks, a sibling rule of Book (Arrange by, or Tab, between
// them). Every paragraph a block of a few lines in a thin frame, set in reading order, a row at a
// time; each section a dotted outline around its blocks, each chapter around its sections, its
// heading as the outline's label; a paragraph still to write in a dashed frame; its margin notes
// in its frame, under it. The thoughts not yet in the book wait in the tray below. A block dragged
// between others moves there (into another outline: into that chapter), onto an outline's label
// goes to the end of that chapter, into the tray leaves the book; a heading dragged moves its
// whole chapter. Each is one step. Zoomed out, it is the corkboard: the headings read from afar.
//
// Plain functions of the read half of the tables (as column.js), and installBlocks(t), which adds
// the rule. Only the plugin API (app/core/API.md). Tested in app/core/api/tests/book-blocks.test.js.

import { wordCount } from './rules.js';
import { read, after, headed, aboutOf, nameOf } from './column.js';
import { DEEPEST, depthOf, levels } from './treedrop.js';
import { isChapter } from './rules.js';
import { holderOf, leaveBook, afterGesture } from './editing.js';

export const BLOCKS = 'book-blocks';
// The board's measures, in world units: a block's words wrap at `block` and show at most `lines`
// lines; `cols` blocks to a row; `frame` the air inside a block's frame, `gap` between frames,
// `pad` inside an outline, `note` lines of a margin note shown under its paragraph.
export const BOARD = Object.freeze({ block: 230, lines: 4, cols: 4, frame: 10, gap: 18, pad: 22, note: 2 });

// How many blocks to a row: the room's setting under the rule (BOARD.cols by default), and the
// counts it offers. setAcross keeps a new count there, one step (marks.edit), as the ⚙ does.
export const ACROSS = Object.freeze([2, 3, 4, 6, 8]);
export function acrossOf(reads, room, set = null) {
  const n = Number(set?.across ?? reads.marks.get(room)?.rules?.[BLOCKS]?.across);
  return ACROSS.includes(n) ? n : BOARD.cols;
}
export function setAcross(t, room, n) {
  const m = t.marks.get(room);
  if (!m) return { ok: false, reason: 'No such room' };
  return t.marks.edit(room, { rules: { ...(m.rules || {}), [BLOCKS]: { ...(m.rules?.[BLOCKS] || {}), across: String(n) } } });
}
export const stepAcross = (n, dir) => ACROSS[Math.max(0, Math.min(ACROSS.length - 1, Math.max(0, ACROSS.indexOf(n)) + dir))];

// The board: { rows, boxes, outlines, tray, cells, books }.
//   rows      for arrange: each paragraph, heading, note and stray where it shows
//   boxes     for draw: the outlines (quiet: dotted by the plugin's style), then the frames
//             (plain; shelf, dashed, for one still to write), the tray (shelf) and its label
//   outlines  [{ id, depth, x, y, w, h, top, ancestors, cells: [{ id, x0, y0, x1, y1 }] }]: each
//             book and chapter, `top` where its blocks begin (above it: its label), its cells the
//             parts it shows in order (a paragraph's block, a section's outline)
//   tray      { x, y, w, h }: the thoughts not yet in the book
//   cells     Map(mark → { x0, y0, x1, y1 }): where each mark shows (a heading: its label strip)
export function board(reads, room, measure, set = null) {
  const { block: BW, lines: LINES, frame: F, gap: G, pad: PAD, note: NL } = BOARD;
  const COLS = acrossOf(reads, room, set);
  const lh = measure('M', BW).lineHeight || 27.5;
  const BH = lh * LINES;
  const CW = BW + 2 * F + G; // a cell's pitch across
  const { items, at, notes } = read(reads, room);
  const notesOf = new Map();
  for (const n of notes) { const l = notesOf.get(n.of); if (l) l.push(n.mark); else notesOf.set(n.of, [n.mark]); }

  // The book as a tree again, from the reading order: holders and what they show, in order.
  const nodes = new Map(), books = [], strays = [];
  let maxDepth = 0;
  for (const it of items) {
    if (it.t === 'title') { const n = { id: it.book, depth: 0, kids: [] }; nodes.set(it.book, n); books.push(n); }
    else if (it.t === 'heading' || it.t === 'chapter') {
      const n = { id: it.chapter, depth: it.depth, num: it.num, head: it.t === 'heading' ? it.mark : null, kids: [] };
      nodes.set(it.chapter, n);
      maxDepth = Math.max(maxDepth, it.depth);
      nodes.get(at.get(it.chapter)?.holder)?.kids.push(n);
    } else if (it.t === 'para') nodes.get(it.holder)?.kids.push({ id: it.mark, para: true });
    else if (it.t === 'stray') strays.push(it.mark);
  }

  const W0 = COLS * CW - G + 2 * PAD * (maxDepth + 1); // the book's outline, widest
  const L0 = -W0 / 2;
  const rows = [], outlines = [], frames = [], labels = [], cells = new Map();
  const clip = (id, width, most) => {
    const n = measure(reads.marks.text(id) || ' ', width).lines || 1;
    return n > most ? { lines: [0, most] } : {};
  };
  // A grid of blocks from `y`, at `left`: each paragraph a block, its notes under it in its frame.
  const grid = (ids, left, y, out) => {
    for (let r = 0; r < ids.length; r += COLS) {
      const row = ids.slice(r, r + COLS);
      const h = Math.max(...row.map((id) => BH + (notesOf.get(id)?.length || 0) * (lh * NL + F)));
      row.forEach((id, k) => {
        const x0 = left + k * CW, cx = x0 + F + BW / 2;
        const box = { x0, y0: y, x1: x0 + BW + 2 * F, y1: y + h + 2 * F };
        rows.push({ mark: id, x: cx, y: y + F + BH / 2, width: BW, height: BH, align: 'start', ...clip(id, BW, LINES) });
        let ny = y + F + BH + F;
        for (const n of notesOf.get(id) || []) {
          rows.push({ mark: n, x: cx + 12, y: ny + lh * NL / 2, width: BW - 24, height: lh * NL, align: 'start', ...clip(n, BW - 24, NL) });
          cells.set(n, { x0: box.x0, y0: ny, x1: box.x1, y1: ny + lh * NL });
          ny += lh * NL + F;
        }
        const open = reads.gaps.of(id)?.state === 'open';
        frames.push({ x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0, style: open ? 'shelf' : 'plain', ...(open ? { note: 'to write' } : {}) });
        cells.set(id, box);
        out?.push({ id, ...box });
      });
      y += h + 2 * F + G;
    }
    return y;
  };
  // A book or chapter's outline from `y`: its label strip (a heading: the heading itself), then its
  // paragraphs as rows of blocks and its sections as outlines inside it. Returns where it ends.
  const outline = (node, y, ancestors) => {
    const d = node.depth;
    const x = L0 + d * PAD, w = W0 - 2 * d * PAD;
    const left = x + PAD;
    const o = { id: node.id, depth: d, x, y, w, h: 0, top: y, ancestors, cells: [] };
    outlines.push(o);
    let words = 0;
    if (d > 0) { // a chapter block: its number, then its heading (or its title) on the frame's top
      // (unnumbered: no number, the heading from the left; unnamed: its number alone, or with
      // neither a slimmer strip, a faint frame)
      const num = node.num ? lh * (1.2 + 0.5 * node.num.length / 2) : 0;
      const name = node.head ? '' : nameOf(reads, node.id);
      const strip = node.head || name || node.num ? lh * 1.9 : lh * 1.1;
      if (node.head) {
        const hw = w - 2 * PAD - num;
        rows.push({ mark: node.head, x: left + num + hw / 2, y: y + strip / 2 + lh * 0.15, width: hw, height: lh, align: 'start', far: [node.num, (reads.marks.text(node.head) || '').split('\n')[0].slice(0, 60)].filter(Boolean).join('  '), ...clip(node.head, hw, 1) });
        cells.set(node.head, { x0: x, y0: y, x1: x + w, y1: y + strip });
      }
      let sy = y + strip;
      for (const n of notesOf.get(node.head) || []) { // notes on a heading: under it, in the strip
        rows.push({ mark: n, x: left + num + (BW - 24) / 2, y: sy + lh * NL / 2, width: BW - 24, height: lh * NL, align: 'start', ...clip(n, BW - 24, NL) });
        cells.set(n, { x0: x, y0: sy, x1: x + w, y1: sy + lh * NL });
        sy += lh * NL + F;
      }
      o.label = node.head ? node.num : [node.num, name].filter(Boolean).join('  ');
      o.named = !!(node.head || name); o.numbered = !!node.num;
      o.top = y = sy;
    } else y += PAD;
    let run = [];
    const flush = () => { if (run.length) { y = grid(run, left, y, o.cells); run = []; } };
    for (const k of node.kids) {
      if (k.para) { run.push(k.id); words += wordCount(reads.marks.text(k.id)); continue; }
      flush();
      const top = y;
      const r = outline(k, y, [...ancestors, node.id]);
      words += r.words;
      o.cells.push({ id: k.id, x0: x + PAD, y0: top, x1: x + w - PAD, y1: r.y });
      y = r.y + G;
    }
    flush();
    if (!node.kids.length) y += lh * 1.2; // an empty chapter still has room to drop into
    y += PAD - (node.kids.length && node.kids[node.kids.length - 1].para ? G : 0);
    o.h = y - o.y;
    o.words = words;
    return { y, words };
  };

  let y = -lh * 6;
  const top = y;
  for (const b of books) {
    if (y > top) y += lh * 3;
    labels.push({ x: L0, y, w: W0, h: lh * 2.4, label: reads.marks.get(b.id)?.title || 'Untitled book', style: 'title', opens: b.id });
    y += lh * 3;
    y = outline(b, y, []).y;
  }
  if (!books.length) {
    labels.push({ x: L0, y, w: W0, h: lh * 2, label: 'No book in this room yet: Ctrl+Alt+J makes one', style: 'quiet' });
    y += lh * 3;
  }
  // The tray: the thoughts not yet in the book (a block let go here leaves it).
  y += lh * 2.5;
  const tray = { x: L0, y, w: W0, h: 0 };
  y = grid(strays, L0 + PAD, y + lh * 1.6, null);
  if (!strays.length) y += lh * 2;
  tray.h = Math.max(lh * 3, y - tray.y + PAD - (strays.length ? G : 0));
  // Each chapter a block holding blocks: a `quiet` box, which the plugin's style frames heavier than
  // a paragraph's (style.css, in a room seen as Book · blocks only); an unnamed one says so faintly.
  const outlined = outlines.filter((o) => o.depth > 0).map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h, label: o.label, right: `${o.named ? '' : 'unnamed · '}${o.numbered ? '' : 'unnumbered · '}${o.words.toLocaleString('en')} words`, style: 'quiet', level: Math.min(o.depth, 3) }));
  const boxes = [...labels,
    { x: tray.x, y: tray.y, w: tray.w, h: tray.h, label: 'Not in the book yet', right: strays.length ? `${strays.length}` : 'drag a block here to take it out', style: 'shelf' },
    ...outlined, ...frames];
  return { rows, boxes, outlines, tray, cells, books: books.length, lineHeight: lh };
}

const inside = (r, x, y) => !!r && x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const within = (o, x, y) => x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;

// Where a mark let go at x, y goes: { mark, join, at, from? } (a proposal), { leave: holder, mark }
// (into the tray: out of the book), or null (where it was, or nowhere it can go). A heading moves
// its chapter; a margin note stays a note (Alt+N makes it a paragraph); a let-go inside the
// mark's own block is no move at all (the room's clear-space nudge, or a drag that came back).
export function dropAt(reads, room, mark, x, y, lay) {
  if (!lay.books || !reads.marks.get(mark)) return null;
  if (inside(lay.cells.get(mark), x, y)) return null;
  if (aboutOf(reads, mark)) return null;
  const id = headed(reads, mark) || mark;
  const from = holderOf(reads, id);
  const T = lay.tray;
  if (x >= T.x && x <= T.x + T.w && y >= T.y && y <= T.y + T.h) return from ? { leave: from, mark: id } : null;
  // A chapter let go inside its own block (on itself, or a section it holds): nothing.
  const own = lay.outlines.find((c) => c.id === id);
  if (own && within(own, x, y)) return null;
  // The innermost outline at the point (never the chapter being moved, nor one inside it).
  let o = null;
  for (const c of lay.outlines) {
    if (c.id === id || c.ancestors.includes(id) || !within(c, x, y)) continue;
    if (!o || c.depth > o.depth) o = c;
  }
  if (!o) return null;
  // A chapter block nests at most three deep, with the sections it brings.
  if (isChapter(reads.marks.get(id)) && depthOf(reads, o.id) + levels(reads, id) > DEEPEST)
    return { refuse: 'A book goes three levels deep: it does not fit there.', mark: id };
  const members = reads.links.members(o.id).filter((m) => m !== id);
  const head = members[0] && headed(reads, members[0]) === o.id ? 1 : 0; // nothing goes above a heading
  let at;
  if (y < o.top) at = members.length; // on the outline's label: at the end of that chapter
  else {
    const shown = o.cells.filter((c) => c.id !== id);
    const k = shown.filter((c) => y >= c.y1 || (y >= c.y0 && x >= (c.x0 + c.x1) / 2)).length;
    at = k < shown.length ? members.indexOf(shown[k].id) : shown.length ? members.indexOf(shown[shown.length - 1].id) + 1 : members.length;
    if (at < 0) at = members.length;
  }
  at = Math.max(head, at);
  if (from === o.id && reads.links.members(o.id).indexOf(id) === at) return null; // where it is
  return { mark: id, join: o.id, at, ...(from && from !== o.id ? { from } : {}) };
}

// The rule, beside Book (order 31, so Tab from Book comes here).
export function installBlocks(t) {
  const measure = (text, width) => t.ui.measure(text, width);
  const ICON = '<rect x="3" y="4" width="8" height="6"/><rect x="13" y="4" width="8" height="6"/><rect x="3" y="14" width="8" height="6"/><rect x="13" y="14" width="8" height="6" stroke-dasharray="2 2"/>';
  // Out of the book: no proposal takes a mark out of a group alone, so the plugin does it, one step,
  // as soon as the room's gesture is over (the drop itself changes nothing).
  const leave = (mark) => afterGesture(t, () => leaveBook(t, mark), 'Out of the book, in the tray. Ctrl+Z puts it back.');
  t.slots.rules.add({
    id: BLOCKS, name: 'Book · blocks', note: 'the book as blocks: a frame for each paragraph, an outline for each chapter; drag to reorder', icon: ICON, order: 31,
    claims: ['book', 'book-chapter'],
    settings: [{ key: 'across', label: 'Blocks across', type: 'choice', default: String(BOARD.cols), options: ACROSS.map((n) => [String(n), String(n)]) }],
    arrange: (reads, context, set) => board(reads, context, measure, set).rows,
    draw: (reads, context, set) => board(reads, context, measure, set).boxes,
    drop: (reads, context, mark, x, y, set) => {
      const p = dropAt(reads, context, mark, x, y, board(reads, context, measure, set));
      if (p?.leave) { leave(p.mark); return null; }
      if (p?.refuse) { t.ui.toast(p.refuse); return null; }
      return p;
    },
    // A thought written after a block lands right after it, in its chapter (as in Book).
    land: (reads, context, mark, x, y, set) => {
      const near = board(reads, context, measure, set).rows.find((r) => r.mark !== mark && Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1);
      return near ? after(reads, context, near.mark) : null;
    },
    hand: false,
  });
}

// The chapter whose block is chosen (a tap on its frame, not on a block in it), in a room seen as
// Book · blocks, or null: an unnamed chapter has no heading to choose, so its frame stands for it.
// The room keeps no API word for the box chosen, so it is read off the canvas (data-box, as
// editor.js reads a slot) and matched to the board's chapter blocks by where it is.
export function chapterAtBox(lay, box) {
  if (!box) return null;
  const o = lay.outlines.find((c) => c.depth > 0 && Math.abs(c.x - box.x) < 0.5 && Math.abs(c.y - box.y) < 0.5 && Math.abs(c.w - box.w) < 0.5);
  return o ? o.id : null;
}
let seenFrame = { key: '', id: null };
export function frameChosen(t) {
  try {
    if (typeof document === 'undefined' || t.ui.chosen()?.mark) return null;
    const r = t.ui.chosen()?.context;
    if (!r || t.marks.get(r)?.mode !== BLOCKS) return null;
    const node = [...document.querySelectorAll(`.room[data-mode="${BLOCKS}"] .room-cell-quiet.chosen[data-box]`)].find((n) => n.offsetParent);
    const box = node ? t.rules.draws(BLOCKS, r).boxes[+node.dataset.box] : null;
    if (!box || box.style !== 'quiet') return null;
    const key = `${r}|${t.moments.seq?.() ?? Math.random()}|${box.x}|${box.y}|${box.w}`; // (looked at a few times a second by the docks)
    if (seenFrame.key !== key) seenFrame = { key, id: chapterAtBox(board(t, r, (text, width) => t.ui.measure(text, width)), box) };
    return seenFrame.id;
  } catch { return null; }
}
