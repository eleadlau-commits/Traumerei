// Tests for the kinds of item (items/index.js, missing.js): a plugin's kind comes and goes with
// the slot, a broken one is skipped, and a thought whose kind is switched off is never lost.

import { test, assert } from 'folio/testing';
import { ui } from 'folio';
import { ITEMS, BUILT_IN, setKinds, kindFor, isKnown, lacks } from '../items/index.js';
import { emptyWorld, create, update, kindOf, isLeaf, thoughtText, MESSY } from '../model.js';

const haiku = {
  kind: 'haiku',
  name: 'Haiku',
  tidy: (f, h) => { const lines = [f.a, f.b, f.c].map(h.oneLine); return lines.some(Boolean) ? { a: lines[0], b: lines[1], c: lines[2] } : null; },
  text: (th) => [th.a, th.b, th.c].join(' / '),
  node: (th, el) => el('div', { class: 'haiku', 'data-id': th.id }, thoughtText(null, th)),
};

test('the built-in kinds are always there, and a plugin\'s kind comes and goes', () => {
  assert.deepEqual(BUILT_IN.map((k) => k.kind), ['line', 'passage', 'picture']);
  assert.deepEqual(setKinds([haiku]), ['line', 'passage', 'picture', 'haiku']);
  assert.equal(ITEMS.haiku, haiku);
  assert.ok(isKnown('haiku'));
  assert.deepEqual(setKinds([]), ['line', 'passage', 'picture']);
  assert.equal(ITEMS.haiku, undefined);
  assert.equal(isKnown('haiku'), false);
});

test('a kind that lacks something, or takes a built-in name, is skipped and said why', () => {
  const said = [];
  setKinds([{ kind: 'half', name: 'Half' }, { ...haiku, kind: 'passage' }, { ...haiku, kind: 'room' }, { ...haiku, kind: 'Bad Name' }], (k, why) => said.push(`${k.kind}: ${why}`));
  assert.deepEqual(Object.keys(ITEMS), ['line', 'passage', 'picture']);
  assert.equal(ITEMS.passage.name, 'Passage');
  assert.deepEqual(said, ['half: it lacks tidy, text, node', 'passage: the kind "passage" is already there', 'room: it lacks kind', 'Bad Name: it lacks kind']);
  assert.deepEqual(lacks(haiku), []);
  assert.deepEqual(lacks(null), ['kind']);
});

test('a thought of a kind switched off is kept exactly, read, and shown as a stand-in', () => {
  setKinds([haiku]);
  const w = emptyWorld(1);
  const th = create(w, MESSY, { kind: 'haiku', a: 'old pond', b: 'a frog jumps in', c: 'the sound of water' }, 2);
  assert.equal(thoughtText(w, th), 'old pond / a frog jumps in / the sound of water');
  setKinds([]); // the plugin is switched off
  assert.equal(kindOf(th), 'haiku');
  assert.ok(isLeaf(th));
  assert.equal(thoughtText(w, th), '[haiku]'); // no words it knows of; still something to read
  const stand = kindFor('haiku');
  assert.ok(stand.missing);
  assert.equal(stand.name, 'Haiku');
  const node = stand.node(th, ui.el);
  assert.ok(node.classList.contains('st-off'));
  assert.match(node.textContent, /Haiku · plugin off/);
  // Moving it (or any change) keeps every field it had.
  update(w, th.id, { dx: 12, dy: 4 }, 3);
  assert.deepEqual([w.things[th.id].a, w.things[th.id].b, w.things[th.id].c, w.things[th.id].dx], ['old pond', 'a frog jumps in', 'the sound of water', 12]);
  setKinds([haiku]); // switched on again: as it was
  assert.equal(thoughtText(w, w.things[th.id]), 'old pond / a frog jumps in / the sound of water');
  setKinds([]);
});

test('a stand-in reads the words such kinds keep, and writes them under its own kind', () => {
  const stand = kindFor('pdf-page');
  assert.equal(stand.name, 'Pdf page');
  const th = { id: 'x', kind: 'pdf-page', title: 'Chapter 2', body: 'Eigenvalues', src: 'data:…' };
  assert.equal(stand.text(th), 'Chapter 2 — Eigenvalues');
  assert.deepEqual(stand.traum.write(th), { title: 'Chapter 2', body: 'Eigenvalues' });
  assert.deepEqual(stand.traum.write({ kind: 'pdf-page', text: 'A caption', src: 'data:x' }), { title: 'A caption', body: 'data:x' });
  assert.equal(kindFor('pdf-page'), stand); // one stand-in per kind
  assert.equal(kindFor('line'), ITEMS.line);
});

test('a thought with no kind or a malformed one is still a line', () => {
  assert.equal(kindOf({}), 'line');
  assert.equal(kindOf({ kind: 'Passage!' }), 'line');
  assert.equal(kindOf({ kind: 'group' }), 'group');
  assert.equal(isLeaf({ kind: 'room' }), false);
});
