// Tests for a chapter open as a document: writing in its paragraphs keeps the chapter's order.

import { test, assert } from 'folio/testing';
import * as libForRussell from '../../world/lib.js';
import { surface as surfaceForRussell } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, create, members, MESSY } from '../../world/model.js';
import { addChapter } from '../../russell/rules.js';
import { keepWords, between } from '../document.js';

bind(lib); // the world's rules, as the room gets them from the world service

function chapter(...texts) {
  const w = emptyWorld(1);
  const g = addChapter(w, MESSY, {}, 10);
  texts.forEach((t, i) => create(w, g.id, { kind: 'line', text: t }, 20 + i * 10));
  return { w, id: g.id, words: () => members(w, g.id).map((th) => th.text) };
}

test('between gives a time inside the gap, or after the last', () => {
  assert.equal(between({ at: 10 }, { at: 20 }), 15);
  assert.equal(between({ at: 10 }, null, 5), 11);
  assert.equal(between(null, { at: 10 }), 9);
  assert.equal(between(null, null, 7), 7);
});

test('Enter after a thought puts the new one just after it', () => {
  const c = chapter('One', 'Three');
  const first = members(c.w, c.id)[0];
  keepWords(c.w, c.id, null, 'Two', first.id, 100);
  assert.deepEqual(c.words(), ['One', 'Two', 'Three']);
  keepWords(c.w, c.id, null, 'Four', members(c.w, c.id).at(-1).id, 200);
  assert.deepEqual(c.words(), ['One', 'Two', 'Three', 'Four']);
});

test('writing in a paragraph changes the thought, maths and new lines kept', () => {
  const c = chapter('Old');
  const th = members(c.w, c.id)[0];
  keepWords(c.w, c.id, th.id, 'Let $A$ be\na matrix', null, 100);
  assert.deepEqual(c.words(), ['Let $A$ be\na matrix']);
});

test('an emptied thought goes, and an empty new one is never made', () => {
  const c = chapter('One', 'Two');
  assert.equal(keepWords(c.w, c.id, null, '   ', null, 100), null);
  assert.equal(members(c.w, c.id).length, 2);
  keepWords(c.w, c.id, members(c.w, c.id)[0].id, '', null, 100);
  assert.deepEqual(c.words(), ['Two']);
});
