import { test, assert } from 'folio/testing';
import { changed, dayOf, timeline, squareOf, days, roomBoard, roomFirst } from '../days.js';

// A little world, and the model rules days.js asks for.
const H = 3600e3;
const t0 = new Date(2026, 10, 3, 12).getTime(); // 3 Nov, noon
const world = () => ({ things: {
  a: { id: 'a', kind: 'room', parent: null, at: 0, name: 'A' },
  tw: { id: 'tw', kind: 'room', parent: null, at: 0, name: 'Twin' },
  s1: { id: 's1', kind: 'room', parent: 'tw', at: 0, name: 'Left' },
  x: { id: 'x', kind: 'line', parent: 'a', at: t0 },
  y: { id: 'y', kind: 'line', parent: 'a', at: t0 - 30 * H, edited: t0 + H },
  z: { id: 'z', kind: 'line', parent: 's1', at: t0 - 24 * H },
  g: { id: 'g', kind: 'group', parent: 'a', at: t0, members: ['x'] },
} });
const m = {
  isLeaf: (th) => ['line', 'passage', 'picture'].includes(th.kind),
  parentOf: (w, id) => w.things[id]?.parent ?? null,
  roomThoughts: (w, id) => Object.values(w.things).filter((th) => th.parent === id && m.isLeaf(th)).sort((a, b) => a.at - b.at),
};

test('a thought changed when it was written, or written in since', () => {
  assert.equal(changed({ at: 5 }), 5);
  assert.equal(changed({ at: 5, edited: 9 }), 9);
});

test('a room\'s timeline is in the order things last changed', () => {
  assert.deepEqual(timeline(m, world(), 'a').map((th) => th.id), ['x', 'y']);
});

test('a side\'s thoughts count for its Twin\'s square', () => {
  const w = world();
  const up = (id) => m.parentOf(w, id);
  assert.equal(squareOf(w, w.things.z, up).id, 'tw');
  assert.equal(squareOf(w, w.things.x, up).id, 'a');
  assert.equal(squareOf(w, { id: 'nowhere' }, up), null);
});

test('days are newest first, each with the rooms written in', () => {
  const d = days(m, world());
  assert.deepEqual(d.map((x) => x.day), [dayOf(t0), dayOf(t0 - 24 * H)]);
  assert.deepEqual(d[0].rooms, [{ id: 'a', n: 2 }]);
  assert.deepEqual(d[1].rooms, [{ id: 'tw', n: 1 }]);
});

test('a room on a past day: later thoughts and that day\'s', () => {
  const w = world();
  w.things.a.at = t0 - 72 * H;
  const b = roomBoard(m, w, 'a', dayOf(t0 - 30 * H));
  assert.deepEqual(b.later, ['x']);
  assert.deepEqual(b.lit, ['y']);
  assert.deepEqual(roomBoard(m, w, 'a', dayOf(t0)).lit.sort(), ['x', 'y']);
  assert.equal(roomFirst(m, w, 'a', t0), dayOf(t0 - 72 * H));
});
