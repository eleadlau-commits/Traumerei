// Tests for Reading notes' plain functions: rules.js (sources, citation keys, the Library rule's
// layout and landing), docks.js (what a field's words do to a source) and view.js / compat.js
// (the fallback helpers' arithmetic).

import { test, assert } from 'folio/testing';
import { tidySource, familyName, autoKey, uniqueKey, validKey, sourcesIn, notesOf, sourceOf, authorYear, layout, landing, libraryTraum, columnX, COLUMN, RULE,
  QUOTE, COMMENT, EDITION, parseQuote, anchorOf, pageOf, streamOf, blockOf, dropAt, isQuote, aboutOf, editionOf } from '../rules.js';
import { editFor, followsAuto, shown } from '../docks.js';
import { setsFor, viewFromTransform, between, moveMs } from '../view.js';
import { roomMode, fileHandles, viewGet } from '../compat.js';

// A library of two sources (b sorts before a by key) and a loose thought.
function reads({ draft = null, links = [], extra = {}, parts: more = {} } = {}) {
  const marks = {
    r: { id: 'r', kind: 'room', name: 'Library', mode: RULE },
    a: { id: 'a', kind: 'group', of: 'reading-source', title: 'Walden', citekey: 'thoreau1854walden', authors: ['Thoreau, Henry David'], year: '1854', at: 1 },
    b: { id: 'b', kind: 'group', of: 'reading-source', title: 'Origin', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859', at: 2 },
    n1: { id: 'n1', kind: 'line', text: 'one', at: 3 },
    n2: { id: 'n2', kind: 'line', text: 'two two two', at: 4 },
    n3: { id: 'n3', kind: 'line', text: 'three', at: 5 },
    x: { id: 'x', kind: 'line', text: 'loose', at: 6 },
    ...extra,
  };
  const parts = { a: ['n3'], b: ['n1', 'n2'], ...more };
  const holders = {};
  for (const [g, ids] of Object.entries(parts)) for (const id of ids) (holders[id] ||= []).push(g);
  return {
    marks: { get: (id) => marks[id] || null, text: (id) => marks[id]?.text || '', in: () => Object.values(marks).filter((m) => m.kind !== 'room'), draft: () => draft },
    links: {
      members: (id) => parts[id] || [], holders: (id) => holders[id] || [],
      from: (m, k = null) => links.filter((l) => l.from === m && (!k || l.kind === k)),
      to: (m, k = null) => links.filter((l) => l.to === m && (!k || l.kind === k)),
    },
  };
}
const measure = (text) => ({ lines: 1, lineHeight: 30, height: 30 * Math.ceil(String(text).length / 10) });

test('a source tidies its own fields: authors a list, the year its digits, empty ones dropped', () => {
  const g = tidySource({ id: 'g', type: 'novel', authors: ' Darwin, Charles \n\n Wallace, Alfred ', year: 'c. 1859', citekey: ' darwin 1859 ', doi: '  ', container: ' Nature ' });
  assert.equal(g.type, 'book');
  assert.deepEqual(g.authors, ['Darwin, Charles', 'Wallace, Alfred']);
  assert.equal(g.year, '1859');
  assert.equal(g.citekey, 'darwin1859');
  assert.equal(g.doi, null);
  assert.equal(g.container, 'Nature');
  assert.equal(tidySource({}).authors, null);
});

test('citation keys: family name, year, first title word that is not an article', () => {
  assert.equal(familyName('Darwin, Charles'), 'Darwin');
  assert.equal(familyName('Mary Wollstonecraft'), 'Wollstonecraft');
  assert.equal(autoKey({ authors: ['Darwin, Charles'], year: '1859', title: 'On the Origin of Species' }), 'darwin1859origin');
  assert.equal(autoKey({ authors: ['Gödel, Kurt'], year: '1931', title: 'Über formal unentscheidbare Sätze' }), 'godel1931uber');
  assert.equal(autoKey({ title: 'The Untitled' }), 'anonnduntitled');
  assert.equal(autoKey({}), 'anonnd');
});

test('a key already taken gets a, b, … z, aa', () => {
  assert.equal(uniqueKey('k', new Set()), 'k');
  assert.equal(uniqueKey('k', new Set(['k'])), 'ka');
  assert.equal(uniqueKey('k', new Set(['k', 'ka', 'kb'])), 'kc');
  const all = new Set(['k', ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `k${c}`)]);
  assert.equal(uniqueKey('k', all), 'kaa');
  assert.ok(validKey('darwin1859:origin_2-a.b'));
  assert.ok(!validKey('darwin 1859'));
  assert.ok(!validKey(''));
});

