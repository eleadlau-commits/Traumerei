// The Book rule's pages: the book set on pages of a fixed size, stacked down the canvas as a
// manuscript is, the title page first; a chapter starts a page (a setting), a heading never sits
// alone at a page's foot, a paragraph runs on to the next page in pieces, and never leaves one
// line alone at a foot or a top. Page numbers sit at each page's foot and the chapter's title
// heads the pages after its first: drawn, never stored. The thoughts not yet in the book follow
// the last page, as a column. Plain functions, as column.js: tested in tests/book-editor.test.js.

import { RULE, SPACE, NOTE, column, read, titleOf, placeNotes, settingOf, widthOf, draftRoom } from './column.js';

// Page sizes in millimetres, and the margin around the words; drawn at MM world units to the
// millimetre (the reading size is 19 units, about a 12-point book face at this scale).
export const SIZES = Object.freeze({ a4: [210, 297, 'A4'], letter: [216, 279, 'Letter'], a5: [148, 210, 'A5'], trade: [152, 229, '6 × 9 in'] });
export const MARGINS = Object.freeze({ narrow: 16, normal: 22, wide: 30 });
export const MM = 3.4;
export const GAP = 56; // between pages, in world units


// The room's page, or null when it is seen as one column: { w, h, m, text, name } (world units).
export function pageOf(reads, room, set = null) {
  const key = settingOf(reads, room, 'pages', set) ?? 'a4';
  const size = SIZES[key];
  if (!size) return null;
  const m = (MARGINS[settingOf(reads, room, 'margins', set)] ?? MARGINS.normal) * MM;
  const w = Math.round(size[0] * MM), h = Math.round(size[1] * MM);
  return { w, h, m, text: Math.round(w - 2 * m), name: size[2], key };
}
// The width the words are set at: the page's measure, or the column's.
export function textWidth(reads, room, set = null) {
  const p = pageOf(reads, room, set);
  return p ? p.text : widthOf(reads, room, set);
}
const chaptersStartPages = (reads, room, set) => settingOf(reads, room, 'chapterPage', set) !== false;

// The book as it reads in this room: pages, or the column.
export function shape(reads, room, measure, size = () => null, set = null) {
  return pageOf(reads, room, set) ? paginate(reads, room, measure, size, set) : { ...column(reads, room, measure, size, set), pageOf: new Map(), pages: 0 };
}

