// Tests for the engine's rules: hashing and streams, colour, stick-breaking, the field, M8, the pattern
// and the spontaneity.

import { test, assert } from 'folio/testing';
import { cyrb53, stream } from '../engine/random.js';
import { oklabL, oklabToSrgb, INK, PAPER, TAN, inkPaperLUT, absorber, linearRamp } from '../engine/colour.js';
import { tone, imageSeed } from '../engine/monochrome.js';
import { stickBreaking } from '../engine/skeleton.js';
import { quantile } from '../engine/field.js';
import { gaussianBlur, washiRGB } from '../engine/render.js';
import { erf, taper, poisson, pattern } from '../engine/pattern.js';
import { components, judge } from '../engine/components.js';
import { Spontaneity, Living, addMark, reach, life, expected } from '../engine/spontaneity.js';
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

test('erf and the lopsided taper', () => {
  assert.ok(near(erf(0), 0) && near(erf(1), 0.8427008, 1e-6) && near(erf(-2), -0.9953223, 1e-6));
  assert.ok(near(taper(0.25, 0.5, 1.5), 1, 1e-9)); // peak at u* = α / (α + β)
  assert.equal(taper(0, 1, 1), 0);
  assert.equal(taper(1, 1, 1), 0);
  assert.ok(taper(0.1, 1, 1) < taper(0.4, 1, 1));
});

test('Poisson counts have the right mean, small and large', () => {
  for (const mean of [4, 200]) {
    const rng = stream(7, ':poisson');
    let sum = 0;
    for (let i = 0; i < 2000; i++) sum += poisson(rng, mean);
    assert.ok(Math.abs(sum / 2000 - mean) < 0.05 * mean);
  }
});

test('the pattern is repeatable, densities are never negative and S is centred', () => {
  const one = pattern(42, 1.5, 1, 240, 160, DEFAULTS);
  const two = pattern(42, 1.5, 1, 240, 160, DEFAULTS);
  assert.deepEqual(one.counts, two.counts);
  assert.deepEqual([...one.Dw.slice(0, 2000)], [...two.Dw.slice(0, 2000)]);
  assert.ok(one.counts.fibres > 100 && one.counts.web > 1000);
  assert.ok(one.Dw.every((v) => v >= 0) && one.Dk.every((v) => v >= 0) && one.Dw.some((v) => v > 0.1));
  assert.ok(one.S.every((v) => Math.abs(v) <= 0.5));
  assert.ok(Math.abs(one.S.reduce((s, v) => s + v, 0) / one.S.length) < 0.01);
  const other = pattern(43, 1.5, 1, 240, 160, DEFAULTS);
  assert.ok(other.Dw.some((v, i) => v !== one.Dw[i]));
});

test('absorbers darken by about e^−D, toward their colour', () => {
  const ak = absorber(INK);
  const at = absorber(TAN);
  assert.ok(near(0.2126 * at[0] + 0.7152 * at[1] + 0.0722 * at[2], 1, 1e-9));
  assert.ok(at[2] > at[1] && at[1] > at[0]); // tan absorbs blue most
  assert.ok(Math.abs(ak[0] - ak[2]) < Math.abs(at[0] - at[2]));
});

test('the composite leaves the base alone at α = 0 and tints through warm inclusions', () => {
  const ramp = linearRamp();
  const ak = absorber(INK);
  const at = absorber(TAN);
  const one = (v) => Float32Array.from([v]);
  const zero = one(0);
  const bare = washiRGB(null, { Dw: zero, Dk: zero, C: zero, S: zero }, 1, ramp, at, ak);
  const paper = oklabToSrgb(PAPER).map((c) => Math.round(255 * c));
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(bare[c] - paper[c]) <= 1);
  const off = washiRGB(null, { Dw: one(2), Dk: one(2), C: one(0.3), S: one(0.3) }, 0, ramp, at, ak);
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(off[c] - paper[c]) <= 1);
  const tan = washiRGB(null, { Dw: one(0.5), Dk: zero, C: zero, S: zero }, 1, ramp, at, ak);
  assert.ok(tan[0] - tan[2] > bare[0] - bare[2]); // warmer than paper
  const lit = washiRGB(null, { Dw: zero, Dk: zero, C: zero, S: one(0.1) }, 1, ramp, at, ak);
  assert.ok(lit[1] > bare[1]); // relief highlights rise above paper
});

test('the Washi view leaves the base view untouched', () => {
  const e = new Engine();
  e.load(picture(160, 120), 160, 120);
  const r = e.mask(DEFAULTS, { x: 0.5, y: 0.5 });
  const before = [...e.view('base', DEFAULTS, r).rgba];
  const washi = e.view('washi', DEFAULTS, r).rgba;
  assert.deepEqual([...e.view('base', DEFAULTS, r).rgba], before);
  assert.ok(washi.some((v, i) => v !== before[i]));
});

test('the Hawkes process has mean rate μ / (1 − n), and n = 0 is Poisson', () => {
  for (const nH of [0, 0.6]) {
    const P = { ...DEFAULTS, mu: 1, nH, tauH: 0.5 };
    let count = 0;
    for (let seed = 0; seed < 10; seed++) {
      const sp = new Spontaneity(seed, 1.5, 1, P);
      sp.advance(1000);
      count += sp.count;
    }
    const want = expected(P).rate * 10000; // clusters make Hawkes counts noisy, so ten runs
    assert.ok(Math.abs(count - want) < 0.04 * want, `${count} vs ${want}`);
  }
});

