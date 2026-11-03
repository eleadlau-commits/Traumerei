// Tests for the ontologies: each has the parts it needs, and the registry keeps only whole ones.

import { test, assert } from 'folio/testing';
import { BUILT_IN, gather, missing, FALLBACK } from '../ontologies/index.js';
import { membership } from '../model.js';

test('every built-in ontology has the parts it needs', () => {
  for (const o of BUILT_IN) assert.deepEqual(missing(o), [], o.id);
  assert.deepEqual(BUILT_IN.map((o) => o.id), ['joyce', 'pessoa']);
  assert.ok(BUILT_IN.some((o) => o.id === FALLBACK));
  const joyce = BUILT_IN.find((o) => o.id === 'joyce');
  assert.equal(typeof joyce.draw, 'function'); // Joyce draws its own canvas and has Timeline
  assert.equal(joyce.panel.key, 'timeline');
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
