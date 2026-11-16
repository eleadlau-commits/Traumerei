// The Book plugin's plain functions: no screen, only the read half of the tables (`reads`, as the
// API hands a view: t.marks, t.links, t.gaps). A book is a group of the family `book`; its parts,
// in the maker's order, are chapters (groups of the family `book-chapter`, which may hold
// sections, chapters again) and thoughts. Tested in tests/rules.test.js.

export const BOOK = 'book';
export const CHAPTER = 'book-chapter';

const isGroupOf = (m, of) => !!m && m.kind === 'group' && m.of === of;
export const isBook = (m) => isGroupOf(m, BOOK);
export const isChapter = (m) => isGroupOf(m, CHAPTER);

// Numbered or not: a chapter's own field `numbered` (slots.groups `fields`, kept in the tables), on
// unless it says false. An unnumbered chapter (a Preface, an Interlude: LaTeX's starred sections)
// shows no number and is skipped in its siblings' numbering, and so are the sections in it.
export const NUMBERED = 'numbered';
export const isNumbered = (m) => !!m && m[NUMBERED] !== false;
// The numbers of one holder's chapters, in order: next(numbered) → '3' (with the holder's prefix,
// '2.' for a section of chapter 2), or '' for an unnumbered one; a prefix of null numbers none.
export function numberer(prefix = '') {
  let n = 0;
  return (numbered) => (prefix != null && numbered !== false ? `${prefix}${++n}` : '');
}
// The prefix a chapter numbered `num` hands its sections: none when it has no number.
export const under = (num) => (num ? `${num}.` : null);
// A chapter's words as a heading shows them: its number and its name, either one alone, or, with
// neither (an unnamed, unnumbered chapter), `none`.
export const headingWords = (num, name, none = '') => [num, name].filter(Boolean).join('  ') || none;

// The books in a room, oldest first.
export function booksIn(reads, room) {
  return reads.marks.in(room).filter(isBook).sort((a, b) => a.at - b.at);
}

// The words a part shows: a group's title, else its words.
export function partText(reads, id) {
  const m = reads.marks.get(id);
  if (!m) return '';
  if (m.kind === 'group') return m.title || reads.marks.text(id) || '';
  return reads.marks.text(id) || '';
}

// A book as a tree: { id, title, parts: [{ id, chapter, title, text, parts, open, of }], open, of }
// (open and of: gaps still open, and how many parts carry one, as gaps.progress reads them). A
// group seen twice (it should not be) is shown once.
export function tree(reads, id, seen = new Set()) {
  const m = reads.marks.get(id);
  if (!m || seen.has(id)) return null;
  seen.add(id);
  const p = reads.gaps.progress(id) || { open: 0, of: 0 };
  // A chapter's heading (the thought linked `heads` to it) is its title, not one of its paragraphs.
  const head = reads.links.to(id, 'heads').map((r) => r.from).find((h) => reads.marks.get(h)) || null;
  const headWords = head ? (reads.marks.text(head) || '').split('\n')[0].trim() : '';
  const parts = reads.links.members(id).map((pid) => {
    const pm = reads.marks.get(pid);
    if (!pm || pid === head) return null;
    if (isChapter(pm)) return { ...tree(reads, pid, seen), chapter: true };
    const g = reads.gaps.of(pid);
    return { id: pid, chapter: false, title: '', text: partText(reads, pid), parts: [], open: g?.state === 'open' ? 1 : 0, of: g ? 1 : 0 };
  }).filter(Boolean);
  // A chapter may have no name (no heading thought, an empty title): its title is then '' (named:
  // false), and those that show it say so in their own way (its number alone, or "(untitled)").
  const name = headWords || m.title || '';
  return { id, chapter: isChapter(m), title: name || (isBook(m) ? 'Untitled book' : ''), named: !!name, ...(isChapter(m) ? { numbered: isNumbered(m) } : {}), text: '', parts, open: p.open || 0, of: p.of || 0 };
}

// How much a book (or chapter) holds: chapters (however deep), thoughts, and words.
export function count(node) {
  let chapters = 0, thoughts = 0, words = 0;
  for (const p of node?.parts || []) {
    if (p.chapter) { chapters++; const c = count(p); chapters += c.chapters; thoughts += c.thoughts; words += c.words; } else { thoughts++; words += wordCount(p.text); }
  }
  return { chapters, thoughts, words };
}
export const wordCount = (text) => (String(text || '').match(/\S+/g) || []).length;

// The contents page: one line per chapter, however deep, numbered as it nests (1, 1.1, 2…); an
// unnumbered chapter has no number and is skipped (Preface, 1, 2, Interlude, 3); an unnamed one
// reads as its number alone, or "(untitled)" with none.
export function contents(node, prefix = '', depth = 1) {
  const out = [];
  const next = numberer(prefix);
  for (const p of node?.parts || []) {
    if (!p.chapter) continue;
    const num = next(p.numbered);
    out.push({ id: p.id, num, depth, title: p.title || (num ? '' : '(untitled)'), named: p.named !== false, numbered: !!num, open: p.open, ...count(p) });
    out.push(...contents(p, under(num), depth + 1));
  }
  return out;
}

// The book as Markdown, in reading order: its title, each chapter a heading (deeper as it nests),
// each thought a paragraph; an open gap is marked, as Export marks one.
export function markdown(node) {
  if (!node) return '';
  const lines = [`# ${node.title}`, ''];
  if (node.open) lines.push(`_${node.open === 1 ? 'One gap is' : `${node.open} gaps are`} still open._`, '');
  // An unnumbered chapter's heading has no number; an unnamed one is its number alone; one with
  // neither is a break (* * *).
  const walk = (n, depth, prefix) => {
    const next = numberer(prefix);
    for (const p of n.parts) {
      if (p.chapter) {
        const num = next(p.numbered);
        const words = [num, p.title].filter(Boolean).join(' ');
        lines.push(words ? `${'#'.repeat(Math.min(depth + 1, 6))} ${words}` : '* * *', '');
        walk(p, depth + 1, under(num));
      } else if (p.text.trim()) {
        lines.push(`${p.open ? '**Open:** ' : ''}${p.text.trim()}`, '');
      }
    }
  };
  walk(node, 1, '');
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// A file name from a title: letters, digits and dashes.
export function fileName(title, ext) {
  const base = String(title || 'book').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'book';
  return `${base}.${ext}`;
}

// A list with one id moved before another (or to the end when `before` is null): the new order.
export function moved(ids, id, before) {
  const rest = ids.filter((x) => x !== id);
  const at = before == null ? rest.length : rest.indexOf(before);
  rest.splice(at < 0 ? rest.length : at, 0, id);
  return rest;
}
