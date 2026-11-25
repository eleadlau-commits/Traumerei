// Reading notes' text reader: a book file (plain text, HTML as Project Gutenberg makes it, EPUB)
// read into memory as words and pages, and a quote found in it. Nothing here is kept: the book
// lives in the session's memory only, never in the tables or the plugin's store (E's rule: path and
// hash only). Plain functions; tested in tests/reader.test.js.
//
//   readable(name)              whether a file of that name can be read here (.txt .html .epub …)
//   readBook(name, bytes)       → { text, pages: [{ label, at }], printed } (async: EPUB unzips)
//   pageAt(book, offset)        the page an offset of the text is on (its index)
//   pageNamed(book, anchor)     the page a quote's anchor names ('p. 56' → the page labelled 56), or -1
//   findQuote(book, words, near) → { from, to } in the text, or null (letters only, any case; near:
//                               a page to look on first)
//   pageText(book, i)           [from, to] of page i in the text
//
// A book's text is paragraphs joined by a blank line. Its pages are the printed ones when the file
// marks them (Gutenberg's [49], [Pg 49], an EPUB's page breaks): `printed` true, each page labelled
// by its number, where it starts in the text. Otherwise screens of about SCREEN letters, cut at a
// paragraph, labelled null.

export const SCREEN = 2400;
const EXT = /\.(txt|text|md|html?|xhtml|epub)$/i;
export const readable = (name) => EXT.test(String(name || ''));

// ---- Reading the file ----

export async function readBook(name, bytes) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ext = (String(name).match(/\.([a-z]+)$/i)?.[1] || '').toLowerCase();
  if (ext === 'epub') return epubBook(buf);
  const words = decode(buf);
  return /^html?$|^xhtml$/.test(ext) || /^\s*<(!doctype html|html)/i.test(words.slice(0, 400)) ? htmlBook([words]) : textBook(words);
}

const decode = (buf) => {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  // A file in Latin-1 (old Gutenberg texts) reads with replacement marks as UTF-8: read it again.
  return (utf.match(/�/g) || []).length > 20 ? new TextDecoder('windows-1252').decode(buf) : utf;
};

// Project Gutenberg's own words before and after the book: the start and end lines, when there.
function trimGutenberg(text, marks) {
  const start = text.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*/i);
  const from = start >= 0 ? text.indexOf('\n', start) + 1 || start : 0;
  const end = text.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG|(^|\n)End of (the |this )?Project Gutenberg/i);
  const to = end > from ? end : text.length;
  const body = text.slice(from, to);
  const lead = body.length - body.trimStart().length;
  const out = body.trim();
  const at = (n) => Math.max(0, Math.min(out.length, n - from - lead));
  return { text: out, marks: marks.filter((m) => m.at >= from && m.at <= to).map((m) => ({ label: m.label, at: at(m.at) })) };
}

// Pages from the marks the file has; screens when it has none.
function paged(text, marks) {
  const t = trimGutenberg(text, marks);
  const seen = [];
  for (const m of t.marks) if (!seen.length || m.at > seen.at(-1).at || m.label !== seen.at(-1).label) {
    if (seen.length && seen.at(-1).at === m.at) seen[seen.length - 1] = m; else seen.push(m);
  }
  if (seen.length >= 2) {
    const pages = /\S/.test(t.text.slice(0, seen[0].at)) ? [{ label: null, at: 0 }, ...seen] : [{ ...seen[0], at: 0 }, ...seen.slice(1)];
    return { text: t.text, pages, printed: true };
  }
  const pages = [];
  for (let at = 0; at < t.text.length;) {
    pages.push({ label: null, at });
    let to = at + SCREEN;
    if (to >= t.text.length) break;
    const cut = t.text.indexOf('\n\n', to);
    const back = t.text.lastIndexOf('\n\n', to);
    to = back > at + SCREEN / 2 ? back + 2 : cut > 0 && cut < to + SCREEN / 2 ? cut + 2 : to;
    at = to;
  }
  if (!pages.length) pages.push({ label: null, at: 0 });
  return { text: t.text, pages, printed: false };
}

