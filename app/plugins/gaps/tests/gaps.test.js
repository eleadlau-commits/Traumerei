// Tests for Gaps's rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { stateLine, progressLine, nextMove, share, dayWords, VERBS } from '../rules.js';

const NOW = new Date(2026, 10, 8, 12).getTime();

test('the Editor line says what a gap is: open and which way, resolved and by what, or its parts\' progress', () => {
  assert.equal(stateLine(null), '');
  assert.equal(stateLine({ state: 'open', direction: 'from world', openedAt: NOW - 86400e3 * 2 }, NOW), 'Open, to do, since 6 Nov');
  assert.equal(stateLine({ state: 'resolved', direction: 'to world', openedAt: 1, resolvedAt: NOW, resolvedBy: 'judgement' }, NOW), 'Resolved 8 Nov by judgement');
  assert.equal(stateLine({ state: 'resolved', direction: 'to maker', openedAt: 1, resolvedAt: NOW, resolvedBy: 'rel:russell:a:b' }, NOW), 'Resolved 8 Nov by a link');
  assert.equal(stateLine({ derived: true, state: 'open', open: 3, resolved: 9, of: 12 }), '3 of 12 parts open');
  assert.equal(stateLine({ derived: true, state: 'resolved', open: 0, resolved: 1, of: 1 }), 'every part resolved (1)');
  assert.equal(progressLine({ open: 1, resolved: 0, of: 1 }), '1 of 1 part open');
  assert.equal(dayWords(new Date(2025, 0, 3).getTime(), NOW), '3 Jan 2025');
});

test('Ctrl+Alt+G opens, resolves, opens again, or only speaks of the parts', () => {
  assert.equal(nextMove(null), 'open');
  assert.equal(nextMove({ state: 'open' }), 'resolve');
  assert.equal(nextMove({ state: 'resolved' }), 'reopen');
  assert.equal(nextMove({ derived: true, state: 'open' }), 'parts');
  assert.equal(share({ open: 3, resolved: 9, of: 12 }), 0.75);
  assert.equal(share(null), 0);
  assert.deepEqual(Object.values(VERBS), ['Check', 'Do', 'Judge']);
});