// The pages: { rows, boxes, width, lineHeight, pageOf: Map(mark → page number), pages }.
export function paginate(reads, room, measure, size = () => null, set = null) {
  const P = pageOf(reads, room, set);
  const W = P.text, L = -W / 2;
  const { items, notes } = read(reads, room);
  const lh = measure('M', W).lineHeight || 27.5;
  const draft = draftRoom(reads, room, measure, W); // the thought being written after a mark: room under it
  const rows = [], boxes = [], onPage = new Map(), heads = [];
  const starts = [], firsts = []; // each page's first mark that starts there, and its first mark at all
  let page = -1, y = 0, used = false, running = '';
  const top = (n) => -lh * 13 + n * (P.h + GAP); // the title page's top a little above the room's middle, where it opens
  const foot = () => top(page) + P.h - P.m;
  const fresh = () => y <= top(page) + P.m + 0.5;
  const newPage = () => { page++; y = top(page) + P.m; used = false; heads[page] = running; };
  const linesOf = (id) => {
    const s = size(id, W);
    if (s && Number.isFinite(s.height) && s.height > 0 && s.lines == null) return { block: s.height };
    return measure(reads.marks.text(id) || ' ', W);
  };
  const row = (id, h, extra = {}) => {
    rows.push({ mark: id, x: 0, y: y + h / 2, width: W, height: h, align: 'start', ...extra });
    if (firsts[page] == null) firsts[page] = id;
    if (!onPage.has(id)) { onPage.set(id, page + 1); if (starts[page] == null) starts[page] = id; }
    y += h; used = true;
  };
  // After `id`'s last piece: the room the thought being written there takes; what follows goes
  // to the next page when it runs past the foot. → true when a new page began.
  const roomFor = (id) => {
    if (!draft || draft.after !== id) return false;
    y += draft.h;
    if (y < foot()) return false;
    newPage();
    return true;
  };

  const books = items.filter((x) => x.t === 'title').length;
  if (!books) { // no book yet: a quiet line says how to make one, and the loose thoughts follow
    const c = column(reads, room, measure, size, set);
    return { ...c, pageOf: onPage, pages: 0 };
  }
  let loose = -1;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.t === 'loose') { loose = k; break; }
    if (it.t === 'title') { // the title page
      running = '';
      newPage();
      const b = reads.marks.get(it.book);
      boxes.push({ x: L, y: top(page) + P.h * 0.3, w: W, h: lh * 2.4, label: b?.title || 'Untitled book', style: 'title', opens: it.book });
      used = true;
      newPage(); // what comes before the first chapter starts on the next page
      continue;
    }
    if (it.t === 'heading' || it.t === 'chapter') {
      const d = it.depth;
      const title = titleOf(reads, it.chapter);
      if (d === 1) running = title;
      const h = it.t === 'heading' ? (linesOf(it.mark).height ?? linesOf(it.mark).block) : lh * 1.3;
      const next = items[k + 1];
      const after = next && next.t === 'para' ? lh * Math.min(2, linesOf(next.mark).lines || 1) : 0; // a heading keeps two lines of what follows
      if (d === 1 && chaptersStartPages(reads, room, set) && used) newPage();
      if (d === 1 && fresh()) { y = top(page) + P.h * 0.2; heads[page] = ''; } // a chapter's first page: its heading dropped, no running head
      else if (!fresh()) y += lh * SPACE.before[d - 1];
      if (y + h + lh * SPACE.after + after > foot()) { newPage(); if (d === 1) { y = top(page) + P.h * 0.2; heads[page] = ''; } }
      if (it.t === 'heading') {
        boxes.push({ x: L - lh * 2.2, y: y - lh * 0.15, w: lh * 1.9, h: lh * 1.3, label: it.num, style: 'heading', level: d });
        row(it.mark, h, { far: title }); // far off, the heading reads as its title, set large (style.css)
        if (roomFor(it.mark)) continue;
      } else {
        boxes.push({ x: L - lh * 2.2, y, w: W + lh * 2.2, h: lh * 1.3, label: `${it.num}  ${title}`, style: 'heading', level: d, opens: it.chapter });
        y += h; used = true;
      }
      y += lh * SPACE.after;
      continue;
    }
    // A paragraph (or a table, a figure: a block, on the next page when it does not fit).
    const m = linesOf(it.mark);
    if (m.block) {
      if (y + m.block > foot() && !fresh()) newPage();
      row(it.mark, m.block);
    } else {
      const lines = Math.max(1, m.lines || 1);
      let from = 0;
      while (from < lines) {
        const rest = lines - from;
        const fits = Math.floor((foot() - y) / lh + 0.01);
        let take = Math.min(rest, fits);
        if (take < rest && rest - take < 2 && rest >= 3) take = rest - 2; // no last line alone at a top
        if (take < rest && take < 2) { // no first line alone at a foot
          if (!fresh()) { newPage(); continue; }
          take = Math.max(1, Math.min(rest, fits));
        }
        row(it.mark, take * lh, take < lines ? { lines: [from, from + take] } : {});
        from += take;
        if (from < lines) newPage();
      }
    }
    if (roomFor(it.mark)) continue;
    y += lh * SPACE.para;
  }
  const last = page;
  // The pages behind, each numbered at its foot (not the title page), its chapter's title at its
  // head (not on a chapter's first page).
  // A page opens (a double-click on it, zoom.js) the first paragraph that starts on it, else the
  // one running on to it. The running head is level 1, so that far off it reads large (style.css).
  const behind = [], firstOn = [];
  for (let n = 0; n <= last; n++) {
    firstOn[n] = starts[n] ?? firsts[n] ?? null;
    behind.push({ x: -P.w / 2, y: top(n), w: P.w, h: P.h, style: 'page', ...(firstOn[n] ? { opens: firstOn[n] } : {}) });
    if (n > 0) behind.push({ x: -lh * 2, y: top(n) + P.h - P.m * 0.62, w: lh * 4, h: lh * 1.1, label: String(n + 1), style: 'quiet' });
    if (n > 0 && heads[n]) behind.push({ x: L, y: top(n) + P.m * 0.38, w: W, h: lh * 1.1, label: heads[n], style: 'quiet', level: 1 });
  }
  boxes.unshift(...behind);
  // After the last page: the thoughts not yet in the book, as a column.
  if (loose >= 0) {
    y = top(last + 1) + lh * 2;
    boxes.push({ x: L, y, w: W, h: lh * 1.2, label: 'Not in the book yet', style: 'line' });
    y += lh * 1.6;
    for (const it of items.slice(loose + 1)) {
      const h = (linesOf(it.mark).height ?? linesOf(it.mark).block);
      rows.push({ mark: it.mark, x: 0, y: y + h / 2, width: W, height: h, align: 'start' });
      y += h + lh * SPACE.para + (draft && draft.after === it.mark ? draft.h : 0);
    }
  }
  placeNotes(reads, rows, notes, measure, P.w / 2 + lh * 1.6);
  // firstOn: each page's mark (by page number less one); origin, pitch and grid: where page n
  // sits (placeOf).
  const lay = { rows, boxes, width: W, lineHeight: lh, pageOf: onPage, pages: last + 1, page: P, firstOn, origin: top(0), pitch: P.h + GAP,
    grid: gridOf(reads, room, set, notes.length ? NOTE + lh * 2.2 : 0) };
  if (lay.grid.fix === 'columns' && lay.grid.count === 1) return lay; // one under another: as laid
  // Laid out one under another above; now each page moves to its place in the grid, all it holds
  // with it (only x and y change: the pagination is the same). A margin note goes with the page
  // of what it is about, in its outer margin (left of a left-hand page of a spread).
  const noteOf = new Map(notes.map((n) => [n.mark, n.of]));
  const below = belowGrid(lay) - top(last + 1); // the thoughts not yet in the book: under the grid
  const move = (o, mid) => {
    const n0 = Math.floor(((mid ?? o.y) - lay.origin) / lay.pitch + 1e-9);
    if (n0 > last) { o.y += below; return; }
    const q = placeOf(lay, n0 + 1);
    o.y += q.y - top(n0); o.x += q.x;
  };
  for (const r of rows) {
    const of = noteOf.get(r.mark);
    if (of && onPage.has(of)) {
      const n = onPage.get(of), q = placeOf(lay, n);
      r.y += q.y - top(n - 1); r.x = q.x + (q.left ? -r.x : r.x);
    } else move(r);
  }
  for (const b of boxes) move(b, b.y + Math.min(b.h, lh) / 2);
  return lay;
}

