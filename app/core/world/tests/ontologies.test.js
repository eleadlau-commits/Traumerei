// Tests for the ontologies: each has the parts it needs, and the registry keeps only whole ones.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import * as libForRussell from '../lib.js';
import { surface as surfaceForRussell } from '../../api/v2.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import { BUILT_IN, gather, missing, FALLBACK, groupChosen, ungroupChosen } from '../ontologies/index.js';
import russell from '../../russell/rules.js';
import { membership, emptyWorld, create, groupOf, MESSY, members, startTrain, addThought } from '../model.js';

test('every built-in ontology has the parts it needs', () => {
  for (const o of BUILT_IN) assert.deepEqual(missing(o), [], o.id);
  assert.deepEqual(BUILT_IN.map((o) => o.id), ['joyce', 'pessoa']); // Russell and Proust are plugins
  assert.deepEqual(missing(russell), []);
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
  assert.deepEqual({ x: model.spotOf(w, train.id).x, y: model.spotOf(w, train.id).y }, { x: 400, y: 120 }); // its rule row
});

test('Russell has the parts it needs, and holds each thought in one chapter', () => {
  assert.deepEqual(missing(russell), []);
  assert.equal(russell.id, 'russell');
  assert.equal(russell.groups.membership, 'one');
  for (const k of ['begin', 'tray', 'placed', 'tag', 'blocks', 'shift', 'measured']) assert.equal(typeof russell[k], 'function', k);
});

test('Ctrl+G: each mode groups what is chosen by its own rule; Ctrl+Shift+G takes it out', () => {
  gather();
  const [joyce, pessoa] = BUILT_IN;
  const w = emptyWorld();
  const t1 = startTrain(w, MESSY, 0, 0), t2 = startTrain(w, MESSY, 400, 0);
  const a = addThought(w, t1.id, 'a', 1), b = addThought(w, t1.id, 'b', 2), c = addThought(w, t2.id, 'c', 3);
  const g = groupChosen(joyce, w, MESSY, [a.id, c.id], 10);
  assert.deepEqual(members(w, g.id).map((th) => th.text), ['a', 'c'], 'one train of the two');
  assert.equal(groupOf(w, b.id, 'joyce').id, t1.id, 'the rest of the old train stays');
  assert.equal(w.things[t2.id], undefined, 'a train left empty goes');
  assert.equal(ungroupChosen(joyce, w, MESSY, [g.id], 11), 1, 'one came out: the last keeps the train');
  assert.ok(groupOf(w, a.id, 'joyce').id !== groupOf(w, c.id, 'joyce').id, 'each in a train of its own');
  const ch = groupChosen(russell, w, MESSY, [a.id, b.id], 12);
  assert.equal(ch.of, 'russell');
  assert.equal(members(w, ch.id).length, 2);
  assert.ok(groupOf(w, a.id, 'joyce'), 'still in its Joyce train');
  assert.equal(ungroupChosen(russell, w, MESSY, [a.id], 13), 1);
  assert.equal(groupOf(w, a.id, 'russell'), null, 'loose in Russell again');
  assert.equal(groupChosen(pessoa, w, MESSY, [a.id, b.id]), null, 'Pessoa has no groups');
});
