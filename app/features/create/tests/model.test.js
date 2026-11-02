// Tests for Create's world: everything is a thought.

import { test, assert } from 'folio/testing';
import {
  MESSY, emptyWorld, loadWorld, rooms, children, create, update, remove, move, name, fold, unfold,
  canHold, addRoom, startTrain, addThought, trainThoughts, roomThoughts, roomTrains, roomUnits,
  roomOf, thoughtText, spiralPoint, pessoaPoint, place, randomSpot, view, roomAt, placeRoom, gridRooms,
} from '../model.js';

const train = (w, room = MESSY, ...texts) => {
  const t = startTrain(w, room, 0, 0);
  texts.forEach((x, i) => addThought(w, t.id, x, i + 1));
  return t;
};

test('a new world has only Messy thoughts, seen in Joyce', () => {
  const w = emptyWorld();
  assert.deepEqual(rooms(w).map((r) => r.id), [MESSY]);
  assert.equal(view(w, MESSY).mode, 'joyce');
});

test('a saved world without the messy room gets it back', () => {
  const w = loadWorld({ v: 2, things: { r1: { id: 'r1', kind: 'room', parent: null, at: 1, name: 'Other' } } });
  assert.deepEqual(rooms(w).map((r) => r.id).sort(), [MESSY, 'r1'].sort());
});

test('the first prototype\'s world is turned into thoughts', () => {
  const w = loadWorld({
    rooms: [{ id: 'messy', name: 'Messy thoughts', at: 0 }, { id: 'r1', name: 'Other', at: 1 }],
    trains: { t1: { id: 't1', room: 'r1', x: 5, y: 6, at: 2 } },
    thoughts: { h1: { id: 'h1', room: 'r1', train: 't1', text: 'hello', at: 3 } },
  });
  assert.equal(roomOf(w, 'h1').id, 'r1');
  assert.deepEqual(trainThoughts(w, 't1').map((t) => t.text), ['hello']);
});

test('what can sit inside what', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.ok(canHold(w, t.id, 'line'));
  assert.ok(!canHold(w, MESSY, 'line'));
  assert.ok(canHold(w, MESSY, 'train'));
  assert.ok(canHold(w, MESSY, 'room'));
  assert.ok(canHold(w, null, 'room'));
  assert.ok(!canHold(w, t.id, 'room'));
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

test('a passage keeps its lines; a picture needs an image', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  assert.equal(create(w, t.id, { kind: 'passage', title: ' ', body: '  ' }), null);
  assert.equal(create(w, t.id, { kind: 'passage', title: 'On notes', body: 'one\nline two' }).body, 'one\nline two');
  assert.equal(create(w, t.id, { kind: 'picture', src: 'javascript:x' }), null);
  assert.ok(create(w, t.id, { kind: 'picture', src: 'data:image/jpeg;base64,AA', text: 'dusk' }));
});

test('moving a train takes every thought with it, in order', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = train(w, MESSY, 'a', 'b');
  assert.ok(move(w, t.id, r.id, 5, 6));
  assert.equal(roomThoughts(w, MESSY).length, 0);
  assert.deepEqual(roomThoughts(w, r.id).map((th) => th.text), ['a', 'b']);
  assert.deepEqual(roomTrains(w, r.id).map((x) => x.id), [t.id]);
});

test('moving one thought into a room gives it a train there; the rest stays joined', () => {
  const w = emptyWorld();
  const r = addRoom(w, 'Elsewhere');
  const t = train(w, MESSY, 'a', 'b', 'c');
  const b = trainThoughts(w, t.id)[1];
  place(w, MESSY, b.id, 9, 9);
  assert.ok(move(w, b.id, r.id));
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'c']);
  assert.equal(roomThoughts(w, r.id)[0].text, 'b');
  assert.equal(w.places[MESSY][b.id], undefined);
});

test('a train left empty by a move is removed', () => {
  const w = emptyWorld();
  const r = addRoom(w);
  const t = train(w, MESSY, 'only');
  move(w, trainThoughts(w, t.id)[0].id, r.id);
  assert.equal(w.things[t.id], undefined);
});

test('rooms can go inside rooms, but never inside themselves', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A');
  const b = addRoom(w, 'B');
  assert.ok(move(w, b.id, a.id));
  assert.deepEqual(children(w, a.id).map((x) => x.id), [b.id]);
  assert.ok(!move(w, a.id, b.id));
  assert.ok(!move(w, a.id, a.id));
});

test('removing a room removes what is in it; Messy thoughts stays', () => {
  const w = emptyWorld();
  const r = addRoom(w);
  const t = train(w, r.id, 'x');
  remove(w, r.id);
  assert.equal(w.things[t.id], undefined);
  remove(w, MESSY);
  assert.ok(w.things[MESSY]);
});

