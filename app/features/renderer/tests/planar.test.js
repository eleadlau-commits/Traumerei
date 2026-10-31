// Tests for the Planar mode: the fog (F1–F6).

import { test, assert } from 'folio/testing';
import { fog, fogRGB, kmeans, sample } from '../engine/planar.js';
import { DEFAULTS } from '../engine/index.js';
import { LINEAR_BYTE, linearToOklab, oklabToOklch, hexToOklab } from '../engine/colour.js';

const W = 150;
const H = 100;
const P = { ...DEFAULTS };

function picture(f) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rgba.set([...f(x, y), 255], 4 * (y * W + x));
  return rgba;
}
const lch = (rgba, x, y) => {
  const q = 4 * (y * W + x);
  return oklabToOklch(linearToOklab([LINEAR_BYTE[rgba[q]], LINEAR_BYTE[rgba[q + 1]], LINEAR_BYTE[rgba[q + 2]]]));
};
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const TEAL = [30, 160, 160];
const ORANGE = [230, 120, 40];
const halves = picture((x) => (x < W / 2 ? TEAL : ORANGE));

test('the fog is the same every time for the same picture, seed and sliders', () => {
  const a = fogRGB(fog(halves, W, H, 7, P), W, H);
  const b = fogRGB(fog(halves, W, H, 7, P), W, H);
  assert.deepEqual([...a], [...b]);
});

test('the fog keeps the palette: teal stays teal and orange stays orange, roughly where they were', () => {
  const out = fogRGB(fog(halves, W, H, 7, { ...P, fogA: 0 }), W, H);
  const [, , hTeal] = oklabToOklch(linearToOklab(TEAL.map((v) => LINEAR_BYTE[v])));
  const [, , hOrange] = oklabToOklch(linearToOklab(ORANGE.map((v) => LINEAR_BYTE[v])));
  const left = lch(out, 5, H / 2);
  const right = lch(out, W - 5, H / 2);
  assert.ok(hueGap(left[2], hTeal) < 25, `left hue ${left[2]} vs teal ${hTeal}`);
  assert.ok(hueGap(right[2], hOrange) < 25, `right hue ${right[2]} vs orange ${hOrange}`);
});

test('no shape survives: a fine checkerboard dissolves into one even colour', () => {
  const check = picture((x, y) => ((Math.floor(x / 5) + Math.floor(y / 5)) % 2 ? TEAL : ORANGE));
  const out = fogRGB(fog(check, W, H, 7, { ...P, fogA: 0 }), W, H);
  let max = 0;
  for (let y = 10; y < H - 10; y += 7) {
    for (let x = 10; x < W - 10; x += 7) {
      const q = 4 * (y * W + x);
      for (let c = 0; c < 3; c++) max = Math.max(max, Math.abs(out[q + c] - out[4 * (50 * W + 75) + c]));
    }
  }
  assert.ok(max <= 6, `spread ${max}`);
});

test('the lightness stays in the band, and the white picture takes the tint\'s hue', () => {
  const white = new Uint8ClampedArray(W * H * 4).fill(255);
  const f = fog(white, W, H, 7, P);
  assert.ok(f.grey);
  const out = fogRGB(f, W, H);
  const [, , hTint] = oklabToOklch(hexToOklab(P.tint));
  const [L, , h] = lch(out, 40, 40);
  assert.ok(hueGap(h, hTint) < 10, `hue ${h} vs ${hTint}`);
  assert.ok(Math.abs(L - P.fogHi) < 0.02, `L ${L}`);
  const dark = fogRGB(fog(picture(() => [0, 0, 0]), W, H, 7, P), W, H);
  assert.ok(Math.abs(lch(dark, 40, 40)[0] - P.fogLo) < 0.02);
});

test('k-means finds the two colours of a two-colour picture, with their shares', () => {
  const s = sample(picture((x) => (x < W * 0.7 ? TEAL : ORANGE)), W, H, P.tint);
  const pal = kmeans(s.lab, s.sw * s.sh, 3);
  assert.ok(pal.length >= 2);
  assert.ok(Math.abs(pal[0].share - 0.7) < 0.05, `share ${pal[0].share}`);
});
