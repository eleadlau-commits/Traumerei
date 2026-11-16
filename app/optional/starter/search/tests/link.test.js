// Tests for the link hand (Search.js linkTo): Ctrl+K from a chosen mark links it to a find.

import { test, assert } from 'folio/testing';
import { linkTo, KIND } from '../Search.js';

const fake = (answer = { ok: true, id: 'k:link:a:b' }) => {
  const made = [];
  return { made, links: { link: (from, to, kind) => { made.push([from, to, kind]); return answer; } }, marks: { text: () => 'words' } };
};

test('a find is linked to the chosen mark as a link, either way round', () => {
  const t = fake();
  const r = linkTo(t, 'a', { id: 'b', text: 'The other room\'s thought' });
  assert.equal(r.ok, true);
  assert.deepEqual(t.made, [['a', 'b', 'link']]);
  assert.equal(KIND.both, true);
  assert.ok(r.words.startsWith('Linked to'));
});

test('a mark is not linked to itself, and a refusal is said in its own words', () => {
  const t = fake({ ok: false, reason: 'The context is locked' });
  assert.equal(linkTo(t, 'a', { id: 'a' }).ok, false);
  assert.equal(t.made.length, 0);
  assert.deepEqual(linkTo(t, 'a', { id: 'b' }), { ok: false, words: 'The context is locked' });
});
