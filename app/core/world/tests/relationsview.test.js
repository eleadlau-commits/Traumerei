// Tests for the relations editor (ontologies/relationsview.js): a row for each relation, rename,
// ends, line and colour, add, reorder, and delete (asking what its links become).

import { test, assert } from 'folio/testing';
import { relationsRow } from '../ontologies/relationsview.js';

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
}

function editor(value, { ends = true, uses = () => 0 } = {}) {
  const seen = [], toasts = [], retagged = [];
  const room = { saved: 0, save() { this.saved++; } };
  const st = { key: 'relations', label: 'Relations', default: ['related to'], ends, none: 'none', uses: (c, n) => uses(n), retag: (c, a, b) => retagged.push([a, b]) };
  const node = relationsRow(st, { el, value, onChange: (v) => seen.push(v), c: room, toast: (t) => toasts.push(t) });
  document.body.append(node);
  return { node, seen, toasts, retagged, room, rows: () => [...node.querySelectorAll('.room-rel-row')], last: () => seen.at(-1) };
}
const change = (n, v) => { n.value = v; n.dispatchEvent(new Event('change')); };
const key = (n, k, more = {}) => n.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...more }));

test('a row for each relation, with its name, ends, line and colour; Russell\'s has no ends', () => {
  const e = editor(['related to', 'calls up -> | dashed amber']);
  assert.equal(e.rows().length, 2);
  const r = e.rows()[1];
  assert.equal(r.querySelector('.room-rel-name').value, 'calls up');
  assert.equal(r.querySelector('.room-rel-ends').value, 'arrow');
  assert.equal(r.querySelector('.room-rel-line').value, 'dashed');
  assert.equal(r.querySelector('[aria-checked="true"]').getAttribute('aria-label'), 'amber');
  assert.equal(editor(['forgets'], { ends: false }).node.querySelector('.room-rel-ends'), null);
  e.node.remove();
});

test('changing the ends, the line and the colour; each change is one step', () => {
  const e = editor(['related to', 'calls up']);
  change(e.rows()[1].querySelector('.room-rel-ends'), 'both');
  assert.deepEqual(e.last(), ['related to', 'calls up <->']);
  change(e.rows()[1].querySelector('.room-rel-line'), 'dotted');
  assert.deepEqual(e.last(), ['related to', 'calls up <-> | dotted']);
  e.rows()[1].querySelector('[aria-label="plum"]').click();
  assert.deepEqual(e.last(), ['related to', 'calls up <-> | dotted plum']);
  e.rows()[1].querySelector('[aria-label="ink"]').click();
  assert.deepEqual(e.last(), ['related to', 'calls up <-> | dotted']);
  assert.equal(e.room.saved, 4);
  e.node.remove();
});

test('rename where it is; a name taken, or with | in it, is refused', () => {
  const e = editor(['related to', 'calls up ->']);
  change(e.rows()[1].querySelector('.room-rel-name'), 'summons');
  assert.deepEqual(e.last(), ['related to', 'summons ->']);
  change(e.rows()[1].querySelector('.room-rel-name'), 'Related To');
  change(e.rows()[1].querySelector('.room-rel-name'), 'a | b');
  assert.equal(e.seen.length, 1);
  assert.equal(e.toasts.length, 2);
  e.node.remove();
});

test('add at the foot; Alt+arrows put a row elsewhere (the first is the one new links get)', () => {
  const e = editor(['related to']);
  const add = e.node.querySelector('.room-rel-add');
  add.value = 'echoes';
  key(add, 'Enter');
  assert.deepEqual(e.last(), ['related to', 'echoes']);
  key(e.rows()[1], 'ArrowUp', { altKey: true });
  assert.deepEqual(e.last(), ['echoes', 'related to']);
  e.node.remove();
});

test('delete: at once when no link has it; else it asks what its links become', () => {
  const e = editor(['related to', 'calls up ->', 'echoes'], { uses: (n) => (n === 'calls up' ? 3 : 0) });
  key(e.rows()[2], 'Delete');
  assert.deepEqual(e.last(), ['related to', 'calls up ->']);
  e.rows()[1].querySelector('.room-rel-delete').click();
  const ask = e.node.querySelector('.room-rel-asking');
  assert.ok(ask && /3 links/.test(ask.textContent));
  change(ask.querySelector('.room-rel-into'), '0');
  [...ask.querySelectorAll('button')].find((b) => b.textContent === 'Delete').click();
  assert.deepEqual(e.retagged, [['calls up', 'related to']]);
  assert.deepEqual(e.last(), ['related to']);
  // The last one stays.
  key(e.rows()[0], 'Delete');
  assert.deepEqual(e.last(), ['related to']);
  assert.match(e.toasts.at(-1), /at least one/);
  e.node.remove();
});
