// Tests for surfaces (surface.js): where a point falls on one, its size, and the room's side:
// mounted into the element drawn for a mark or a box, kept across drawings, focused by a click,
// given back with Esc, one gesture held from down to up, and left when no longer drawn.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { Surfaces, localPoint, sizeFor, pointerOf, SIZE } from '../surface.js';

bind(lib);

test('a point on a surface is in its own units, however far the room is zoomed', () => {
  // A 240 × 160 surface drawn at twice the size, its corner at (100, 50) on the screen.
  const rect = { left: 100, top: 50, width: 480, height: 320 };
  assert.deepEqual(localPoint(rect, 240, 160, 100, 50), { x: 0, y: 0 });
  assert.deepEqual(localPoint(rect, 240, 160, 580, 370), { x: 240, y: 160 });
  assert.deepEqual(localPoint(rect, 240, 160, 340, 210), { x: 120, y: 80 });
});

test('a surface takes the size its rule gave, else its own, else the room\'s', () => {
  assert.deepEqual(sizeFor({ width: '400px', minHeight: '300px' }, { width: 240, height: 160 }), { width: 400, height: 300 });
  assert.deepEqual(sizeFor({ width: '', minHeight: '' }, { width: 120, height: 90 }), { width: 120, height: 90 });
  assert.deepEqual(sizeFor({}, {}), { ...SIZE });
});

test('what a plugin hears of the pointer is plain and frozen', () => {
  const e = pointerOf('move', { pressure: 0.7, buttons: 1, pointerType: 'pen', shiftKey: true, altKey: false, ctrlKey: false, metaKey: true }, { x: 3, y: 4 });
  assert.deepEqual({ ...e }, { type: 'move', x: 3, y: 4, pressure: 0.7, buttons: 1, pointer: 'pen', shift: true, alt: false, ctrl: true });
  assert.ok(Object.isFrozen(e));
});

// A room with just enough of the Room class for surfaces: a world, a canvas, the slot.
function fakeRoom(surfaces) {
  const w = lib.model.emptyWorld();
  const r = lib.model.addRoom(w, 'Pad');
  const had = Object.values(lib.items.ITEMS).filter((k) => !lib.items.BUILT_IN.includes(k));
  lib.items.setKinds([...had, { kind: 'pad-test', name: 'Pad', surface: 'pad', tidy: (f) => f, text: () => 'pad', node: (th, el) => el('div', { class: 'pad-picture' }, 'pad') }]);
  const th = lib.model.create(w, r.id, { kind: 'pad-test', n: 1 });
  const world$ = document.createElement('div');
  document.body.append(world$);
  const room = Object.create(Surfaces.prototype);
  Object.assign(room, {
    world: w, roomId: r.id, world$, ont: { boxes: () => [{ x: 0, y: 0, w: 300, h: 100, surface: 'pad' }] }, locked: false, undone: 0,
    slot: () => ({ items: surfaces }), undo() { this.undone++; },
  });
  const draw = () => {
    world$.replaceChildren(
      Object.assign(document.createElement('div'), { className: 'room-float' }),
      Object.assign(document.createElement('div'), { className: 'room-cell' }));
    world$.firstChild.dataset.thought = th.id;
    world$.firstChild.append(Object.assign(document.createElement('div'), { className: 'pad-picture' }));
    world$.lastChild.dataset.box = '0';
    world$.lastChild.dataset.surface = 'pad';
    room.mountSurfaces();
  };
  return { w, th, room, world$, draw, done: () => { world$.remove(); lib.items.setKinds(had); } };
}