test('the marks at a moment do not depend on how the frames fell', () => {
  const one = new Spontaneity(7, 1.5, 1, DEFAULTS);
  for (let t = 0; t <= 60; t += 1 / 60) one.advance(t);
  const two = new Spontaneity(7, 1.5, 1, DEFAULTS);
  two.advance(60);
  const key = (sp) => sp.live.map((m) => [m.t0, m.kind, m.x, m.y, m.len].join()).join(';');
  assert.ok(one.live.length > 0);
  assert.equal(key(one), key(two));
  const other = new Spontaneity(8, 1.5, 1, DEFAULTS);
  other.advance(60);
  assert.ok(key(other) !== key(two));
});

test('offspring stay near their parents and background marks cover the whole canvas', () => {
  const P = { ...DEFAULTS, mu: 1, nH: 0.8 };
  const sp = new Spontaneity(3, 2, 1, P);
  const all = [];
  const seen = new Set();
  for (let t = 1; t <= 400; t += 1) for (const m of sp.advance(t)) if (!seen.has(m.id)) seen.add(m.id), all.push(m);
  const byId = new Map(all.map((m) => [m.id, m]));
  const roots = all.filter((m) => m.parent === null);
  const left = roots.filter((m) => m.x < 1).length;
  assert.ok(roots.length > 50 && Math.abs(left / roots.length - 0.5) < 0.15); // uniform, not drawn to any part
  const kids = all.filter((m) => byId.has(m.parent));
  const far = kids.filter((m) => Math.hypot(m.x - byId.get(m.parent).x, m.y - byId.get(m.parent).y) > 5 * P.sigmaC);
  assert.ok(kids.length > 50 && far.length < 0.02 * kids.length);
});

test('a mark is drawn in, holds and fades away', () => {
  const mk = { Td: 1, T: 2, tauF: 1 };
  assert.deepEqual(life(mk, 0), { g: 0, o: 0 });
  assert.ok(near(life(mk, 0.5).g, 0.5));
  assert.equal(life(mk, 2).o, 1);
  assert.ok(near(life(mk, 4).o, Math.exp(-1)));
});

test('marks add density only near themselves, and the living picture goes back to the base', () => {
  const W = 120;
  const H = 80;
  const cv = { W, H, scale: 80, px: 1 / 80 };
  const base = { t0: 0, x: 0.75, y: 0.5, theta: 0, len: 0.4, r: 0.05, q: 1, w: 0.02, b: 0.002, a: 1,
    alpha: 0.3, beta: 0.3, Td: 1, T: 1, tauF: 0.5 };
  for (const kind of ['dot', 'dash']) {
    const mk = { ...base, kind };
    if (kind !== 'dot') mk.pts = Float32Array.from({ length: 34 }, (_, k) => (k % 2 ? 0.5 : 0.55 + (0.4 * (k / 2)) / 16));
    mk.box = reach(mk, cv.px);
    const D = new Float32Array(W * H);
    addMark(mk, 1.5, cv, D);
    assert.ok(D[40 * W + 60] > 0.5, kind); // at the centre
    assert.ok(D[5 * W + 5] === 0 && D[40 * W + 5] === 0, kind); // far away
    const half = new Float32Array(W * H);
    addMark(mk, 0.3, cv, half); // drawn in partly: less ink
    assert.ok(half.reduce((a, v) => a + v, 0) < D.reduce((a, v) => a + v, 0), kind);
  }
  const rgba = new Uint8ClampedArray(W * H * 4).fill(200);
  const P = { ...DEFAULTS, mu: 2, muT: 1, tauF: 0.2, muR: 0.05, muLen: 0.2, muWm: 0.02 };
  const live = new Living(new Spontaneity(5, 1.5, 1, P), rgba, W, H, [1, 1, 1], 1);
  let changed = false;
  for (let t = 0; t < 5; t += 0.05) live.frame(t), (changed ||= live.rgba.some((v, i) => v !== rgba[i]));
  assert.ok(changed);
  live.process.P = { ...P, mu: 0 }; // no new marks: once the old ones are gone, the picture is the base again
  live.process.E = 0;
  live.process.next = null;
  for (let t = 5; t < 40; t += 0.5) live.frame(t);
  assert.deepEqual([...live.rgba], [...rgba]);
});

test('the Living view starts as the Washi view', () => {
  const e = new Engine();
  e.load(picture(160, 120), 160, 120);
  const r = e.mask(DEFAULTS, { x: 0.5, y: 0.5 });
  const washi = e.view('washi', DEFAULTS, r).rgba;
  const img = e.view('living', DEFAULTS, r);
  assert.deepEqual([...img.rgba], [...washi]);
  const live = e.living(DEFAULTS, img.rgba);
  live.frame(30);
  assert.deepEqual([...washi], [...img.rgba]); // the static pixels are kept; marks go in live.rgba
});

test('the marks do not depend on the anchor', () => {
  const e = new Engine();
  e.load(picture(160, 120), 160, 120);
  const marks = (anchor) => {
    const r = e.mask(DEFAULTS, anchor);
    const live = e.living(DEFAULTS, e.view('living', DEFAULTS, r).rgba);
    live.frame(40);
    return live.process.live.map((m) => [m.t0, m.x, m.y].join()).join(';');
  };
  assert.equal(marks({ x: 0.2, y: 0.3 }), marks({ x: 0.8, y: 0.7 }));
});
