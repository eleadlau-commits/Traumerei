// Reading notes' Book tab: the open source's book, a page at a time, in the right dock beside
// Details. The book is read from its linked file into this session's memory only (reader.js), never
// into the tables or the store. With core's `ui.files.read(path)` (core-gaps.md, gap 12) it reopens
// by itself; until then the person picks it once a session (Open the book…), checked by its hash.
//
// installBook(t, o) with o = { fileOf(id), pathOf(id), load(accept) → { name, sha256, data } | null,
//   readPath(path) → { name, sha256, data } | null, quoteOf(mark) → { src, words, anchor } | null }
// → { show(src, quote?), follow(mark), toggle(), close(), sync(inLibrary), books }

import { ui } from 'folio';
import { readable, readBook, pageAt, pageNamed, pageText, findQuote } from './reader.js';

const { el } = ui;
export const BOOK = 'reading.book';
const ACCEPT = '.txt,.text,.md,.html,.htm,.xhtml,.epub';

export function installBook(t, o) {
  const books = new Map(); // sha256 → book, this session's (at most 3 kept)
  let body = null;          // the tab's body while it is open
  let cur = null;           // { src, page, hl: { from, to } | null }
  let busy = false;
  const btn = (label, fn, cls = '') => el('button', { type: 'button', class: `box-btn ${cls}`.trim(), onclick: fn }, label);
  const keep = (sha, book) => { books.delete(sha); books.set(sha, book); while (books.size > 3) books.delete(books.keys().next().value); return book; };
  const bookOf = (src) => { const f = o.fileOf(src); return f ? books.get(f.sha256) || null : null; };

  // The book of a source, from memory, from its path (core's read, when there) or picked.
  const fromFile = async (got, f) => {
    if (!got?.data) return null;
    if (got.sha256 && f.sha256 && got.sha256 !== f.sha256) t.ui.toast(`${got.name} is not the file attached (its fingerprint differs). Shown anyway; Verify… in Details to check.`);
    try { return keep(f.sha256 || got.sha256, await readBook(got.name || f.name, got.data)); }
    catch (err) { t.ui.toast(`${got.name || f.name} could not be read: ${err?.message || err}`); return null; }
  };
  const loadByPath = async (src) => {
    const f = o.fileOf(src);
    if (!f || !readable(f.name || f.rel) || bookOf(src)) return bookOf(src);
    const got = await o.readPath?.(o.pathOf(src));
    return got ? fromFile(got, f) : null;
  };
  const pickFor = async (src) => {
    const f = o.fileOf(src);
    if (!f) return null;
    const got = await o.load(ACCEPT);
    const book = got ? await fromFile(got, f) : null;
    if (book && cur?.src === src) await place(src, cur.quote);
    draw();
    return book;
  };

  // ---- The tab ----
  const draw = () => {
    if (!body) return;
    const src = cur?.src;
    const s = src ? t.marks.get(src) : null;
    if (!s) { body.replaceChildren(el('p', { class: 'hint' }, 'Open a source to read its book here.')); return; }
    const head = el('h3', { class: 'label reading-book-head' }, s.title || s.citekey || 'Untitled');
    const f = o.fileOf(src);
    if (!f) { body.replaceChildren(head, el('p', { class: 'hint' }, 'No book linked. Attach its file in Details › File (a .txt, .html or .epub file reads here).')); return; }
    if (!readable(f.name || f.rel)) {
      body.replaceChildren(head, el('p', { class: 'hint' }, /\.pdf$/i.test(f.name || f.rel) ? 'A PDF opens in its own app (Details › Open). Reading a PDF here comes later.' : `${f.name} can't be read here: a .txt, .html or .epub file can.`));
      return;
    }
    const book = bookOf(src);
    if (!book) {
      body.replaceChildren(head,
        el('p', { class: 'hint' }, `${f.name}: pick it once this session to read it here. Only this computer's memory holds it; the library keeps its path and fingerprint.`),
        el('div', { class: 'box-btns' }, btn('Open the book…', () => pickFor(src))));
      return;
    }
    const i = Math.max(0, Math.min(book.pages.length - 1, cur.page || 0));
    cur.page = i;
    const [a, b] = pageText(book, i);
    const label = book.printed ? (book.pages[i].label != null ? `p. ${book.pages[i].label}` : 'Front matter') : `Screen ${i + 1} of ${book.pages.length}`;
    const page = el('article', { class: 'reading-page', tabindex: '0', 'aria-label': `${s.title || 'Book'}, ${label}` }, ...paras(book.text, a, b, cur.hl));
    page.addEventListener('keydown', keys);
    body.replaceChildren(head,
      el('div', { class: 'reading-book-nav' },
        btn('‹', () => turn(-1)),
        el('span', { class: 'reading-book-at' }, label, book.printed ? el('span', { class: 'pick-note' }, ` · ${i + 1} of ${book.pages.length}`) : ''),
        btn('›', () => turn(1))),
      page,
      el('p', { class: 'hint' }, '← / → or Page Up / Down turn the page; Home, End. Choosing a quote on the canvas turns to it.'));
    const hl = page.querySelector('.st-sel');
    if (hl) hl.scrollIntoView?.({ block: 'center' }); else page.scrollTop = 0;
  };
  // The words of a page as paragraphs, the quote found in it lit.
  const paras = (text, a, b, hl) => {
    const out = [];
    let at = a;
    for (const part of text.slice(a, b).split('\n\n')) {
      const from = at, to = at + part.length;
      at = to + 2;
      if (!part.trim()) continue;
      if (hl && hl.from < to && hl.to > from) {
        const x = Math.max(hl.from, from) - from, y = Math.min(hl.to, to) - from;
        out.push(el('p', {}, part.slice(0, x), el('span', { class: 'st-sel' }, part.slice(x, y)), part.slice(y)));
      } else out.push(el('p', {}, part));
    }
    return out;
  };
  const keys = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const d = k === 'ArrowRight' || k === 'PageDown' ? 1 : k === 'ArrowLeft' || k === 'PageUp' ? -1 : k === 'Home' ? -Infinity : k === 'End' ? Infinity : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    turn(d);
    body?.querySelector('.reading-page')?.focus();
  };
  const turn = (d) => {
    const book = cur && bookOf(cur.src);
    if (!book) return;
    const n = book.pages.length;
    cur.page = d === -Infinity ? 0 : d === Infinity ? n - 1 : Math.max(0, Math.min(n - 1, cur.page + d));
    draw();
  };

  // Where a quote is: the page its anchor names (printed pages), else its words found anywhere.
  const place = async (src, quote) => {
    const book = bookOf(src);
    if (!book || !quote) return;
    const named = pageNamed(book, quote.anchor);
    const hl = findQuote(book, quote.words, named);
    cur.hl = hl;
    const found = hl ? pageAt(book, hl.from) : -1;
    // The anchor's page wins unless the words are on it or the next or last one (a quote across a turn).
    cur.page = named >= 0 && (found < 0 || Math.abs(found - named) > 1) ? named : found >= 0 ? found : cur.page;
  };

  const openTab = async () => {
    const d = t.ui.docks;
    if (!d?.right) return false;
    if (body) { d.right.show(BOOK); return true; }
    if (busy) return false;
    busy = true;
    const b = el('div', { class: 'reading reading-book' });
    body = b;
    try {
      const h = await d.right.open({ key: BOOK, tab: 'Book', kind: 'Book', title: '', label: 'Book', body: b, onClose: () => { if (body === b) body = null; } });
      if (!h && body === b) body = null;
    } finally { busy = false; }
    return !!body;
  };

  // The Book tab shows `src` (at the page of `quoteMark`, when given).
  const show = async (src, quoteMark = null) => {
    if (!src) return false;
    const quote = quoteMark ? o.quoteOf(quoteMark) : null;
    const was = cur?.src === src ? cur.page : 0;
    cur = { src, page: was, hl: null, quote };
    if (!(await openTab())) return false;
    draw();
    await loadByPath(src);
    if (cur?.src !== src) return true;
    if (quote) await place(src, quote);
    draw();
    if (bookOf(src)) body?.querySelector('.reading-page')?.focus({ preventScroll: true });
    else body?.querySelector('button')?.focus();
    return true;
  };
  // A mark chosen on the canvas: when the tab shows and it is a quote, turn to it.
  const follow = (mark, src = null) => {
    if (!body || !t.ui.docks?.right?.isShowing?.(BOOK)) return;
    const q = mark ? o.quoteOf(mark) : null;
    if (!q?.src) { if (src && src !== cur?.src) show(src); return; }
    if (q?.src && (q.src !== cur?.src || q.words !== cur?.quote?.words)) {
      if (bookOf(q.src)) { cur = { src: q.src, page: 0, hl: null, quote: q }; place(q.src, q).then(draw); }
      else show(q.src, mark);
    }
  };
  const close = () => { if (body) t.ui.docks?.right?.close(BOOK, true); body = null; };
  const toggle = (src) => (body && t.ui.docks?.right?.isShowing?.(BOOK) && cur?.src === src ? (close(), false) : show(src));
  const sync = (inLibrary) => { if (!inLibrary) close(); };
  return { show, follow, toggle, close, sync, books, isOpen: () => !!body, current: () => cur };
}
