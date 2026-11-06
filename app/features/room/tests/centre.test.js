// Tests for bringing the view to things (centre.js): the view that fits a box.

import { test, assert } from 'folio/testing';
import { fitView } from '../centre.js';
import { ZOOM } from '../shared.js';

const box = (x, y, w, h) => ({ x, y, w, h });

test('Home: a big room is zoomed out to fit, centred on its middle', () => {
  const v = fitView(box(-1000, 0, 4000, 1000), 1000, 600, { pad: 50 });
  assert.equal(v.x, 1000);
  assert.equal(v.y, 500);
  assert.ok(Math.abs(v.zoom - 900 / 4000) < 1e-9 || v.zoom === ZOOM.min);
  assert.ok(4000 * v.zoom <= 900 + 1e-9 || v.zoom === ZOOM.min);
});

test('Home: a small room is not blown up past its natural size', () => {
  const v = fitView(box(10, 10, 100, 40), 1200, 800);
  assert.equal(v.zoom, 1);
  assert.equal(v.x, 60);
  assert.equal(v.y, 30);
});

test('the zoom stays in the room\'s range', () => {
  assert.equal(fitView(box(0, 0, 1e6, 1e6), 800, 600).zoom, ZOOM.min);
  assert.ok(fitView(box(0, 0, 0, 0), 800, 600, { most: 99 }).zoom <= ZOOM.max);
});

test('Ctrl+Shift+C keeps the zoom when the choice fits, and zooms out when it does not', () => {
  const kept = fitView(box(500, 500, 200, 100), 1000, 700, { keep: 1.6 });
  assert.equal(kept.zoom, 1.6);
  assert.equal(kept.x, 600);
  assert.equal(kept.y, 550);
  const out = fitView(box(0, 0, 3000, 100), 1000, 700, { keep: 1.6, pad: 50 });
  assert.ok(out.zoom < 1.6);
  assert.ok(3000 * out.zoom <= 900 + 1e-9);
});
