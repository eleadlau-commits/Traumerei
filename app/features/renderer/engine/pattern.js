// The Washi pattern, steps P1–P5: hairline fibres, specks and flakes as an inclusion density D,
// and a crinkled relief grain as a shading S. Both are W × H maps at full image size.
// Shapes and paths are in canvas units (short side = 1), so a picture gives the same sheet at any size.

import { stream } from './random.js';
import { simplex, fbm } from './noise.js';
import { smoothstep } from './field.js';

const MARGIN = 0.1; // m: germs land on the canvas widened by this, so edges aren't sparse
const STEP = 0.001; // h: the walk's step
const SIGMA_N = 0.47; // standard deviation of simplex noise along a line, so g has sd 1
const HARMONICS = 12; // K

// Poisson(mean): Knuth's product of uniforms, or for large means a rounded Gaussian.
export function poisson(rng, mean) {
  if (!(mean > 0)) return 0;
  if (mean > 30) return Math.max(0, Math.round(mean + Math.sqrt(mean) * rng.N()));
  const limit = Math.exp(-mean);
  let k = 0;
  for (let p = rng.U(); p > limit; p *= rng.U()) k++;
  return k;
}

const logNormal = (rng, median, spread) => median * Math.exp(spread * rng.N());

// erf by Abramowitz & Stegun 7.1.26 (error below 1.5e-7).
export function erf(x) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

// The lopsided taper E(u), 1 at its peak u* = α / (α + β) and 0 at both ends.
export function taper(u, alpha, beta) {
  if (u <= 0 || u >= 1) return 0;
  const us = alpha / (alpha + beta);
  return Math.pow(u / us, alpha) * Math.pow((1 - u) / (1 - us), beta);
}

// P1. One walk of length `len` from (x, y) with heading θ: points after the start, Brownian heading.
function walk(rng, x, y, theta, len, tau) {
  const pts = [];
  const steps = Math.max(1, Math.ceil(len / STEP));
  const h = len / steps;
  const kick = tau * Math.sqrt(h);
  for (let k = 0; k < steps; k++) {
    x += h * Math.cos(theta);
    y += h * Math.sin(theta);
    pts.push(x, y);
    theta += kick * rng.N();
  }
  return pts;
}

