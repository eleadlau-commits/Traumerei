// Tests for working with Proust's links on the screen (draw.js): Ctrl+J joins the two chosen,
// each node's dot draws a link, a double-click edits one where it is, and the pop-up lists what a
// thought points to, what points to it and what it is linked with.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v2.js';
import { bind } from '../world.js';
import { emptyWorld, create, MESSY } from '../../world/model.js';
import { groupChosen } from '../../world/ontologies/index.js';
import { arrowKey } from '../../world/ontologies/arrowview.js';
import { proust, links } from '../rules.js';
import { draw, join, props, press } from '../draw.js';

bind(surface(lib));

let clock = 10;
const line = (w, text) => create(w, MESSY, { kind: 'line', text }, clock++);

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

// A stand-in for the room.
function room(w) {
  const r = {
    world: w, roomId: MESSY, el, sel: null, found: null, draft: null, locked: false, saved: 0, drawn: 0, toasts: [], went: [],
    isSel: (id) => !!r.sel && (r.sel.ids || [r.sel.id]).includes(id),
    setting: (k) => proust.settings.find((s) => s.key === k)?.default,
    thoughtNode: (th) => el('span', { class: 'room-thought' }, th.text || th.title || ''),
    draftNode: () => el('span', {}, ''),
    save() { r.saved++; }, drawWorld() { r.drawn++; }, toast(t) { r.toasts.push(t); },
    goTo(f) { r.went.push(f.id); r.sel = { kind: 'thought', id: f.id }; },
  };
  return r;
}

function three() {
  const w = emptyWorld(1);
  const [a, b, c] = ['Combray', 'Balbec', 'Venice'].map((t) => line(w, t).id);
  proust.drop(w, MESSY, a, 0, 0);
  proust.drop(w, MESSY, b, 300, 0);
  proust.drop(w, MESSY, c, 0, 300);
  return { w, a, b, c, r: room(w) };
}

test('Ctrl+J links the two chosen, from the first to the other, and opens the link to be named', () => {
  const { w, a, b, r } = three();
  r.sel = { kind: 'many', ids: [b, a] };
  join(r);
  const all = links().arrows(w, MESSY);
  assert.equal(all.length, 1);
  assert.equal(all[0].from, b);
  assert.equal(all[0].to, a);
  assert.equal(all[0].rel, 'related to');
  assert.ok(r.saved > 0);
  const out = draw(r);
  assert.ok(out.some((n) => n.classList?.contains('room-arrow-edit')), 'the edit box is open on the new link');
  // A press elsewhere keeps what was typed and closes it.
  press(r, { button: 0, target: el('div'), preventDefault() {} });
  assert.equal(draw(r).some((n) => n.classList?.contains('room-arrow-edit')), false);
});

test('Ctrl+J says why when it can\'t: not two chosen, the same link twice, a locked room', () => {
  const { w, a, b, c, r } = three();
  r.sel = { kind: 'thought', id: a };
  join(r);
  r.sel = { kind: 'many', ids: [a, b, c] };
  join(r);
  assert.equal(links().arrows(w, MESSY).length, 0);
  assert.equal(r.toasts.length, 2);
  assert.match(r.toasts[0], /Choose two/);
  r.sel = { kind: 'many', ids: [a, b] };
  join(r);
  join(r);
  assert.equal(r.toasts.at(-1), 'That link is already there.');
  r.locked = true;
  r.sel = { kind: 'many', ids: [b, c] };
  join(r);
  assert.equal(links().arrows(w, MESSY).length, 1);
});

test('a cluster can be joined like a thought', () => {
  const { w, a, b, c, r } = three();
  const g = groupChosen(proust, w, MESSY, [a, b], clock++);
  r.sel = { kind: 'many', ids: [c, g.id] };
  join(r);
  assert.deepEqual(links().arrows(w, MESSY).map((x) => [x.from, x.to]), [[c, g.id]]);
});

test('each node has a dot to draw a link from, except in a locked room', () => {
  const { a, b, c, r } = three();
  const dots = draw(r).flatMap((n) => [...(n.querySelectorAll?.('[data-dot]') || [])]).map((d) => d.dataset.dot);
  assert.deepEqual(dots.sort(), [a, b, c].sort());
  r.locked = true;
  assert.equal(draw(r).flatMap((n) => [...(n.querySelectorAll?.('[data-dot]') || [])]).length, 0);
});

test('the pop-up: what it points to, what points to it, and what it is linked with; a name goes there', () => {
  const { w, a, b, c, r } = three();
  links().link(w, MESSY, a, b, '', 'leads to');       // an arrow out of a
  links().link(w, MESSY, c, a, '', 'leads to');       // an arrow into a
  links().link(w, MESSY, a, c);                       // related to: a plain line
  const rows = props(r, w.things[a]);
  const text = rows.map((n) => n.textContent);
  assert.deepEqual(text, ['Points toBalbec', 'Pointed to byVenice', 'Linked withVenice']);
  rows[0].querySelector('button').click();
  assert.deepEqual(r.went, [b]);
  // A thought with no links has no rows.
  const d = line(w, 'Paris').id;
  proust.drop(w, MESSY, d, 600, 600);
  assert.deepEqual(props(r, w.things[d]), []);
});

test('both ways and a plain line are "linked with", once for a pair', () => {
  const { w, a, b, r } = three();
  links().link(w, MESSY, a, b, '', 'is equivalent to');
  links().link(w, MESSY, b, a);
  const rows = props(r, w.things[b]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].textContent, 'Linked withCombray');
});

test('a double-click on a link edits it where it is', () => {
  const { w, a, b, r } = three();
  links().link(w, MESSY, a, b);
  const hit = el('div', { 'data-arrow': arrowKey(a, b) });
  const e = { button: 0, target: hit, preventDefault() {} };
  assert.equal(press(r, e), false);
  assert.equal(press(r, e), true);
  const box = draw(r).find((n) => n.classList?.contains('room-arrow-edit'));
  const input = box.querySelector('input.room-edit-text');
  input.value = 'the steeples';
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(links().arrows(w, MESSY)[0].label, 'the steeples');
});

test('the × beside a name in the pop-up takes that link away; both ways for a pair', () => {
  const { w, a, b, c, r } = three();
  links().link(w, MESSY, a, b, '', 'leads to');
  links().link(w, MESSY, a, c, '', 'is equivalent to');
  links().link(w, MESSY, c, a);
  let rows = props(r, w.things[a]);
  rows[0].querySelector('.room-arrow-x').click();
  assert.equal(links().arrows(w, MESSY).some((x) => x.from === a && x.to === b), false);
  assert.equal(r.saved, 1);
  rows = props(r, w.things[a]);
  assert.equal(rows.length, 1);
  rows[0].querySelector('.room-arrow-x').click();
  assert.deepEqual(links().arrows(w, MESSY), []);
  assert.equal(r.saved, 2);
  // A locked room shows no ×.
  links().link(w, MESSY, a, b, '', 'leads to');
  r.locked = true;
  assert.equal(props(r, w.things[a])[0].querySelector('.room-arrow-x'), null);
});
