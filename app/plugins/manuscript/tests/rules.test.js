// Tests for Manuscript's pure rules (the corpus suite, app/core/api/tests/corpus.test.js, runs the
// rule itself through the host).

import { test, assert } from 'folio/testing';
import { roman, numberOf, chapterAt } from '../rules.js';

test('chapters are numbered 1 / 1.1, I / i, or not at all', () => {
  assert.equal(roman(1994), 'MCMXCIV');
  assert.equal(numberOf([2, 1], 'arabic'), '2.1');
  assert.equal(numberOf([4], 'roman'), 'IV');
  assert.equal(numberOf([4, 3], 'roman'), 'iii');
  assert.equal(numberOf([1], 'none'), '');
});

test('a point of the column is in the innermost chapter running over it', () => {
  const spans = [{ chapter: 'a', top: 0, bottom: 300, depth: 1 }, { chapter: 'b', top: 100, bottom: 200, depth: 2 }];
  assert.equal(chapterAt(spans, 150).chapter, 'b');
  assert.equal(chapterAt(spans, 250).chapter, 'a');
  assert.equal(chapterAt(spans, 400), null);
});
