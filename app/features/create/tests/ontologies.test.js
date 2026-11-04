// Tests for the ontologies: each has the parts it needs, and the registry keeps only whole ones.

import { test, assert } from 'folio/testing';
import { BUILT_IN, gather, missing, FALLBACK } from '../ontologies/index.js';
import { membership, emptyWorld, create, groupOf, MESSY } from '../model.js';

test('every built-in ontology has the parts it needs', () => {
  for (const o of BUILT_IN) assert.deepEqual(missing(o), [], o.id);
  assert.deepEqual(BUILT_IN.map((o) => o.id), ['joyce', 'pessoa']);
  assert.ok(BUILT_IN.some((o) => o.id === FALLBACK));
  const joyce = BUILT_IN.find((o) => o.id === 'joyce');
  assert.equal(typeof joyce.draw, 'function'); // Joyce draws its own canvas
  assert.equal(joyce.settings.find((s) => s.key === 'tension').default, 0.5);
});

test('ontologies from other features join the built-in ones; broken or repeated ones are skipped', () => {
  const extra = {
    id: 'sets', name: 'Perec', note: 'named sets', order: 30, groups: { form: 'set', name: 'Set', membership: 'many' },
    units: () => [], point: () => null, drop: () => {},
  };
  const skipped = [];
  const all = gather([extra, { id: 'half', name: 'Half' }, { ...BUILT_IN[0] }], (o, lacks) => skipped.push([o.id, lacks]));
  assert.deepEqual(all.map((o) => o.id), ['joyce', 'pessoa', 'sets']);
  assert.deepEqual(skipped, [['half', ['note', 'units', 'point', 'drop']]]);
  assert.equal(membership('sets'), 'many');
  assert.equal(membership('joyce'), 'one');
});

test('moves must have a label and a run; begin must be a function', () => {
  const base = { id: 'x', name: 'X', note: 'n', units: () => [], point: () => null, drop: () => {} };
  assert.deepEqual(missing({ ...base, moves: [{ label: 'Go', run: () => {} }], begin: () => null }), []);
  assert.deepEqual(missing({ ...base, moves: [{ label: 'Go' }] }), ['moves']);
  assert.deepEqual(missing({ ...base, begin: 'soon' }), ['begin']);
});

test('Joyce: a thought in no train waits in the tray, and dragged out it starts a train there', () => {
  const joyce = BUILT_IN.find((o) => o.id === 'joyce');
  const w = emptyWorld(1);
  const t = create(w, MESSY, { kind: 'group', of: 'joyce', x: 0, y: 0 }, 2);
  const kept = create(w, t.id, { kind: 'line', text: 'in a train' }, 3);
  const loose = create(w, MESSY, { kind: 'line', text: 'loose' }, 4);
  assert.deepEqual(joyce.tray(w, MESSY).map((th) => th.id), [loose.id]);
  assert.ok(joyce.placed(w, MESSY, kept.id));
  assert.ok(!joyce.placed(w, MESSY, loose.id));
  joyce.drop(w, MESSY, loose.id, 400, 120);
  assert.deepEqual(joyce.tray(w, MESSY), []);
  const train = groupOf(w, loose.id, 'joyce');
  assert.ok(train && train.id !== t.id);
  assert.deepEqual({ x: train.x, y: train.y }, { x: 400, y: 120 });
});
