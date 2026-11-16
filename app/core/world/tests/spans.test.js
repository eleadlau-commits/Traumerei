// Spans (spans.js): the look of words in a thought, kept on the mark, following its words.
import { test, assert } from 'folio/testing';
import * as S from '../spans.js';
import { emptyWorld, addRoom, create, update } from '../model.js';

const pairs = (list) => (list || []).map((s) => [s.from, s.to, s.kind]);

test('spans follow the words: typing before moves them, inside stretches, around stays outside, deleting them takes them away', () => {
  const sp = [{ from: 2, to: 6, kind: 'bold' }];
  assert.deepEqual(pairs(S.shift(sp, 'a bold x', 'so a bold x')), [[5, 9, 'bold']]);
  assert.deepEqual(pairs(S.shift(sp, 'a bold x', 'a boXld x')), [[2, 7, 'bold']]);
  assert.deepEqual(pairs(S.shift(sp, 'a bold x', 'a boldly x')), [[2, 6, 'bold']]);
  assert.deepEqual(pairs(S.shift(sp, 'a bold x', 'a Xbold x')), [[3, 7, 'bold']]);
  assert.equal(S.shift(sp, 'a bold x', 'a  x'), null);
});

test('toggle turns a kind on over words, and off where they have it; one kind merges', () => {
  let sp = S.toggle(null, 'bold', 0, 3, 10);
  assert.deepEqual(pairs(sp), [[0, 3, 'bold']]);
  sp = S.toggle(sp, 'bold', 2, 6, 10);
  assert.deepEqual(pairs(sp), [[0, 6, 'bold']]);
  sp = S.toggle(sp, 'bold', 2, 4, 10);
  assert.deepEqual(pairs(sp), [[0, 2, 'bold'], [4, 6, 'bold']]);
  assert.deepEqual(pairs(S.clean([{ from: -3, to: 99, kind: 'x' }, { from: 4, to: 4, kind: 'y' }, { from: 1, to: 2, kind: 'BAD' }], 5)), [[0, 5, 'x']]);
});

test('Markdown writes a span kind\'s marks hugging the words', () => {
  const kinds = [{ kind: 'bold', md: ['**', '**'] }, { kind: 'italic', md: ['*', '*'] }];
  assert.equal(S.markdown('a bold word', [{ from: 1, to: 7, kind: 'bold' }], kinds), 'a **bold** word');
  assert.equal(S.markdown('all of it', [{ from: 0, to: 9, kind: 'bold' }, { from: 4, to: 6, kind: 'italic' }], kinds), '**all *of* it**');
  assert.equal(S.markdown('plain', [{ from: 0, to: 5, kind: 'unknown' }], kinds), 'plain');
});

test('a thought keeps its spans, tidied, and its words carry them when written again', () => {
  const w = emptyWorld(1);
  const room = addRoom(w, 'Study', 2);
  const th = create(w, room.id, { kind: 'line', text: 'a bold word', spans: [{ from: 2, to: 6, kind: 'bold' }, { from: 0, to: 0, kind: 'x' }] }, 3);
  assert.deepEqual(pairs(th.spans), [[2, 6, 'bold']]);
  update(w, th.id, { text: 'so a bold word' }, 4);
  assert.deepEqual(pairs(w.things[th.id].spans), [[5, 9, 'bold']]);
  update(w, th.id, { spans: null }, 5);
  assert.ok(!('spans' in w.things[th.id]));
});

test('segments cut the words where any look begins or ends', () => {
  const segs = S.segments(10, [{ from: 2, to: 5, class: 'bold' }, { from: 4, to: 8, class: 'wavy' }], [9]);
  assert.deepEqual(segs.map((g) => [g.from, g.to, g.classes.join(' ')]), [[0, 2, ''], [2, 4, 'bold'], [4, 5, 'bold wavy'], [5, 8, 'wavy'], [8, 9, ''], [9, 10, '']]);
});
