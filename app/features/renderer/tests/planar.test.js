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

// ---- The network (N1–N4) ----
import { tiles, network, counts } from '../engine/network.js';
import { describeNetwork } from '../report.js';

const NX = 1.5;
const NY = 1;

test('the tiles fill the frame exactly, without overlapping', () => {
  const t = tiles(42, NX, NY, P);
  const area = t.reduce((s, [x0, y0, x1, y1]) => s + (x1 - x0) * (y1 - y0), 0);
  assert.ok(Math.abs(area - NX * NY) < 1e-9, `area ${area}`);
  for (let i = 0; i < t.length; i++) {
    for (let j = i + 1; j < t.length; j++) {
      const [a, b] = [t[i], t[j]];
      const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
      const oy = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
      assert.ok(ox <= 1e-9 || oy <= 1e-9, `tiles ${i} and ${j} overlap`);
    }
  }
  // ρ = 6 on 1.5 × 1 is a 9 × 6 grid; merging μ = 0.45 leaves round(54 × 0.55) = 30.
  assert.equal(t.length, 30);
});

test('the network is the same every time, and only the seed changes it', () => {
  const a = JSON.stringify(network(tiles(42, NX, NY, P), NX, NY));
  assert.equal(a, JSON.stringify(network(tiles(42, NX, NY, P), NX, NY)));
  assert.ok(a !== JSON.stringify(network(tiles(43, NX, NY, P), NX, NY)));
});

test('junctions are T or crosses, lines end only on the frame, and straight lines are unbroken', () => {
  const net = network(tiles(42, NX, NY, P), NX, NY);
  const onFrame = (v) => v.x < 1e-9 || v.y < 1e-9 || v.x > NX - 1e-9 || v.y > NY - 1e-9;
  for (const v of net.nodes) {
    if (onFrame(v)) assert.equal(v.deg, 1);
    else assert.ok(v.deg === 3 || v.deg === 4, `degree ${v.deg} at ${v.x}, ${v.y}`);
  }
  for (const L of net.lines) {
    for (let k = 0; k < L.edges.length; k++) {
      const e = net.edges[L.edges[k]];
      assert.equal(e.horizontal, L.horizontal);
      if (k) assert.equal(net.edges[L.edges[k - 1]].b, e.a); // end to end
    }
  }
  // Euler: in a tiling, rectangles = segments − interior junctions + 1 (the frame's edge isn't drawn,
  // so each line end on the frame closes one more face against it): F = E + 1 − V_inner.
  const c = counts(net);
  assert.equal(c.rectangles, c.segments - (c.tees + c.crosses) + 1);
});

test('merging μ = 0 is the full grid, with only crosses', () => {
  const c = counts(network(tiles(42, NX, NY, { ...P, netMu: 0 }), NX, NY));
  assert.equal(c.rectangles, 54);
  assert.equal(c.tees, 0);
  assert.equal(c.crosses, 8 * 5);
  assert.equal(c.lines, 8 + 5);
});

test('the network report counts rectangles, junctions and length', () => {
  const net = { ...network(tiles(42, NX, NY, P), NX, NY), ms: 3 };
  assert.match(describeNetwork(net, P), /^Network \(streams :planar:net:grid :planar:net:merge\): 30 rectangles, \d+ junctions \(\d+ T, \d+ crosses\)/);
});

// ---- The flashes (E1–E5) ----
import { Flashes, ball, revealed, revealRun, reach } from '../engine/flashes.js';

const NET = network(tiles(42, NX, NY, P), NX, NY);

test('the flashes at a moment do not depend on how the frames fell', () => {
  const a = new Flashes(9, NET, P);
  const b = new Flashes(9, NET, P);
  for (let t = 0; t < 30; t += 0.016) a.pieces(t);
  assert.deepEqual(a.pieces(30), b.pieces(30));
  a.pieces(5); // going back replays from 0
  assert.deepEqual(a.pieces(30), b.pieces(30));
});

test('a glint stays on one straight line, and every flash fades out completely', () => {
  const f = new Flashes(9, NET, { ...P, flashPiG: 1 });
  let seen = 0;
  for (let t = 0.5; t < 60; t += 0.5) {
    const byGlint = f.pieces(t);
    for (const p of byGlint) {
      assert.ok(p.x0 === p.x1 || p.y0 === p.y1, 'axis-aligned');
      seen++;
    }
  }
  assert.ok(seen > 0);
  f.P = { ...P, flashMu: 0 }; // no new events: once the last has faded, nothing shows
  f.hawkes.E = 0;
  f.hawkes.next = null;
  assert.equal(f.pieces(200).length, 0);
});

