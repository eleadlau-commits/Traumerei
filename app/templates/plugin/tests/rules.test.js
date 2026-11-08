// Tests for __NAME__'s rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { words, wordsLine } from '../rules.js';

test('words are counted however they are spaced', () => {
  assert.equal(words('  Vectors   are\nlists. '), 3);
  assert.equal(words(''), 0);
  assert.equal(words(undefined), 0);
});

test('the Editor line says word or words', () => {
  assert.equal(wordsLine(1), '1 word');
  assert.equal(wordsLine(2), '2 words');
});
