// The Book plugin's plain functions: no screen, only the read half of the tables (`reads`, as the
// API hands a view: t.marks, t.links, t.gaps). A book is a group of the family `book`; its parts,
// in the maker's order, are chapters (groups of the family `book-chapter`, which may hold
// sections, chapters again) and thoughts. Tested in tests/rules.test.js.

export const BOOK = 'book';
export const CHAPTER = 'book-chapter';

const isGroupOf = (m, of) => !!m && m.kind === 'group' && m.of === of;
export const isBook = (m) => isGroupOf(m, BOOK);
export const isChapter = (m) => isGroupOf(m, CHAPTER);

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
  const parts = reads.links.members(id).map((pid) => {
    const pm = reads.marks.get(pid);
    if (!pm) return null;
    if (isChapter(pm)) return { ...tree(reads, pid, seen), chapter: true };
    const g = reads.gaps.of(pid);
    return { id: pid, chapter: false, title: '', text: partText(reads, pid), parts: [], open: g?.state === 'open' ? 1 : 0, of: g ? 1 : 0 };
  }).filter(Boolean);
  return { id, chapter: isChapter(m), title: m.title || (isBook(m) ? 'Untitled book' : 'Untitled chapter'), text: '', parts, open: p.open || 0, of: p.of || 0 };
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

// The contents page: one line per chapter, however deep, numbered as it nests (1, 1.1, 2…).
export function contents(node, prefix = '') {
  const out = [];
  let n = 0;
  for (const p of node?.parts || []) {
    if (!p.chapter) continue;
    const num = `${prefix}${++n}`;
    out.push({ id: p.id, num, depth: num.split('.').length, title: p.title, open: p.open, ...count(p) });
    out.push(...contents(p, `${num}.`));
  }
  return out;
}

// The book as Markdown, in reading order: its title, each chapter a heading (deeper as it nests),
// each thought a paragraph; an open gap is marked, as Export marks one.
export function markdown(node) {
  if (!node) return '';
  const lines = [`# ${node.title}`, ''];
  if (node.open) lines.push(`_${node.open === 1 ? 'One gap is' : `${node.open} gaps are`} still open._`, '');
  const walk = (n, depth, prefix) => {
    let k = 0;
    for (const p of n.parts) {
      if (p.chapter) {
        const num = `${prefix}${++k}`;
        lines.push(`${'#'.repeat(Math.min(depth + 1, 6))} ${num} ${p.title}`, '');
        walk(p, depth + 1, `${num}.`);
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
