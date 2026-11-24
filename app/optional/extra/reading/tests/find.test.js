// Tests for Reading notes' tags and finding (find.js): #tags read from words, a query of words and
// #tags across a library's notes and sources.

import { test, assert } from 'folio/testing';
import { tagsIn, tagSpans, parseQuery, find, tagsOf, snippet, fold, TAG } from '../find.js';
import { RULE, QUOTE } from '../rules.js';

test('tags are #words: folded, each once; not inside a word, an address or a link', () => {
  assert.deepEqual(tagsIn('On #Liberty and #harm-principle, again #liberty.'), ['liberty', 'harm-principle']);
  assert.deepEqual(tagsIn('#Évolution first'), ['evolution']);
  assert.deepEqual(tagsIn('no tags: C# and a#b and https://x.org/#top and &#39;'), []);
  assert.deepEqual(tagsIn('#1859 #a_b-'), ['1859', 'a_b']);
  const words = 'see #wonder here';
  assert.deepEqual(tagSpans(words), [{ from: 4, to: 11 }]);
  assert.equal(words.slice(4, 11), '#wonder');
  assert.equal(fold('Çà'), 'ca');
});

test('a query is its words and its #tags', () => {
  assert.deepEqual(parseQuery('Grandeur #wonder life'), { words: ['grandeur', 'life'], tags: ['wonder'] });
  assert.deepEqual(parseQuery('  '), { words: [], tags: [] });
});

function reads() {
  const marks = {
    r: { id: 'r', kind: 'room', mode: RULE },
    s: { id: 's', kind: 'group', of: 'reading-source', title: 'Origin of Species', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859' },
    q: { id: 'q', kind: 'line', text: '"There is grandeur in this view of life."' },
    c: { id: 'c', kind: 'line', text: 'Wonder survives the mechanism. #wonder' },
    n: { id: 'n', kind: 'line', text: 'Another note.' },
    g: { id: 'g', kind: 'group', of: TAG, title: 'wonder' },
    e: { id: 'e', kind: 'group', of: TAG, title: 'empty' },
  };
  const parts = { s: ['q', 'c', 'n'], g: ['c'], e: [] };
  const links = [{ id: 'L', from: 'q', to: 's', kind: QUOTE, label: 'p. 490' }];
  const holders = {};
  for (const [g, ids] of Object.entries(parts)) for (const id of ids) (holders[id] ||= []).push(g);
  return {
    marks: { get: (id) => marks[id] || null, in: () => Object.values(marks).filter((m) => m.kind !== 'room') },
    links: { members: (id) => parts[id] || [], holders: (id) => holders[id] || [],
      from: (m, k) => links.filter((l) => l.from === m && (!k || l.kind === k)), to: (m, k) => links.filter((l) => l.to === m && (!k || l.kind === k)) },
  };
}

test('find: every word in a note (its words, its page or its source\'s key), in every tag asked for', () => {
  const R = reads();
  assert.deepEqual(find(R, 'r', 'grandeur').notes.map((n) => n.note), ['q']);
  assert.equal(find(R, 'r', 'GRANDEUR life').notes[0].anchor, 'p. 490');
  assert.deepEqual(find(R, 'r', '490').notes.map((n) => n.note), ['q'], 'by its page');
  assert.deepEqual(find(R, 'r', '#wonder').notes.map((n) => n.note), ['c']);
  assert.deepEqual(find(R, 'r', '#wonder grandeur').notes, [], 'every word and every tag');
  assert.deepEqual(find(R, 'r', '#nosuch').notes, []);
  assert.deepEqual(find(R, 'r', 'darwin').sources.map((s) => s.source), ['s'], 'a source by its author');
  assert.equal(find(R, 'r', 'darwin').notes.length, 3, 'and its notes by its key');
  assert.deepEqual(find(R, 'r', '').notes, []);
  assert.deepEqual(tagsOf(R, 'r'), [{ id: 'g', word: 'wonder', notes: 1 }], 'a tag holding nothing is not listed');
});

test('a result shows a piece of the note around the word found', () => {
  const long = `${'a '.repeat(80)}needle ${'b '.repeat(80)}`;
  const s = snippet(long, ['needle'], 40);
  assert.ok(s.includes('needle') && s.startsWith('…') && s.endsWith('…') && s.length <= 42);
  assert.equal(snippet('short', ['x']), 'short');
});