// P1–P2 for one kind of stroke (fibres or specks). K holds that kind's settings:
//   { lambda, muL, sL, lp, muW, muB, muA, sigmaW, sigmaB, sigmaA, ellG, ab: [lo, hi] }
// Draws: the noise permutation (255), the count, then per stroke the midpoint, L, θ₀, the forward
// walk, the backward walk, w₀, b₀, a₀, α, β and the three noise offsets. Adds into D; returns the count.
function strokes(rng, K, canvas, D) {
  const { X, Y, W, px } = canvas;
  const n = simplex(rng.U);
  const count = poisson(rng, K.lambda * (X + 2 * MARGIN) * (Y + 2 * MARGIN));
  const tau = Math.sqrt(2 / K.lp);
  const scratch = canvas.scratch;
  for (let f = 0; f < count; f++) {
    const x0 = -MARGIN + rng.U() * (X + 2 * MARGIN);
    const y0 = -MARGIN + rng.U() * (Y + 2 * MARGIN);
    const L = logNormal(rng, K.muL, K.sL);
    const theta0 = rng.U() * 2 * Math.PI;
    const fwd = walk(rng, x0, y0, theta0, L / 2, tau);
    const back = walk(rng, x0, y0, theta0 + Math.PI, L / 2, tau);
    const w0 = logNormal(rng, K.muW, 0.3);
    const b0 = logNormal(rng, K.muB, 0.5);
    const a0 = logNormal(rng, K.muA, 0.4);
    const [lo, hi] = K.ab;
    const alpha = lo + (hi - lo) * rng.U();
    const beta = lo + (hi - lo) * rng.U();
    const o = [rng.U() * 1000, rng.U() * 1000, rng.U() * 1000];
    const g = (s, i) => n(s / K.ellG, o[i]) / SIGMA_N;

    // The polyline from the backward end to the forward end, with arc length s and w, b', a at each point.
    const xs = [];
    const ys = [];
    for (let k = back.length - 2; k >= 0; k -= 2) xs.push(back[k]), ys.push(back[k + 1]);
    xs.push(x0), ys.push(y0);
    for (let k = 0; k < fwd.length; k += 2) xs.push(fwd[k]), ys.push(fwd[k + 1]);
    const m = xs.length;
    const hb = (L / 2) / (back.length / 2);
    const hf = (L / 2) / (fwd.length / 2);
    const vw = new Float32Array(m);
    const vb = new Float32Array(m);
    const va = new Float32Array(m);
    const nb = back.length / 2;
    for (let k = 0; k < m; k++) {
      const s = k <= nb ? k * hb : L / 2 + (k - nb) * hf;
      vw[k] = w0 * Math.exp(K.sigmaW * g(s, 0));
      const b = b0 * Math.exp(K.sigmaB * g(s, 1));
      vb[k] = Math.sqrt(b * b + (px / 2) ** 2);
      va[k] = a0 * taper(s / L, alpha, beta) * Math.max(0, 1 + K.sigmaA * g(s, 2));
    }
    rasterStroke(xs, ys, vw, vb, va, canvas, scratch);
    // P2.4–6: the cross-section at each touched pixel, from its nearest point on the polyline.
    for (const p of scratch.touched) {
      const d = Math.sqrt(scratch.d2[p]);
      const w = scratch.w[p];
      const b = scratch.b[p];
      const k = 1 / (Math.SQRT2 * b);
      D[p] += scratch.a[p] * 0.5 * (erf((w / 2 - d) * k) + erf((w / 2 + d) * k));
      scratch.d2[p] = Infinity;
    }
    scratch.touched.length = 0;
  }
  return count;

  // Per pixel within reach, the squared distance to the nearest point and w, b', a interpolated there.
  function rasterStroke(xs, ys, vw, vb, va, cv, sc) {
    for (let k = 0; k + 1 < xs.length; k++) {
      const reach = Math.max(vw[k], vw[k + 1]) / 2 + 3 * Math.max(vb[k], vb[k + 1]);
      if (Math.max(va[k], va[k + 1]) <= 0) continue;
      const ax = xs[k], ay = ys[k], bx = xs[k + 1], by = ys[k + 1];
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - reach) / px));
      const i1 = Math.min(W - 1, Math.floor((Math.max(ax, bx) + reach) / px));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - reach) / px));
      const j1 = Math.min(cv.H - 1, Math.floor((Math.max(ay, by) + reach) / px));
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1e-12;
      const r2 = reach * reach;
      for (let j = j0; j <= j1; j++) {
        const py = (j + 0.5) * px;
        for (let i = i0; i <= i1; i++) {
          const pxx = (i + 0.5) * px;
          let t = ((pxx - ax) * dx + (py - ay) * dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = ax + t * dx - pxx, ey = ay + t * dy - py;
          const d2 = ex * ex + ey * ey;
          if (d2 > r2) continue;
          const p = j * W + i;
          if (d2 < sc.d2[p]) {
            if (sc.d2[p] === Infinity) sc.touched.push(p);
            sc.d2[p] = d2;
            sc.w[p] = vw[k] + t * (vw[k + 1] - vw[k]);
            sc.b[p] = vb[k] + t * (vb[k + 1] - vb[k]);
            sc.a[p] = va[k] + t * (va[k + 1] - va[k]);
          }
        }
      }
    }
  }
}

