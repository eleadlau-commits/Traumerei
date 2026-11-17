// The Book editor's docks: the contents in the left dock (the tree: chapters and sections,
// numbered as they nest, each with its words and open gaps; a click goes there; drag a line
// anywhere in it: before, after or into another (treedrop.js); the chapter you are in is lit), and the book in hand in the right
// dock (what is chosen: a chapter's words and what is still open in it, a paragraph's words and
// gap; the book's title and totals; Markdown and Print). Only the plugin API (t.ui.docks).

import { ui } from 'folio';
import { isChapter, isNumbered, booksIn, wordCount } from './rules.js';
import { RULE, read, headed, headOf, titleOf, nameOf, aboutOf, ABOUT, TYPES, typeOf, setType } from './column.js';
import { pageOf, textWidth, ranges, sheetWidth, gridOf, setGrid, COUNTS } from './pages.js';
import { holderOf, moveInto } from './editing.js';
import { BLOCKS, ACROSS, acrossOf, setAcross, frameChosen } from './blocks.js';
import { chapterOf, rename, setNumbered, unnumberedAbove } from './nest.js';
import { zoneOf, landing, dropTo } from './treedrop.js';
import { otherSide, twinOf, fitZoom, stageBox, leftShown } from './side.js';

const { el } = ui;
const LEFT = 'book.contents', RIGHT = 'book.hand';