test('a train folds into one thought, named, and unfolds back in order', () => {
  const w = emptyWorld();
  const t = train(w, MESSY, 'a', 'b', 'c');
  assert.ok(fold(w, t.id));
  name(w, t.id, 'Letters');
  assert.deepEqual(roomUnits(w, MESSY).map((u) => u.id), [t.id]);
  assert.equal(thoughtText(w, t), 'a\nb\nc');
  assert.equal(w.things[t.id].title, 'Letters');
  assert.ok(unfold(w, t.id));
  assert.equal(roomUnits(w, MESSY).length, 3);
  assert.deepEqual(trainThoughts(w, t.id).map((th) => th.text), ['a', 'b', 'c']);
});

test('naming works on rooms and passages too', () => {
  const w = emptyWorld();
  name(w, MESSY, 'Mess');
  assert.equal(w.things[MESSY].name, 'Mess');
  const t = startTrain(w, MESSY, 0, 0);
  const p = create(w, t.id, { kind: 'passage', body: 'x' });
  name(w, p.id, 'Title');
  assert.equal(w.things[p.id].title, 'Title');
});

test('emptying a thought removes it, and its train if it was alone', () => {
  const w = emptyWorld();
  const t = startTrain(w, MESSY, 0, 0);
  const p = create(w, t.id, { kind: 'passage', title: 'x' });
  update(w, p.id, { title: '' });
  assert.equal(w.things[p.id], undefined);
  assert.equal(w.things[t.id], undefined);
});

test('a room\'s tint, lightness and opacity are kept in range', () => {
  const w = emptyWorld();
  update(w, MESSY, { tint: '#AABBCC', light: 3, opacity: -1 });
  assert.equal(w.things[MESSY].tint, '#AABBCC');
  assert.equal(w.things[MESSY].light, 1);
  assert.equal(w.things[MESSY].opacity, 0);
});

test('the spiral moves outwards as thoughts are added', () => {
  const r = (i) => { const p = spiralPoint(i); return Math.hypot(p.x, p.y); };
  assert.ok(r(30) > r(10) && r(10) > r(1));
});

test('a dragged Pessoa thought stays where it was put', () => {
  const w = emptyWorld();
  const t = train(w, MESSY, 'x');
  const a = trainThoughts(w, t.id)[0];
  place(w, MESSY, a.id, 123, 45);
  assert.deepEqual(pessoaPoint(w, MESSY, a.id), { x: 123, y: 45 });
});

test('a random spot is inside the box', () => {
  const p = randomSpot({ x: 10, y: 20, w: 100, h: 50 }, [{ x: 0, y: 0 }]);
  assert.ok(p.x >= 10 && p.x <= 110 && p.y >= 20 && p.y <= 70);
});

test('Messy thoughts takes four squares at the top left of the grid', () => {
  const w = emptyWorld();
  const m = rooms(w)[0];
  assert.deepEqual([m.col, m.row, m.size], [0, 0, 2]);
  assert.equal(roomAt(w, 1, 1).id, MESSY);
  assert.equal(roomAt(w, 2, 0), null);
});

test('a room is made in the square asked for, or the first free one', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A', 1, { col: 4, row: 3 });
  assert.deepEqual([a.col, a.row], [4, 3]);
  const b = addRoom(w, 'B', 2, { col: 1, row: 1 }); // taken by Messy
  assert.deepEqual([b.col, b.row], [2, 0]);
  const c = addRoom(w, 'C', 3);
  assert.deepEqual([c.col, c.row], [3, 0]);
});

test('rooms move to free squares only', () => {
  const w = emptyWorld();
  const a = addRoom(w, 'A', 1, { col: 3, row: 0 });
  assert.ok(placeRoom(w, a.id, 5, 5));
  assert.ok(!placeRoom(w, a.id, 0, 1));
  assert.ok(!placeRoom(w, MESSY, 4, 5)); // would cover A
  assert.ok(placeRoom(w, MESSY, 2, 2));
  assert.ok(placeRoom(w, a.id, 0, 0));
});

test('a saved world gets its rooms placed on the grid without overlaps', () => {
  const w = loadWorld({ v: 2, things: {
    messy: { id: 'messy', kind: 'room', parent: null, at: 0, name: 'Messy thoughts' },
    r1: { id: 'r1', kind: 'room', parent: null, at: 1, name: 'One', col: 1, row: 0 },
    r2: { id: 'r2', kind: 'room', parent: null, at: 2, name: 'Two' },
  } });
  const seen = new Set();
  for (const r of gridRooms(w)) for (let c = 0; c < r.size; c++) for (let d = 0; d < r.size; d++) {
    const k = `${r.col + c},${r.row + d}`;
    assert.ok(!seen.has(k), k);
    seen.add(k);
  }
  assert.deepEqual([w.things.messy.col, w.things.messy.row], [0, 0]);
});
