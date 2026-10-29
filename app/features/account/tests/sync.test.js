// Tests for the account sync rules.

import { test, assert } from 'folio/testing';
import { pack, unpack, decide } from '../sync.js';

test('packing ignores key order', () => {
  assert.equal(pack({ b: '1', a: '2' }), pack({ a: '2', b: '1' }));
});

test('unpacking refuses anything but a map of text', () => {
  assert.deepEqual(unpack('{"renderer.params":"{}"}'), { 'renderer.params': '{}' });
  assert.equal(unpack('nope'), null);
  assert.equal(unpack('[1]'), null);
  assert.equal(unpack('{"a":1}'), null);
});

test('a new account takes the device\'s settings, an existing one wins', () => {
  assert.equal(decide(null, { a: '1' }), 'upload');
  assert.equal(decide({ a: '1' }, { a: '1' }), 'same');
  assert.equal(decide({ a: '2' }, { a: '1' }), 'apply');
  assert.equal(decide({}, { a: '1' }), 'apply');
});