test('black lines spread along the network and most stay on their own segment', () => {
  const i = NET.edges.findIndex((e) => e.length > 0.15);
  const small = ball(NET, i, NET.edges[i].length / 2, 0.03);
  assert.equal(small.length, 1);
  assert.ok(Math.abs(small[0][2] - small[0][1] - 0.06) < 1e-9);
  const big = ball(NET, i, NET.edges[i].length / 2, NET.edges[i].length / 2 + 0.05);
  assert.ok(big.length >= 3, 'past both ends, into every edge at each junction');
  // With r = 0.05, how many cascades leave their segment: R must exceed the distance to the nearest node.
  const f = new Flashes(9, NET, { ...P, flashPiG: 0 });
  let stay = 0;
  let all = 0;
  for (let t = 1; t <= 600; t += 1) {
    for (const x of f.advance(t)) {
      if (x.counted) continue;
      x.counted = true;
      const e = NET.edges[x.at.edge];
      all++;
      if (x.R < Math.min(x.at.pos, e.length - x.at.pos)) stay++;
    }
  }
  assert.ok(stay / all > 0.5, `${stay} of ${all} stay on their segment`);
});

test('the revealed fraction counts each part of the network once', () => {
  const f = new Flashes(9, NET, P);
  const L = NET.lines.find((l) => !l.horizontal);
  const piece = { x0: L.at, y0: L.from, x1: L.at, y1: L.to, a0: 1, a1: 1 };
  f.pieces = () => [piece, piece];
  assert.ok(Math.abs(revealed(NET, f, 1) - (L.to - L.from) / NET.length) < 1e-9);
});

test('over six hours, the largest reveal in each 10 minutes is usually small and never past 60%', () => {
  const r = revealRun(7, NET, P, 6);
  const sorted = [...r.maxima].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  const msg = `10-minute maxima: median ${median.toFixed(3)}, largest ${r.overall.toFixed(3)}, mean R ${r.mean.toFixed(4)}`;
  assert.equal(r.maxima.length, 36);
  assert.ok(median > 0.1 && median < 0.35, msg);
  assert.ok(r.overall < 0.6, msg);
});

test('the black front is blurred: the reach covers the ball once, fading over its last w_f', () => {
  const i = NET.edges.findIndex((e) => e.length > 0.15);
  for (const rho of [0.03, 0.2, 0.5]) {
    const pos = NET.edges[i].length / 3;
    const len = (ps, a, b) => ps.reduce((s, p) => s + p[b] - p[a], 0);
    const pieces = reach(NET, i, pos, rho);
    assert.ok(Math.abs(len(pieces, 1, 2) - len(ball(NET, i, pos, rho), 1, 2)) < 1e-9, `same length at ρ ${rho}`);
    for (const [, , , d0, d1] of pieces) assert.ok(d0 <= rho + 1e-12 && d1 <= rho + 1e-12 && d0 >= -1e-12 && d1 >= -1e-12);
  }
  const f = new Flashes(4, NET, { ...P, flashPiG: 0, flashMu: 1, flashR: 0.3 });
  let soft = 0;
  let solid = 0;
  for (let t = 0.5; t < 60; t += 0.5) {
    for (const p of f.pieces(t)) {
      if (p.a0 !== p.a1) soft++;
      else solid++;
    }
  }
  assert.ok(soft > 0 && solid > 0, `${soft} soft and ${solid} solid pieces`);
});

test('the black lasts longer with a longer F_b', () => {
  const short = new Flashes(4, NET, { ...P, flashPiG: 0, flashFB: 0.4 });
  const long = new Flashes(4, NET, { ...P, flashPiG: 0, flashFB: 4 });
  let a = 0;
  let b = 0;
  for (let t = 0.1; t < 300; t += 0.1) {
    a += revealed(NET, short, t);
    b += revealed(NET, long, t);
  }
  assert.ok(b > 2 * a, `${a.toFixed(1)} vs ${b.toFixed(1)}`);
});
