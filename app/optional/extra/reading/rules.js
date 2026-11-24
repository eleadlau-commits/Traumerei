// Reading notes' plain functions: a library's sources, their citation keys, and the Library rule's
// layout and landing. No screen: only the read half of the tables (`reads`, as a rule's arrange is
// handed, or the plugin's own t) and a measure(text, width) handed in, so the tests run them as
// they are. Tested in tests/rules.test.js.
//
// The shape (all in the six tables, Law 8): the library is the room; a source is a group of the
// family `reading-source`, its metadata the group's own fields and its title the group's title; a
// note is a line thought, `part of` its source, in stream order. No source text is ever kept.

export const RULE = 'reading-library';
export const SOURCE = 'reading-source';
// Quiet link kinds (the Library draws them itself): a quote to its source, its label the anchor
// ("p. 112"); a comment to the quote it is about; an edition to the source it is an edition of.
export const QUOTE = 'reading quote';
export const COMMENT = 'reading comment';
export const EDITION = 'reading edition';

// A source's own fields (slots.groups `fields`); its title is the group's title.
export const FIELDS = Object.freeze(['type', 'citekey', 'authors', 'year', 'edition', 'container', 'volume', 'issue', 'pages', 'publisher', 'doi', 'url', 'isbn', 'file']);
export const TYPES = Object.freeze([['book', 'Book'], ['article', 'Article'], ['chapter', 'Chapter'], ['web', 'Web page'], ['thesis', 'Thesis'], ['report', 'Report'], ['other', 'Other']]);
const TYPE_IDS = new Set(TYPES.map(([id]) => id));
const TEXT_FIELDS = ['edition', 'container', 'volume', 'issue', 'pages', 'publisher', 'doi', 'url', 'isbn'];

export const isSource = (m) => !!m && m.kind === 'group' && m.of === SOURCE;

// A source's own fields tidied (slots.groups `tidy`): authors a list of names, the year its
// digits, the rest trimmed words; an empty one taken off (null), so an edit that empties it drops it.
export function tidySource(g) {
  const out = { ...g };
  const words = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  out.type = TYPE_IDS.has(g.type) ? g.type : 'book';
  const list = Array.isArray(g.authors) ? g.authors : typeof g.authors === 'string' ? g.authors.split('\n') : [];
  const authors = list.map(words).filter(Boolean);
  out.authors = authors.length ? authors : null;
  const year = words(g.year).replace(/[^\d]/g, '').slice(0, 4);
  out.year = year || null;
  const key = words(g.citekey).replace(/\s+/g, '');
  out.citekey = key || null;
  for (const k of TEXT_FIELDS) out[k] = words(g[k]) || null;
  out.file = g.file && typeof g.file === 'object' ? g.file : null;
  return out;
}

// ---- Citation keys ----

// Words a title starts with that a key skips (English, and the articles of a few other languages).
const STOP = new Set(['a', 'an', 'the', 'of', 'on', 'in', 'and', 'for', 'to', 'la', 'le', 'les', 'l', 'der', 'die', 'das', 'el', 'il', 'lo', 'un', 'une', 'ein', 'eine']);
const ascii = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The family name of an author written "Darwin, Charles" or "Charles Darwin".
export function familyName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  if (s.includes(',')) return s.split(',')[0].trim();
  const parts = s.split(/\s+/);
  return parts[parts.length - 1];
}

