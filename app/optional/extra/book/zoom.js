// The Book rule under the zoom's three bands (t.ui.zoom.bands). Far off, the book is a shelf of
// page thumbnails: body text as quiet lines, each chapter's title large on its first page and at
// the head of the pages after (style.css, under room-band-far; the words are the heading rows' far
// band words and the running heads, both made with the layout in pages.js). From there:
//   - a double-click on a page (or a paragraph on it) goes to that page, filling the height;
//   - a click on a chapter in the contents (docks.js) brings its first page into view, from its
//     top, at a zoom to read it (far off: the page fills the height).
// Going there is one move: the mark is chosen with t.ui.choose (so the room is not opened again
// and the right dock stays as it was) and t.ui.zoom.go slides and zooms the view there, eased (at
// once when the system asks for less motion; the person's own wheel or drag stops it).

import { RULE, typeOf, setType, stepType } from './column.js';
import { placeOf, pageAt, ranges, GUTTER, pageOf, gridOf, setGrid, stepCount } from './pages.js';
import { BLOCKS, acrossOf, setAcross, stepAcross } from './blocks.js';
import { stageBox } from './side.js';
export { pageAt } from './pages.js';

const MIN = 0.25, MAX = 4, READ = 0.5; // the zoom's limits, and the least zoom that reads (mid)

// The zoom at which a page of height `h` (world units) fills a screen `viewH` pixels tall, with a
// little air: never under mid (the words still read as words), never past the zoom's limit.
export function fillHeight(h, viewH) {
  const z = (viewH - 24) / h;
  return Math.min(MAX, Math.max(READ, Math.round(z * 100) / 100));
}

// The middle of the screen that shows page n (from 1) of a layout with pages at zoom z on a
// screen viewW by viewH pixels: the whole page when it fits the height, else its top with a little
// air; a page of a spread with its facing page, when both fit the width.
export function pageCentre(lay, n, z, viewH, viewW = 0) {
  const q = placeOf(lay, n), w = lay.page.w, h = lay.page.h, seen = viewH / z;
  const both = lay.grid?.paired && (2 * w + GUTTER) * z <= viewW;
  return { x: both ? q.x + (q.left ? 1 : -1) * (w + GUTTER) / 2 : q.x, y: h <= seen ? q.y + h / 2 : q.y - 12 / z + seen / 2 };
}

// The zoom to go to a page at: it fills the height; in a spread, both pages, when the two fit the
// width at a zoom that still reads.
export function goZoom(lay, viewH, viewW) {
  const z = fillHeight(lay.page.h, viewH);
  if (!lay.grid?.paired) return z;
  const zw = Math.floor(((viewW - 24) / (2 * lay.page.w + GUTTER)) * 100) / 100;
  return zw >= READ ? Math.min(z, zw) : z;
}

// How long a move takes (ms): longer the further it goes on the screen and the more it zooms,
// within 260 to 520.
export function moveMs(a, b) {
  const px = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.zoom, b.zoom);
  const zoom = Math.abs(Math.log2(b.zoom / a.zoom));
  return Math.round(Math.min(520, 260 + px * 0.12 + zoom * 160));
}

