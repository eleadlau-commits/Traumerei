// Reading notes' gestures on notes: a quote and its page, a comment under a quote, a note moved
// in its stream or to another source, an edition of a source. Each is one step (t.together) and
// keeps every law: a note is a line `part of` its source; a quote has a quiet `reading quote` link
// to its source, its label the anchor; a comment a `reading comment` link to its quote; an edition
// a `reading edition` link to the source it is an edition of. Only the plugin API (t); tested in
// tests/notes.test.js and app/core/api/tests/reading.test.js.
//
//   asQuote(t, id, force?)    a note read as a quote ('"…" p. 112'): the anchor off its words, linked
//   toggleQuote(t, id)         a quote back to a note (its page back in its words), or a note a quote
//   move(t, id, place)         { source, under, before }: a note (a quote with its comments) moved
//   nest(t, id) / unnest(t, id) a note under the quote before it / out from under its quote
//   step(t, id, dir)           one place up (-1) or down (1) among its neighbours
//   tidy(t, src)               the stream's order as shown (a quote's comments right after it)
//   newEdition(t, src)         a new source, an edition of `src` (its metadata copied, its own key)
//   setEditionOf(t, src, main) an edition of `main`, or of nothing (null)
//   syncTags(t, id)            a note in the tags its words name (#word), out of the others
//   deleteSource(t, src)       a source and its notes deleted (its collections, editions and other
//                              sources stay; a tag left holding nothing goes)

import { SOURCE, QUOTE, COMMENT, EDITION, isSource, notesOf, sourceOf, quoteOf, isQuote, aboutOf, editionOf, editionsOf,
  streamOf, blockOf, parseQuote, autoKey, uniqueKey, keysIn } from './rules.js';
import { TAG, isTag, tagsIn, tagNamed, fold } from './find.js';

const no = (reason) => ({ ok: false, reason });
const partRow = (t, id, src) => t.links.from(id, 'part of').find((l) => l.to === src) || null;
const unlinkAll = (t, id, kind) => { for (const l of t.links.from(id, kind)) t.links.unlink(l.id); };

// The stream's order as it is shown: each quote's comments right after it. Only when it differs.
export function tidy(t, src) {
  if (!src || !isSource(t.marks.get(src))) return;
  const now = t.links.members(src);
  const notes = now.filter((id) => t.marks.get(id)?.kind === 'line');
  const shown = streamOf(t, src, notes).map((n) => n.id);
  const others = now.filter((id) => t.marks.get(id)?.kind !== 'line');
  const want = [...shown, ...others];
  if (want.some((id, i) => id !== now[i])) t.links.order(src, want);
}

// A note read as a quote: '"…" p. 112' or '> …', or any note (force, Alt+Q). Its words lose the
// "> " and the anchor, it links to its source with the anchor as label, and it comes out from
// under a quote (a quote stands on its own). → { ok, quote: true } or { ok: false, reason }.
export function asQuote(t, id, force = false) {
  const m = t.marks.get(id);
  const src = sourceOf(t, id);
  if (!m || m.kind !== 'line') return no('Choose a note first.');
  if (!src) return no('A quote is from a source: put the note in one first.');
  const q = parseQuote(m.text, force);
  if (!q) return { ok: true, quote: false };
  const was = quoteOf(t, id);
  if (was && !q.anchor && q.text === m.text) return { ok: true, quote: true };
  return t.together(() => {
    if (q.text !== m.text) { const e = t.marks.edit(id, { text: q.text }); if (e?.ok === false) return e; }
    const label = q.anchor || (was?.label ?? '');
    if (!was || was.label !== label || was.to !== src) {
      if (was) t.links.unlink(was.id);
      const l = t.links.link(id, src, QUOTE, label || null);
      if (l?.ok === false) return l;
    }
    unlinkAll(t, id, COMMENT);
    tidy(t, src);
    return { ok: true, quote: true };
  });
}

// A quote back to a note (its page put back at the end of its words, so nothing is lost), or a
// note made a quote (Alt+Q). → { ok, quote } or { ok: false, reason }.
export function toggleQuote(t, id) {
  const q = quoteOf(t, id);
  if (!q) return asQuote(t, id, true);
  const m = t.marks.get(id);
  return t.together(() => {
    t.links.unlink(q.id);
    if (q.label) t.marks.edit(id, { text: `${m.text} ${q.label}` });
    // Its comments stand on their own now, where they were.
    for (const l of t.links.to(id, COMMENT)) t.links.unlink(l.id);
    return { ok: true, quote: false };
  });
}

