// Reading notes: what comes in from other tools, as gestures (each one step, t.together). BibTeX
// or BibLaTeX (Zotero's metadata) becomes sources; Zotero's annotations, exported as Markdown,
// become quotes with their pages and the comments under them. Only the plugin API (t); tested in
// app/core/api/tests/reading.test.js.

import { SOURCE, QUOTE, COMMENT, isSource, sourcesIn, autoKey, uniqueKey, validKey } from './rules.js';
import { parseBib, entryToSource } from './bibtex.js';
import { parseZotero } from './zotero.js';

// A .bib file's entries as sources of the library: one already there by key (or by title and
// year when it has no key) is left as it is. One step. → { ok, made, kept, skipped }.
export function importBib(t, room, text) {
  const entries = parseBib(text);
  if (!entries.length) return { ok: false, reason: 'No BibTeX entries in that file.' };
  const have = sourcesIn(t, room);
  const keys = new Set(have.map((s) => s.citekey).filter(Boolean));
  const titled = new Set(have.map((s) => `${String(s.title || '').toLowerCase()}|${s.year || ''}`));
  let made = 0, kept = 0;
  const out = t.together(() => {
    for (const e of entries) {
      const src = entryToSource(e);
      if ((src.citekey && keys.has(src.citekey)) || titled.has(`${String(src.title || '').toLowerCase()}|${src.year || ''}`)) { kept++; continue; }
      src.citekey = src.citekey && validKey(src.citekey) ? src.citekey : uniqueKey(autoKey(src), keys);
      const { title, ...fields } = src;
      const r = t.marks.make({ kind: 'group', content: { title, of: SOURCE, ...fields }, in: room });
      if (r?.ok === false) return r;
      keys.add(src.citekey);
      titled.add(`${String(title || '').toLowerCase()}|${src.year || ''}`);
      made++;
    }
    return { ok: true };
  });
  return out?.ok === false ? out : { ok: true, made, kept, skipped: 0 };
}

// Zotero's annotations (a note exported as Markdown) into a source, at the end of its stream: a
// highlight a quote with its page, its comment a comment under it, any other paragraph a note.
// One step. → { ok, quotes, comments, notes }.
export function importZotero(t, src, md) {
  if (!isSource(t.marks.get(src))) return { ok: false, reason: 'Open a source first.' };
  const room = t.places.home(src);
  const items = parseZotero(md);
  if (!items.length) return { ok: false, reason: 'No highlights or notes in that file.' };
  const n = { quotes: 0, comments: 0, notes: 0 };
  const out = t.together(() => {
    let quote = null;
    for (const it of items) {
      const r = t.marks.make({ content: it.text, in: room });
      if (r?.ok === false) return r;
      const j = t.links.link(r.id, src, 'part of');
      if (j?.ok === false) return j;
      if (it.quote) { t.links.link(r.id, src, QUOTE, it.page || null); quote = r.id; n.quotes++; }
      else if (it.comment && quote) { t.links.link(r.id, quote, COMMENT); n.comments++; }
      else { quote = null; n.notes++; }
    }
    return { ok: true };
  });
  return out?.ok === false ? out : { ok: true, ...n };
}
