// Tests for Reading notes' BibTeX and BibLaTeX in and out (bibtex.js) and Zotero's annotations in
// (zotero.js).

import { test, assert } from 'folio/testing';
import { parseBib, entryToSource, sourceToEntry, writeBib, namesOf, unlatex } from '../bibtex.js';
import { parseZotero } from '../zotero.js';

const BIB = `@string{jm = "John Murray"}
@comment{exported by Zotero}
@Book{darwin1859origin,
  author = {Darwin, Charles},
  title = {On the {Origin} of Species by Means of Natural Selection},
  publisher = jm, year = 1859, edition = {1st},
  abstract = {never kept}
}
@article{godel1931,
  author = {Kurt G{\\"o}del and Ludwig van Beethoven and {World Health Organization}},
  title = {{\\"U}ber formal unentscheidbare S{\\"a}tze},
  journaltitle = {Monatshefte f{\\"u}r Mathematik}, date = {1931-01}, volume = 38, number = {1},
  pages = {173--198}, doi = {10.1007/BF01700692}
}
@broken{oops, title = {never closed
`;

test('BibTeX in: entries, @string macros, accents and braces; never the abstract', () => {
  const e = parseBib(BIB);
  assert.deepEqual(e.map((x) => x.key), ['darwin1859origin', 'godel1931']);
  const d = entryToSource(e[0]);
  assert.deepEqual(d, { title: 'On the Origin of Species by Means of Natural Selection', type: 'book', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859', edition: '1st', publisher: 'John Murray' });
  const g = entryToSource(e[1]);
  assert.equal(g.type, 'article');
  assert.deepEqual(g.authors, ['Gödel, Kurt', 'van Beethoven, Ludwig', 'World Health Organization']);
  assert.equal(g.title, 'Über formal unentscheidbare Sätze');
  assert.equal(g.container, 'Monatshefte für Mathematik');
  assert.equal(g.year, '1931');
  assert.equal(g.pages, '173–198');
  assert.equal(g.issue, '1');
  assert.equal(unlatex('Fran\\c{c}ois \\& {\\o}ystein --- x'), 'François & øystein — x');
  assert.deepEqual(namesOf('Charles Robert Darwin and {Royal Society}'), ['Darwin, Charles Robert', 'Royal Society']);
});

test('BibTeX out: each source an entry under its key; read back the same', () => {
  const src = { title: 'Über formal & more', type: 'article', citekey: 'godel1931', authors: ['Gödel, Kurt', 'World Health Organization'], year: '1931', container: 'Monatshefte', pages: '173–198', doi: '10.1007/x' };
  const text = sourceToEntry(src);
  assert.ok(text.startsWith('@article{godel1931,'));
  assert.ok(text.includes('author = {Gödel, Kurt and {World Health Organization}}'));
  assert.ok(text.includes('pages = {173--198}'));
  assert.ok(text.includes('title = {Über formal \\& more}'));
  const back = entryToSource(parseBib(writeBib([src]))[0]);
  assert.deepEqual(back, src);
});

test('Zotero\'s annotations in: a highlight a quote with its page, its comment under it, other paragraphs notes', () => {
  const md = `# Annotations
(11/24/2026, 3:04:12 PM)

“There is grandeur in this view of life” ([Darwin, 1859, p. 490](zotero://select/library/items/AB)) ([pdf](zotero://open-pdf/library/items/EF?page=508)) Wonder survives the mechanism.

“We see nothing of these slow changes” ([Darwin, 1859, pp. 84-85](zotero://select/x))

A thought of my own, **in bold**.

![image](attachments/x.png)
`;
  assert.deepEqual(parseZotero(md), [
    { quote: true, text: '“There is grandeur in this view of life”', page: 'p. 490' },
    { comment: true, text: 'Wonder survives the mechanism.' },
    { quote: true, text: '“We see nothing of these slow changes”', page: 'pp. 84–85' },
    { text: 'A thought of my own, in bold.' },
  ]);
  assert.deepEqual(parseZotero(''), []);
});
