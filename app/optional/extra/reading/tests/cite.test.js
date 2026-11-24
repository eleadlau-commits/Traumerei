// Tests for Reading notes' citations (cite.js): Chicago author-date in the text and in References,
// Pandoc keys, and the Word document's parts (word.js).

import { test, assert } from 'folio/testing';
import { inText, citeNames, chicagoPages, referenceText, references, pandoc } from '../cite.js';
import { bodyOf } from '../word.js';
import { crc32 } from '../zip.js';

const darwin = { type: 'book', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859', title: 'On the Origin of Species by Means of Natural Selection', edition: '1st', publisher: 'John Murray' };

test('Chicago in the text: (Darwin 1859, 490), names as Chicago joins them, pages as Chicago shortens them', () => {
  assert.equal(inText(darwin, 'p. 490'), '(Darwin 1859, 490)');
  assert.equal(inText(darwin), '(Darwin 1859)');
  assert.equal(inText({ ...darwin, year: '' }, 'p. xiv'), '(Darwin n.d., xiv)');
  assert.equal(citeNames({ authors: ['Marx, Karl', 'Engels, Friedrich'] }), 'Marx and Engels');
  assert.equal(citeNames({ authors: ['A, a', 'B, b', 'C, c'] }), 'A, B, and C');
  assert.equal(citeNames({ authors: ['A, a', 'B, b', 'C, c', 'D, d'] }), 'A et al.');
  assert.deepEqual(['71-72', '100-104', '101-108', '321-328', '1087-1089', '498-532', '1496-1504'].map((p) => chicagoPages(`pp. ${p}`)),
    ['71–72', '100–104', '101–8', '321–28', '1087–89', '498–532', '1496–1504']);
});

test('Chicago References: books in italic with edition and publisher, articles with journal, volume, issue and pages', () => {
  assert.equal(referenceText(darwin), 'Darwin, Charles. 1859. On the Origin of Species by Means of Natural Selection. John Murray.', 'a first edition is not named');
  assert.equal(referenceText({ ...darwin, year: '1872', edition: '6th' }), 'Darwin, Charles. 1872. On the Origin of Species by Means of Natural Selection. 6th ed. John Murray.');
  const art = { type: 'article', authors: ['Gödel, Kurt', 'Wallace, Alfred Russel'], year: '1931', title: 'Über formal unentscheidbare Sätze', container: 'Monatshefte für Mathematik', volume: '38', issue: '1', pages: '173–198', doi: '10.1007/BF01700692' };
  assert.equal(referenceText(art), 'Gödel, Kurt, and Alfred Russel Wallace. 1931. “Über formal unentscheidbare Sätze.” Monatshefte für Mathematik 38 (1): 173–98. https://doi.org/10.1007/BF01700692.');
  const sorted = references([{ ...darwin, authors: ['Mill, John Stuart'] }, darwin, { ...darwin, year: '1858' }]);
  assert.deepEqual(sorted.map((s) => `${s.authors[0]} ${s.year}`), ['Darwin, Charles 1858', 'Darwin, Charles 1859', 'Mill, John Stuart 1859']);
  assert.equal(pandoc(darwin, 'p. 490'), '[@darwin1859origin, p. 490]');
});

test('the Word document: a heading a source, quotes cited in Chicago, References at the end', () => {
  const marks = {
    s: { id: 's', kind: 'group', of: 'reading-source', ...darwin },
    q: { id: 'q', kind: 'line', text: '"There is grandeur."' },
    c: { id: 'c', kind: 'line', text: 'A comment <with> & marks.' },
  };
  const R = {
    marks: { get: (id) => marks[id] || null, in: () => Object.values(marks) },
    links: { members: (id) => (id === 's' ? ['q', 'c'] : []), holders: (id) => (id === 'q' || id === 'c' ? ['s'] : []),
      from: (m, k) => (m === 'q' && k === 'reading quote' ? [{ id: 'L', from: 'q', to: 's', kind: k, label: 'p. 490' }] : m === 'c' && k === 'reading comment' ? [{ id: 'C', from: 'c', to: 'q', kind: k }] : []),
      to: () => [] },
  };
  const xml = bodyOf(R, 'r', 'My library').join('');
  assert.ok(xml.includes('w:val="Title"') && xml.includes('My library'));
  assert.ok(xml.includes('w:val="Heading1"'));
  assert.ok(xml.includes(' (Darwin 1859, 490)'), 'the quote cited');
  assert.ok(xml.includes('w:val="Comment"') && xml.includes('&lt;with&gt; &amp; marks'), 'the comment under it, escaped');
  assert.ok(xml.indexOf('References') > xml.indexOf('Darwin 1859, 490'));
  assert.ok(xml.includes('<w:i/></w:rPr><w:t xml:space="preserve">On the Origin'), 'the book\'s title in italic');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