// Pages in a grid (the room's settings): `grid` 'columns' (that many pages across, rows follow;
// an even count pairs them as facing pages, the title page alone on the right as a recto) or
// 'rows' (that many pages down, columns follow: the book reads left to right as a strip).
export const COUNTS = Object.freeze([1, 2, 3, 4, 6]);
export const GUTTER = 24; // between the two pages of a spread
export function gridOf(reads, room, set = null, side = 0) {
  const fix = settingOf(reads, room, 'grid', set) === 'rows' ? 'rows' : 'columns';
  const n = Number(settingOf(reads, room, 'count', set));
  const count = COUNTS.includes(n) ? n : 1;
  const paired = fix === 'columns' && count % 2 === 0;
  // between pages side by side: room for the margin notes (side: a note's width and air, or 0)
  return { fix, count, paired, between: GAP + (paired ? 2 * side : side) };
}

// Where page n (from 1) sits: { x: its middle, y: its top, col, row, left: a left-hand page of a
// spread }.
export function placeOf(lay, n) {
  const g = lay.grid || { fix: 'columns', count: 1, paired: false, between: GAP }, w = lay.page.w;
  if (g.fix === 'columns' && g.count === 1) return { x: 0, y: lay.origin + (n - 1) * lay.pitch, col: 0, row: n - 1, left: false };
  let col, row;
  if (g.fix === 'rows') { col = Math.floor((n - 1) / g.count); row = (n - 1) % g.count; }
  else { const slot = g.paired ? n : n - 1; col = slot % g.count; row = Math.floor(slot / g.count); }
  const left = g.paired && col % 2 === 0;
  let x;
  if (g.paired) { const pair = Math.floor(col / 2); x = pair * (2 * w + GUTTER + g.between) + (left ? 0 : w + GUTTER); }
  else x = col * (w + g.between);
  if (g.fix === 'columns') { // the columns centred on the middle
    const k = g.count, span = g.paired ? (k / 2) * (2 * w + GUTTER) + (k / 2 - 1) * g.between : k * w + (k - 1) * g.between;
    x += w / 2 - span / 2;
  }
  return { x, y: lay.origin + row * lay.pitch, col, row, left };
}
// The top of page n (from 1).
export const pageTop = (lay, n) => placeOf(lay, n).y;
// The page at a point (x, y), or null.
export function pageAt(lay, x, y) {
  for (let n = 1; n <= lay.pages; n++) {
    const q = placeOf(lay, n);
    if (Math.abs(x - q.x) <= lay.page.w / 2 + 1 && y >= q.y - 1 && y <= q.y + lay.page.h + 1) return n;
  }
  return null;
}
// The top of what follows the grid.
export function belowGrid(lay) {
  let lo = lay.origin;
  for (let n = 1; n <= lay.pages; n++) lo = Math.max(lo, placeOf(lay, n).y + lay.pitch);
  return lo;
}
// How wide the room's pages read side by side (the docks fit them): a spread, or a page.
export function sheetWidth(reads, room, set = null) {
  const P = pageOf(reads, room, set);
  if (!P) return 0;
  return gridOf(reads, room, set).paired ? 2 * P.w + GUTTER : P.w;
}