// Plain text: paragraphs are split by a blank line; a line break inside one is a space (Gutenberg
// wraps its lines). A [49] or [Pg 49] alone marks a page.
function textBook(words) {
  const paras = words.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n[ \t]*\n+/);
  let text = '';
  const marks = [];
  for (const p of paras) {
    let line = p.replace(/\s*\n\s*/g, ' ').trim();
    if (!line) continue;
    line = line.replace(/\[(?:Pg\.?\s*|Page\s+)?([0-9]+|[ivxlcdm]+)\]/gi, (all, n, i) => { marks.push({ label: n, at: text.length + (text ? 2 : 0) + i }); return ''; }).replace(/\s{2,}/g, ' ').trim();
    if (!line) continue;
    text += (text ? '\n\n' : '') + line;
  }
  return paged(text, marks);
}

// HTML (one page or an EPUB's chapters in turn): the text of its blocks, each a paragraph; a page
// number Gutenberg marks (span.pagenum) or an EPUB page break (epub:type or role pagebreak) marks
// a page, its words left out.
const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'BR', 'HR', 'SECTION', 'ARTICLE', 'TABLE', 'DD', 'DT', 'FIGCAPTION', 'TITLE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'svg', 'SVG']);
const pageLabel = (el) => {
  const words = (el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent || el.id || '').trim();
  const m = words.match(/(?:Pg\.?\s*|Page[\s_]*)?([0-9]+|[ivxlcdm]+)\b/i);
  return m ? m[1] : null;
};
const isPageMark = (el) => {
  const c = ` ${el.getAttribute('class') || ''} `;
  const type = el.getAttribute('epub:type') || el.getAttributeNS?.('http://www.idpf.org/2007/ops', 'type') || '';
  return / pagenum /.test(c) || / pageno /.test(c) || /pagebreak/.test(type) || el.getAttribute('role') === 'doc-pagebreak';
};

function htmlBook(docs) {
  let text = '', line = '';
  const marks = [];
  const flush = () => { const l = line.replace(/\s+/g, ' ').trim(); if (l) text += (text ? '\n\n' : '') + l; line = ''; };
  const walk = (node) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { line += n.nodeValue; continue; }
      if (n.nodeType !== 1 || SKIP.has(n.tagName)) continue;
      if (isPageMark(n)) {
        const label = pageLabel(n);
        if (label) { const l = line.replace(/\s+/g, ' ').trim(); marks.push({ label, at: l ? text.length + (text ? 2 : 0) + l.length : text.length + (text ? 2 : 0) }); }
        continue;
      }
      const block = BLOCK.has(n.tagName.toUpperCase());
      if (block) flush();
      walk(n);
      if (block) flush();
    }
  };
  for (const src of docs) {
    const doc = typeof src === 'string' ? new DOMParser().parseFromString(src, 'text/html') : src;
    walk(doc.body || doc.documentElement);
    flush();
  }
  // A mark taken mid-paragraph counted the line before trimming: keep it inside the text.
  for (const m of marks) m.at = Math.min(m.at, text.length);
  return paged(text, marks);
}

// ---- EPUB: a zip of XHTML chapters, read in the order its package gives (the spine) ----