test('sources by key; notes in stream order; a note knows its source', () => {
  const r = reads();
  assert.deepEqual(sourcesIn(r, 'r').map((s) => s.id), ['b', 'a']);
  assert.deepEqual(notesOf(r, 'b'), ['n1', 'n2']);
  assert.equal(sourceOf(r, 'n3'), 'a');
  assert.equal(sourceOf(r, 'x'), null);
  assert.equal(authorYear({ authors: ['Darwin, Charles'], year: '1859' }), 'Darwin 1859');
  assert.equal(authorYear({ authors: ['Marx, Karl', 'Engels, Friedrich'], year: '1848' }), 'Marx and Engels 1848');
  assert.equal(authorYear({ authors: ['A', 'B', 'C'] }), 'A et al. n.d.');
});

test('the Library rule lays each source as a column of its notes, side by side, thoughts in no source in Unfiled', () => {
  const lay = layout(reads(), 'r', measure);
  assert.deepEqual(lay.columns.map((c) => c.source), ['b', 'a', null], 'and Unfiled last');
  assert.equal(lay.columns[1].x, columnX(1));
  assert.deepEqual(lay.rows.map((row) => row.mark), ['n1', 'n2', 'n3', 'x'], 'every thought placed');
  const [r1, r2] = lay.rows;
  assert.equal(r1.x, COLUMN.gutter / 2, 'a gutter at the left for the pages');
  assert.equal(r1.width, COLUMN.width - COLUMN.gutter);
  assert.equal(r1.align, 'start');
  assert.ok(r2.y - r2.height / 2 >= r1.y + r1.height / 2 + COLUMN.space - 1e-6, 'one under another, with air');
  assert.equal(lay.rows.find((row) => row.mark === 'x').x, columnX(2), 'a thought in no source: in Unfiled');
  const heads = lay.boxes.filter((b) => b.style === 'heading');
  assert.deepEqual(heads.map((b) => b.label), ['Origin', 'Walden', 'Unfiled']);
  assert.equal(heads[0].note, 'Darwin 1859 · darwin1859origin');
});

test('a source with no notes says so; the draft after a note opens room under it', () => {
  const r = reads();
  const empty = { ...r, links: { ...r.links, members: (id) => (id === 'a' ? [] : r.links.members(id)) } };
  assert.ok(layout(empty, 'r', measure).boxes.some((b) => b.style === 'quiet' && /No notes yet/.test(b.note)));
  const plain = layout(reads(), 'r', measure).rows.find((row) => row.mark === 'n2').y;
  const drafted = layout(reads({ draft: { text: 'new', after: 'n1', height: 60 } }), 'r', measure).rows.find((row) => row.mark === 'n2').y;
  assert.ok(drafted >= plain + 60, 'the next note moves down');
});

