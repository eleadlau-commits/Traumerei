// Tests for relations.js: arrows and their relations, shared by any ontology that joins its groups.

import { test, assert } from 'folio/testing';
import { emptyWorld, create, MESSY, groupsIn, members, isGroup, setRoomSetting, own } from '../model.js';
import {
  arrowsOf, relationName, splitList, listText, cleanRelations, relationShown, withRelation,
  relationEntry, cleanRelationList, relationEnds, RELATIONS,
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
  assert.deepEqual(relationEntry('leads to ->'), { name: 'leads to', ends: 'arrow' });
  assert.deepEqual(relationEntry('is equivalent to <->'), { name: 'is equivalent to', ends: 'both' });
  assert.deepEqual(relationEntry('near  --'), { name: 'near', ends: 'none' });
  assert.deepEqual(relationEntry('forgets'), { name: 'forgets', ends: null });
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
  assert.ok(own(w, MESSY, 'web-links')[b.id]);
  assert.equal(own(w, MESSY, 'web', false)[b.id], undefined);
  assert.equal(net.link(w, MESSY, a.id, a.id), 'Not to itself.');
  assert.equal(net.link(w, MESSY, b.id, a.id), ''); // loops allowed
});
