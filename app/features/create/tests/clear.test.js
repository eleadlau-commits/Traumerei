// Tests for clear space: overlapping blocks are pushed apart; fixed ones stay.

import { test, assert } from 'folio/testing';
import { clearSpace } from '../clear.js';

const box = (x, y, w, h) => ({ x, y, w, h });

test('the newer of two overlapping blocks moves clear, down the page', () => {
  const moves = clearSpace([
    { id: 'old', box: box(0, 0, 300, 90), at: 1 },
    { id: 'new', box: box(10, 40, 200, 30), at: 2 },
  ], { gap: 10 });
  assert.equal(moves.old, undefined);
  assert.equal(moves.new.dx, 0);
  assert.ok(40 + moves.new.dy >= 100); // below the old one, with the gap
});

test('a fixed block stays and the other moves around it; apart ones are left alone', () => {
  const moves = clearSpace([
    { id: 'hand', box: box(0, 0, 100, 40), fixed: true, at: 5 },
    { id: 'auto', box: box(0, 10, 100, 40), at: 1 },
    { id: 'far', box: box(900, 900, 50, 20), at: 9 },
  ], { gap: 0 });
  assert.equal(moves.hand, undefined);
  assert.equal(moves.far, undefined);
  assert.ok(moves.auto.dy >= 30);
});

test('a pile of blocks ends with none overlapping', () => {
  const bs = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, box: box(i * 5, i * 5, 120, 30), at: i }));
  const moves = clearSpace(bs, { gap: 4 });
  const out = bs.map((b) => ({ x: b.box.x + (moves[b.id]?.dx || 0), y: b.box.y + (moves[b.id]?.dy || 0), w: 120, h: 30 }));
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.ok(!hit, `${i} and ${j} overlap`);
  }
});