test('Enter lands a note after the chosen one in the open source, else at the end of the open source', () => {
  const r = reads();
  const lay = layout(r, 'r', measure);
  const n1 = lay.rows.find((row) => row.mark === 'n1');
  assert.deepEqual(landing(r, 'r', 'new', n1.x, n1.y, 'b', lay), { join: 'b', at: 1 }, 'right after n1');
  assert.deepEqual(landing(r, 'r', 'new', n1.x, n1.y, null, lay), { join: 'b', at: 1 }, 'no open source known: after n1 still');
  assert.deepEqual(landing(r, 'r', 'new', n1.x, n1.y, 'a', lay), { join: 'a', at: 1 }, 'written after a note of another source: the open one\'s end');
  assert.deepEqual(landing(r, 'r', 'new', 0, 9999, 'b', lay), { join: 'b', at: 2 }, 'nothing under it: the end of the open source');
  assert.deepEqual(landing(r, 'r', 'new', columnX(1) + 30, 9999, null, lay), { join: 'a', at: 1 }, 'no open source: the column under x');
  assert.equal(landing(r, 'r', 'new', columnX(2), 9999, null, lay), null, 'under Unfiled: in no source');
  assert.equal(landing({ ...r, marks: { ...r.marks, in: () => [] } }, 'r', 'new', 0, 0, null, { rows: [], columns: [] }), null);
});

