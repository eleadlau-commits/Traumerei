// Tests for Book's rules (rules.js), over a small stand-in for the read half of the tables.

import { test, assert } from 'folio/testing';
import { tree, count, contents, markdown, fileName, moved, booksIn, wordCount } from '../rules.js';

// A book with two chapters, the second holding a section; gaps on two thoughts.
function reads() {
  const marks = {
    r: { id: 'r', kind: 'room', name: 'Room' },
    b: { id: 'b', kind: 'group', of: 'book', title: 'Book', at: 1 },
    c1: { id: 'c1', kind: 'group', of: 'book-chapter', title: 'One', at: 2 },
    c2: { id: 'c2', kind: 'group', of: 'book-chapter', title: 'Two', at: 3 },
    s: { id: 's', kind: 'group', of: 'book-chapter', title: 'Two, a', at: 4 },
    a: { id: 'a', kind: 'line', text: 'Alpha beta', at: 5 },
    g: { id: 'g', kind: 'line', text: 'Gamma', at: 6 },
    d: { id: 'd', kind: 'line', text: 'Delta epsilon zeta', at: 7 },
  };
  const parts = { b: ['c1', 'c2'], c1: ['a', 'g'], c2: ['s'], s: ['d'] };
  const gaps = { g: { state: 'open' }, d: { state: 'resolved' } };
  return {
    marks: { get: (id) => marks[id] || null, text: (id) => marks[id]?.text || '', in: () => Object.values(marks).filter((m) => m.kind !== 'room') },
    links: { members: (id) => parts[id] || [], to: () => [] },
    gaps: { of: (id) => gaps[id] || null, progress: (id) => ({ b: { open: 1, of: 2 }, c1: { open: 1, of: 1 }, c2: { open: 0, of: 1 }, s: { open: 0, of: 1 } }[id] || { open: 0, of: 0 }) },
  };
}

test('a book reads as a tree, counted, its contents numbered as they nest', () => {
  const node = tree(reads(), 'b');
  assert.deepEqual(node.parts.map((p) => p.title), ['One', 'Two']);
  assert.deepEqual(count(node), { chapters: 3, thoughts: 3, words: 6 });
  assert.deepEqual(contents(node).map((c) => [c.num, c.title, c.depth]), [['1', 'One', 1], ['2', 'Two', 1], ['2.1', 'Two, a', 2]]);
  assert.equal(node.open, 1);
  assert.deepEqual(booksIn(reads(), 'r').map((m) => m.id), ['b']);
});

test('a book as Markdown: headings as chapters nest, thoughts as paragraphs, open gaps marked', () => {
  const md = markdown(tree(reads(), 'b'));
  assert.equal(md, '# Book\n\n_One gap is still open._\n\n## 1 One\n\nAlpha beta\n\n**Open:** Gamma\n\n## 2 Two\n\n### 2.1 Two, a\n\nDelta epsilon zeta\n');
});

test('names, words and moving a line', () => {
  assert.equal(fileName('Linear Maps: an Introduction', 'md'), 'linear-maps-an-introduction.md');
  assert.equal(fileName('', 'md'), 'book.md');
  assert.equal(wordCount('  two  words '), 2);
  assert.deepEqual(moved(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b']);
  assert.deepEqual(moved(['a', 'b', 'c'], 'a', null), ['b', 'c', 'a']);
});