// P4. Flakes: torn Fourier outlines with a see-through fill, veins and a rim. Adds into D; returns the count.
// Draws: the vein permutation (255), the count, then per flake the centre, φ, ℓ, q, the K − 1 pairs
// (c_k, ψ_k), a_in and the vein offset.
function flakes(rng, P, canvas, D) {
  const { X, Y, W, H, px } = canvas;
  const n = simplex(rng.U);
  const count = poisson(rng, P.lambdaK * (X + 2 * MARGIN) * (Y + 2 * MARGIN));
  for (let f = 0; f < count; f++) {
    const cx = -MARGIN + rng.U() * (X + 2 * MARGIN);
    const cy = -MARGIN + rng.U() * (Y + 2 * MARGIN);
    const phi = rng.U() * Math.PI;
    const len = logNormal(rng, P.muK, 0.5);
    const q = 0.2 + 0.4 * rng.U();
    const ck = [];
    const psi = [];
    let bound = 1;
    for (let k = 2; k <= HARMONICS; k++) {
      ck.push(rng.N() * P.cK * Math.pow(k, -P.pK));
      psi.push(rng.U() * 2 * Math.PI);
      bound += Math.abs(ck[ck.length - 1]);
    }
    const aIn = 0.04 + 0.21 * rng.U();
    const o = rng.U() * 1000;
    const cos = Math.cos(phi), sin = Math.sin(phi);
    const reach = bound * (1 + P.epsK) * len / 2;
    const i0 = Math.max(0, Math.floor((cx - reach) / px)), i1 = Math.min(W - 1, Math.floor((cx + reach) / px));
    const j0 = Math.max(0, Math.floor((cy - reach) / px)), j1 = Math.min(H - 1, Math.floor((cy + reach) / px));
    for (let j = j0; j <= j1; j++) {
      const y = (j + 0.5) * px;
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) * px;
        const u1 = ((x - cx) * cos + (y - cy) * sin) * 2 / len;
        const u2 = (-(x - cx) * sin + (y - cy) * cos) * 2 / (q * len);
        const rad = Math.hypot(u1, u2);
        if (rad > bound * (1 + P.epsK)) continue;
        const th = Math.atan2(u2, u1);
        let r = 1;
        for (let k = 0; k < ck.length; k++) r += ck[k] * Math.cos((k + 2) * th + psi[k]);
        const rho = rad / Math.max(0.3, r);
        if (rho > 1 + P.epsK) continue;
        const edge = 1 - smoothstep(1 - P.epsK, 1 + P.epsK, rho);
        const vein = Math.max(0, 1 + P.sigmaV * n(x / P.lambdaV + o, y / P.lambdaV));
        const rim = P.kRim * Math.exp(-((rho - 0.9) ** 2) / (2 * 0.06 * 0.06));
        D[j * W + i] += edge * aIn * (vein + rim);
      }
    }
  }
  return count;
}

// P5. The relief grain: warped two-scale Worley creases plus fBm mottle as a height h, lit from ψ.
// Draws: the warp permutation (255), o₁, o₂, the mottle permutation (255), then one jitter (x, y)
// per cell, row by row, for the grid at λ_g and then for the grid at λ_g / 2.
function grain(rng, P, canvas) {
  const { X, Y, W, H, px } = canvas;
  const nw = simplex(rng.U);
  const o1 = rng.U() * 1000;
  const o2 = rng.U() * 1000;
  const mottle = fbm(simplex(rng.U), { octaves: 4, lambda: P.lambdaN, H: 0.5 });
  const pad = P.Ag + 2 * P.lambdaG;
  const grids = [P.lambdaG, P.lambdaG / 2].map((size) => {
    const c0 = Math.floor(-pad / size);
    const gw = Math.ceil((X + pad) / size) - c0 + 1;
    const gh = Math.ceil((Y + pad) / size) - c0 + 1;
    const pts = new Float32Array(2 * gw * gh);
    for (let j = 0, q = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++, q += 2) {
        pts[q] = (c0 + i + rng.U()) * size;
        pts[q + 1] = (c0 + j + rng.U()) * size;
      }
    }
    return { size, c0, gw, gh, pts };
  });
  // F₂ − F₁ over the 3 × 3 cells around x.
  const crease = ({ size, c0, gw, gh, pts }, x, y) => {
    const ci = Math.floor(x / size) - c0;
    const cj = Math.floor(y / size) - c0;
    let f1 = Infinity, f2 = Infinity;
    for (let dj = -1; dj <= 1; dj++) {
      const j = cj + dj;
      if (j < 0 || j >= gh) continue;
      for (let di = -1; di <= 1; di++) {
        const i = ci + di;
        if (i < 0 || i >= gw) continue;
        const q = 2 * (j * gw + i);
        const dx = pts[q] - x;
        const dy = pts[q + 1] - y;
        const d = dx * dx + dy * dy;
        if (d < f1) f2 = f1, f1 = d;
        else if (d < f2) f2 = d;
      }
    }
    return Math.sqrt(f2) - Math.sqrt(f1);
  };
  const h = new Float32Array(W * H);
  for (let j = 0, p = 0; j < H; j++) {
    const y = (j + 0.5) * px;
    for (let i = 0; i < W; i++, p++) {
      const x = (i + 0.5) * px;
      const xw = x + P.Ag * nw(x / P.lambdaGw, y / P.lambdaGw + o1);
      const yw = y + P.Ag * nw(x / P.lambdaGw + o2, y / P.lambdaGw);
      h[p] = smoothstep(0, P.omega, crease(grids[0], xw, yw) / P.lambdaG) +
        0.5 * smoothstep(0, P.omega, (2 * crease(grids[1], xw, yw)) / P.lambdaG) +
        P.etaG * mottle(x, y);
    }
  }
  // S = clamp(−a_g λ_g ∇h · ℓ̂, ±0.5), ∇h by central differences (one-sided at the edges).
  const psi = (P.psi * Math.PI) / 180;
  const lx = Math.cos(psi), ly = Math.sin(psi);
  const S = new Float32Array(W * H);
  const k = -P.aG * P.lambdaG / px;
  for (let j = 0, p = 0; j < H; j++) {
    const ju = j > 0 ? j - 1 : j, jd = j < H - 1 ? j + 1 : j;
    for (let i = 0; i < W; i++, p++) {
      const il = i > 0 ? i - 1 : i, ir = i < W - 1 ? i + 1 : i;
      const gx = (h[j * W + ir] - h[j * W + il]) / (ir - il || 1);
      const gy = (h[jd * W + i] - h[ju * W + i]) / (jd - ju || 1);
      const s = k * (gx * lx + gy * ly);
      S[p] = s < -0.5 ? -0.5 : s > 0.5 ? 0.5 : s;
    }
  }
  return S;
}