test('a new library is a traum/3 text of one room seen as Library', () => {
  const text = libraryTraum('My: Library\n');
  assert.match(text, /^---\nformat: traum\/3\ncontext: \^1\n---/);
  assert.match(text, /## \^1 room: My: Library\nmode: reading-library\n/);
});

test('Details: a field\'s words as an edit, a key kept unique and valid, an auto key following the source', () => {
  const src = { id: 'b', title: 'Origin', citekey: 'darwin1859origin', authors: ['Darwin, Charles'], year: '1859' };
  const taken = new Set(['thoreau1854walden']);
  assert.equal(shown(src, 'authors'), 'Darwin, Charles');
  assert.equal(editFor(src, 'title', 'Origin', taken), null, 'nothing changed');
  assert.ok(followsAuto(src, taken));
  assert.deepEqual(editFor(src, 'year', '1860', taken).fields, { year: '1860', citekey: 'darwin1860origin' });
  assert.deepEqual(editFor(src, 'title', 'The Descent\nof Man', taken).fields, { title: 'The Descent of Man', citekey: 'darwin1859descent' });
  assert.deepEqual(editFor(src, 'authors', 'Thoreau, Henry\nX', new Set(['thoreau1859origin'])).fields, { authors: ['Thoreau, Henry', 'X'], citekey: 'thoreau1859origina' });
  const typed = { ...src, citekey: 'origin' };
  assert.ok(!followsAuto(typed, taken));
  assert.deepEqual(editFor(typed, 'year', '1860', taken).fields, { year: '1860' }, 'a typed key stays');
  assert.match(editFor(src, 'citekey', 'thoreau1854walden', taken).reason, /Another source/);
  assert.match(editFor(src, 'citekey', 'two words', taken).reason, /letters, digits/);
  assert.match(editFor(src, 'citekey', ' ', taken).reason, /needs a citation key/);
  assert.deepEqual(editFor(src, 'doi', '', taken), null, 'still empty');
  assert.deepEqual(editFor({ ...src, doi: '10.1/x' }, 'doi', '', taken).fields, { doi: null }, 'emptied: taken off');
  assert.deepEqual(editFor(src, 'title', '  ', taken).fields.title, 'Untitled');
});

test('a smooth jump: the zoom calls that land the view where asked, at the same zoom too', () => {
  const at = (V, z0, s) => ({ x: s.at.x + (V.x - s.at.x) * z0 / s.zoom, y: s.at.y + (V.y - s.at.y) * z0 / s.zoom });
  const a = { x: 0, y: 0, zoom: 1 }, b = { x: 780, y: 300, zoom: 1 };
  const steps = setsFor(a, b);
  let V = { x: a.x, y: a.y }, z = a.zoom;
  for (const s of steps) { V = at(V, z, s); z = s.zoom; }
  assert.ok(Math.abs(V.x - b.x) < 1e-6 && Math.abs(V.y - b.y) < 1e-6 && z === 1);
  assert.deepEqual(setsFor(a, a), []);
  assert.deepEqual(between(a, b, 0.5), { x: 390, y: 150, zoom: 1 });
  assert.ok(moveMs(a, b) >= 260 && moveMs(a, b) <= 520);
  assert.deepEqual(viewFromTransform('translate(100px, 50px) scale(2)', 800, 600, 2), { x: 150, y: 125, zoom: 2 });
  assert.equal(viewFromTransform('translate(100px, 50px) scale(2)', 800, 600, 1), null, 'a zoom that disagrees: not read');
});

test('fallback helpers: the new API when the app has it, the workaround when not', async () => {
  const room = (c) => ({ ui: { chosen: () => c }, marks: { get: () => ({ mode: 'joyce' }) } });
  assert.deepEqual(roomMode(room({ context: 'r', mode: RULE })), { room: 'r', mode: RULE }, 'the app says the mode');
  assert.deepEqual(roomMode(room({ context: 'r' })), { room: 'r', mode: 'joyce' }, 'else read off the room');
  assert.equal(roomMode(room(null)), null);
  assert.deepEqual(viewGet({ ui: { zoom: { get: () => ({ zoom: 1.5, x: 10, y: 20 }) } } }), { x: 10, y: 20, zoom: 1.5 }, 'ui.zoom.get with x, y');
  assert.equal(viewGet({ ui: { zoom: { get: () => ({ zoom: 1 }) } } }), null, 'no screen to read here');
  const plain = fileHandles({ ui: { files: { open: async () => null } } });
  assert.equal(plain.native, false);
  assert.equal(await plain.show('/x.pdf', 3), false, 'without the core addition: the caller copies path and page');
  assert.equal(await plain.hash('/x.pdf'), null, 'without it: pick the file again');
  const asked = [];
  const native = fileHandles({ ui: { files: { show: async (p, o) => { asked.push([p, o]); return { ok: true }; }, hash: async () => ({ sha256: 'ab', bytes: 2 }) } } });
  assert.ok(native.native);
  assert.equal(await native.show('/x.pdf', 130), true);
  assert.deepEqual(asked, [['/x.pdf', { page: 130 }]]);
  assert.deepEqual(await native.hash('/x.pdf'), { sha256: 'ab', bytes: 2 });
});

// ---- 0.2: quotes, comments, editions ----

test('a quote is words begun with a quotation mark or "> ", its page typed at the end', () => {
  assert.deepEqual(parseQuote('"There is grandeur in this view of life." p. 490'), { text: '"There is grandeur in this view of life."', anchor: 'p. 490' });
  assert.deepEqual(parseQuote('“Liberty” (pp. 12-14)'), { text: '“Liberty”', anchor: 'pp. 12–14' });
  assert.deepEqual(parseQuote('"Preface" @xiv'), { text: '"Preface"', anchor: 'p. xiv' });
  assert.deepEqual(parseQuote('> I went to the woods, p. 90'), { text: 'I went to the woods', anchor: 'p. 90' });
  assert.deepEqual(parseQuote('"no page"'), { text: '"no page"', anchor: '' });
  assert.equal(parseQuote('Compare p. 40'), null, 'a comment that ends in a page stays a comment');
  assert.deepEqual(parseQuote('Compare p. 40', true), { text: 'Compare', anchor: 'p. 40' }, 'Alt+Q makes it a quote');
  assert.equal(parseQuote('> '), null);
  assert.equal(anchorOf('012', '012'), 'p. 12');
  assert.equal(pageOf('pp. 112–113'), '112');
  assert.equal(pageOf('p. xiv'), 'xiv');
});

// Source b: q1 (a quote, p. 12), c1 (a comment on it), n2; c2 a comment on q1 kept later in the stream.
function quoted() {
  return reads({
    extra: { q1: { id: 'q1', kind: 'line', text: '"quoted"', at: 7 }, c1: { id: 'c1', kind: 'line', text: 'on it', at: 8 }, c2: { id: 'c2', kind: 'line', text: 'more on it', at: 9 } },
    parts: { b: ['q1', 'n2', 'c1', 'c2'], a: ['n3'] },
    links: [
      { id: 'L1', from: 'q1', to: 'b', kind: QUOTE, label: 'p. 12' },
      { id: 'L2', from: 'c1', to: 'q1', kind: COMMENT },
      { id: 'L3', from: 'c2', to: 'q1', kind: COMMENT },
    ],
  });
}

test('a quote\'s comments sit under it, indented, its page in the margin at its left', () => {
  const R = quoted();
  assert.ok(isQuote(R, 'q1') && !isQuote(R, 'c1'));
  assert.equal(aboutOf(R, 'c1'), 'q1');
  assert.deepEqual(streamOf(R, 'b'), [{ id: 'q1', under: null }, { id: 'c1', under: 'q1' }, { id: 'c2', under: 'q1' }, { id: 'n2', under: null }]);
  assert.deepEqual(blockOf(R, 'q1'), ['q1', 'c1', 'c2']);
  const L = layout(R, 'r', measure);
  const row = (id) => L.rows.find((r) => r.mark === id);
  assert.equal(row('c1').width, COLUMN.width - COLUMN.gutter - COLUMN.indent);
  assert.ok(row('c1').x > row('q1').x, 'indented');
  assert.ok(row('q1').y < row('c1').y && row('c1').y < row('c2').y && row('c2').y < row('n2').y);
  const page = L.boxes.find((b) => b.label === 'p. 12');
  assert.ok(page && page.x + page.w <= row('q1').x - row('q1').width / 2, 'the page stands in the gutter, left of the words');
  const col = L.columns.find((c) => c.source === 'b');
  assert.deepEqual(col.units.map((u) => u.ids), [['q1', 'c1', 'c2'], ['n2']]);
});

test('let go between blocks a note stands there; among a quote\'s comments it goes under the quote', () => {
  const R = quoted();
  const L = layout(R, 'r', measure);
  const col = L.columns.find((c) => c.source === 'b');
  const [q, n] = col.units;
  // Above the quote: before it.
  assert.deepEqual(dropAt(R, 'r', 'n3', col.x, q.top - 5, L), { source: 'b', under: null, before: 'q1' });
  // Among its comments (the middle of c2's row less a little): under q1, before c2.
  const c2 = L.rows.find((r) => r.mark === 'c2');
  assert.deepEqual(dropAt(R, 'r', 'n3', col.x, c2.y - 2, L), { source: 'b', under: 'q1', before: 'c2' });
  // A quote is never put under a quote: after its block.
  assert.deepEqual(dropAt(R, 'r', 'q1', col.x, n.top + 40, L).under, null);
  // Under the last block: at the end.
  assert.deepEqual(dropAt(R, 'r', 'n3', col.x, col.bottom + 300, L), { source: 'b', under: null, before: null });
  // Far off any column: nothing.
  assert.equal(dropAt(R, 'r', 'n3', col.x + 5000, 0, L), null);
});

test('an edition comes right after the source it is an edition of, in the list and the columns', () => {
  const R = reads({
    extra: { e: { id: 'e', kind: 'group', of: 'reading-source', title: 'Origin', citekey: 'darwin1872origin', authors: ['Darwin, Charles'], year: '1872', edition: '6th', at: 9 } },
    links: [{ id: 'E1', from: 'e', to: 'b', kind: EDITION }],
  });
  assert.equal(editionOf(R, 'e'), 'b');
  assert.deepEqual(sourcesIn(R, 'r').map((s) => s.id), ['b', 'e', 'a']);
  const L = layout(R, 'r', measure);
  assert.deepEqual(L.columns.map((c) => c.source), ['b', 'e', 'a', null]);
  assert.ok(L.boxes.find((b) => b.label === 'Origin' && /6th ed\. · edition of darwin1859origin/.test(b.note)));
});