test('a surface is drawn in the element of its mark and of its box, kept across drawings, and left when gone', () => {
  const calls = [];
  const s = { id: 'pad', width: 200, height: 120, draw: (el, ctx) => calls.push(['draw', ctx.mark ? 'mark' : 'box', ctx.width, ctx.height]), leave: (el, ctx) => calls.push(['leave', ctx.mark ? 'mark' : 'box']), hold: () => () => {} };
  const { th, w, room, world$, draw, done } = fakeRoom([s]);
  draw();
  const host = world$.querySelector(`[data-thought] .room-surface`);
  assert.ok(host, 'the mark shows its surface');
  assert.equal(world$.querySelector('.pad-picture'), null, 'in place of its picture');
  assert.equal(host.style.width, '200px');
  assert.ok(world$.querySelector('[data-box] .room-surface'), 'the box shows its surface');
  assert.deepEqual(calls, [['draw', 'mark', 200, 120], ['draw', 'box', 300, 100]]);
  draw();
  assert.equal(world$.querySelector(`[data-thought] .room-surface`), host, 'the same element, moved into the new drawing');
  assert.equal(calls.length, 2, 'nothing changed, so nothing drawn again');
  // A moment later: made and changed in the same millisecond, the stamp (edited) would read the same.
  lib.model.update(w, th.id, { n: 2 }, (th.edited ?? th.at) + 1000);
  draw();
  assert.deepEqual(calls.at(-1), ['draw', 'mark', 200, 120], 'its mark changed: drawn again');
  world$.replaceChildren();
  room.mountSurfaces();
  assert.deepEqual(calls.slice(-2).map((c) => c.join(' ')).sort(), ['leave box', 'leave mark']);
  done();
});

test('focused, a surface hears one gesture held from down to up, its keys, and gives the room back on Esc', () => {
  const heard = [];
  let held = 0, let_go = 0;
  const s = { id: 'pad', draw() {}, hold: () => { held++; return () => { let_go++; }; },
    pointer: (e) => heard.push(e.type), key: (e) => { heard.push(`key ${e.key}`); return e.key === 'x'; }, focus: () => heard.push('focus'), blur: () => heard.push('blur') };
  const { room, world$, draw, done } = fakeRoom([s]);
  draw();
  const h = [...room.liveSurfaces.values()].find((x) => x.o.mark);
  // Not focused: a press goes to the room, so the plugin hears nothing.
  h.node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
  assert.deepEqual(heard, []);
  room.focusSurface(h);
  assert.equal(document.activeElement, h.keys);
  assert.ok(h.node.classList.contains('room-surface-on'));
  let reachedRoom = false;
  const roomHears = () => { reachedRoom = true; };
  world$.addEventListener('pointerdown', roomHears);
  h.node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 2, clientX: 5, clientY: 5 }));
  h.node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 9, clientY: 9 }));
  assert.equal(let_go, 0, 'held while the pointer is down');
  h.node.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 9, clientY: 9 }));
  assert.equal(reachedRoom, false, 'the room did not hear the press');
  assert.deepEqual([held, let_go], [1, 1]);
  // A redraw while focused keeps the focus.
  draw();
  assert.equal(document.activeElement, h.keys);
  const key = (k, o = {}) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }); h.keys.dispatchEvent(e); return e; };
  assert.equal(key('x').defaultPrevented, true);
  key('z', { ctrlKey: true });
  assert.equal(room.undone, 1, 'Ctrl+Z undoes, and the plugin never hears it');
  key('Escape');
  assert.equal(h.focused, false);
  assert.deepEqual(heard, ['focus', 'down', 'move', 'up', 'key x', 'blur']);
  world$.removeEventListener('pointerdown', roomHears);
  done();
});

test('a click outside a focused surface gives the room back', () => {
  const s = { id: 'pad', draw() {}, hold: () => () => {} };
  const { room, draw, done } = fakeRoom([s]);
  draw();
  const h = [...room.liveSurfaces.values()][0];
  room.focusSurface(h);
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  assert.equal(h.focused, false);
  done();
});

test('a surface whose draw throws changes nothing in the room', () => {
  const s = { id: 'pad', draw() { throw new Error('broken'); }, hold: () => () => {} };
  const { world$, draw, done } = fakeRoom([s]);
  const warn = console.warn; console.warn = () => {};
  try { draw(); } finally { console.warn = warn; }
  assert.ok(world$.querySelector('.room-surface'));
  done();
});