// The key a source would be given: family name of its first author, its year, the first word of
// its title that is not an article ("darwin1859origin"). Never empty.
export function autoKey({ authors, year, title } = {}) {
  const first = Array.isArray(authors) ? authors[0] : null;
  const who = ascii(familyName(first)) || 'anon';
  const when = String(year || '').replace(/[^\d]/g, '').slice(0, 4) || 'nd';
  const word = String(title || '').split(/[\s\-–—:;,.!?'"’()]+/).map(ascii).find((w) => w && !STOP.has(w)) || '';
  return who + when + word;
}

// `base`, or base + a, b, … z, aa, … : the first not in `taken` (a Set of keys).
export function uniqueKey(base, taken) {
  if (!taken.has(base)) return base;
  for (let i = 0; ; i++) {
    let n = i, suffix = '';
    do { suffix = String.fromCharCode(97 + (n % 26)) + suffix; n = Math.floor(n / 26) - 1; } while (n >= 0);
    if (!taken.has(base + suffix)) return base + suffix;
  }
}

// Whether a key may be used as typed: letters, digits and _ : . - only (what BibTeX and Pandoc take).
export const validKey = (k) => /^[A-Za-z0-9_:.-]+$/.test(String(k || ''));

// The keys of a room's sources, but one (when editing it).
export function keysIn(reads, room, but = null) {
  return new Set(sourcesIn(reads, room).filter((s) => s.id !== but).map((s) => s.citekey).filter(Boolean));
}

// ---- Anchors: the printed page a quote is on ----

// A page as printed: digits, or roman numerals for front matter (xiv).
const PAGE = '(?:\\d+|[ivxlcdm]+)';
// A kept note's words read as a quote: words begun with a quotation mark, or with "> ", and an
// anchor typed at the end or not ('"… life." p. 112', '"…" (pp. 112-13)', '"…" @xiv'). A note that
// only ends in a page ("compare p. 40") stays a comment; Alt+Q makes any note a quote (force).
// → { text, anchor } (the words without the "> " and the anchor; the anchor as the link's label,
// '' for none), or null when the words are not a quote.
const ANCHOR = new RegExp(`(^|[\\s,;])\\(?\\s*(?:pp?\\.?\\s*|@\\s?)(${PAGE})(?:\\s*[-–—]\\s*(${PAGE}))?\\s*\\)?\\s*$`, 'i');
const OPENS = /^["“‘«„'‹]/;
export function parseQuote(words, force = false) {
  let text = String(words ?? '').trim();
  let marked = force || OPENS.test(text);
  if (/^>\s?/.test(text)) { text = text.replace(/^>\s?/, ''); marked = true; }
  if (!marked) return null;
  const m = ANCHOR.exec(text);
  if (m && text.slice(0, m.index).trim()) return { text: text.slice(0, m.index).replace(/[\s,;]+$/, ''), anchor: anchorOf(m[2], m[3]) };
  return text ? { text, anchor: '' } : null;
}
// "p. 112", "pp. 112–13" kept as typed ("pp. 112–113"), "p. xiv".
export function anchorOf(from, to = null) {
  const a = String(from || '').toLowerCase().replace(/^0+(?=\d)/, '');
  if (!a) return '';
  const b = to ? String(to).toLowerCase().replace(/^0+(?=\d)/, '') : '';
  return b && b !== a ? `pp. ${a}–${b}` : `p. ${a}`;
}
// The first page of an anchor ("112" of "pp. 112–113"), or ''.
export const pageOf = (anchor) => (String(anchor || '').match(new RegExp(PAGE, 'i')) || [''])[0];

// ---- Quotes, comments, editions ----

const one = (reads, mark, kind) => reads.links.from(mark, kind)[0] || null;
// A note's quote row ({ id, from, to, label }), or null when it is not a quote.
export const quoteOf = (reads, mark) => one(reads, mark, QUOTE);
export const isQuote = (reads, mark) => !!quoteOf(reads, mark);
// The quote a comment is about, or null.
export const aboutOf = (reads, mark) => one(reads, mark, COMMENT)?.to || null;
// The source a source is an edition of, or null.
export const editionOf = (reads, src) => one(reads, src, EDITION)?.to || null;
// The editions of a source, by year.
export function editionsOf(reads, src) {
  return reads.links.to(src, EDITION).map((l) => reads.marks.get(l.from)).filter(isSource)
    .sort((a, b) => String(a.year || '').localeCompare(String(b.year || '')) || String(a.citekey || '').localeCompare(String(b.citekey || '')));
}

// A source's notes as the stream shows them: [{ id, under }] where `under` is the quote a comment
// sits under (null for a note of its own). Comments follow their quote, in stream order; a comment
// whose quote is in another source (or not a quote) stands on its own.
export function streamOf(reads, src, notes = notesOf(reads, src)) {
  const here = new Set(notes);
  const kids = new Map(), top = [];
  for (const id of notes) {
    const q = aboutOf(reads, id);
    if (q && q !== id && here.has(q) && !aboutOf(reads, q)) { if (!kids.has(q)) kids.set(q, []); kids.get(q).push(id); }
    else top.push(id);
  }
  const out = [];
  for (const id of top) { out.push({ id, under: null }); for (const c of kids.get(id) || []) out.push({ id: c, under: id }); }
  return out;
}
// A note and the comments under it (a quote's block), in order.
export function blockOf(reads, mark) {
  const src = sourceOf(reads, mark);
  if (!src) return [mark];
  const s = streamOf(reads, src);
  return [mark, ...s.filter((n) => n.under === mark).map((n) => n.id)];
}

// ---- Reading the library ----

// The sources of a room, by citation key (then title, then when made), each source's editions
// right after it, by year: the order of the left dock and of the columns on the canvas.
export function sourcesIn(reads, room) {
  return orderSources(reads, reads.marks.in(room).filter(isSource));
}
const sortSources = (list) => list.sort((a, b) =>
  String(a.citekey || '').localeCompare(String(b.citekey || '')) || String(a.title || '').localeCompare(String(b.title || '')) || (a.at || 0) - (b.at || 0));
function orderSources(reads, list) {
  const ids = new Set(list.map((s) => s.id));
  const main = new Map(); // an edition → the source it is an edition of (when that is here)
  for (const s of list) { const m = editionOf(reads, s.id); if (m && ids.has(m) && m !== s.id) main.set(s.id, m); }
  const out = [];
  for (const s of sortSources(list.filter((x) => !main.has(x.id)))) {
    out.push(s);
    for (const e of editionsOf(reads, s.id)) if (main.get(e.id) === s.id) out.push(list.find((x) => x.id === e.id));
  }
  return out;
}

// The notes of a source, in stream order (its parts that are words).
export function notesOf(reads, source) {
  return reads.links.members(source).filter((id) => reads.marks.get(id)?.kind === 'line');
}

// The source a note is in, or null.
export function sourceOf(reads, mark) {
  for (const g of reads.links.holders(mark)) if (isSource(reads.marks.get(g))) return g;
  return null;
}

// "Darwin 1859", "Marx and Engels 1848", "Smith et al. 2001"; "n.d." for no year.
export function authorYear(src) {
  const a = (src?.authors || []).map(familyName).filter(Boolean);
  const who = !a.length ? 'Anon.' : a.length === 1 ? a[0] : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a[0]} et al.`;
  return `${who} ${src?.year || 'n.d.'}`;
}

// ---- The Library rule: each source a column of its notes, side by side ----

// World units: a column's width, the air between columns, the source's heading above its notes,
// the space between notes.
export const COLUMN = Object.freeze({ width: 560, gap: 220, head: 120, space: 22, empty: 90, indent: 48, gutter: 84 });

// The centre x of column i.
export const columnX = (i) => i * (COLUMN.width + COLUMN.gap);

// The library laid out: { rows (arrange's), boxes (draw's), columns: [{ source, x, top, bottom,
// notes, units }] }: each source a column, and after them a column of the room's thoughts in no
// source (Unfiled, `source: null`), so every thought is placed. A quote's page stands in the
// column's gutter at its left; the comments on a quote sit under it, indented. `units` are the column's blocks
// ({ head, ids, top, bottom }: a note and the comments under it), for dropping and keys. The
// thought being written (reads.marks.draft) after a note opens room under it.
export function layout(reads, room, measure) {
  const W = COLUMN.width, I = COLUMN.indent, G = COLUMN.gutter;
  const draft = reads.marks.draft?.(room) || null;
  const rows = [], boxes = [], columns = [];
  // One read of the room: its marks by id (each reads.marks.get is a frozen copy: 1,500 of them
  // would cost more than the whole layout).
  const all = reads.marks.in(room);
  const byId = new Map(all.map((m) => [m.id, m]));
  const filed = new Set();
  const column = (source, x, head, stream) => {
    boxes.push({ x: x - W / 2, y: 0, w: W, h: COLUMN.head - 30, style: 'heading', level: 1, ...head });
    let y = COLUMN.head;
    const units = [];
    for (const { id, under } of stream) {
      // A source's notes leave a gutter at the left for the quotes' pages (Unfiled has none).
      const g = source ? G : 0;
      const w = W - g - (under ? I : 0), cx = x + g / 2 + (under ? I / 2 : 0);
      const h = Math.max(measure(byId.get(id)?.text || ' ', w).height || 0, 24);
      if (!under) units.push({ head: id, ids: [id], top: y, bottom: y + h });
      else if (units.length) units[units.length - 1].ids.push(id);
      rows.push({ mark: id, x: cx, y: y + h / 2, width: w, height: h, align: 'start' });
      if (!under && source) {
        const q = quoteOf(reads, id);
        if (q?.label) boxes.push({ x: x - W / 2, y, w: G - 12, h: 26, label: q.label, style: 'quiet' });
      }
      y += h;
      if (units.length) units[units.length - 1].bottom = y;
      y += COLUMN.space;
      if (draft?.after === id) y += Math.max(draft.height || 40, 24) + COLUMN.space;
    }
    if (!stream.length && source) {
      boxes.push({ x: x - W / 2, y, w: W, h: COLUMN.empty, note: 'No notes yet. Type to add one.', style: 'quiet' });
      y += COLUMN.empty;
    }
    columns.push({ source, x, top: 0, bottom: y, notes: stream.map((n) => n.id), units });
  };
  const srcs = orderSources(reads, all.filter(isSource));
  srcs.forEach((src, i) => {
    const notes = reads.links.members(src.id).filter((id) => byId.get(id)?.kind === 'line');
    for (const id of notes) filed.add(id);
    const main = editionOf(reads, src.id);
    const of = main && byId.get(main)?.citekey ? ` · edition of ${byId.get(main).citekey}` : '';
    const ed = src.edition ? ` · ${src.edition} ed.` : '';
    column(src.id, columnX(i), { label: src.title || 'Untitled', note: (src.citekey ? `${authorYear(src)} · ${src.citekey}` : authorYear(src)) + ed + of }, streamOf(reads, src.id, notes));
  });
  const unfiled = all.filter((m) => m.kind === 'line' && !filed.has(m.id)).map((id) => ({ id: id.id, under: null }));
  if (unfiled.length) column(null, columnX(srcs.length), { label: 'Unfiled', note: 'notes in no source' }, unfiled);
  return { rows, boxes, columns };
}

// Where a note let go at x, y goes (a drag): { source, under, before } for move() (notes.js), or
// null to leave it where it is. Over a column: between two blocks, there as a note of its own; in
// the comments under a quote (or the lower half of a quote with none), a comment on it (a note
// that is no quote and holds no comments of its own). Over Unfiled: out of its source.
export function dropAt(reads, room, mark, x, y, lay) {
  const m = reads.marks.get(mark);
  if (!m || m.kind !== 'line' || !lay?.columns?.length) return null;
  const col = nearest(lay.columns, x);
  if (!col || Math.abs(col.x - x) > COLUMN.width / 2 + COLUMN.gap / 2) return null;
  if (!col.source) return sourceOf(reads, mark) ? { source: null, under: null, before: null } : null;
  const own = blockOf(reads, mark);
  const canNest = !isQuote(reads, mark) && own.length === 1;
  const units = col.units.filter((u) => u.head !== mark);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (y < u.top) return { source: col.source, under: null, before: u.head };
    if (y > u.bottom + COLUMN.space / 2) continue;
    const firstH = (lay.rows.find((r) => r.mark === u.head)?.height) || 24;
    if (y < u.top + firstH / 2) return { source: col.source, under: null, before: u.head };
    if (canNest && isQuote(reads, u.head)) {
      // Among its comments: before the first whose middle is below y.
      const kids = u.ids.slice(1).filter((id) => id !== mark);
      const next = kids.find((id) => { const r = lay.rows.find((rr) => rr.mark === id); return r && y < r.y; }) || null;
      return { source: col.source, under: u.head, before: next };
    }
    return { source: col.source, under: null, before: units[i + 1]?.head || null };
  }
  return { source: col.source, under: null, before: null };
}

// Where a thought just kept goes, as a proposal for the rule's land (one step with Enter):
// - written after a note (x, y its centre): right after that note, in its source, when that is
//   the open source (or none is known);
// - else at the end of the open source's stream;
// - else in the column under x.
// open: the source open in the room, or null. lay: layout(...) of the room.
export function landing(reads, room, mark, x, y, open, lay) {
  const after = lay.rows.find((r) => r.mark !== mark && Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1);
  if (after) {
    const src = sourceOf(reads, after.mark);
    if (src && (!open || src === open)) return { join: src, at: notesOf(reads, src).indexOf(after.mark) + 1 };
  }
  const col = open ? lay.columns.find((c) => c.source === open) : nearest(lay.columns, x);
  if (!col?.source) return null; // (the Unfiled column: it stays in no source)
  return { join: col.source, at: notesOf(reads, col.source).filter((id) => id !== mark).length };
}

export const nearest = (columns, x) => columns.reduce((best, c) => (!best || Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best), null);

// ---- A new library ----

// A new, empty library as a .traum file (traum/3): one room, already seen as Library, carried by
// the file because a plugin can't set a room's mode itself (core-gaps.md).
export function libraryTraum(name = 'Library') {
  const title = String(name).replace(/[\r\n]+/g, ' ').trim() || 'Library';
  return ['---', 'format: traum/3', 'context: ^1', '---', '', '# Marks', '', `## ^1 room: ${title}`, `mode: ${RULE}`, ''].join('\n');
}