// Each chapter's pages: Map(chapter → [first, last]), from a layout's pageOf.
export function ranges(reads, room, pageOf) {
  const out = new Map();
  const walk = (g) => {
    let lo = Infinity, hi = -Infinity;
    for (const id of reads.links.members(g)) {
      const m = reads.marks.get(id);
      if (!m) continue;
      if (m.kind === 'group') {
        const r = walk(id);
        if (r) { lo = Math.min(lo, r[0]); hi = Math.max(hi, r[1]); }
      } else if (pageOf.has(id)) { const p = pageOf.get(id); lo = Math.min(lo, p); hi = Math.max(hi, p); }
    }
    if (lo === Infinity) return null;
    out.set(g, [lo, hi]);
    return [lo, hi];
  };
  for (const b of read(reads, room).items.filter((x) => x.t === 'title')) walk(b.book);
  return out;
}

// The room's grid changed ({ grid?, count? }), kept in the room's settings under the rule, as its
// ⚙ keeps them: one step, undone as one. → { ok } (marks.edit's).
export function setGrid(t, room, change) {
  const m = t.marks.get(room);
  if (!m) return { ok: false, reason: 'No such room' };
  const next = { ...(m.rules?.[RULE] || {}), ...change };
  if (next.count != null) next.count = String(next.count);
  return t.marks.edit(room, { rules: { ...(m.rules || {}), [RULE]: next } });
}
// The count one step more (dir 1) or fewer (-1), within COUNTS.
export function stepCount(n, dir) {
  const i = Math.max(0, COUNTS.indexOf(n));
  return COUNTS[Math.max(0, Math.min(COUNTS.length - 1, i + dir))];
}
