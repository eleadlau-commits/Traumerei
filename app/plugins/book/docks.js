// The Book editor's docks: the contents in the left dock (the tree: chapters and sections,
// numbered as they nest, each with its words and open gaps; a click goes there; drag a line to
// reorder among its siblings; the chapter you are in is lit), and the book in hand in the right
// dock (what is chosen: a chapter's words and what is still open in it, a paragraph's words and
// gap; the book's title and totals; Markdown and Print). Only the plugin API (t.ui.docks).

import { ui } from 'folio';
import { isChapter, booksIn, wordCount, moved } from './rules.js';
import { RULE, read, headed, headOf, titleOf, aboutOf, ABOUT } from './column.js';
import { pageOf, textWidth, ranges } from './pages.js';
import { holderOf, moveInto } from './editing.js';

const { el } = ui;
const LEFT = 'book.contents', RIGHT = 'book.hand';

export function installDocks(t, { exportMarkdown, print, layout }) {
  const room = () => t.ui.chosen()?.context || null;
  const docks = () => t.ui.docks || null;
  let left = null, right = null;   // the bodies, while open
  let moving = null;               // Alt+M: the mark waiting to be moved into a chapter
  let seen = '';                   // what the docks last showed (redrawn only when it changes)

  const bookOf = (r) => booksIn(t, r)[0]?.id || null;
  // The chapter (or book) the chosen mark, or the caret, is in.
  const here = () => {
    const id = t.ui.text.caret()?.mark || t.ui.chosen()?.mark;
    if (!id) return null;
    return headed(t, id) || (isChapter(t.marks.get(id)) ? id : holderOf(t, id));
  };

  // To a mark on the canvas, chosen. (Going there shows its properties in the right dock: the
  // book in hand comes back when it was showing.)
  const goTo = (id) => {
    const had = !!right;
    t.ui.open.mark(id);
    if (had) setTimeout(() => { openRight(); }, 0);
  };

  // Words and open gaps under a chapter, however deep.
  const tally = (id) => {
    let words = 0, open = 0, paras = 0;
    const walk = (g) => {
      for (const p of t.links.members(g)) {
        const m = t.marks.get(p);
        if (!m) continue;
        if (isChapter(m)) { walk(p); continue; }
        if (headed(t, p)) continue;
        paras++;
        words += wordCount(t.marks.text(p));
        if (t.gaps.of(p)?.state === 'open') open++;
      }
    };
    walk(id);
    return { words, open, paras };
  };

  // ---- Left: the contents ----

  const contents = () => {
    const r = room();
    const b = r && bookOf(r);
    if (!b) return [el('p', { class: 'hint' }, 'No book in this room yet. Ctrl+Alt+J makes one.')];
    const lit = here();
    const { items } = read(t, r);
    const heads = items.filter((x) => x.t === 'heading' || x.t === 'chapter');
    const all = tally(b);
    const lay = layout(r);
    const pp = lay.pages ? ranges(t, r, lay.pageOf) : new Map();
    const span = (g) => { const x = pp.get(g); return x ? (x[0] === x[1] ? `p. ${x[0]} · ` : `pp. ${x[0]}–${x[1]} · `) : ''; };
    const list = el('ol', { class: 'book-tree', role: 'list' });
    for (const it of heads) {
      const c = tally(it.chapter);
      const go = () => {
        if (moving) { const r2 = moveInto(t, moving, it.chapter); if (!r2.ok) t.ui.toast(r2.reason); moving = null; draw(true); return; }
        goTo(headOf(t, it.chapter) || it.chapter);
      };
      const row = el('li', { class: `book-tree-line book-depth-${it.depth}` + (it.chapter === lit ? ' book-here' : '') + (moving ? ' book-target' : ''), 'data-drop': it.chapter },
        el('button', { type: 'button', class: 'book-text', onclick: go, title: moving ? 'Move it here' : 'Go there' },
          el('span', { class: 'book-num' }, it.num), ` ${titleOf(t, it.chapter)}`),
        el('span', { class: 'book-right' }, `${span(it.chapter)}${c.words.toLocaleString()}${c.open ? ` · ${c.open} open` : ''}`));
      if (!t.distance.shut(r)) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-book-part', it.chapter); e.dataTransfer.effectAllowed = 'move'; });
        row.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-book-part')) { e.preventDefault(); row.classList.add('book-over'); } });
        row.addEventListener('dragleave', () => row.classList.remove('book-over'));
        row.addEventListener('drop', (e) => {
          row.classList.remove('book-over');
          const id = e.dataTransfer.getData('text/x-book-part');
          const holder = holderOf(t, it.chapter);
          if (!id || id === it.chapter || holderOf(t, id) !== holder) return; // among its siblings
          e.preventDefault();
          t.links.order(holder, moved(t.links.members(holder), id, it.chapter));
        });
      }
      list.append(row);
    }
    return [
      moving ? el('p', { class: 'hint book-moving' }, `Moving “${(t.marks.text(moving) || '').slice(0, 40)}”: click a chapter. Escape: no.`) : null,
      el('div', { class: 'book-tree-head' }, el('span', {}, t.marks.get(b)?.title || 'Untitled book'),
        el('span', { class: 'book-right' }, `${lay.pages ? `${lay.pages} pages · ` : ''}${all.words.toLocaleString()} words${all.open ? ` · ${all.open} open` : ''}`)),
      heads.length ? list : el('p', { class: 'hint' }, 'No chapters yet. Choose a paragraph and press Ctrl+Alt+H to make it a heading.'),
    ].filter(Boolean);
  };

  // ---- Right: in hand ----

  const btn = (label, fn) => el('button', { type: 'button', class: 'box-btn', onclick: fn }, label);
  const inHand = () => {
    const r = room();
    const b = r && bookOf(r);
    if (!b) return [el('p', { class: 'hint' }, 'No book in this room yet.'), el('div', { class: 'box-btns' }, btn('Make a book', () => openAll(true)))];
    const id = t.ui.text.caret()?.mark || t.ui.chosen()?.mark;
    const ch = id ? (headed(t, id) || (isChapter(t.marks.get(id)) ? id : null)) : null;
    const out = [];
    const locked = t.distance.shut(b);
    const title = el('input', { class: 'pop-name title-field book-title', value: t.marks.get(b)?.title || '', 'aria-label': 'The book\'s title', maxlength: 120, disabled: locked,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
      onchange: (e) => { const v = e.target.value.trim(); if (v) t.marks.edit(b, { title: v }); } });
    const all = tally(b);
    out.push(title, el('p', { class: 'hint book-stats' }, `${all.paras} paragraphs · ${all.words.toLocaleString()} words${all.open ? ` · ${all.open} still open` : ' · nothing open'}`));
    if (ch) {
      const c = tally(ch);
      const sub = t.links.members(ch).filter((p) => isChapter(t.marks.get(p))).length;
      out.push(el('details', { class: 'sec', open: '' }, el('summary', {}, 'Chapter in hand'),
        el('div', { class: 'sec-body' },
          el('p', { class: 'book-hand-title' }, titleOf(t, ch)),
          el('p', { class: 'hint' }, `${c.paras} paragraphs · ${c.words.toLocaleString()} words${sub ? ` · ${sub} sections` : ''}${c.open ? ` · ${c.open} still open` : ''}`),
          el('p', { class: 'hint' }, 'Ctrl+] deeper · Ctrl+[ up · Ctrl+Up / Ctrl+Down move it · Ctrl+Alt+H back to a paragraph'))));
    } else if (id && t.marks.get(id) && aboutOf(t, id)) {
      const of = aboutOf(t, id);
      out.push(el('details', { class: 'sec', open: '' }, el('summary', {}, 'Margin note in hand'),
        el('div', { class: 'sec-body' },
          el('p', { class: 'hint' }, `${wordCount(t.marks.text(id))} words · beside “${(t.marks.text(of) || '').slice(0, 48)}…” · not in the export`),
          el('p', { class: 'hint' }, 'Alt+N: back into the book, after that paragraph'))));
    } else if (id && t.marks.get(id)) {
      const g = t.gaps.of(id);
      const where = holderOf(t, id);
      const notes = t.links.to(id, ABOUT).filter((n) => t.marks.get(n.from)).length;
      const pg = layout(r).pageOf.get(id);
      out.push(el('details', { class: 'sec', open: '' }, el('summary', {}, 'Paragraph in hand'),
        el('div', { class: 'sec-body' },
          el('p', { class: 'hint' }, `${wordCount(t.marks.text(id))} words${where ? ` · in ${isChapter(t.marks.get(where)) ? titleOf(t, where) : 'the book, before the first chapter'}` : ' · not in the book yet'}${g ? ` · ${g.state === 'open' ? 'still to write' : 'written'}` : ''}${pg ? ` · page ${pg}` : ''}${notes ? ` · ${notes === 1 ? 'a margin note' : `${notes} margin notes`}` : ''}`),
          el('p', { class: 'hint' }, 'Ctrl+Alt+H heading · Alt+M into a chapter · Alt+N a note on the one before · Ctrl+Up / Ctrl+Down move · Alt+Enter split'))));
    }
    out.push(el('div', { class: 'box-btns book-actions' }, btn('Export Markdown', () => exportMarkdown(b)), btn('Print or PDF', () => print(b))));
    return out;
  };

  // ---- Drawing ----

  const stamp = () => `${room()}|${here()}|${t.ui.chosen()?.mark}|${moving}|${t.moments.seq?.() ?? ''}`;
  // The docks belong to a room seen as Book: out of it (the rooms page, another room, another
  // mode), they close.
  const inBookRoom = () => { const r = room(); return !!r && t.marks.get(r)?.mode === RULE; };
  const closeAll = () => {
    const d = docks();
    if (left) d?.left?.close(LEFT, true);
    if (right) d?.right?.close(RIGHT, true);
    left = right = null; moving = null;
    if (timer) { clearInterval(timer); timer = null; }
  };
  const draw = (force = false) => {
    if ((left || right) && !inBookRoom()) { closeAll(); return; }
    const s = stamp();
    if (!force && s === seen) return;
    seen = s;
    if (left) left.replaceChildren(...contents());
    if (right) right.replaceChildren(...inHand());
  };
  // What is chosen has no event: while a dock shows, it is looked at a few times a second.
  let timer = null;
  const watch = () => { if (!timer && (left || right)) timer = setInterval(() => draw(), 300); };
  const unwatch = () => { if (timer && !left && !right) { clearInterval(timer); timer = null; } };

  const openLeft = async () => {
    const d = docks()?.left;
    if (!d) return;
    if (!d.isOpen(LEFT)) {
      left = el('div', { class: 'book book-contents' });
      await d.open({ key: LEFT, tab: 'Contents', kind: 'Book', title: '', label: 'Contents', body: left,
        drop: { accepts: (ids, target) => !!target?.dataset?.drop && ids.length > 0,
          drop: (ids, target) => { let n = 0; for (const id of ids) if (moveInto(t, id, target.dataset.drop).ok) n++; if (n) t.ui.toast(`${n === 1 ? 'A paragraph' : `${n} paragraphs`} moved into ${titleOf(t, target.dataset.drop)}.`); } },
        onClose: () => { left = null; moving = null; unwatch(); } });
    } else d.show(LEFT);
    draw(true); watch();
  };
  const openRight = async () => {
    const d = docks()?.right;
    if (!d) return;
    if (!d.isOpen(RIGHT)) {
      right = el('div', { class: 'book book-hand' });
      await d.open({ key: RIGHT, tab: 'Book', kind: 'Book', title: '', body: right, onClose: () => { right = null; unwatch(); } });
    } else d.show(RIGHT);
    draw(true); watch();
  };
  // Ctrl+Alt+J: both docks (and a book first, when the room has none and make is asked).
  const openAll = async (make = false) => {
    const r = room();
    if (!r) return;
    if (make && !bookOf(r)) {
      if (t.distance.shut(r)) { t.ui.toast('This room is locked.'); return; }
      t.marks.make({ kind: 'group', content: { title: t.marks.text(r) || 'Book', of: 'book' }, in: r });
    }
    await openLeft();
    await openRight();
    setTimeout(fit, 60);
  };
  // The column fitted between the docks: zoomed out (never in) until a line and its heading
  // numbers fit the canvas between the two docks (read off the docks' own bodies).
  const fit = () => {
    const r = room();
    if (!r || !left || !right || typeof window === 'undefined') return;
    const a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
    const room$ = (b.width ? b.left : window.innerWidth) - (a.width ? a.right : 0);
    const p = pageOf(t, r);
    const need = p ? p.w + 80 : textWidth(t, r) + 160; // the page (or the column and its numbers) and air
    const z = t.ui.zoom?.get()?.zoom || 1;
    if (room$ > 0 && room$ < need * z) t.ui.zoom.set(Math.max(0.5, Math.floor((room$ / need) * 20) / 20));
  };
  // Alt+M: the chosen paragraph (or heading's chapter) into a chapter picked in the contents.
  const startMove = async () => {
    const id = t.ui.chosen()?.mark;
    if (!id) { t.ui.toast('Choose a paragraph first.'); return; }
    moving = id;
    await openLeft();
    draw(true);
  };
  const cancelMove = () => { if (!moving) return false; moving = null; draw(true); return true; };

  for (const on of [t.marks.on, t.links.on, t.gaps.on]) on(() => { if (left || right) draw(true); });
  t.ui.zoom?.on?.(() => { if (left || right) draw(); }); // a change of room is heard here at once
  return { openAll, openLeft, openRight, startMove, cancelMove, moving: () => !!moving, draw, fit, goTo };
}
