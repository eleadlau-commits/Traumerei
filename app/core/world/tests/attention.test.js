// Tests for a room's light: where attention has been.

import { test, assert } from 'folio/testing';
import { visit, light, loadLog, FADE, MOST } from '../attention.js';

test('a room never visited is dark; visits light it, and the light fades', () => {
  const log = {};
  assert.equal(light(log, 'r', [], 0), 0);
  visit(log, 'r', 0);
  visit(log, 'r', 2 * 3600e3);
  const now = light(log, 'r', [], 3 * 3600e3);
  const later = light(log, 'r', [], 3 * 3600e3 + 3 * FADE);
  assert.ok(now > 0.4 && later < now * 0.2, `${now} ${later}`);
});

test('many visits never light a room past full, and the log stays short', () => {
  const log = {};
  for (let i = 0; i < 200; i++) visit(log, 'r', i * 120e3);
  assert.ok(light(log, 'r', [], 200 * 120e3) < 1);
  assert.equal(log.r.length, MOST);
});

test('going in twice within a minute is one visit; writing adds light', () => {
  const log = {};
  visit(log, 'r', 0);
  visit(log, 'r', 30e3);
  assert.equal(log.r.length, 1);
  assert.ok(light(log, 'r', [10e3, 20e3], 60e3) > light(log, 'r', [], 60e3));
});

test('a saved log is checked', () => {
  assert.deepEqual(loadLog({ a: [1, 'x', 2], b: 'nope' }), { a: [1, 2] });
  assert.deepEqual(loadLog(null), {});
});
