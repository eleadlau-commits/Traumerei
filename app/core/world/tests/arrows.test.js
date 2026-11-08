// Tests for the arrow maths: side midpoints, the facing-side rule, straight and curved lines.

import { test, assert } from 'folio/testing';
import { facing, sidePoint, between, path, middle, labelSpot, PAD } from '../ontologies/arrows.js';

const box = (x, y, w = 100, h = 40) => ({ x, y, w, h });

test('arrows: a box below is met bottom to top, one beside right to left', () => {
  assert.deepEqual(facing(box(0, 0), box(0, 200)), { from: 'bottom', to: 'top' });
  assert.deepEqual(facing(box(0, 200), box(0, 0)), { from: 'top', to: 'bottom' });
  assert.deepEqual(facing(box(0, 0), box(300, 10)), { from: 'right', to: 'left' });
  assert.deepEqual(facing(box(300, 10), box(0, 0)), { from: 'left', to: 'right' });
  // Below and a little aside: still bottom to top; far aside and a little below: side to side.
  assert.deepEqual(facing(box(0, 0), box(150, 200)), { from: 'bottom', to: 'top' });
  assert.deepEqual(facing(box(0, 0), box(500, 60)), { from: 'right', to: 'left' });
  // A tie goes up and down.
  assert.deepEqual(facing(box(0, 0), box(150, 90)), { from: 'bottom', to: 'top' });
});

test('arrows: each end is the midpoint of its side, padded off it', () => {
  const b = box(10, 20, 100, 40);
  assert.deepEqual(sidePoint(b, 'top'), { x: 60, y: 20 });
  assert.deepEqual(sidePoint(b, 'bottom', 5), { x: 60, y: 65 });
  assert.deepEqual(sidePoint(b, 'left', 5), { x: 5, y: 40 });
  assert.deepEqual(sidePoint(b, 'right'), { x: 110, y: 40 });
  const a = between(box(0, 0), box(0, 200));
  assert.deepEqual(a.p, { x: 50, y: 40 + PAD });
  assert.deepEqual(a.q, { x: 50, y: 200 - PAD });
  const s = between(box(0, 0), box(300, 0), { from: (side) => (side === 'bottom' ? 30 : 4), to: 0 });
  assert.deepEqual([s.p, s.q], [{ x: 104, y: 20 }, { x: 300, y: 20 }]);
});

test('arrows: two parents on either side come in on the child\'s facing sides', () => {
  const child = box(200, 200);
  assert.equal(between(box(-200, 190), child).to, 'left');
  assert.equal(between(box(600, 190), child).to, 'right');
  assert.equal(between(box(200, 0), child).to, 'top');
});

test('arrows: straight and curved lines, and the label at the middle', () => {
  const a = between(box(0, 0), box(0, 200));
  assert.equal(path(a), `M50 ${40 + PAD}L50 ${200 - PAD}`);
  assert.match(path(a, 'curved'), /^M50 52C50 \S+ 50 \S+ 50 188$/);
  assert.deepEqual(middle(a), { x: 50, y: 120 });
  assert.deepEqual(middle(a, 'curved'), { x: 50, y: 120 }); // a straight drop curves nowhere
  // Beside an arrow that runs down, on the side it leans to; above one that runs across.
  assert.equal(labelSpot(a).side, 'right');
  // A slanting arrow's label sits in a corner the line stays out of.
  assert.equal(labelSpot(between(box(150, 0), box(0, 200))).side, 'left-up');
  assert.equal(labelSpot(between(box(0, 0), box(150, 200))).side, 'right-up');
  assert.equal(labelSpot(between(box(0, 0), box(150, 200)), 'straight', { prefer: 'left' }).side, 'left-down');
  assert.equal(labelSpot(a, 'straight', { prefer: 'left' }).side, 'left');
  const across = labelSpot(between(box(0, 0), box(400, 0)));
  assert.equal(across.side, 'above');
  assert.equal(across.x, (100 + PAD + 400 - PAD) / 2);
});
