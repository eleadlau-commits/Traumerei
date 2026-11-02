// Tests for Create's rooms, trains and thoughts.

import { test, assert } from 'folio/testing';
import {
  MESSY, emptyWorld, loadWorld, addRoom, startTrain, addThought, trainThoughts, roomThoughts,
  roomTrains, moveTrain, moveThought, spiralPoint, pessoaPoint, placeThought, randomSpot, view,
  addThing, updateThing, foldTrain, unfold,
} from '../model.js';

test('a new world has only Messy thoughts, in Joyce', () => {
  const w = emptyWorld();
  assert.deepEqual(w.rooms.map((r) => r.id), [MESSY]);
  assert.equal(view(w, MESSY).mode, 'joyce');
});

test('a saved world without the messy room gets it back', () => {
  const w = loadWorld({ rooms: [{ id: 'r1', name: 'Other', at: 1 }] });
  assert.equal(w.rooms[0].id, MESSY);
  assert.equal(w.rooms.length, 2);
});

test('thoughts in a train keep the order they were written in', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  addThought(w, t.id, 'second', 20);
  addThought(w, t.id, 'first', 10);
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['first', 'second']);
});

test('an empty thought is not kept, and spaces are tidied', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(addThought(w, t.id, '   '), null);
  assert.equal(addThought(w, t.id, '  a   b ').text, 'a b');
});

test('moving a train takes every thought with it, in order', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = startTrain(w, MESSY, 0, 0);
  addThought(w, t.id, 'a', 1);
  addThought(w, t.id, 'b', 2);
  assert.ok(moveTrain(w, t.id, r.id, 5, 6));
  assert.equal(roomThoughts(w, MESSY).length, 0);
  assert.deepEqual(roomThoughts(w, r.id).map((th) => th.text), ['a', 'b']);
  assert.deepEqual(roomTrains(w, r.id).map((x) => x.id), [t.id]);
});

test('moving one thought leaves the rest of its train joined', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = startTrain(w, MESSY, 0, 0);
  addThought(w, t.id, 'a', 1);
  const b = addThought(w, t.id, 'b', 2);
  addThought(w, t.id, 'c', 3);
  placeThought(w, MESSY, b.id, 9, 9);
  assert.ok(moveThought(w, b.id, r.id, 0, 0));
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'c']);
  assert.equal(roomThoughts(w, r.id)[0].text, 'b');
  assert.equal(w.places[MESSY][b.id], undefined);
});

test('a train left empty by a move is removed', () => {
  const w = emptyWorld();
  const r = addRoom(w);
  const t = startTrain(w, MESSY, 0, 0);
  const a = addThought(w, t.id, 'only');
  moveThought(w, a.id, r.id, 0, 0);
  assert.equal(w.trains[t.id], undefined);
});

test('the spiral moves outwards as thoughts are added', () => {
  const r = (i) => { const p = spiralPoint(i); return Math.hypot(p.x, p.y); };
  assert.ok(r(30) > r(10) && r(10) > r(1));
});

test('a dragged Pessoa thought stays where it was put', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  const a = addThought(w, t.id, 'x');
  placeThought(w, MESSY, a.id, 123, 45);
  assert.deepEqual(pessoaPoint(w, MESSY, a.id), { x: 123, y: 45 });
});

test('a random spot is inside the box', () => {
  const p = randomSpot({ x: 10, y: 20, w: 100, h: 50 }, [{ x: 0, y: 0 }]);
  assert.ok(p.x >= 10 && p.x <= 110 && p.y >= 20 && p.y <= 70);
});

test('a passage keeps its lines; an empty one is not kept', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(addThing(w, t.id, { kind: 'passage', title: ' ', body: '  ' }), null);
  const p = addThing(w, t.id, { kind: 'passage', title: 'On notes', body: 'one\nline two' });
  assert.equal(p.body, 'one\nline two');
});

test('a picture needs an image', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(addThing(w, t.id, { kind: 'picture', src: 'javascript:x' }), null);
  assert.ok(addThing(w, t.id, { kind: 'picture', src: 'data:image/jpeg;base64,AA', text: 'dusk' }));
});

test('a train folds into one thought, and unfolds back in order', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  addThought(w, t.id, 'a', 1);
  addThought(w, t.id, 'b', 2);
  addThought(w, t.id, 'c', 3);
  const f = foldTrain(w, t.id, 'Letters');
  assert.equal(trainThoughts(w, t.id).length, 1);
  assert.equal(f.body, 'a\nb\nc');
  assert.ok(unfold(w, f.id));
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'b', 'c']);
});

test('emptying a thought deletes it', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  const p = addThing(w, t.id, { kind: 'passage', title: 'x' });
  updateThing(w, p.id, { title: '' });
  assert.equal(w.thoughts[p.id], undefined);
});
