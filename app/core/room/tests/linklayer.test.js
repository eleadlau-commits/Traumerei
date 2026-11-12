// Tests for a plugin's links on the canvas (linklayer.js): which become lines, which a ↗.

import { test, assert } from 'folio/testing';
import { plan, edge, isPluginKind } from '../linklayer.js';

const ROWS = [
  { id: 'k:cites:a:b', from: 'a', to: 'b', kind: 'cites' },
  { id: 'k:link:a:x', from: 'a', to: 'x', kind: 'link' },
  { id: 'k:provokes:s:b', from: 's', to: 'b', kind: 'provokes' },
];
const ends = (id) => ROWS.filter((r) => r.from === id || r.to === id);

test('a link between two marks that both show is one line, drawn once', () => {
  const { lines } = plan(new Set(['a', 'b']), ends);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].id, 'k:cites:a:b');
});

test('a link whose other end does not show is a ↗ on the mark that does, either way round', () => {
  const { stubs } = plan(new Set(['a', 'b']), ends);
  assert.deepEqual(stubs.get('a'), [{ id: 'k:link:a:x', kind: 'link', other: 'x', out: true }]);
  assert.deepEqual(stubs.get('b'), [{ id: 'k:provokes:s:b', kind: 'provokes', other: 's', out: false }]);
});

test('nothing shows: nothing to draw', () => {
  const { lines, stubs } = plan(new Set(), ends);
  assert.equal(lines.length + stubs.size, 0);
});

test('structure is each mode\'s own to draw; every other kind is a plugin\'s', () => {
  const structure = ['part of', 'stands for', 'relation'];
  for (const k of structure) assert.equal(isPluginKind(k, structure), false);
  assert.equal(isPluginKind('cites', structure), true);
});

test('a line leaves a box at its edge, toward the other', () => {
  const a = { x: 0, y: 0, w: 100, h: 20 }, b = { x: 300, y: 0, w: 100, h: 20 };
  assert.deepEqual(edge(a, b), { x: 100, y: 10 });
  assert.deepEqual(edge(b, a), { x: 300, y: 10 });
  const c = { x: 0, y: 200, w: 100, h: 20 };
  assert.deepEqual(edge(a, c), { x: 50, y: 20 });
});