export function installDocks(t, { exportMarkdown, exportWord, print, layout, bring = (id) => t.ui.open.mark(id), regrid = (r, write) => write(), retype = (r, v) => setType(t, r, v) }) {
  const room = () => t.ui.chosen()?.context || null;
  const docks = () => t.ui.docks || null;
  let left = null, right = null;   // the bodies, while open
  let moving = null;               // Alt+M: the mark waiting to be moved into a chapter
  let seen = '';                   // what the docks last showed (redrawn only when it changes)
  let dragging = null;             // the chapter whose line is being dragged in the contents
  const LIT = ['book-drop-before', 'book-drop-after', 'book-drop-into', 'book-drop-no'];
  const unlight = (list, keep = null) => { for (const li of list.children) if (li !== keep) li.classList.remove(...LIT); };
  const done = (list) => { dragging = null; for (const li of list.children) li.classList.remove(...LIT, 'book-dragged'); };

  const bookOf = (r) => booksIn(t, r)[0]?.id || null;
  // The room the docks are about: the open room when it is seen as Book (or Book · blocks); on a
  // Twin, the other side when that one is, so the docks stay put while you work on the other half
  // (closing them there moved the canvas and left the Loose tray showing). null: none.
  const isBookMode = (r) => { const m = r && t.marks.get(r)?.mode; return m === RULE || m === BLOCKS; };
  const bookRoom = () => {
    const r = room();
    if (!r || isBookMode(r)) return r || null;
    const o = otherSide(t, r);
    return o && isBookMode(o) ? o : null;
  };
  // The chosen mark (or the caret's), when it is in room r: on a Twin's other side it is not ours.
  const inHandOf = (r) => { const id = t.ui.text.caret()?.mark || t.ui.chosen()?.mark; return id && t.places.home(id) === r ? id : null; };
  // The chapter (or book) the chosen mark, or the caret, is in.
  const here = () => {
    const r = bookRoom();
    if (r !== room()) return null; // (the other side of a Twin is open: nothing of the book in hand)
    const id = inHandOf(r);
    if (!id) return frameChosen(t); // (a chapter block's frame chosen, Book · blocks)
    return headed(t, id) || (isChapter(t.marks.get(id)) ? id : holderOf(t, id));
  };

  // To a mark on the canvas, chosen, its page in view at a zoom to read it (zoom.js bring). (Going
  // there shows its properties in the right dock: the book in hand comes back when it was showing.)
  const keep = (fn) => { const had = !!right; const out = fn(); if (had) setTimeout(() => { openRight(); }, 0); return out; };
  const goTo = (id) => keep(() => bring(id));

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
    const r = bookRoom();
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
          el('span', { class: 'book-num' }, it.num), ` ${nameOf(t, it.chapter) || (it.num ? '' : '(untitled)')}`),
        el('span', { class: 'book-right' }, `${span(it.chapter)}${c.words.toLocaleString()}${c.open ? ` · ${c.open} open` : ''}`));
      if (!t.distance.shut(r)) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => { dragging = it.chapter; e.dataTransfer.setData('text/x-book-part', it.chapter); e.dataTransfer.effectAllowed = 'move'; row.classList.add('book-dragged'); });
        row.addEventListener('dragend', () => done(list));
        // Where it would land, lit on the line: a rule above (before), below (after), or the line
        // itself (into); struck faint where it may not go (let go there, it says why).
        row.addEventListener('dragover', (e) => {
          if (!e.dataTransfer.types.includes('text/x-book-part')) return;
          const box = row.getBoundingClientRect();
          const zone = zoneOf(e.clientY, box.top, box.height);
          const where = dragging ? landing(t, dragging, it.chapter, zone) : { ok: true };
          unlight(list, row);
          row.classList.remove('book-drop-before', 'book-drop-after', 'book-drop-into', 'book-drop-no');
          e.preventDefault();
          if (where.ok) { e.dataTransfer.dropEffect = 'move'; row.classList.add(`book-drop-${zone}`); }
          else if (where.reason) row.classList.add('book-drop-no'); // (let go: refused in words)
          else e.dataTransfer.dropEffect = 'none';
        });
        row.addEventListener('dragleave', (e) => { if (!row.contains(e.relatedTarget)) unlight(list); });
        row.addEventListener('drop', (e) => {
          done(list);
          const id = e.dataTransfer.getData('text/x-book-part');
          if (!id) return;
          e.preventDefault();
          const box = row.getBoundingClientRect();
          const res = dropTo(t, id, it.chapter, zoneOf(e.clientY, box.top, box.height));
          if (!res.ok && res.reason) t.ui.toast(res.reason);
        });
      }
      list.append(row);
    }
    return [
      moving ? el('p', { class: 'hint book-moving' }, `Moving “${(t.marks.text(moving) || '').slice(0, 40)}”: click a chapter. Escape: no.`) : null,
      el('div', { class: 'book-tree-head' }, el('span', {}, t.marks.get(b)?.title || 'Untitled book'),
        el('span', { class: 'book-right' }, `${lay.pages ? `${lay.pages} pages · ` : ''}${all.words.toLocaleString()} words${all.open ? ` · ${all.open} open` : ''}`)),
      heads.length ? list : el('p', { class: 'hint' }, 'No chapters yet. Choose a paragraph and press Ctrl+Alt+H to make it a heading.'),
      heads.length && !t.distance.shut(r) ? el('p', { class: 'hint book-tree-hint' }, 'Drag a line onto another: its top before it, its middle into it, its foot after it. Thoughts from the page dropped on a line join that chapter. Keys: Ctrl+Up / Ctrl+Down, Ctrl+] / Ctrl+[, Alt+M.') : null,
    ].filter(Boolean);
  };

  // ---- Right: in hand ----

  const btn = (label, fn) => el('button', { type: 'button', class: 'box-btn', onclick: fn }, label);
  // The pages side by side: fix the columns or the rows, and how many (Alt+G, Alt+= and Alt+-).
  const gridControl = (r) => {
    const g = gridOf(t, r);
    const word = (label, on, change, title) => el('button', { type: 'button', class: 'word', 'aria-pressed': on ? 'true' : 'false', title,
      onclick: () => { const res = regrid(r, () => setGrid(t, r, change)); if (res && res.ok === false && res.reason) t.ui.toast(res.reason); } }, label);
    const now = g.fix === 'columns' ? (g.count === 1 ? 'One under another' : `${g.count} across${g.paired ? ', facing pages' : ''}`) : `${g.count} down, read left to right`;
    return el('div', { class: 'book-grid', role: 'group', 'aria-label': 'Pages side by side' },
      el('span', { class: 'label' }, 'Pages side by side'),
      el('div', { class: 'seg book-grid-row' }, el('span', { class: 'hint' }, 'Fix'),
        word('Columns', g.fix === 'columns', { grid: 'columns' }, 'So many pages across; rows follow (Alt+G)'),
        word('Rows', g.fix === 'rows', { grid: 'rows' }, 'So many pages down; columns follow (Alt+G)')),
      el('div', { class: 'seg book-grid-row' }, el('span', { class: 'hint' }, 'How many'),
        ...COUNTS.map((n) => word(String(n), g.count === n, { count: n }, `${n} ${g.fix === 'columns' ? 'across' : 'down'}${n === 2 && g.fix === 'columns' ? ': facing pages' : ''} (Alt+= / Alt+-)`))),
      el('p', { class: 'hint' }, `${now} · Alt+= more · Alt+- fewer · Alt+G columns or rows`));
  };
  // Type size: everything smaller or larger in proportion, the page as it is (Alt+Shift+= and Alt+Shift+-).
  const typeControl = (r) => {
    const now = String(Math.round(typeOf(t, r) * 100));
    return el('div', { class: 'book-grid', role: 'group', 'aria-label': 'Type size' },
      el('span', { class: 'label' }, 'Type size'),
      el('div', { class: 'seg book-grid-row' }, ...TYPES.map((v) => el('button', { type: 'button', class: 'word', 'aria-pressed': v === now ? 'true' : 'false', title: `${v}%: the words, headings, spacing and margin numbers together (Alt+Shift+= / Alt+Shift+-)`,
        onclick: () => { const res = retype(r, v); if (res && res.ok === false && res.reason) t.ui.toast(res.reason); } }, `${v}%`))),
      el('p', { class: 'hint' }, 'Everything in proportion; the page stays · Alt+Shift+= larger · Alt+Shift+- smaller'));
  };
  // Book · blocks: how many blocks to a row (Alt+= and Alt+-).
  const blocksControl = (r) => {
    const n = acrossOf(t, r);
    return el('div', { class: 'book-grid', role: 'group', 'aria-label': 'Blocks across' },
      el('span', { class: 'label' }, 'Blocks across'),
      el('div', { class: 'seg book-grid-row' }, ...ACROSS.map((k) => el('button', { type: 'button', class: 'word', 'aria-pressed': k === n ? 'true' : 'false', title: `${k} blocks to a row (Alt+= / Alt+-)`,
        onclick: () => { const res = setAcross(t, r, k); if (res && res.ok === false && res.reason) t.ui.toast(res.reason); } }, String(k)))),
      el('p', { class: 'hint' }, 'Alt+= more · Alt+- fewer'));
  };
  // A chapter: its name (Title: typed, it becomes the heading; emptied, the chapter is unnamed),
  // numbered or not (pick words, Alt+U), how much it holds, and the keys.
  const chapterSection = (r, ch, label, locked) => {
    const c = tally(ch);
    const sub = t.links.members(ch).filter((p) => isChapter(t.marks.get(p))).length;
    const name = nameOf(t, ch);
    const on = isNumbered(t.marks.get(ch));
    const field = el('input', { class: 'pop-name title-field book-chapter-title', value: name, placeholder: 'Unnamed: type a title', 'aria-label': 'The chapter\'s title', maxlength: 120, disabled: locked,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = name; e.target.blur(); } },
      onchange: (e) => { const res = rename(t, r, ch, e.target.value); if (res && res.ok === false && res.reason) t.ui.toast(res.reason); } });
    const word = (text, yes, title) => el('button', { type: 'button', class: 'word', 'aria-pressed': yes === on ? 'true' : 'false', title, disabled: locked,
      onclick: () => { const res = setNumbered(t, ch, yes); if (res.ok === false && res.reason) t.ui.toast(res.reason); } }, text);
    return el('details', { class: 'sec', open: '' }, el('summary', {}, label),
      el('div', { class: 'sec-body' },
        el('label', { class: 'label' }, 'Title', field),
        el('div', { class: 'book-grid', role: 'group', 'aria-label': 'Numbered or not' },
          el('div', { class: 'seg book-grid-row' }, word('Numbered', true, 'A number, counted among its siblings (Alt+U)'), word('Unnumbered', false, 'No number, skipped in the numbering: a Preface, an Interlude (Alt+U)'))),
        unnumberedAbove(t, ch) ? el('p', { class: 'hint' }, 'No number while it sits in an unnumbered chapter.') : null,
        el('p', { class: 'hint' }, `${c.paras} paragraphs · ${c.words.toLocaleString()} words${sub ? ` · ${sub} sections` : ''}${c.open ? ` · ${c.open} still open` : ''}`),
        el('p', { class: 'hint' }, 'Alt+U numbered or not · Alt+Shift+H unnamed or named by its first paragraph · Alt+Shift+C a chapter inside it · Alt+C a chapter around it · Ctrl+] deeper · Ctrl+[ up · Ctrl+Up / Ctrl+Down move it · drag its heading to nest it')));
  };
  const inHand = () => {
    const r = bookRoom();
    const b = r && bookOf(r);
    if (!b) return [el('p', { class: 'hint' }, 'No book in this room yet.'), el('div', { class: 'box-btns' }, btn('Make a book', () => openAll(true)))];
    const id = r === room() ? inHandOf(r) : null;
    const ch = id ? (headed(t, id) || (isChapter(t.marks.get(id)) ? id : null)) : r === room() ? frameChosen(t) : null;
    const out = [];
    const locked = t.distance.shut(b);
    const title = el('input', { class: 'pop-name title-field book-title', value: t.marks.get(b)?.title || '', 'aria-label': 'The book\'s title', maxlength: 120, disabled: locked,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
      onchange: (e) => { const v = e.target.value.trim(); if (v) t.marks.edit(b, { title: v }); } });
    const all = tally(b);
    out.push(title, el('p', { class: 'hint book-stats' }, `${all.paras} paragraphs · ${all.words.toLocaleString()} words${all.open ? ` · ${all.open} still open` : ' · nothing open'}`));
    if (t.marks.get(r)?.mode === BLOCKS) out.push(blocksControl(r));
    else if (pageOf(t, r)) out.push(gridControl(r));
    out.push(typeControl(r));
    if (ch) out.push(chapterSection(r, ch, 'Chapter in hand', locked));
    else if (id && t.marks.get(id) && aboutOf(t, id)) {
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
          el('p', { class: 'hint' }, 'Ctrl+Alt+H heading · Alt+M into a chapter · Alt+N a note on the one before · Ctrl+Up / Ctrl+Down move · Alt+Enter split · Alt+C a chapter around it'))));
      const its = chapterOf(t, id);
      if (its && !aboutOf(t, id)) out.push(chapterSection(r, its, 'Its chapter', locked));
    }
    out.push(el('div', { class: 'box-btns book-actions' }, btn('Export Markdown', () => exportMarkdown(b)), btn('Word document', () => exportWord(b)), btn('Print or PDF', () => print(b))));
    return out;
  };

  // ---- Drawing ----

  const stamp = () => `${room()}|${bookRoom()}|${here()}|${t.ui.chosen()?.mark}|${moving}|${t.moments.seq?.() ?? ''}`; // (here: a chosen frame too)
  // The docks belong to a room seen as Book (or to a Twin with a side seen as Book): out of it
  // (the rooms page, another room, another mode), they close.
  const inBookRoom = () => !!bookRoom(); // (Book · blocks keeps them)
  // The left dock as Book found it: when it was hidden (only the room's Loose strip at its edge),
  // it is hidden again once the contents close, so the Loose tray never stays open in its place.
  // (A plugin's dock has no hide: the docks' own command, Ctrl+Alt+L, hides it; core-gaps.md.)
  let leftWas = true;
  const tuckLeft = () => {
    if (leftWas || !leftShown() || docks()?.left?.isOpen(LEFT)) return;
    leftWas = true;
    try { t.slots.commands.run('docks.left'); } catch { /* no docks' keys: it stays */ }
  };
  const closeAll = () => {
    const d = docks();
    if (left) d?.left?.close(LEFT, true);
    if (right) d?.right?.close(RIGHT, true);
    left = right = null; moving = null;
    if (timer) { clearInterval(timer); timer = null; }
    setTimeout(tuckLeft, 0);
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
      leftWas = leftShown();
      left = el('div', { class: 'book book-contents' });
      await d.open({ key: LEFT, tab: 'Contents', kind: 'Book', title: '', label: 'Contents', body: left,
        drop: { accepts: (ids, target) => !!target?.dataset?.drop && ids.length > 0 && ids.every((id) => t.places.home(id) === bookRoom()), // (not yet from a Twin's other side)
          drop: (ids, target) => { const n = t.together(() => ids.filter((id) => moveInto(t, id, target.dataset.drop).ok).length); if (n) t.ui.toast(`${n === 1 ? 'A paragraph' : `${n} paragraphs`} moved into ${titleOf(t, target.dataset.drop)}.`); } },
        onClose: () => { left = null; moving = null; unwatch(); setTimeout(tuckLeft, 0); } });
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
    const r = bookRoom() || room();
    if (!r) return;
    if (make && !bookOf(r)) {
      if (t.distance.shut(r)) { t.ui.toast('This room is locked.'); return; }
      t.marks.make({ kind: 'group', content: { title: t.marks.text(r) || 'Book', of: 'book' }, in: r });
    }
    await openLeft();
    await openRight();
    setTimeout(fit, 60);
  };
  // Ctrl+Alt+J, or Tools → Book: the docks shown, or hidden when they show (the left dock as it was).
  const showing = () => { const d = docks(); return !!(d?.left?.isShowing(LEFT) || d?.right?.isShowing(RIGHT)); };
  // Hiding them hides the left dock too, so the Loose tray never shows in the contents' place
  // (the Loose strip at the edge, or Ctrl+Alt+L, still opens it).
  const toggleAll = () => { if (showing()) { leftWas = false; closeAll(); } else openAll(true); };
  // How wide the book reads on the canvas: the page or spread (or the column and its numbers) and air.
  const needOf = (r) => (pageOf(t, r) ? sheetWidth(t, r) + 80 : textWidth(t, r) + 160);
  // The column fitted to the canvas it has (between the docks, and in a Twin its half): zoomed out
  // (never in) until a line and its heading numbers fit. Read off the stage that shows; without
  // one, between the docks' own bodies.
  const fit = () => {
    const r = room();
    if (!r || r !== bookRoom() || !left || !right || typeof window === 'undefined' || t.marks.get(r)?.mode === BLOCKS) return; // (the board is not fitted)
    const s = stageBox(), a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
    const room$ = s ? s.width : (b.width ? b.left : window.innerWidth) - (a.width ? a.right : 0);
    const z = fitZoom(room$, needOf(r), t.ui.zoom?.get()?.zoom || 1);
    if (z) t.ui.zoom.set(z);
  };
  // A Twin's side seen as Book, the first time you work there since the Twin opened: the view
  // placed again on its own half (the room opens a Twin measuring the whole canvas, so its first
  // look sat half a side to the right, under the divider, until a click on the other side put it
  // back; core-gaps.md), and the column zoomed out to fit the half. A zoom set to what it is
  // places the view again where it is, and moves nothing else. Later switches leave the view be.
  const boardWidth = (r) => {
    let lo = Infinity, hi = -Infinity;
    try { for (const b of t.rules.draws(BLOCKS, r).boxes || []) { lo = Math.min(lo, b.x); hi = Math.max(hi, b.x + b.w); } } catch { return 0; }
    return hi > lo ? hi - lo + 80 : 0;
  };
  let twinNow = null; const settled = new Set();
  const settle = (r) => {
    if (room() !== r || !isBookMode(r) || typeof window === 'undefined') return;
    const now = t.ui.zoom?.get?.()?.zoom;
    if (!now) return;
    const s = stageBox();
    // (Book · blocks: the board, as wide as its outlines are drawn, zoomed out as far as the zoom goes)
    const board = t.marks.get(r)?.mode === BLOCKS;
    const z = s ? (board ? fitZoom(s.width, boardWidth(r), now, 0.25) : fitZoom(s.width, needOf(r), now)) : null;
    t.ui.zoom.set(z || now);
  };
  const onRoom = (r) => {
    const tw = twinOf(t, r);
    if (tw !== twinNow) { twinNow = tw; settled.clear(); }
    if (!tw || !isBookMode(r) || settled.has(r)) return;
    settled.add(r);
    const go = () => settle(r);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else setTimeout(go, 0);
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
  // A room turned to Book (or Book · blocks) while the left dock shows (the Loose tray): the
  // contents take its place, and the book in hand comes to the right.
  let modeWas = null;
  const modeCheck = () => {
    const r = room(), m = r ? t.marks.get(r)?.mode : null, was = modeWas;
    modeWas = r ? `${r}|${m}` : null;
    if (!r || modeWas === was || !was || !was.startsWith(`${r}|`) || !isBookMode(r) || left) return;
    if (leftShown()) setTimeout(() => { if (!left && isBookMode(room())) openAll(false); }, 0);
  };
  t.marks.on(modeCheck);
  // A change of mode has no event: the room's canvas says its mode (data-mode), so it is watched
  // there (core-gaps.md: no mode event for plugins).
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    new MutationObserver(() => modeCheck()).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  }
  let roomWas = null;
  t.ui.zoom?.on?.((e) => {
    if (e?.context !== roomWas) { roomWas = e?.context ?? null; modeWas = roomWas ? `${roomWas}|${t.marks.get(roomWas)?.mode}` : null; try { onRoom(roomWas); } catch { /* no places: left be */ } }
    modeCheck();
    if (left || right) draw();
  }); // a change of room is heard here at once
  return { openAll, toggleAll, showing, openLeft, openRight, startMove, cancelMove, moving: () => !!moving, draw, fit, goTo, keep };
}
