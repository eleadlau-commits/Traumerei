// Tests for the engine's rules: hashing and streams, colour, stick-breaking, the field and M8.

import { test, assert } from 'folio/testing';
import { cyrb53, stream } from '../engine/random.js';
import { oklabL, oklabToSrgb, INK, PAPER, inkPaperLUT } from '../engine/colour.js';
import { tone, imageSeed } from '../engine/monochrome.js';
import { stickBreaking } from '../engine/skeleton.js';
import { quantile } from '../engine/field.js';
import { gaussianBlur } from '../engine/render.js';
import { components, judge } from '../engine/components.js';
import { Engine, DEFAULTS } from '../engine/index.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// A small test picture: a gradient with a bright disc.
function picture(W, H) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const q = 4 * (y * W + x);
      const disc = Math.hypot(x - W * 0.3, y - H * 0.6) < H * 0.2 ? 120 : 0;
      rgba[q] = Math.min(255, (255 * x) / W + disc);
      rgba[q + 1] = Math.min(255, (255 * y) / H + disc);
      rgba[q + 2] = 90;
      rgba[q + 3] = 255;
    }
  }
  return rgba;
}

test('cyrb53 matches its published value', () => {
  assert.equal(cyrb53('a'), 7929297801672961);
});

test('named streams are repeatable and independent', () => {
  const a = stream(42, ':skeleton');
  const b = stream(42, ':skeleton');
  const c = stream(42, ':warp');
  const xs = [a.U(), a.U(), a.N()];
  assert.deepEqual(xs, [b.U(), b.U(), b.N()]);
  assert.ok(xs[0] !== c.U());
});

test('OKLab L is 0 for black and 1 for white', () => {
  assert.ok(near(oklabL(0, 0, 0), 0));
  assert.ok(near(oklabL(1, 1, 1), 1, 1e-4));
});

test('OKLab white goes back to sRGB white', () => {
  const rgb = oklabToSrgb([1, 0, 0]);
  rgb.forEach((c) => assert.ok(near(c, 1, 1e-3)));
});

test('the LUT runs from ink to paper', () => {
  const lut = inkPaperLUT();
  const ink = oklabToSrgb(INK).map((c) => Math.round(255 * c));
  const paper = oklabToSrgb(PAPER).map((c) => Math.round(255 * c));
  assert.deepEqual([...lut.slice(0, 3)], ink);
  assert.deepEqual([...lut.slice(765, 768)], paper);
});

test('tone keeps densities between d_min and d_max', () => {
  const L = Float32Array.from([0, 0.2, 0.5, 0.8, 1]);
  const t = tone(L, [0.2, 0.8], { k: 4, gamma: 1, dMin: 0.65, dMax: 0.97 });
  assert.ok(near(t[0], 0.65, 1e-6) && near(t[1], 0.65, 1e-6));
  assert.ok(near(t[3], 0.97, 1e-6) && near(t[4], 0.97, 1e-6));
  assert.ok(near(t[2], 0.81, 1e-6));
});

test('stick-breaking stays under κ, sorted, at most 12 pieces', () => {
  for (let s = 0; s < 20; s++) {
    const A = stickBreaking(stream(s, ':skeleton').U, { kappa: 0.35, theta: 1.5, Amin: 0.005 });
    assert.ok(A.length >= 1 && A.length <= 12);
    assert.ok(A.reduce((x, y) => x + y, 0) <= 0.35 + 1e-9);
    for (let i = 1; i < A.length; i++) assert.ok(A[i] <= A[i - 1]);
  }
});

test('quantile interpolates', () => {
  assert.equal(quantile([3, 1, 2, 4, 5], 0.5), 3);
  assert.ok(near(quantile([0, 1], 0.25), 0.25));
});

test('components finds two blobs and judges their sizes', () => {
  const G = { gw: 6, gh: 3, hx: 1, hy: 1 };
  const Fp = Float32Array.from([1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0]);
  const comps = components(G, Fp, 0.5, 0.1);
  assert.equal(comps.length, 2);
  const verdict = judge(comps, { x: 1, y: 1 }, 1, 'gaussian', 0.1);
  assert.equal(verdict.pairs.length, 1); // equal areas: ratio 1 ≥ 0.85
  assert.ok(!verdict.pass);
});

test('the same picture always gives the same seed and mask', () => {
  const rgba = picture(160, 120);
  const one = new Engine();
  const two = new Engine();
  assert.equal(one.load(rgba, 160, 120).seed, imageSeed(rgba, 160, 120));
  two.load(rgba, 160, 120);
  const r1 = one.mask(DEFAULTS, { x: 0.5, y: 0.5 });
  const r2 = two.mask(DEFAULTS, { x: 0.5, y: 0.5 });
  assert.equal(r1.best.n, r2.best.n);
  assert.equal(r1.best.T, r2.best.T);
  assert.deepEqual([...one.view('base', DEFAULTS, r1).rgba.slice(0, 400)], [...two.view('base', DEFAULTS, r2).rgba.slice(0, 400)]);
});

test('the mask covers about κ of the picture', () => {
  const e = new Engine();
  e.load(picture(200, 200), 200, 200);
  const r = e.mask(DEFAULTS, { x: 0.4, y: 0.6 });
  const m = e.fullMask(DEFAULTS, r);
  const cover = m.reduce((s, v) => s + v, 0) / m.length;
  assert.ok(Math.abs(cover - DEFAULTS.kappa) < 0.03);
});

test('the blur keeps the total and softens a step', () => {
  const G = { gw: 40, gh: 1 };
  const v = Float32Array.from({ length: 40 }, (_, i) => (i >= 10 && i < 30 ? 1 : 0));
  const b = gaussianBlur(G, v, 2);
  assert.ok(near(b.reduce((s, x) => s + x, 0), 20, 1e-3));
  assert.ok(b[10] > 0.3 && b[10] < 0.7 && b[20] > 0.99);
});

test('feather widens the fade but keeps the coverage', () => {
  const e = new Engine();
  e.load(picture(200, 200), 200, 200);
  const r = e.mask(DEFAULTS, { x: 0.5, y: 0.5 });
  const soft = (m) => m.filter((v) => v > 0.05 && v < 0.95).length;
  const hard = e.fullMask({ ...DEFAULTS, feather: 0 }, r).slice();
  const feathered = e.fullMask({ ...DEFAULTS, feather: 0.04 }, r);
  assert.ok(soft(feathered) > 3 * soft(hard));
  const mean = (m) => m.reduce((s, v) => s + v, 0) / m.length;
  assert.ok(Math.abs(mean(feathered) - mean(hard)) < 0.02);
});
