// Tests for how rooms look.

import { test, assert } from 'folio/testing';
import { rgb, hex, toHsl, fromHsl, pageLook, roomLook, squareLook, lookPrefs, LOOK, LIGHT, LIGHT_MESSY } from '../look.js';

test('colours go to hex and back', () => {
  assert.deepEqual(rgb('#f2ebd9'), [242, 235, 217]);
  assert.equal(hex([242, 235, 217]), '#f2ebd9');
  assert.equal(rgb('nope'), null);
});

test('HSL there and back keeps the colour', () => {
  const c = [180, 120, 60];
  const back = fromHsl(toHsl(c)).map(Math.round);
  assert.deepEqual(back, c);
});

test('the rooms page is the picture\'s gradient under a light opacity mask', () => {
  const p = pageLook({ top: [200, 200, 200], bottom: [100, 100, 100] });
  assert.equal(p.top, 'rgb(200 200 200 / 1)');
  assert.equal(p.bottom, 'rgb(100 100 100 / 1)');
  assert.equal(p.mask, 'rgb(0 0 0 / 0.1)');
});

test('room squares are see-through, and Messy thoughts is the deepest', () => {
  const room = squareLook({}), messy = squareLook({}, true);
  assert.ok(room.alpha > 0 && room.alpha < messy.alpha && messy.alpha < 0.5);
  assert.match(squareLook({ tint: '#336699' }).fill, /^rgb\(51 102 153 \//);
});

test('Messy thoughts is darker than other rooms by default', () => {
  assert.ok(LIGHT_MESSY < LIGHT);
  assert.ok(roomLook({}, undefined, true).light < roomLook({}).light);
});

test('a dark room gets pale words, a light one dark ink', () => {
  assert.ok(roomLook({ light: 0.2 }).dark);
  assert.ok(!roomLook({ light: 0.9 }).dark);
  assert.ok(roomLook({ light: 0.2 }).ink !== roomLook({ light: 0.9 }).ink);
});

test('a room keeps its own tint and opacity', () => {
  const look = roomLook({ tint: '#336699', opacity: 0.5 });
  assert.equal(look.tint, '#336699');
  assert.match(look.top, / \/ 0\.5\)$/);
});

test('Settings → Rooms: saved values are checked, and change the look', () => {
  const p = lookPrefs({ mask: 0.3, maskColour: '#102030', square: 'x', tint: 'nope', glow: 0.2 });
  assert.equal(p.mask, 0.3);
  assert.equal(p.square, LOOK.square);
  assert.equal(p.tint, '');
  assert.equal(pageLook(null, p).mask, 'rgb(16 32 48 / 0.3)');
  assert.ok(squareLook({}, false, { ...p, square: 1.2 }).alpha > squareLook({}, false, p).alpha);
  assert.equal(roomLook({}, undefined, false, { ...p, tint: '#336699', saturation: 0 }).tint, '#336699');
  assert.equal(roomLook({}, undefined, true, { ...p, lightMessy: 0.3 }).light, 0.3);
});
