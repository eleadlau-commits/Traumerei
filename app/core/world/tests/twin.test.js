// Tests for a Twin: a room whose two sides are rooms of their own, side by side, sharing nothing;
// a thought or group can be moved across.

import { test, assert } from 'folio/testing';
import * as libForRussell from '../lib.js';
import { surface as surfaceForRussell } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import * as model from '../model.js';
import { emptyWorld, loadWorld, create, children, view, roomThoughts, roomTags, copyRoom, remove, move, groupsOf, rooms, topRoom, isBig, join } from '../model.js';
import russell from '../../russell/rules.js';
import { addTwin, sides, twinOf, otherSide, across, isTwin, placeName, moveTargets } from '../twin.js';

const ONTS = [{ id: 'joyce', name: 'Joyce' }, { id: 'pessoa', name: 'Pessoa' }, { id: 'russell', name: 'Russell' }];

test('a Twin has two sides, each a room with its own mode, and only they are inside it', () => {
  const w = emptyWorld();
  const t = addTwin(w, 'Pair', 1, {}, ['joyce', 'russell']);
  assert.ok(isTwin(t));
  assert.equal(t.size, 'twin');
  assert.ok(!isBig(t));
  const [l, r] = sides(w, t.id);
  assert.deepEqual([model.sideOf(w, l.id), model.sideOf(w, r.id), model.parentOf(w, l.id), model.parentOf(w, r.id)], [0, 1, t.id, t.id]);
  assert.deepEqual([view(w, l.id).mode, view(w, r.id).mode], ['joyce', 'russell']);
  assert.ok(!rooms(w).some((x) => x.id === l.id));            // the sides are not on the rooms page
  assert.equal(create(w, t.id, { kind: 'line', text: 'no' }), null); // nothing else goes in the Twin
  assert.deepEqual(roomTags(w, t.id, ONTS).map((x) => x.tag), ['Joyce', 'Russell']);
  assert.equal(twinOf(w, l.id).id, t.id);
  assert.equal(otherSide(w, l.id).id, r.id);
});

test('nothing is shared: a thought moved across belongs to the other side alone', () => {
  const w = emptyWorld();
  const t = addTwin(w, 'Pair', 1, {}, ['joyce', 'joyce']);
  const [l, r] = sides(w, t.id);
  const a = create(w, l.id, { kind: 'line', text: 'a' }, 2);
  create(w, r.id, { kind: 'line', text: 'b' }, 3);
  assert.deepEqual(children(w, l.id).filter((x) => x.kind === 'line').map((x) => x.text), ['a']);
  assert.deepEqual(roomThoughts(w, t.id).map((x) => x.text), ['a', 'b']); // the Twin's square counts both
  assert.equal(topRoom(w, a.id).id, t.id);
  assert.ok(across(w, a.id, 10, 20));
  assert.equal(model.parentOf(w, a.id), r.id);
  assert.ok(groupsOf(w, a.id).every((g) => model.parentOf(w, g.id) === r.id));
  assert.equal(move(w, a.id, t.id), false);                // never into the Twin itself
});

test('a Twin survives a reload, copies with its sides, and goes with them', () => {
  let w = emptyWorld();
  const t = addTwin(w, 'Pair', 1, {}, ['pessoa', 'russell']);
  const [l] = sides(w, t.id);
  create(w, l.id, { kind: 'line', text: 'kept' }, 2);
  w = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.equal(sides(w, t.id).length, 2);
  const c = copyRoom(w, t.id, 5);
  const cs = sides(w, c.id);
  assert.equal(cs.length, 2);
  assert.ok(cs.every((s) => !sides(w, t.id).some((o) => o.id === s.id)));
  assert.equal(view(w, cs[1].id).mode, 'russell');
  assert.deepEqual(roomThoughts(w, c.id).map((x) => x.text), ['kept']);
  remove(w, t.id);
  assert.equal(Object.values(w.things).filter((x) => model.parentOf(w, x.id) === l.id).length, 0);
});

test('Move to lists a Twin as its two sides, the other side first from inside one', () => {
  const w = emptyWorld();
  const t = addTwin(w, 'Pair', 1, {}, ['joyce', 'russell']);
  const [l, r] = sides(w, t.id);
  assert.equal(placeName(w, l.id), 'Pair · Left');
  assert.equal(placeName(w, r.id), 'Pair · Right');
  const names = (from) => moveTargets(w, from).map((x) => x.name);
  assert.deepEqual(names('messy'), ['Pair · Left', 'Pair · Right']);
  assert.ok(!moveTargets(w, 'messy').some((x) => x.id === t.id)); // never the Twin itself
  assert.deepEqual(names(r.id), ['Pair · Left', 'Messy thoughts']);
  assert.deepEqual(names(l.id), ['Pair · Right', 'Messy thoughts']);
});

test('a group moved across to a side in another mode is one object there: its thoughts are not loose too', () => {
  const w = emptyWorld();
  const t = addTwin(w, 'Pair', 1, {}, ['joyce', 'russell']);
  const [l, r] = sides(w, t.id);
  const a = create(w, l.id, { kind: 'line', text: 'a' }, 2);
  const g = create(w, l.id, { kind: 'group', of: 'joyce', x: 0, y: 0 }, 2);
  join(w, g.id, a.id);
  assert.ok(!g.shared); // a train made by writing on: layout only
  assert.ok(across(w, g.id, 10, 20));
  assert.equal(model.parentOf(w, a.id), r.id);
  assert.ok(g.shared);
  assert.deepEqual(russell.tray(w, r.id).map((x) => x.id), [g.id]); // the train, not its thought as well
  // Across to a side in its own mode, a group stays layout only.
  const u = addTwin(w, 'Same', 1, {}, ['joyce', 'joyce']);
  const [ul] = sides(w, u.id);
  const b = create(w, ul.id, { kind: 'line', text: 'b' }, 3);
  const h = create(w, ul.id, { kind: 'group', of: 'joyce', x: 0, y: 0 }, 3);
  join(w, h.id, b.id);
  assert.ok(across(w, h.id));
  assert.ok(!h.shared);
});