// The pattern's parts and the sliders each depends on, so moving one slider redoes only its part.
export const PARTS = {
  fibres: ['lambdaF', 'muL', 'sL', 'lp', 'muW', 'muB', 'muA', 'sigmaW', 'sigmaB', 'sigmaA', 'ellG'],
  specks: ['lambdaS', 'muLs', 'muWs', 'muAs', 'sigmaW', 'sigmaB', 'sigmaA', 'ellG'],
  flakes: ['lambdaK', 'muK', 'cK', 'pK', 'epsK', 'kRim', 'sigmaV', 'lambdaV'],
  grain: ['lambdaG', 'omega', 'Ag', 'lambdaGw', 'etaG', 'lambdaN', 'aG', 'psi'],
};

// One part of P1–P5 for the whole canvas. Fibres, specks and flakes → { D, count }; grain → { S }.
export function part(name, seed, X, Y, W, H, P) {
  const canvas = { X, Y, W, H, px: X / W };
  const rng = stream(seed, `:pattern:${name}`);
  if (name === 'grain') return { S: grain(rng, P, canvas) };
  const D = new Float32Array(W * H);
  if (name === 'flakes') return { D, count: flakes(rng, P, canvas, D) };
  canvas.scratch = { d2: new Float32Array(W * H).fill(Infinity), w: new Float32Array(W * H),
    b: new Float32Array(W * H), a: new Float32Array(W * H), touched: [] };
  const K = name === 'fibres'
    ? { lambda: P.lambdaF, muL: P.muL, sL: P.sL, lp: P.lp, muW: P.muW, muB: P.muB, muA: P.muA, ab: [0.3, 2] }
    : { lambda: P.lambdaS, muL: P.muLs, sL: 0.4, lp: 0.05, muW: P.muWs, muB: 0.0002, muA: P.muAs, ab: [0.6, 1.2] };
  Object.assign(K, { sigmaW: P.sigmaW, sigmaB: P.sigmaB, sigmaA: P.sigmaA, ellG: P.ellG });
  return { D, count: strokes(rng, K, canvas, D) };
}

// P1–P5 for the whole canvas, D = D_f + D_s + D_k. → { D, S, counts: { fibres, specks, flakes } }
export function pattern(seed, X, Y, W, H, P) {
  const [f, s, k] = ['fibres', 'specks', 'flakes'].map((n) => part(n, seed, X, Y, W, H, P));
  const D = f.D.map((v, i) => v + s.D[i] + k.D[i]);
  return { D, S: part('grain', seed, X, Y, W, H, P).S, counts: { fibres: f.count, specks: s.count, flakes: k.count } };
}
