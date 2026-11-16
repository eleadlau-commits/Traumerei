// Tests for a card's line of counts (cards.js).

import { test, assert } from 'folio/testing';
import { countsLine } from '../cards.js';

const nameOf = (x) => x.family || null;

test('a card says how many groups of each family and how many thoughts it holds', () => {
  const held = [{ family: 'Chapter' }, { }, { }, { family: 'Chapter' }, { }];
  assert.equal(countsLine(held, nameOf), '2 chapters · 3 thoughts');
});

test('one of a thing is said once, without an s', () => {
  assert.equal(countsLine([{ family: 'Chapter' }, { }], nameOf), '1 chapter · 1 thought');
});

test('an empty card still says it holds nothing', () => {
  assert.equal(countsLine([], nameOf), '0 thoughts');
});
