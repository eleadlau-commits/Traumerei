// Tests for Reading notes' collections (collections.js) and the board of Library · blocks
// (rules.js layout with `across`), on a small fake of the read half of the tables.

import { test, assert } from 'folio/testing';
import { collectionTree, collectionParent, collectionDepth, collectionLevels, collectionHolds, sourcesUnder, collectionsOf, collectionLanding, zoneOf, COLLECTION } from '../collections.js';
import { layout, columnAt, dropAt, acrossOf, BLOCK, RULE } from '../rules.js';

// A library: sources a, b, c; collections A (holding a and B), B (holding b), C (holding a, c).
function reads() {
  const marks = {
    r: { id: 'r', kind: 'room', mode: RULE },
    a: { id: 'a', kind: 'group', of: 'reading-source', title: 'Alpha', citekey: 'a', at: 1 },
    b: { id: 'b', kind: 'group', of: 'reading-source', title: 'Beta', citekey: 'b', at: 2 },
    c: { id: 'c', kind: 'group', of: 'reading-source', title: 'Gamma', citekey: 'c', at: 3 },
    A: { id: 'A', kind: 'group', of: COLLECTION, title: 'Zoology' },
    B: { id: 'B', kind: 'group', of: COLLECTION, title: 'birds' },
    C: { id: 'C', kind: 'group', of: COLLECTION, title: 'Art' },
    n1: { id: 'n1', kind: 'line', text: 'one one one one one one one one' },
    n2: { id: 'n2', kind: 'line', text: 'two' },
    n3: { id: 'n3', kind: 'line', text: 'three three three' },
    n4: { id: 'n4', kind: 'line', text: 'four' },
  };
  const parts = { A: ['a', 'B'], B: ['b'], C: ['a', 'c'], a: ['n1', 'n2'], b: ['n3'], c: ['n4'] };
  const holders = {};
  for (const [g, ids] of Object.entries(parts)) for (const id of ids) (holders[id] ||= []).push(g);
  return {
    marks: { get: (id) => marks[id] || null, text: (id) => marks[id]?.text || '', in: () => Object.values(marks).filter((m) => m.kind !== 'room'), draft: () => null },
    links: { members: (id) => parts[id] || [], holders: (id) => holders[id] || [], from: () => [], to: () => [] },
  };
}
const measure = (text) => ({ lines: 1, lineHeight: 30, height: 30 * Math.ceil(String(text).length / 10) });

test('collections: the tree by name (any case), each with the sources in it and inside it', () => {
  const R = reads();
  assert.deepEqual(collectionTree(R, 'r').map((n) => [n.name, n.depth, n.sources, n.all]), [['Art', 1, 2, 2], ['Zoology', 1, 1, 2], ['birds', 2, 1, 1]]);
  assert.equal(collectionParent(R, 'B'), 'A');
  assert.equal(collectionDepth(R, 'B'), 2);
  assert.equal(collectionLevels(R, 'A'), 2);
  assert.ok(collectionHolds(R, 'A', 'B') && !collectionHolds(R, 'B', 'A'));
  assert.deepEqual(sourcesUnder(R, 'A').sort(), ['a', 'b']);
  assert.deepEqual(collectionsOf(R, 'a'), ['C', 'A']);
});

test('collections: a collection let go on a line goes inside it from the middle, beside it from the edges, never inside itself', () => {
  const R = reads();
  assert.equal(zoneOf(1, 0, 30), 'before');
  assert.equal(zoneOf(15, 0, 30), 'into');
  assert.equal(zoneOf(29, 0, 30), 'after');
  assert.deepEqual(collectionLanding(R, 'C', 'B', 'before'), { parent: 'A' });
  assert.deepEqual(collectionLanding(R, 'C', 'B', 'into'), { parent: 'B' });
  assert.deepEqual(collectionLanding(R, 'B', null, 'into'), { parent: null });
  assert.ok(collectionLanding(R, 'A', 'B', 'into').reason, 'not inside what it holds');
});

test('blocks: blocks across, each under the shortest column so far; a point finds its block', () => {
  const R = reads();
  assert.equal(acrossOf({ across: '2' }), 2);
  assert.equal(acrossOf({ across: '5' }), 0, 'a count not offered: columns');
  assert.equal(acrossOf({ across: '0' }), 0, 'columns');
  assert.equal(acrossOf(null), 0, 'columns by default');
  const L = layout(R, 'r', measure, 2);
  assert.ok(L.blocks);
  assert.deepEqual(L.columns.map((c) => c.source), ['a', 'b', 'c']);
  const [a, b, c] = L.columns;
  assert.ok(a.x < b.x, 'the first two side by side');
  assert.equal(c.x, b.x, 'the third under the shorter (b)');
  assert.ok(c.top > b.bottom + BLOCK.gap);
  assert.equal(L.boxes.filter((x) => x.style === 'plain').length, 3, 'a frame each');
  assert.equal(columnAt(L, a.x, a.top + 10), a);
  assert.equal(columnAt(L, (a.x + b.x) / 2, -500), null);
  assert.deepEqual(dropAt(R, 'r', 'n4', a.x, a.bottom - 1, L), { source: 'a', under: null, before: null });
});
