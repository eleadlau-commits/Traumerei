// Book: a book in any room. A book is a card on the canvas, in every mode, beside the room's own
// shape (a Proust web, a Russell tree): a group of the family `book` whose parts are chapters
// (groups of the family `book-chapter`) and the room's thoughts, in the maker's order. A thought
// sits in a chapter and stays where its mode put it. Double-click or Enter on the card opens the
// book in the right dock: its title, a contents page (chapters numbered as they nest, how much
// each holds, gaps still open), each chapter opened to its thoughts, drag to reorder, thoughts
// dragged from the canvas onto a chapter join it, Read shows the book in reading order, and it
// leaves as Markdown or a printed page (Save as PDF). Tools → Book in a room's rail, or
// Ctrl+Alt+J, opens the room's books, or makes the first.
//
// A plugin. It reaches the app only through the plugin API (app/core/API.md): slots.groups,
// slots.buttons, slots.commands, the tables (marks, links, gaps, places), ui.docks.right and
// ui.files.save. Saved data: none outside the tables (Law 8: a book is marks and part-of links,
// and travels in a .traum file).

import { Feature, ui } from 'folio';
import { BOOK, CHAPTER, isBook, isChapter, booksIn, tree, count, contents, markdown, fileName, moved } from './rules.js';
import { installEditor } from './editor.js';
import { installDocks } from './docks.js';
import { pageOf, SIZES, MARGINS } from './pages.js';
import { RULE } from './column.js';
import { wordDoc, DOCX } from './word.js';

const { el } = ui;
const KEY = 'book';
const ICON = 'book';

