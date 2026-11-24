// Reading notes: tags and finding, as plain functions of the read half of the tables. A tag is a
// group of the family `reading-tag` (membership many), its title the word, typed as #word in a
// note. Finding reads a query of words and #tags across a library's notes and sources. No screen;
// tested in tests/find.test.js.

import { isSource, sourcesIn, sourceOf, quoteOf, aboutOf, streamOf, authorYear } from './rules.js';

export const TAG = 'reading-tag';
export const isTag = (m) => !!m && m.kind === 'group' && m.of === TAG;

// A word folded for comparing: lower case, no accents.
export const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

// The tags typed in some words ("#evolution", "#harm-principle"), folded, each once, in order.
const HASH = /(^|[^\p{L}\p{N}_&/#-])#([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu;
export function tagsIn(words) {
  const out = [];
  for (const m of String(words || '').matchAll(HASH)) { const w = fold(m[2]).replace(/[-_]+$/, ''); if (w && !out.includes(w)) out.push(w); }
  return out;
}
// Where each tag stands in some words: [{ from, to }] (the # and the word), for the decorator.
export function tagSpans(words) {
  const out = [];
  for (const m of String(words || '').matchAll(HASH)) { const from = m.index + m[1].length; out.push({ from, to: from + 1 + m[2].length }); }
  return out;
}

// A library's tags: [{ id, word, notes }] (notes the count), by word; only tags that hold a note.
export function tagsOf(reads, room) {
  return reads.marks.in(room).filter(isTag)
    .map((g) => ({ id: g.id, word: String(g.title || ''), notes: reads.links.members(g.id).length }))
    .filter((g) => g.word && g.notes > 0)
    .sort((a, b) => a.word.localeCompare(b.word));
}
// The tag group of a word in a room, or null.
export function tagNamed(reads, room, word) {
  const w = fold(word);
  return reads.marks.in(room).find((g) => isTag(g) && fold(g.title) === w)?.id || null;
}
// The tags a note is in (their words).
export function tagsOfNote(reads, mark) {
  return reads.links.holders(mark).map((g) => reads.marks.get(g)).filter(isTag).map((g) => String(g.title || ''));
}

// A query read: { words: [folded], tags: [folded] }.
export function parseQuery(q) {
  const tags = tagsIn(q);
  const words = String(q || '').replace(HASH, '$1').split(/\s+/).map(fold).map((w) => w.replace(/^#/, '')).filter(Boolean);
  return { words, tags };
}

// What a query finds in a library, in library order: { sources: [{ source }], notes: [{ note,
// source, under, anchor, text }] }. A note is found when it holds every word (in its words, its
// page, or its source's key) and is in every tag; a source when its key, title, authors or year
// hold every word (and no tag is asked for). `most` caps the notes.
export function find(reads, room, q, most = 200) {
  const { words, tags } = parseQuery(q);
  const out = { sources: [], notes: [], words, tags };
  if (!words.length && !tags.length) return out;
  const tagIds = tags.map((w) => tagNamed(reads, room, w));
  if (tagIds.some((id) => !id)) return out;
  const inTags = tagIds.map((id) => new Set(reads.links.members(id)));
  const has = (hay) => words.every((w) => hay.includes(w));
  for (const src of sourcesIn(reads, room)) {
    const key = fold(src.citekey);
    if (!tags.length && has(fold([src.citekey, src.title, ...(src.authors || []), src.year, authorYear(src)].join(' ')))) out.sources.push({ source: src.id });
    for (const { id, under } of streamOf(reads, src.id)) {
      if (out.notes.length >= most) break;
      if (!inTags.every((s) => s.has(id))) continue;
      const m = reads.marks.get(id);
      const anchor = quoteOf(reads, id)?.label || '';
      if (!has(fold(`${m?.text || ''} ${anchor} ${key}`))) continue;
      out.notes.push({ note: id, source: src.id, under, anchor, text: m?.text || '' });
    }
  }
  return out;
}

// A short piece of a note's words around the first word found (for a result line).
export function snippet(text, words, size = 90) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= size) return s;
  const f = fold(s);
  const at = words.length ? Math.max(0, f.indexOf(words[0])) : 0;
  const from = Math.max(0, Math.min(at - Math.floor(size / 3), s.length - size));
  return `${from > 0 ? '…' : ''}${s.slice(from, from + size).trim()}${from + size < s.length ? '…' : ''}`;
}