// A note moved: `source` the source it goes into (null: out of every source, Unfiled), `under` the
// quote it goes under as a comment (null: a note of its own), `before` the note it goes before
// (a block's head, or a comment under `under`; null: at the end). A quote carries its comments.
// One step. → { ok } or { ok: false, reason }.
export function move(t, id, { source = null, under = null, before = null } = {}) {
  const m = t.marks.get(id);
  if (!m || m.kind !== 'line') return no('Choose a note first.');
  const from = sourceOf(t, id);
  const block = blockOf(t, id);
  if (under && (block.length > 1 || isQuote(t, id))) under = null; // a quote, or a note with comments, stands on its own
  if (under === id || before === id) return no('A note does not go next to itself.');
  if (source && !isSource(t.marks.get(source))) return no('There is no such source.');
  if (under && (sourceOf(t, under) !== source || !isQuote(t, under))) return no('A comment goes under a quote of the same source.');
  return t.together(() => {
    // Into the source (each note of the block), out of the one it was in.
    if (source !== from) {
      for (const n of block) {
        const p = from ? partRow(t, n, from) : null;
        if (p) t.links.unlink(p.id);
        if (source) { const r = t.links.link(n, source, 'part of'); if (r?.ok === false) return r; }
        const q = quoteOf(t, n);
        if (q) { t.links.unlink(q.id); if (source) t.links.link(n, source, QUOTE, q.label || null); }
      }
    }
    // Under its quote, or on its own.
    const about = aboutOf(t, id);
    if (about !== under) { unlinkAll(t, id, COMMENT); if (under) { const r = t.links.link(id, under, COMMENT); if (r?.ok === false) return r; } }
    if (!source) return { ok: true };
    // Its place in the stream: the stream as shown, the block taken out and put back before `before`.
    const rest = streamOf(t, source).map((n) => n.id).filter((n) => !block.includes(n));
    let at = before ? rest.indexOf(before) : -1;
    if (at < 0) {
      if (under) { const kids = rest.filter((n) => aboutOf(t, n) === under); at = rest.indexOf(kids.length ? kids.at(-1) : under) + 1; }
      else at = rest.length;
    }
    rest.splice(at, 0, ...block);
    const others = t.links.members(source).filter((n) => !rest.includes(n));
    t.links.order(source, [...rest, ...others]);
    return { ok: true };
  });
}

// The note under the quote before it, as its last comment (Alt+→).
export function nest(t, id) {
  const src = sourceOf(t, id);
  if (!src) return no('Choose a note in a source.');
  if (aboutOf(t, id)) return no('It is a comment already.');
  if (isQuote(t, id)) return no('A quote stands on its own: Alt+Q makes it a note first.');
  if (blockOf(t, id).length > 1) return no('It holds comments of its own.');
  const s = streamOf(t, src);
  const i = s.findIndex((n) => n.id === id);
  let head = null;
  for (let j = i - 1; j >= 0; j--) if (!s[j].under) { head = s[j].id; break; }
  if (!head || !isQuote(t, head)) return no('A comment goes under a quote: there is none just before it.');
  return move(t, id, { source: src, under: head, before: null });
}

// A comment out from under its quote, right after the quote's block (Alt+←).
export function unnest(t, id) {
  const q = aboutOf(t, id);
  const src = sourceOf(t, id);
  if (!q || !src) return no('It is not under a quote.');
  const s = streamOf(t, src);
  const tops = s.filter((n) => !n.under).map((n) => n.id);
  const next = tops[tops.indexOf(q) + 1] || null;
  return move(t, id, { source: src, under: null, before: next });
}

// One place up (-1) or down (1): a block among the blocks, a comment among its quote's comments
// (Alt+Shift+↑ / ↓). At the top or the bottom, nothing.
export function step(t, id, dir) {
  const src = sourceOf(t, id);
  if (!src) return no('Choose a note in a source.');
  const s = streamOf(t, src);
  const under = aboutOf(t, id);
  const sibs = s.filter((n) => (under ? n.under === under : !n.under) && (!under || sourceOf(t, under) === src)).map((n) => n.id);
  const i = sibs.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sibs.length) return { ok: true, moved: false };
  const before = dir < 0 ? sibs[j] : (sibs[j + 1] || null);
  return move(t, id, { source: src, under: under && sourceOf(t, under) === src ? under : null, before });
}

