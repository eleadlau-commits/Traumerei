// Tests for Highlighter's rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { rangeAtCaret, capitals, countLine, fileName } from '../rules.js';

test('a bare caret takes the word around it; a selection is kept as it is', () => {
  assert.deepEqual(rangeAtCaret({ from: 6, to: 6, text: 'a red-brown fox' }), [2, 11]);
  assert.deepEqual(rangeAtCaret({ from: 8, to: 2, text: 'a red-brown fox' }), [2, 8]);
  assert.equal(rangeAtCaret({ from: 2, to: 2, text: 'a   b' }), null);
});

test('words in capitals, two letters or more, standing alone', () => {
  assert.deepEqual(capitals('NASA and I and USbased'), [{ from: 0, to: 4, class: 'caps' }]);
  assert.deepEqual(capitals(''), []);
});

test('the strip line and the file name', () => {
  assert.equal(countLine(0), '');
  assert.equal(countLine(1), '1 highlighted thought');
  assert.equal(countLine(3), '3 highlighted thoughts');
  assert.equal(fileName('My room: draft!'), 'My room draft.md');
  assert.equal(fileName('???'), 'room.md');
});