// keep(fn): runs a going-there so that the book in hand stays in the right dock (docks.js).
export function installZoom(t, { layout, keep = (fn) => fn() }) {
  const room = () => t.ui.chosen()?.context || null;
  const inBook = () => { const r = room(); return !!r && t.marks.get(r)?.mode === RULE; };
  // The height of the canvas on the screen: the window less the room's top bar and status line.
  const viewH = () => (typeof window === 'undefined' ? 800 : Math.max(240, window.innerHeight - 84));
  // Its width: the stage that shows (between the docks; on a Twin, its half), else the window
  // less the room's rail and the Book's own docks, while they show.
  const viewW = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 1200;
    const s = stageBox();
    if (s) return Math.max(320, s.width);
    let w = window.innerWidth - 234;
    for (const body of document.querySelectorAll('.book-contents, .book-hand')) { const r = body.getBoundingClientRect(); if (r.width) w -= r.width + 32; }
    return Math.max(320, w);
  };
  // Where a mark sits, from the rule's own layout (as the room draws it, with the room's settings).
  const at = (r, id) => { const row = layout(r).rows.find((x) => x.mark === id); return row ? { x: row.x, y: row.y } : null; };
  // The view to `to` ({ x, y, zoom }) in one eased move, longer the further it goes.
  const go = (to) => { const from = t.ui.zoom.get(); return !!from && t.ui.zoom.go(to, { ms: moveMs(from, to) }).ok; };
  // The mark chosen (as a click would) and the view moved to `to`; false when the mark is not in
  // this room (the caller opens it instead).
  const goSmooth = (r, mark, to) => {
    if (t.places.home(mark) !== r) return false;
    if (t.ui.chosen()?.mark !== mark && !t.ui.choose([mark])?.ok) return false;
    return go(to);
  };

  // To page n of the open room, with `mark` chosen (it is on that page), at zoom z (the zoom it
  // has by default). A mark the room does not place: only chosen, the view on it.
  const toPage = (r, mark, n, z = null) => {
    const lay = layout(r), now = t.ui.zoom?.get?.();
    if (lay.pages && n && now) {
      const zoom = Math.min(MAX, Math.max(MIN, z ?? now.zoom));
      if (goSmooth(r, mark, { ...pageCentre(lay, n, zoom, viewH(), viewW()), zoom })) return true;
    }
    if (!t.ui.open.mark(mark)) return false;
    if (lay.pages && n) { const zoom = Math.min(MAX, Math.max(MIN, z ?? t.ui.zoom.get()?.zoom ?? 1)); go({ ...pageCentre(lay, n, zoom, viewH(), viewW()), zoom }); }
    return true;
  };

  // From the contents: a chapter's heading (or the chapter, when it has none). With pages, its
  // first page from the top; far off, near enough to read. Without pages: the heading a quarter
  // of the way down the screen, and far off, back to the reading size.
  const bring = (id) => {
    const r = room();
    if (!r || !inBook()) return t.ui.open.mark(id);
    const lay = layout(r);
    const now = t.ui.zoom?.get?.();
    const far = now?.band === 'far';
    if (!lay.pages) {
      const p = at(r, id);
      const zoom = far ? 1 : now?.zoom || 1;
      if (p && goSmooth(r, id, { x: p.x, y: p.y + viewH() / zoom / 4, zoom })) return true;
      const ok = t.ui.open.mark(id);
      if (ok && far && p) t.ui.zoom.set(1, p);
      return ok;
    }
    const n = lay.pageOf.get(id) ?? ranges(t, r, lay.pageOf).get(id)?.[0];
    return toPage(r, id, n, far ? goZoom(lay, viewH(), viewW()) : null);
  };

  // Far off, a double-click on a page (it opens the first paragraph on it, pages.js firstOn) or on
  // a paragraph drawn as quiet lines: to that page, filling the height. Heard as two presses in the
  // same spot, since the room redraws what is chosen between them and no dblclick comes; read
  // off the canvas's own marks (data-thought, data-id) and boxes (data-box: the rule's box, in
  // the order draw gave it, as t.rules.draws hands it back).
  let last = null; // the press before: { x, y, at }
  const under = (r, target, lay) => {
    const id = target.closest('[data-thought]')?.dataset.thought || target.closest('[data-id]')?.dataset.id;
    if (id) return { mark: id, n: lay.pageOf.get(id) };
    const i = target.closest('[data-box]')?.dataset.box;
    const b = i == null ? null : t.rules.draws(RULE, r).boxes[+i];
    return b?.opens ? { mark: b.opens, n: b.style === 'page' ? pageAt(lay, b.x + b.w / 2, b.y + 1) : lay.pageOf.get(b.opens) } : null;
  };
  const onPress = (e) => {
    try {
      if (e.button !== 0 || e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) { last = null; return; }
      const now = Date.now(), was = last;
      last = { x: e.clientX, y: e.clientY, at: now };
      if (!was || now - was.at > 450 || Math.hypot(e.clientX - was.x, e.clientY - was.y) > 6) return;
      last = null;
      if (!inBook() || t.ui.zoom?.get?.()?.band !== 'far' || !e.target?.closest) return;
      const r = room(), lay = layout(r), hit = lay.pages ? under(r, e.target, lay) : null;
      if (!hit?.mark || !hit.n) return;
      setTimeout(() => keep(() => toPage(r, hit.mark, hit.n, goZoom(lay, viewH(), viewW()))), 0); // after the room hears the press
    } catch { last = null; /* switched off */ }
  };
  // The pages side by side changed (the dock's words, or a key): the page in hand (the chosen
  // mark's, else the book's first) brought back into view at the zoom it had, since every page
  // has moved. write() makes the change (setGrid); → its result.
  const regrid = (r, write) => {
    const was = t.ui.chosen()?.mark || null;
    const res = write();
    if (!res || res.ok === false) return res;
    const lay = layout(r);
    const id = was && lay.pageOf.has(was) ? was : lay.firstOn?.[1] ?? lay.firstOn?.[0];
    const n = id ? lay.pageOf.get(id) : null;
    if (lay.pages && n) keep(() => toPage(r, id, n));
    return res;
  };
  // Type size (column.js typeOf): set to v (a percent, as TYPES has it), the zoom changed by as
  // much, so the page keeps its size on the screen and the words grow or shrink on it, and the
  // page in hand brought back into view. → the result of setType.
  const retype = (r, v) => {
    const was = typeOf(t, r), now = t.ui.zoom?.get?.()?.zoom;
    const here = room() === r && (inBook() || board());
    if (now && here) t.ui.zoom.set(Math.min(MAX, Math.max(MIN, now * (+v / 100) / was)));
    return here && inBook() ? regrid(r, () => setType(t, r, v)) : setType(t, r, v); // (the board: no pages to bring back)
  };
  // Keys, in a room seen as Book with pages: Alt+= one more, Alt+- one fewer, Alt+G columns or
  // rows. In Book · blocks, Alt+= and Alt+-: blocks across.
  const say = (res) => { if (res && res.ok === false && res.reason) t.ui.toast(res.reason); };
  const paged = () => inBook() && !!pageOf(t, room());
  const board = () => { const r = room(); return !!r && t.marks.get(r)?.mode === BLOCKS; };
  const grid = () => gridOf(t, room());
  const step = (change) => {
    say(regrid(room(), () => setGrid(t, room(), change)));
    const g = grid(), pages = g.count === 1 ? 'page' : 'pages';
    t.ui.toast(g.count === 1 && g.fix === 'columns' ? 'Pages one under another.' : `${g.count} ${pages} ${g.fix === 'columns' ? 'across' : 'down'}${g.paired ? ', facing' : ''}.`);
  };
  const reblock = (dir) => { const n = stepAcross(acrossOf(t, room()), dir); say(setAcross(t, room(), n)); t.ui.toast(`${n} blocks across.`); };
  const cmd = (o) => t.slots.commands.add({ order: 72, zone: 'room', ...o });
  cmd({ id: 'book.grid-more', keys: ['Alt+='], words: 'pages (or blocks) side by side: one more column (or row)',
    when: () => paged() || board(), run: () => (board() ? reblock(1) : step({ count: stepCount(grid().count, 1) })) });
  cmd({ id: 'book.grid-fewer', keys: ['Alt+-'], words: 'pages (or blocks) side by side: one fewer column (or row)',
    when: () => paged() || board(), run: () => (board() ? reblock(-1) : step({ count: stepCount(grid().count, -1) })) });
  cmd({ id: 'book.grid-fix', keys: ['Alt+G'], words: 'pages side by side: fix the columns, or the rows',
    when: paged, run: () => step({ grid: grid().fix === 'columns' ? 'rows' : 'columns' }) });

  // Alt+Shift+= / Alt+Shift+-: the type a step larger or smaller (Book and Book · blocks). Written
  // as what they type, + and _ (a sign's key ignores Shift: keys/keymap.js), so they never clash
  // with Alt+= and Alt+- (pages side by side).
  const typeStep = (dir) => {
    const r = room(), v = stepType(Math.round(typeOf(t, r) * 100), dir);
    say(retype(r, v));
    t.ui.toast(`Type ${v}%.`);
  };
  const either = () => inBook() || board();
  cmd({ id: 'book.type-larger', keys: ['Alt++'], words: 'type size: one step larger (everything in proportion; the page stays)', when: either, run: () => typeStep(1) });
  cmd({ id: 'book.type-smaller', keys: ['Alt+_'], words: 'type size: one step smaller (everything in proportion; the page stays)', when: either, run: () => typeStep(-1) });

  if (typeof window !== 'undefined') window.addEventListener('pointerdown', onPress, true);
  const stop = () => { if (typeof window !== 'undefined') window.removeEventListener('pointerdown', onPress, true); };
  return { bring, toPage, regrid, retype, stop };
}
