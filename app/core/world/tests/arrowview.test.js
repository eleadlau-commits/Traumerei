// Tests for the arrows on the screen (ontologies/arrowview.js), with Russell's arrows and a
// stand-in for the room.

import { test, assert } from 'folio/testing';
import { emptyWorld, create, MESSY } from '../model.js';
import { addChapter, link, unlink, labelOf, arrows, arrowsInto, parentsOf, childrenOf, setLabel, setRelation, chapterName } from '../ontologies/russell.js';
import { arrowView, arrowKey } from '../ontologies/arrowview.js';
import { layer } from '../ontologies/lines.js';

let clock = 10;
const chapter = (w, text) => {
  const g = addChapter(w, MESSY, {}, clock++);
  create(w, g.id, { kind: 'line', text }, clock++);
  return g.id;
};

// A small element maker, like the room's c.el.
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

// Three chapters, a above b and c; arrows a → b ("the shape") and a → c.
function setup(ends) {
  const w = emptyWorld(1);
  const a = chapter(w, 'Arrays'), b = chapter(w, 'Matrices'), c = chapter(w, 'Groups');
  link(w, MESSY, a, b, 'the shape');
  link(w, MESSY, a, c);
  const spots = { [a]: { at: { x: 0, y: 0 }, size: { w: 200, h: 60 } }, [b]: { at: { x: -150, y: 200 }, size: { w: 200, h: 60 } }, [c]: { at: { x: 150, y: 200 }, size: { w: 200, h: 60 } } };
  const view = arrowView({
    of: 'russell',
    net: { arrows, arrowsInto, parentsOf, childrenOf, link, unlink, setLabel, setRelation },
    boxes: () => spots, pads: () => ({}), nodeAt: () => null, name: chapterName, ...(ends ? { ends } : {}),
  });
  const room = { world: w, roomId: MESSY, el, locked: false, saved: 0, drawn: 0, setting: (k) => (k === 'line' ? 'straight' : undefined), save() { this.saved++; }, drawWorld() { this.drawn++; }, toast() {} };
  return { w, a, b, c, view, room };
}

test('each arrow is drawn as a line with an arrowhead, a hit line and its label', () => {
  const { a, b, view, room } = setup();
  const l = layer();
  const nodes = view.draw(room, l);
  assert.equal(l.querySelectorAll('path.room-arrow').length, 2);
  assert.equal(l.querySelectorAll('path.room-arrow-hit').length, 2);
  for (const p of l.querySelectorAll('path.room-arrow')) assert.match(p.getAttribute('marker-end'), /url\(#/);
  const label = nodes.find((n) => n.dataset.arrow === arrowKey(a, b) && !n.classList.contains('room-arrow-hint'));
  assert.ok(label && label.textContent.includes('the shape'));
});

test('a relation\'s ends choose the heads: plain, or both ways', () => {
  const plain = setup(() => 'none'), l1 = layer();
  plain.view.draw(plain.room, l1);
  for (const p of l1.querySelectorAll('path.room-arrow')) assert.equal(p.getAttribute('marker-end'), null);
  const both = setup(() => 'both'), l2 = layer();
  both.view.draw(both.room, l2);
  for (const p of l2.querySelectorAll('path.room-arrow')) assert.ok(p.getAttribute('marker-start') && p.getAttribute('marker-end'));
});

test('a double-click on an arrow edits it where it is; Enter keeps the new label', () => {
  const { w, a, b, view, room } = setup();
  const hit = el('div', { 'data-arrow': arrowKey(a, b) });
  const press = () => view.press(room, { target: hit, button: 0, preventDefault() {} });
  assert.equal(press(), false); // the first press is only heard
  assert.equal(press(), true);  // the second, soon after, opens the edit box
  assert.ok(view.editing(room));
  const nodes = view.draw(room, layer());
  const box = nodes.find((n) => n.classList.contains('room-arrow-edit'));
  assert.ok(box);
  const input = box.querySelector('input.room-edit-text');
  input.value = 'the entries';
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  assert.equal(view.editing(room), false);
  assert.equal(labelOf(w, MESSY, a, b), 'the entries');
  assert.ok(room.saved > 0);
});

test('a chapter\'s pop-up has a row for each arrow into it', () => {
  const { b, view, room, w } = setup();
  const rows = view.props(room, w.things[b]);
  assert.equal(rows.length, 1);
  assert.ok(rows[0].textContent.includes('From Arrays'));
  assert.equal(rows[0].querySelector('input').value, 'the shape');
});

test('the edit box\'s Remove, and Delete at the end of its label, take the arrow away', () => {
  const { w, a, b, c, view, room } = setup();
  view.edit(room, a, b);
  let box = view.draw(room, layer()).find((n) => n.classList.contains('room-arrow-edit'));
  const remove = box.querySelector('[data-arrow-remove]');
  assert.ok(remove);
  // Pressed on the canvas (it holds the pointer), so press() hears it.
  assert.equal(view.press(room, { target: remove, preventDefault() {} }), true);
  assert.deepEqual(parentsOf(w, MESSY, b), []);
  assert.equal(view.editing(room), false);
  assert.equal(room.saved, 1);
  // Delete in the label: nothing after the caret, so the arrow goes.
  view.edit(room, a, c);
  box = view.draw(room, layer()).find((n) => n.classList.contains('room-arrow-edit'));
  const input = box.querySelector('input');
  document.body.append(box);
  input.value = 'abc';
  input.setSelectionRange(1, 1);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
  assert.deepEqual(parentsOf(w, MESSY, c), [a], 'Delete with letters after the caret only deletes a letter');
  input.setSelectionRange(3, 3);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
  assert.deepEqual(parentsOf(w, MESSY, c), []);
  box.remove();
});

test('a pop-up row\'s × takes its arrow away; a locked room shows none', () => {
  const { w, a, b, view, room } = setup();
  const [row] = view.props(room, w.things[b]);
  row.querySelector('.room-arrow-x').click();
  assert.deepEqual(parentsOf(w, MESSY, b), []);
  assert.equal(room.saved, 1);
  link(w, MESSY, a, b);
  room.locked = true;
  assert.equal(view.props(room, w.things[b])[0].querySelector('.room-arrow-x'), null);
});
