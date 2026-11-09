// Tests for Desk's rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { items, byRoom, byFloor, summary, why, label, step, dayWords } from '../rules.js';

const NOW = new Date(2026, 10, 9, 12).getTime();
const DAY = 864e5;
const PLACES = {
  a: { room: 'r1', roomName: 'Thesis', floor: 'floor:0', floorName: 'Floor 1', floorOrder: 0 },
  b: { room: 'r1', roomName: 'Thesis', floor: 'floor:0', floorName: 'Floor 1', floorOrder: 0 },
  c: { room: 'r2', roomName: 'House', floor: 'floor:1', floorName: 'Floor 2', floorOrder: 1 },
  r3: { room: 'r3', roomName: 'Old', floor: 'archive', floorName: 'Archive', floorOrder: Infinity },
};
const place = (m) => PLACES[m] || null;
const gaps = [
  { mark: 'a', direction: 'from world', openedAt: NOW - 5 * DAY },
  { mark: 'c', direction: 'to world', openedAt: NOW - 9 * DAY },
  { mark: 'b', direction: 'to maker', openedAt: NOW - 2 * DAY },
  { mark: 'lost', direction: 'from world', openedAt: NOW },
];
const back = [{ mark: 'b', kind: 'due', at: NOW - DAY, back: NOW - DAY }, { mark: 'r3', kind: 'return', at: NOW, back: NOW, note: 'start here' }];

test('the desk gathers open gaps and what came back, once each, leaving out marks in no room', () => {
  const list = items(gaps, back, place);
  assert.deepEqual(list.map((i) => [i.mark, i.kind]), [['b', 'due'], ['r3', 'return'], ['a', 'gap'], ['c', 'gap']]);
  assert.equal(summary(list), '2 open gaps · 2 back');
  assert.equal(summary([]), '');
  assert.equal(label(4), 'Desk · 4');
  assert.equal(label(0), 'Desk');
});

test('by room: a room with something back first, then the longest waiting; back before gaps inside', () => {
  const rooms = byRoom(items(gaps, back, place));
  assert.deepEqual(rooms.map((r) => r.room), ['r1', 'r3', 'r2']);
  assert.deepEqual(rooms[0].items.map((i) => i.mark), ['b', 'a']);
  assert.equal(rooms[0].back, 1);
});

test('by floor: floors in order, the Archive last, rooms gathered under each', () => {
  const floors = byFloor(items(gaps, back, place));
  assert.deepEqual(floors.map((f) => f.name), ['Floor 1', 'Floor 2', 'Archive']);
  assert.deepEqual(floors[0].rooms.map((r) => r.name), ['Thesis']);
});

test('each row says why it waits, and the arrows stop at the ends', () => {
  assert.equal(why({ kind: 'gap', direction: 'from world', at: NOW - 3 * DAY }, NOW), 'To do, since 6 Nov');
  assert.equal(why({ kind: 'gap', direction: 'to world', at: NOW }, NOW), 'To check, since today');
  assert.equal(why({ kind: 'due', at: NOW - DAY }, NOW), 'Due yesterday');
  assert.equal(why({ kind: 'return' }, NOW), 'Note for this visit');
  assert.equal(dayWords(new Date(2025, 0, 3).getTime(), NOW), '3 Jan 2025');
  assert.equal(step(0, 3, 'ArrowUp'), 0);
  assert.equal(step(0, 3, 'ArrowDown'), 1);
  assert.equal(step(2, 3, 'ArrowDown'), 2);
  assert.equal(step(1, 3, 'End'), 2);
  assert.equal(step(1, 3, 'x'), 1);
});
