// The mask's field, steps M5–M7, on a reduced grid: Gaussian-like kernels at a warped point,
// fBm roughness near the level of the kernels' edges, and the threshold at the (1−κ) quantile.

import { simplex, fbm } from './noise.js';

const SQRT_LN2 = Math.sqrt(Math.LN2);

// The grid: cell centres covering [0, X] × [0, Y] with about `short` cells on the short side.
export function grid(X, Y, short) {
  const gw = Math.max(2, Math.round(short * X));
  const gh = Math.max(2, Math.round(short * Y));
  return { gw, gh, X, Y, hx: X / gw, hy: Y / gh };
}

// M5. F(x) = Σ_i exp(−q_i(x)), q_i the squared distance in the patch's own axes with widths
// semi-axis/√ln2 (so F_i = ½ on the ellipse itself).
export function kernels(patches) {
  return patches.map((p) => {
    const c = Math.cos(p.phi);
    const s = Math.sin(p.phi);
    const wa = p.a / SQRT_LN2;
    const wb = p.b / SQRT_LN2;
    return { x: p.x, y: p.y, c, s, ia2: 1 / (wa * wa), ib2: 1 / (wb * wb) };
  });
}

export function F(K, x, y) {
  let sum = 0;
  for (let i = 0; i < K.length; i++) {
    const k = K[i];
    const dx = x - k.x;
    const dy = y - k.y;
    const u = dx * k.c + dy * k.s;
    const v = -dx * k.s + dy * k.c;
    sum += Math.exp(-(u * u * k.ia2 + v * v * k.ib2));
  }
  return sum;
}

// q-quantile of an array, by sorting a copy and interpolating.
export function quantile(values, q) {
  const sorted = Float32Array.from(values).sort();
  const pos = q * (sorted.length - 1);
  const i = Math.floor(pos);
  const j = Math.min(sorted.length - 1, i + 1);
  return sorted[i] + (sorted[j] - sorted[i]) * (pos - i);
}

// M5–M7 on grid G. warpRng and noiseRng are the ':warp' and ':noise' streams.
// Returns { Fp: F' per cell (row by row), T, max }.
export function field(G, patches, warpRng, noiseRng, P) {
  const K = kernels(patches);
  const n1 = simplex(warpRng.U);
  const n2 = simplex(warpRng.U);
  const rough = fbm(simplex(noiseRng.U), { octaves: P.octaves, lambda: P.lambdaRough, H: P.H });
  const Fp = new Float32Array(G.gw * G.gh);
  let max = 0;
  for (let j = 0, idx = 0; j < G.gh; j++) {
    const y = (j + 0.5) * G.hy;
    for (let i = 0; i < G.gw; i++, idx++) {
      const x = (i + 0.5) * G.hx;
      const xw = x + P.Awarp * n1(x / P.lambdaWarp, y / P.lambdaWarp);
      const yw = y + P.Awarp * n2(x / P.lambdaWarp, y / P.lambdaWarp);
      const f = F(K, xw, yw);
      const fc = f < 0 ? 0 : f > 1 ? 1 : f;
      const v = f + P.eta * rough(x, y) * 4 * fc * (1 - fc); // M6
      Fp[idx] = v;
      if (v > max) max = v;
    }
  }
  const T = quantile(Fp, 1 - P.kappa); // M7
  return { Fp, T, max };
}

export function smoothstep(e0, e1, x) {
  if (e1 <= e0) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
