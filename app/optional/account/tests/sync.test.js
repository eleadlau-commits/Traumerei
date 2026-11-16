// Tests for the account sync rules.

import { test, assert } from 'folio/testing';
import { pack, unpack, decide, reloadedRecently, RELOAD_GUARD, settingsOf, incoming, batchesOf, LIMIT } from '../sync.js';

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

test('right after a reload, a difference is sent up instead of reloading again', () => {
  assert.equal(decide({ a: '2' }, { a: '1' }, true), 'upload');
  assert.equal(decide({ a: '1' }, { a: '1' }, true), 'same');
  assert.equal(decide(null, { a: '1' }, true), 'upload');
});

test('the reload guard lasts a minute', () => {
  assert.equal(reloadedRecently(null, 1000), false);
  assert.equal(reloadedRecently(1000, 1000 + RELOAD_GUARD - 1), true);
  assert.equal(reloadedRecently(1000, 1000 + RELOAD_GUARD), false);
  assert.equal(reloadedRecently(5000, 1000), false); // a clock set back doesn't count
});

test('the world travels as moments, not as settings', () => {
  const snap = { 'world.world3': '{}', 'world.moments': '{}', 'renderer.params': '{}', 'time.open': 'true' };
  assert.deepEqual(Object.keys(settingsOf(snap)), ['renderer.params', 'time.open']);
});

test('incoming batches are the other devices\' since the last, oldest first; a batch names its rows', () => {
  const batches = [{ at: 5, device: 'b', rows: [] }, { at: 3, device: 'b', rows: [] }, { at: 4, device: 'a', rows: [] }, { at: 1, device: 'b', rows: [] }, null];
  assert.deepEqual(incoming(batches, 2, 'a').map((b) => b.at), [3, 5]);
  assert.deepEqual(batchesOf([], 'a'), []);
  assert.deepEqual(batchesOf([{ seq: 4 }, { seq: 7 }], 'a', 9), [{ at: 9, device: 'a', from: 4, to: 7, rows: [{ seq: 4 }, { seq: 7 }] }]);
  const big = Array.from({ length: 30 }, (_, i) => ({ seq: i + 1, text: 'x'.repeat(LIMIT / 10) }));
  const cut = batchesOf(big, 'a', 1);
  assert.ok(cut.length >= 3 && cut.every((b) => JSON.stringify(b.rows).length <= LIMIT) && cut.map((b) => b.at).join() === cut.map((_, i) => i + 1).join());
  assert.deepEqual(cut.flatMap((b) => b.rows.map((r) => r.seq)), big.map((r) => r.seq));

});