// ---- Tags ----

// A note's tags as its words say (#word): in each tag group of the library (made when there is
// none), out of the ones it no longer names; a tag left holding nothing goes. One step, or none
// when nothing changes. → { ok, changed }.
export function syncTags(t, id) {
  const m = t.marks.get(id);
  const room = m ? t.places.home(id) : null;
  if (!m || m.kind !== 'line' || !room) return { ok: true, changed: false };
  const want = tagsIn(m.text);
  const now = t.links.holders(id).map((g) => t.marks.get(g)).filter(isTag);
  const gone = now.filter((g) => !want.includes(fold(g.title)));
  const add = want.filter((w) => !now.some((g) => fold(g.title) === w));
  if (!gone.length && !add.length) return { ok: true, changed: false };
  return t.together(() => {
    for (const g of gone) {
      const p = partRow(t, id, g.id);
      if (p) t.links.unlink(p.id);
      if (!t.links.members(g.id).length) t.marks.delete(g.id);
    }
    for (const w of add) {
      let g = tagNamed(t, room, w);
      if (!g) { const made = t.marks.make({ kind: 'group', content: { title: w, of: TAG }, in: room }); if (made?.ok === false) return made; g = made.id; }
      const r = t.links.link(id, g, 'part of');
      if (r?.ok === false) return r;
    }
    return { ok: true, changed: true };
  });
}

// ---- Editions ----

const COPY = ['type', 'authors', 'container', 'publisher', 'volume', 'issue', 'pages', 'doi', 'url', 'isbn'];

// A new source, an edition of `src` (or of the source `src` is an edition of): its title, authors
// and the rest copied, no year and no edition yet, its own key; in the same library. One step.
// → { ok, id } or { ok: false, reason }.
export function newEdition(t, src) {
  const s = t.marks.get(src);
  if (!isSource(s)) return no('Open a source first.');
  const main = editionOf(t, src) || src;
  const m = t.marks.get(main);
  const room = t.places.home(main);
  const content = { title: m.title || 'Untitled', of: SOURCE };
  for (const k of COPY) if (m[k] != null) content[k] = m[k];
  content.citekey = uniqueKey(autoKey({ authors: m.authors, year: '', title: m.title }), keysIn(t, room));
  return t.together(() => {
    const made = t.marks.make({ kind: 'group', content, in: room });
    if (made?.ok === false) return made;
    const l = t.links.link(made.id, main, EDITION);
    if (l?.ok === false) return l;
    return { ok: true, id: made.id };
  });
}

// `src` an edition of `main` (one with editions of its own can't be), or of nothing (null).
export function setEditionOf(t, src, main) {
  if (!isSource(t.marks.get(src))) return no('Open a source first.');
  if (main === src) return no('A source is not an edition of itself.');
  if (main && !isSource(t.marks.get(main))) return no('There is no such source.');
  if (main && editionsOf(t, src).length) return no('It has editions of its own: it is the one they are editions of.');
  if (main && editionOf(t, main)) main = editionOf(t, main); // an edition of an edition: of the first
  if ((editionOf(t, src) || null) === (main || null)) return { ok: true };
  return t.together(() => {
    unlinkAll(t, src, EDITION);
    if (main) { const l = t.links.link(src, main, EDITION); if (l?.ok === false) return l; }
    return { ok: true };
  });
}



// A source deleted with its notes, as one step (Ctrl+Z brings it all back). Taken out of its
// collections first, so a collection it leaves empty stays (a group left with no parts would go).
// Its editions stay, as sources of their own.
export function deleteSource(t, src) {
  if (!isSource(t.marks.get(src))) return no('Choose a source first.');
  const notes = notesOf(t, src);
  return t.together(() => {
    unlinkAll(t, src, 'part of');
    const d = t.marks.delete(src);
    if (d?.ok === false) return d;
    for (const n of notes) if (t.marks.get(n)) { const r = t.marks.delete(n); if (r?.ok === false) return r; }
    return { ok: true, notes: notes.length };
  });
}