async function epubBook(buf) {
  const files = unzipIndex(buf);
  const get = async (name) => { const f = files.get(name) || files.get(decodeURIComponent(name)); return f ? decode(await inflate(buf, f)) : null; };
  const container = await get('META-INF/container.xml');
  const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
  const opf = opfPath ? await get(opfPath) : null;
  if (!opf) throw new Error('This EPUB has no package.');
  const base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const pkg = new DOMParser().parseFromString(opf, 'application/xml');
  const items = new Map([...pkg.getElementsByTagName('item')].map((i) => [i.getAttribute('id'), i.getAttribute('href')]));
  const order = [...pkg.getElementsByTagName('itemref')].map((r) => items.get(r.getAttribute('idref'))).filter(Boolean);
  const docs = [];
  for (const href of order) {
    const words = await get(base + href.split('#')[0]);
    if (words == null) continue;
    let doc = new DOMParser().parseFromString(words, 'application/xhtml+xml');
    if (doc.getElementsByTagName('parsererror').length) doc = new DOMParser().parseFromString(words, 'text/html');
    docs.push(doc);
  }
  return htmlBook(docs);
}

// The zip's directory: name → { at, method, size } (its local header found from the central one).
function unzipIndex(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Not a zip file.');
  const count = v.getUint16(end + 10, true);
  let p = v.getUint32(end + 16, true);
  const out = new Map();
  const names = new TextDecoder();
  for (let k = 0; k < count && v.getUint32(p, true) === 0x02014b50; k++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const n = v.getUint16(p + 28, true), e = v.getUint16(p + 30, true), c = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = names.decode(buf.subarray(p + 46, p + 46 + n));
    const at = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    out.set(name, { at, method, size });
    p += 46 + n + e + c;
  }
  return out;
}
async function inflate(buf, f) {
  const raw = buf.subarray(f.at, f.at + f.size);
  if (f.method === 0) return raw;
  if (f.method !== 8) throw new Error('This EPUB is packed in a way that can\'t be read here.');
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---- Pages and quotes ----

export function pageAt(book, offset) {
  const p = book.pages;
  let lo = 0, hi = p.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (p[mid].at <= offset) lo = mid; else hi = mid - 1; }
  return lo;
}
export const pageText = (book, i) => [book.pages[i].at, i + 1 < book.pages.length ? book.pages[i + 1].at : book.text.length];

// 'p. 56', 'pp. 56–57', 'S. 56', 'p. xiv' → the page labelled so (its first number), or -1.
export function pageNamed(book, anchor) {
  if (!book.printed) return -1;
  const m = String(anchor || '').match(/\b(?:pp?|S|s|Seite)\.?\s*([0-9]+|[ivxlcdm]+)\b/i);
  if (!m) return -1;
  const want = m[1].toLowerCase();
  return book.pages.findIndex((p) => p.label != null && String(p.label).toLowerCase() === want);
}

// The book's letters and digits, lower case, ß as ss, with where each came from in the text.
function letters(words) {
  const chars = [], from = [];
  const lower = words.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if (ch === 'ß') { chars.push('s', 's'); from.push(i, i); continue; }
    if (/[\p{L}\p{N}]/u.test(ch)) { chars.push(ch); from.push(i); }
  }
  return { s: chars.join(''), from };
}
const lettersOf = (book) => (book._letters ||= letters(book.text));

// Where a quote's words are in the book, by their letters (quotation marks, spacing and case
// don't count). Tries the whole quote, then its start, then its end. `near`: the page to look on
// first (the anchor's).
export function findQuote(book, words, near = -1) {
  const q = letters(String(words || '')).s;
  if (q.length < 4) return null;
  const L = lettersOf(book);
  const span = (i, n) => ({ from: L.from[i], to: L.from[i + n - 1] + 1 });
  const lookIn = (needle) => {
    if (near >= 0) {
      const [a, b] = pageText(book, near);
      const lo = L.from.findIndex((x) => x >= a);
      const i = lo < 0 ? -1 : L.s.indexOf(needle, lo);
      if (i >= 0 && L.from[i] < b + 400) return i;
    }
    return L.s.indexOf(needle);
  };
  let i = lookIn(q);
  if (i >= 0) return span(i, q.length);
  const part = Math.min(48, q.length);
  i = lookIn(q.slice(0, part));
  if (i >= 0) return span(i, part);
  i = lookIn(q.slice(-part));
  return i >= 0 ? span(i, part) : null;
}
