// Tests for the divider between a Twin's halves (twin.js splitAt): the left half's share.

import { test, assert } from 'folio/testing';
import { splitAt, SIDE_MIN } from '../twin.js';

test('the divider follows the pointer as the left half\'s share of the width', () => {
  assert.equal(splitAt(700, 100, 1200), 0.5);
  assert.equal(splitAt(400, 100, 1200), 0.25);
});

test('each half stays at least SIDE_MIN wide', () => {
  assert.equal(splitAt(110, 100, 1200), SIDE_MIN / 1200);
  assert.equal(splitAt(5000, 100, 1200), 1 - SIDE_MIN / 1200);
});

test('an area too narrow for two halves stays half and half', () => {
  assert.equal(splitAt(300, 0, 500), 0.5);
  assert.equal(splitAt(NaN, 0, 1000), 0.5);
});
