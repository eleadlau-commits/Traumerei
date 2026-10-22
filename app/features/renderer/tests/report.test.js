// Tests for the M8 report text.

import { test, assert } from 'folio/testing';
import { describe } from '../report.js';

const attempt = (n, pass) => ({
  n, pieces: 3, dropped: 1, T: 0.3, main: { x: 0.5, y: 0.5, how: 'gaussian' },
  patches: [{ r: 0.2 }, { r: 0.1 }],
  comps: [{ area: 0.2 }, { area: 0.05 }],
  verdict: { pass, score: pass ? 0 : 2, near: { pass, distance: 0.1, limit: 0.24 }, pairs: [] },
});

test('a passing first attempt is reported as kept', () => {
  const a = attempt(0, true);
  const r = describe({ attempts: [a], best: a });
  assert.match(r.summary, /Attempt 0 passed/);
  assert.ok(r.attempts[0].kept);
  assert.match(r.attempts[0].title, /:skeleton :warp :noise/);
});

test('re-rolls name their streams and the best is kept', () => {
  const a = attempt(0, false);
  const b = attempt(1, false);
  const r = describe({ attempts: [a, b], best: a });
  assert.match(r.summary, /closest one \(attempt 0\)/);
  assert.match(r.attempts[1].title, /:skeleton:1 :warp:1 :noise:1/);
  assert.ok(r.attempts[0].kept && !r.attempts[1].kept);
});
