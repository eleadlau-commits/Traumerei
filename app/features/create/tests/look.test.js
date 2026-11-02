// Tests for how rooms look.

import { test, assert } from 'folio/testing';
import { rgb, hex, toHsl, fromHsl, toOklch, fromOklch, pageLook, roomLook, squareLook, lookPrefs, savedLook, LOOK, LIGHT, LIGHT_MESSY, PALETTE, DEEPER } from '../look.js';

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

test('OKLCh there and back keeps the colour', () => {
  for (const c of [[242, 235, 217], [51, 102, 153], [20, 20, 20]]) assert.deepEqual(fromOklch(toOklch(c)), c);
});

test('the rooms page\'s mask is the palette\'s ink at the mask\'s opacity', () => {
  const p = pageLook({ top: [200, 200, 200], bottom: [100, 100, 100] });
  assert.equal(p.top, 'rgb(200 200 200 / 1)');
  assert.equal(p.mask, 'rgb(43 42 39 / 0.1)');
  assert.equal(pageLook(null, LOOK, { ...PALETTE, ink: '#102030' }).mask, 'rgb(16 32 48 / 0.1)');
});

test('a square is a deeper version of its room, and Messy thoughts is the deepest', () => {
  const room = squareLook({}), messy = squareLook({}, true);
  assert.ok(room.alpha > 0 && room.alpha < messy.alpha && messy.alpha < 0.5);
  const blue = { tint: '#336699', light: 0.7 };
  const fill = rgb('#' + squareLook(blue).fill.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''));
  const [L, , h] = toOklch(fill), inside = toOklch(rgb(roomLook(blue).colour));
  assert.ok(Math.abs(L - (inside[0] - DEEPER)) < 0.01);
  assert.ok(Math.abs(h - inside[2]) < 3);
});

test('a room with no colour of its own takes the paper\'s hue', () => {
  const [, , h] = toOklch(rgb(roomLook({}).colour));
  assert.ok(Math.abs(h - toOklch(rgb(PALETTE.paper))[2]) < 3);
  const [, , h2] = toOklch(rgb(roomLook({}, { ...PALETTE, paper: '#d8e0ea' }).colour));
  assert.ok(h2 > 200 && h2 < 300);
});

test('Messy thoughts is darker than other rooms by default', () => {
  assert.ok(LIGHT_MESSY < LIGHT);
  assert.ok(roomLook({}, undefined, true).light < roomLook({}).light);
});

test('a dark room gets the pale for words, a light one the ink', () => {
  assert.ok(roomLook({ light: 0.2 }).dark);
  assert.ok(!roomLook({ light: 0.9 }).dark);
  assert.equal(roomLook({ light: 0.2 }).ink, PALETTE.pale);
  assert.equal(roomLook({ light: 0.9 }).ink, PALETTE.ink);
});

test('a room keeps its own colour and opacity', () => {
  const look = roomLook({ tint: '#336699', light: toOklch([51, 102, 153])[0], opacity: 0.5 });
  assert.equal(look.colour, '#336699');
  assert.match(look.top, / \/ 0\.5\)$/);
});

test('Settings → Rooms: saved values are checked; old (HSL) lightness is dropped', () => {
  const p = lookPrefs({ mask: 0.3, square: 'x', glow: 0.2, light: 0.5, v: 2 });
  assert.equal(p.mask, 0.3);
  assert.equal(p.square, LOOK.square);
  assert.equal(p.light, 0.5);
  assert.equal(lookPrefs({ light: 0.5 }).light, LIGHT);
  assert.equal(savedLook(p).v, 2);
  assert.equal(pageLook(null, p).mask, 'rgb(43 42 39 / 0.3)');
  assert.ok(squareLook({}, false, { ...p, square: 1.2 }).alpha > squareLook({}, false, p).alpha);
  assert.equal(roomLook({}, undefined, true, { ...p, lightMessy: 0.3 }).light, 0.3);
});
