// Tests for relations.js: arrows and their relations, shared by any ontology that joins its groups.

import { test, assert } from 'folio/testing';
import { emptyWorld, create, MESSY, groupsIn, members, isGroup, setRoomSetting, own } from '../model.js';
import * as L from '../links.js';
import {
  arrowsOf, relationName, splitList, listText, cleanRelations, relationShown, withRelation,
  relationEntry, cleanRelationList, relationEnds, relationLooks, entryText, RELATIONS,
} from '../ontologies/relations.js';

test('relation names: any words or signs, or none; [[ ]] refused', () => {
  assert.equal(relationName('  is   a case\nof '), 'is a case of');
  assert.equal(relationName('⊂'), '⊂');
  assert.equal(relationName('→ (up to ≅)'), '→ (up to ≅)');
  assert.equal(relationName(''), '');
  assert.equal(relationName('see [[A]]'), null);
});

test('lists: commas split, quotes keep a comma, written back the same', () => {
  assert.deepEqual(splitList('[forgets, "less, or equal", ⊂]'), ['forgets', 'less, or equal', '⊂']);
  const names = cleanRelations('forgets, "less, or equal", ⊂, Forgets, , is a case of');
  assert.deepEqual(names, ['forgets', 'less, or equal', '⊂', 'is a case of']);
  assert.equal(listText(names), 'forgets, "less, or equal", ⊂, is a case of');
  assert.deepEqual(cleanRelations(listText(names)), names);
  assert.deepEqual(withRelation(names, ' ≅ '), [...names, '≅']);
  assert.deepEqual(withRelation(names, 'FORGETS'), names);
  assert.deepEqual(withRelation(names, ''), names);
});

test('shown beside a label: not when unnamed, nor when it is the room\'s only one', () => {
  assert.equal(relationShown(['forgets'], 'forgets'), '');
  assert.equal(relationShown(['forgets'], ''), '');
  assert.equal(relationShown(['forgets'], '⊂'), '⊂');
  assert.equal(relationShown(['forgets', '⊂'], 'forgets'), 'forgets');
});

// A made-up ontology whose groups are nodes and that allows loops, as a network would.
const OF = 'net';
const net = arrowsOf({
  of: OF, word: 'node', loops: true,
  isNode: (w, roomId, id) => isGroup(w.things[id]) && w.things[id].of === OF,
  nodes: (w, roomId) => groupsIn(w, roomId, OF).filter((g) => members(w, g.id).length),
});
let clock = 10;
const node = (w) => {
  const g = create(w, MESSY, { kind: 'group', of: OF }, clock++);
  create(w, g.id, { kind: 'line', text: 'x' }, clock++);
  return g.id;
};