export function install(t) {
  const room = () => t.ui.chosen()?.context || null;
  const dock = () => t.ui.docks?.right || null;
  let showing = null;          // { book } (a book open in the tab) or { room } (the room's books)
  let reading = false;         // the tab shows the book in reading order
  const openChapters = new Set(); // chapters opened to their thoughts
  let body = null;

  // ---- Making ----

  // A new book in the open room, placed on the canvas beside what is there (or at the chosen
  // thought), with a first chapter; one step.
  const newBook = () => {
    const r = room();
    if (!r) return null;
    if (t.distance.shut(r)) { t.ui.toast('This room is locked.'); return null; }
    const n = booksIn(t, r).length;
    const made = t.together(() => {
      const b = t.marks.make({ kind: 'group', content: { title: n ? `New book ${n + 1}` : 'New book', of: BOOK }, in: r });
      if (!b.ok) return b;
      const ch = t.marks.make({ kind: 'group', content: { title: 'Chapter 1', of: CHAPTER }, in: r });
      if (ch.ok) t.links.link(ch.id, b.id, 'part of');
      const mode = t.marks.get(r)?.mode;
      if (mode) {
        const chosen = t.ui.chosen()?.mark;
        const lay = t.rules.layout(mode, r);
        const at = lay.find((p) => p.mark === chosen)?.position;
        const right = lay.length ? Math.max(...lay.map((p) => p.position.x)) + 640 : 0;
        t.places.put(b.id, r, mode, at ? { x: at.x + 480, y: at.y } : { x: right, y: lay.length ? Math.min(...lay.map((p) => p.position.y)) : 0 });
      }
      return b;
    });
    if (!made?.ok) { t.ui.toast(made?.reason || 'The book could not be made here.'); return null; }
    openBook(made.id);
    return made.id;
  };

  const newChapter = (holder, title = null) => {
    const r = t.places.home(holder);
    const n = t.links.members(holder).filter((id) => isChapter(t.marks.get(id))).length;
    return t.together(() => {
      const ch = t.marks.make({ kind: 'group', content: { title: title || `Chapter ${n + 1}`, of: CHAPTER }, in: r });
      if (ch.ok) t.links.link(ch.id, holder, 'part of');
      return ch;
    });
  };

  // Thoughts let go on a chapter (or the book: its last chapter, or a first one) join it, in
  // order; one step. Groups of a book are not taken (a book is never part of itself).
  const take = (ids, holder) => {
    const target = isBook(t.marks.get(holder))
      ? (t.links.members(holder).filter((id) => isChapter(t.marks.get(id))).pop() || newChapter(holder)?.id)
      : holder;
    if (!target) return false;
    const r = t.places.home(target);
    let n = 0, away = 0;
    t.together(() => {
      for (const id of ids) {
        const m = t.marks.get(id);
        if (!m || isBook(m) || isChapter(m)) continue;
        if (t.places.home(id) !== r) { away++; continue; }
        if (t.links.link(id, target, 'part of').ok) n++;
      }
    });
    if (away) t.ui.toast('A book holds the thoughts of its own room.');
    else if (n) t.ui.toast(`${n === 1 ? 'A thought' : `${n} thoughts`} in ${t.marks.get(target)?.title || 'the chapter'}.`);
    return n > 0;
  };

  const unpart = (id, holder) => {
    const row = t.links.from(id, 'part of').find((l) => l.to === holder);
    if (row) t.links.unlink(row.id);
  };

  const removeBook = (id) => {
    const node = tree(t, id);
    t.together(() => {
      const all = [];
      const walk = (n) => { for (const p of n.parts) if (p.chapter) { walk(p); all.push(p.id); } };
      if (node) walk(node);
      for (const c of all) t.marks.delete(c);
      t.marks.delete(id);
    });
    showing = room() ? { room: room() } : null;
    draw();
    t.ui.toast('The book is gone; its thoughts are where they were. Ctrl+Z brings it back.');
  };

  // ---- Out: Markdown, Word and a printed page ----

  const exportMarkdown = async (id) => {
    const node = tree(t, id);
    if (node) await t.ui.files.save(fileName(node.title, 'md'), markdown(node), 'text/markdown');
  };
  // A Word document true to the room's pages: size, margins, a chapter on a new page (word.js).
  const exportWord = async (id) => {
    const node = tree(t, id);
    if (node) await t.ui.files.save(fileName(node.title, 'docx'), new Blob([wordDoc(t, id)], { type: DOCX }), DOCX);
  };
  const print = (id) => {
    const node = tree(t, id);
    if (!node || typeof document === 'undefined') return;
    // True to the room's pages: their size and margins, and a chapter on a new page.
    const r = t.places.home(id);
    const set = t.marks.get(r)?.rules?.[RULE] || {};
    const size = pageOf(t, r) ? SIZES[set.pages ?? 'a4'] : null;
    const m = MARGINS[set.margins] ?? MARGINS.normal;
    const css = (size ? `@page { size: ${size[0]}mm ${size[1]}mm; margin: ${m}mm; }` : '')
      + (set.chapterPage !== false ? ' .book-print h2.book-read-head { break-before: page; }' : '');
    const page = el('div', { class: 'book-print' }, el('style', {}, css), ...readingNodes(node, true));
    document.querySelectorAll('body > .book-print').forEach((n) => n.remove());
    const title = document.title;
    document.title = node.title;
    document.body.append(page);
    document.body.classList.add('book-printing');
    const done = () => { page.remove(); document.body.classList.remove('book-printing'); document.title = title; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };

  // ---- The tab ----

  const openBook = (id) => {
    if (!t.marks.get(id)) return;
    showing = { book: id };
    reading = false;
    show();
  };
  const openRoomBooks = () => {
    const r = room();
    if (!r) return;
    if (editor.inBook()) { docks.openAll(true); return; } // a room seen as Book: contents left, in hand right
    const books = booksIn(t, r);
    if (books.length === 1) { openBook(books[0].id); return; }
    if (!books.length) { newBook(); return; }
    showing = { room: r };
    show();
  };

  const show = async () => {
    const d = dock();
    if (!d) { t.ui.toast('The Book needs the right dock.'); return; }
    if (!d.isOpen(KEY)) {
      body = el('div', { class: 'book' });
      await d.open({ key: KEY, tab: 'Book', kind: 'Book', title: '', body,
        // Thoughts dragged from the canvas: onto a chapter's line (data-drop), or anywhere on the book.
        drop: {
          accepts: (ids) => !!showing?.book && ids.some((id) => { const m = t.marks.get(id); return m && !isBook(m) && !isChapter(m); }),
          drop: (ids, target) => take(ids, target?.dataset?.drop || showing.book),
        },
        onClose: () => { showing = null; body = null; } });
    } else d.show(KEY);
    draw();
  };

  const draw = () => {
    if (!body) return;
    if (showing?.book && !t.marks.get(showing.book)) showing = room() ? { room: room() } : null;
    if (!showing) { body.replaceChildren(); return; }
    body.replaceChildren(...(showing.book ? (reading ? readingView(showing.book) : bookView(showing.book)) : listView(showing.room)));
  };

  const btn = (label, fn, extra = '') => el('button', { type: 'button', class: `box-btn ${extra}`, onclick: fn }, label);

  // The room's books: each with how much it holds; New book.
  const listView = (r) => {
    const books = booksIn(t, r);
    return [
      el('p', { class: 'hint' }, books.length ? 'The books in this room.' : 'No book in this room yet.'),
      el('div', { class: 'book-list', role: 'list' }, ...books.map((b) => {
        const c = count(tree(t, b.id));
        return el('button', { type: 'button', class: 'pick', role: 'listitem', onclick: () => openBook(b.id) },
          el('span', {}, b.title || 'Untitled book'), el('span', { class: 'pick-note' }, `${c.chapters} chapters · ${c.words} words`));
      })),
      el('div', { class: 'box-btns' }, btn('New book', () => newBook())),
    ];
  };

  // A book: its title, how much it holds, its contents (chapters, each opened to its thoughts),
  // then what it can do.
  const bookView = (id) => {
    const node = tree(t, id);
    const c = count(node);
    const locked = t.distance.shut(id);
    const title = el('input', { class: 'pop-name title-field book-title', value: node.title, 'aria-label': 'The book\'s title', maxlength: 120, disabled: locked,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = node.title; e.target.blur(); } },
      onchange: (e) => { const v = e.target.value.trim(); if (v) t.marks.edit(id, { title: v }); } });
    const stats = el('p', { class: 'hint book-stats' },
      `${c.chapters} ${c.chapters === 1 ? 'chapter' : 'chapters'} · ${c.thoughts} ${c.thoughts === 1 ? 'thought' : 'thoughts'} · ${c.words} words`
      + (node.open ? ` · ${node.open} open` : node.of ? ' · nothing open' : ''));
    return [
      title, stats,
      el('details', { class: 'sec', open: '' }, el('summary', {}, 'Contents'),
        el('div', { class: 'sec-body' },
          node.parts.length ? partsList(node, locked, '') : el('p', { class: 'hint' }, 'Empty. Add a chapter, then drag thoughts from the room onto it.'),
          el('p', { class: 'hint book-hint' }, 'Drag a thought from the room onto a chapter to add it. Drag a line to reorder.'))),
      el('div', { class: 'box-btns book-actions' },
        locked ? null : btn('Add chapter', () => { newChapter(id); }),
        btn('Read', () => { reading = true; draw(); }),
        btn('Export Markdown', () => exportMarkdown(id)),
        btn('Print or PDF', () => print(id)),
        locked ? null : btn('Delete book', () => removeBook(id), 'danger')),
      booksIn(t, t.places.home(id)).length > 1 ? el('div', { class: 'box-btns' }, btn('All books here', () => { showing = { room: t.places.home(id) }; draw(); })) : null,
    ].filter(Boolean);
  };

  // A holder's parts, as lines: a chapter (numbered, its counts on the right, ▸ opens it to its
  // thoughts, a double-click renames it) or a thought (a click goes to it in the room, × takes it
  // out). Each line drags to another place among its siblings.
  const partsList = (holder, locked, prefix) => {
    let n = 0;
    const ids = holder.parts.map((p) => p.id);
    const list = el('ol', { class: 'book-parts', role: 'list' });
    for (const p of holder.parts) {
      const num = p.chapter ? `${prefix}${++n}` : '';
      const row = p.chapter ? chapterLine(p, num, locked, holder) : thoughtLine(p, locked, holder);
      if (!locked) {
        row.draggable = true;
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-book-part', `${holder.id} ${p.id}`); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); });
        row.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/x-book-part')) { e.preventDefault(); row.classList.add('book-over'); } });
        row.addEventListener('dragleave', () => row.classList.remove('book-over'));
        row.addEventListener('drop', (e) => {
          row.classList.remove('book-over');
          const [from, part] = (e.dataTransfer.getData('text/x-book-part') || '').split(' ');
          if (from !== holder.id || !part || part === p.id) return;
          e.preventDefault(); e.stopPropagation();
          t.links.order(holder.id, moved(ids, part, p.id));
        });
      }
      list.append(row);
      if (p.chapter && openChapters.has(p.id)) list.append(el('li', { class: 'book-inside' }, p.parts.length ? partsList(p, locked, `${num}.`) : el('p', { class: 'hint' }, 'Nothing in it yet.')));
    }
    return list;
  };

  const chapterLine = (p, num, locked, holder) => {
    const open = openChapters.has(p.id);
    const c = count(p);
    const name = el('span', { class: 'book-name', title: locked ? p.title : 'Double-click to rename', ondblclick: (e) => {
      if (locked) return;
      const f = el('input', { class: 'book-rename', value: p.title, maxlength: 120,
        onkeydown: (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') f.blur(); if (ev.key === 'Escape') { f.value = p.title; f.blur(); } },
        onblur: () => { const v = f.value.trim(); if (v && v !== p.title) t.marks.edit(p.id, { title: v }); else draw(); } });
      e.currentTarget.replaceWith(f); f.focus(); f.select();
    } }, p.title);
    return el('li', { class: 'book-line book-chapter' + (open ? ' open' : ''), 'data-drop': p.id },
      el('button', { type: 'button', class: 'book-caret', 'aria-expanded': String(open), 'aria-label': open ? 'Close' : 'Open', onclick: () => { if (open) openChapters.delete(p.id); else openChapters.add(p.id); draw(); } }, '›'),
      el('span', { class: 'book-num' }, num), name,
      el('span', { class: 'book-right' }, `${c.thoughts}${p.open ? ` · ${p.open} open` : ''}`),
      locked ? null : el('button', { type: 'button', class: 'close-x book-x', 'aria-label': 'Take the chapter away (its thoughts stay)', title: 'Take the chapter away (its thoughts stay in the room)',
        onclick: () => { t.together(() => { unpart(p.id, holder.id); t.marks.delete(p.id); }); } }));
  };

  const thoughtLine = (p, locked, holder) => el('li', { class: 'book-line book-thought' + (p.open ? ' book-open-gap' : '') },
    el('button', { type: 'button', class: 'book-text', title: 'Show it in the room', onclick: () => t.ui.open.mark(p.id) }, p.text.split('\n')[0] || '…'),
    locked ? null : el('button', { type: 'button', class: 'close-x book-x', 'aria-label': 'Take it out of the chapter', title: 'Take it out of the chapter (it stays in the room)', onclick: () => unpart(p.id, holder.id) }));

  // Reading order: the book as it reads, chapter by chapter.
  const readingNodes = (node, printed = false) => {
    const out = [el(printed ? 'h1' : 'div', { class: printed ? '' : 'book-read-title' }, node.title)];
    const walk = (n, depth, prefix) => {
      let k = 0;
      for (const p of n.parts) {
        if (p.chapter) { const num = `${prefix}${++k}`; out.push(el(`h${Math.min(depth + 1, 6)}`, { class: 'book-read-head' }, `${num} ${p.title}`)); walk(p, depth + 1, `${num}.`); }
        else if (p.text.trim()) out.push(el('p', { class: 'book-read-p' + (p.open ? ' book-open-gap' : '') }, p.text));
      }
    };
    walk(node, 1, '');
    return out;
  };
  const readingView = (id) => {
    const node = tree(t, id);
    const toc = contents(node);
    return [
      el('div', { class: 'box-btns' }, btn('Back to contents', () => { reading = false; draw(); })),
      toc.length ? el('ol', { class: 'book-toc' }, ...toc.map((x) => el('li', { style: `padding-left:${(x.depth - 1) * 14}px` }, el('span', { class: 'book-num' }, x.num), ` ${x.title}`))) : null,
      el('article', { class: 'book-read' }, ...readingNodes(node)),
    ].filter(Boolean);
  };

  // ---- Into the app ----

  t.slots.groups.add({ id: BOOK, name: 'Book', card: true, open: (id) => openBook(id) });
  t.slots.groups.add({ id: CHAPTER, name: 'Chapter', membership: 'one' }); // a paragraph sits in one chapter
  const editor = installEditor(t);
  const docks = installDocks(t, { exportMarkdown, exportWord, print, layout: editor.layout });
  // In the room's ⋯ More too, beside the room file's own Export: the room's first book.
  t.slots.formats.add({ id: 'book-docx', name: 'Book as a Word document (.docx)', accepts: () => false,
    exportRoom: (r) => { const b = booksIn(t, r)[0]; return b ? exportWord(b.id) : t.ui.toast('No book in this room yet.'); } });
  t.slots.commands.add({ id: 'book.move-into', keys: ['Alt+M'], zone: 'room', order: 72, words: 'move the chosen paragraph or chapter into a chapter you pick in the contents',
    when: () => editor.inBook() && !!t.ui.chosen()?.mark, run: () => docks.startMove() });
  t.slots.commands.add({ id: 'book.move-cancel', keys: ['Escape'], zone: 'room', order: 1, words: 'not moving it after all',
    when: () => docks.moving(), run: () => docks.cancelMove() });
  t.slots.buttons.add({ id: 'book', label: 'Book', icon: ICON, order: 40, visible: () => !!room(),
    title: () => 'This room\'s books (Ctrl+Alt+J): a contents page, chapters of thoughts, export', on: () => !!dock()?.isShowing(KEY), run: openRoomBooks });
  t.slots.commands.add({ id: 'book.open', keys: ['Ctrl+Alt+J'], zone: 'room', order: 70, words: 'Open this room\'s book, or make one', when: () => !!room(), run: openRoomBooks });
  t.slots.commands.add({ id: 'book.new', zone: 'room', order: 71, words: 'A new book in this room', when: () => !!room(), run: () => newBook() });
  // Redrawn as the tables change (a thought written, a chapter made, an undo).
  const redraw = () => { if (body) draw(); };
  t.marks.on(redraw);
  t.links.on(redraw);
  t.gaps.on(redraw);

  return { newBook, newChapter, take, openBook, exportWord, editor, docks };
}

export default class Book extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.api = install(t);
  }
}