test('an ontology that allows loops: an arrow back up is drawn; itself and twice still refused', () => {
  const w = emptyWorld(1);
  const a = node(w), b = node(w), c = node(w);
  assert.equal(net.link(w, MESSY, a, b), '');
  assert.equal(net.link(w, MESSY, b, c), '');
  assert.equal(net.link(w, MESSY, c, a, 'closes it', ''), '');
  assert.match(net.link(w, MESSY, a, a), /node can't be its own parent/);
  assert.match(net.link(w, MESSY, a, b), /already/);
  assert.deepEqual(net.arrows(w, MESSY), [
    { from: c, to: a, label: 'closes it', rel: '' },
    { from: a, to: b, label: '', rel: 'forgets' },
    { from: b, to: c, label: '', rel: 'forgets' },
  ]);
});

test('a new arrow gets the room\'s first relation, or the one it is given', () => {
  const w = emptyWorld(1);
  setRoomSetting(w, MESSY, OF, 'relations', ['⊂', 'is a case of']);
  const a = node(w), b = node(w), c = node(w);
  net.link(w, MESSY, a, b);
  net.link(w, MESSY, a, c, '', 'is a case of');
  assert.equal(net.relationOf(w, MESSY, a, b), '⊂');
  assert.equal(net.relationOf(w, MESSY, a, c), 'is a case of');
  // Renamed in place in the room's list: its arrows follow.
  assert.equal(net.renameRelations(w, MESSY, ['⊂', 'is a case of'], ['⊆', 'is a case of']), 1);
  assert.equal(net.relationOf(w, MESSY, a, b), '⊆');
});

test('a relation may carry its ends as a mark after its name', () => {
  assert.deepEqual(relationEntry('leads to ->'), { name: 'leads to', ends: 'arrow', line: null, colour: null });
  assert.deepEqual(relationEntry('is equivalent to <->'), { name: 'is equivalent to', ends: 'both', line: null, colour: null });
  assert.deepEqual(relationEntry('near  --'), { name: 'near', ends: 'none', line: null, colour: null });
  assert.deepEqual(relationEntry('forgets'), { name: 'forgets', ends: null, line: null, colour: null });
  assert.deepEqual(cleanRelationList('a ->, A, b<->,  c'), ['a ->', 'b <->', 'c']);
  assert.deepEqual(cleanRelations('a ->, b <->, c'), ['a', 'b', 'c']);
  assert.deepEqual(cleanRelations('', ['related to']), ['related to']);
  assert.deepEqual(relationEnds(['a ->', 'b <->', 'c'], 'none'), { a: 'arrow', b: 'both', c: 'none' });
  assert.deepEqual(withRelation(['a ->', 'b'], 'c'), ['a ->', 'b', 'c']); // the others keep their marks
  assert.deepEqual(withRelation(['a ->', 'b'], 'A'), ['a ->', 'b']);
});

test('arrowsOf can keep its arrows apart, read its own setting, and refuse in its own words', () => {
  const w = emptyWorld(1);
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 2), b = create(w, MESSY, { kind: 'line', text: 'b' }, 3);
  const setting = { ...RELATIONS, key: 'relations', default: ['related to', 'leads to ->'] };
  const net = arrowsOf({ of: 'web', store: 'web-links', setting, isNode: (x, r, id) => !!x.things[id], nodes: (x, r) => [a, b], loops: true, words: { self: 'Not to itself.' } });
  assert.deepEqual(net.relations(w, MESSY), ['related to', 'leads to']);
  assert.equal(net.link(w, MESSY, a.id, b.id), '');
  assert.equal(net.relationOf(w, MESSY, a.id, b.id), 'related to');
  assert.deepEqual(L.get(w, L.relId('web-links', b.id, a.id)), { id: `rel:web-links:${b.id}:${a.id}`, from: b.id, to: a.id, kind: 'relation', rule: 'web-links', label: 'related to' }); // a row of the links table, under its store
  assert.deepEqual(L.ofRule(w, 'web'), []);
  assert.equal(net.link(w, MESSY, a.id, a.id), 'Not to itself.');
  assert.equal(net.link(w, MESSY, b.id, a.id), ''); // loops allowed
});

test('a relation may carry its look after a |: its line and its colour; plain ones are left out', () => {
  assert.deepEqual(relationEntry('calls up -> | dashed amber'), { name: 'calls up', ends: 'arrow', line: 'dashed', colour: 'amber' });
  assert.deepEqual(relationEntry('near | rust'), { name: 'near', ends: null, line: null, colour: 'rust' });
  assert.deepEqual(relationEntry('near | solid ink wobbly'), { name: 'near', ends: null, line: null, colour: null });
  assert.equal(entryText({ name: 'calls up', ends: 'arrow', line: 'dotted', colour: 'slate' }), 'calls up -> | dotted slate');
  assert.equal(entryText({ name: 'calls up', ends: 'arrow', line: 'dotted', colour: null }, false), 'calls up | dotted');
  assert.deepEqual(cleanRelationList(['a -> | dashed', 'b | plum', 'A']), ['a -> | dashed', 'b | plum']);
  assert.deepEqual(relationLooks(['a -> | dashed', 'b']), { a: { line: 'dashed', colour: null }, b: { line: null, colour: null } });
  assert.equal(relationName('a | b'), null); // | parts a line from its look, so no name holds one
});

test('renaming follows only true renames: a list put in another order renames nothing', () => {
  const w = emptyWorld(1);
  const net = arrowsOf({ of: 'russell', isNode: () => true, nodes: () => [], loops: true });
  for (const id of ['x', 'y', 'z']) w.things[id] = { id, kind: 'group', of: 'russell', parent: MESSY, at: 1 };
  L.set(w, L.relId('russell', 'x', 'y'), { from: 'x', to: 'y', kind: 'relation', rule: 'russell', label: 'forgets' });
  L.set(w, L.relId('russell', 'x', 'z'), { from: 'x', to: 'z', kind: 'relation', rule: 'russell', label: 'is a case of' });
  const rel = (p) => L.get(w, L.relId('russell', 'x', p)).label || '';
  assert.equal(net.renameRelations(w, MESSY, ['forgets', 'is a case of'], ['is a case of', 'forgets']), 0);
  assert.deepEqual([rel('y'), rel('z')], ['forgets', 'is a case of']);
  assert.equal(net.renameRelations(w, MESSY, ['forgets', 'is a case of'], ['omits', 'is a case of']), 1);
  assert.equal(rel('y'), 'omits');
  assert.equal(net.uses(w, MESSY, 'is a case of'), 1);
  assert.equal(net.retag(w, MESSY, 'is a case of', ''), 1);
  assert.equal(rel('z'), '');
});
