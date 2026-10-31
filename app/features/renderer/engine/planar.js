// The Planar mode's maths. So far the base, F1–F6: the picture dissolved into a still fog of its own
// colours (palette fields, B2), drifted into veils by a seeded warp (B4). Nothing moves; no shape survives.
//   F1  sample:   the picture, area-averaged in linear light onto a grid of SAMPLE_SHORT cells on the
//                 short side, to OKLab. A picture with almost no colour takes the tint τ's a, b.
//   F2  palette:  K colours c_k by k-means in OKLab over the cells (k-means++ from ':planar:palette').
//   F3  fields:   each cell's soft membership m_k = softmax(−|Lab − c_k|² / 2τ_m²), each field blurred
//                 by a Gaussian of standard deviation σ (the coarseness).
//   F4  fog:      fog(x) = Σ_k w_k c_k, with w_k = M_k^p / Σ_j M_j^p.
//   F5  drift:    fog'(x) = fog(x + A w(x / λ_d)), w a 2D fBm vector field from ':planar:fog'.
//   F6  tone:     L' = L_lo + (L_hi − L_lo) L, C' = c C, same hue; to sRGB on the grid, filled in
//                 bilinearly to full size with a ±½ dither per 8-bit channel.
// Lengths are in canvas units (short side = 1).

import { LINEAR_BYTE, delinearise, linearToOklab, hexToOklab, oklabToOklch } from './colour.js';
import { stream, mulberry32 } from './random.js';
import { simplex, fbm } from './noise.js';
import { blur, lchToLinear } from './plain.js';

export const SAMPLE_SHORT = 48; // F1's grid: cells on the short side
export const FOG_SHORT = 96; // F5–F6's grid, where the drifted fog is evaluated
export const K = 6; // palette size
const ITER = 12; // Lloyd iterations
const TAU_M = 0.06; // membership softness, in OKLab distance
const P_PURITY = 1.5; // F4's exponent p: above 1 keeps colours apart, with soft fronts
const LAMBDA_D = 0.25; // F5's warp scale
const OCTAVES_D = 2; // F5's fBm octaves
const GREY_C = 0.012; // F1: below this mean chroma the picture counts as having no colour

// F1. → { lab: Float32Array(3 n), sw, sh, grey }
export function sample(rgba, W, H, tint) {
  const s = Math.min(W, H);
  const sw = Math.max(2, Math.round((W / s) * SAMPLE_SHORT));
  const sh = Math.max(2, Math.round((H / s) * SAMPLE_SHORT));
  const lin = new Float64Array(3 * sw * sh);
  const count = new Float64Array(sw * sh);
  for (let y = 0; y < H; y++) {
    const j = Math.min(sh - 1, Math.floor((y * sh) / H));
    for (let x = 0; x < W; x++) {
      const i = Math.min(sw - 1, Math.floor((x * sw) / W));
      const c = j * sw + i;
      const q = 4 * (y * W + x);
      lin[3 * c] += LINEAR_BYTE[rgba[q]];
      lin[3 * c + 1] += LINEAR_BYTE[rgba[q + 1]];
      lin[3 * c + 2] += LINEAR_BYTE[rgba[q + 2]];
      count[c]++;
    }
  }
  const lab = new Float32Array(3 * sw * sh);
  let sumC = 0;
  for (let c = 0; c < sw * sh; c++) {
    const n = count[c] || 1;
    const [L, a, b] = linearToOklab([lin[3 * c] / n, lin[3 * c + 1] / n, lin[3 * c + 2] / n]);
    lab.set([L, a, b], 3 * c);
    sumC += Math.hypot(a, b);
  }
  const grey = sumC / (sw * sh) < GREY_C;
  if (grey) {
    const [, ta, tb] = hexToOklab(tint);
    for (let c = 0; c < sw * sh; c++) {
      lab[3 * c + 1] = ta;
      lab[3 * c + 2] = tb;
    }
  }
  return { lab, sw, sh, grey };
}

const d2 = (lab, c, k) => (lab[3 * c] - k[0]) ** 2 + (lab[3 * c + 1] - k[1]) ** 2 + (lab[3 * c + 2] - k[2]) ** 2;

// F2. k-means++ then ITER Lloyd steps. → [{ lab: [L, a, b], share }], sorted by share.
export function kmeans(lab, n, seed) {
  const { U } = stream(seed, ':planar:palette');
  const first = Math.floor(U() * n);
  const centres = [[lab[3 * first], lab[3 * first + 1], lab[3 * first + 2]]];
  const best = new Float64Array(n).fill(Infinity);
  while (centres.length < K) {
    let total = 0;
    for (let c = 0; c < n; c++) {
      best[c] = Math.min(best[c], d2(lab, c, centres[centres.length - 1]));
      total += best[c];
    }
    if (!(total > 0)) break; // fewer distinct colours than K
    let r = U() * total;
    let pick = n - 1;
    for (let c = 0; c < n; c++) {
      r -= best[c];
      if (r < 0) {
        pick = c;
        break;
      }
    }
    centres.push([lab[3 * pick], lab[3 * pick + 1], lab[3 * pick + 2]]);
  }
  const label = new Int32Array(n);
  for (let it = 0; it < ITER; it++) {
    const sum = centres.map(() => [0, 0, 0, 0]);
    for (let c = 0; c < n; c++) {
      let bk = 0;
      let bd = Infinity;
      for (let k = 0; k < centres.length; k++) {
        const d = d2(lab, c, centres[k]);
        if (d < bd) [bd, bk] = [d, k];
      }
      label[c] = bk;
      const s = sum[bk];
      s[0] += lab[3 * c];
      s[1] += lab[3 * c + 1];
      s[2] += lab[3 * c + 2];
      s[3]++;
    }
    for (let k = 0; k < centres.length; k++) if (sum[k][3]) centres[k] = sum[k].slice(0, 3).map((v) => v / sum[k][3]);
  }
  const shares = centres.map(() => 0);
  for (let c = 0; c < n; c++) shares[label[c]] += 1 / n;
  return centres.map((lab3, k) => ({ lab: lab3, share: shares[k] })).filter((p) => p.share > 0).sort((a, b) => b.share - a.share);
}

// F3–F4 on the sample grid. → Float32Array(3 n) of OKLab
export function fogField(lab, sw, sh, pal, sigma) {
  const n = sw * sh;
  const fields = pal.map(() => new Float32Array(n));
  for (let c = 0; c < n; c++) {
    let total = 0;
    const e = pal.map((p) => Math.exp(-d2(lab, c, p.lab) / (2 * TAU_M * TAU_M)));
    for (const v of e) total += v;
    if (!(total > 0)) {
      // far from every colour (can't happen with centres from the data, but keep it safe): the nearest
      let bk = 0;
      for (let k = 1; k < pal.length; k++) if (d2(lab, c, pal[k].lab) < d2(lab, c, pal[bk].lab)) bk = k;
      fields[bk][c] = 1;
      continue;
    }
    for (let k = 0; k < pal.length; k++) fields[k][c] = e[k] / total;
  }
  const s = Math.min(sw, sh);
  const M = fields.map((f) => blur(f, sw, sh, sigma * s));
  const fog = new Float32Array(3 * n);
  for (let c = 0; c < n; c++) {
    let total = 0;
    const w = M.map((m) => Math.max(0, m[c]) ** P_PURITY);
    for (const v of w) total += v;
    for (let k = 0; k < pal.length; k++) {
      const f = total > 0 ? w[k] / total : 1 / pal.length;
      fog[3 * c] += f * pal[k].lab[0];
      fog[3 * c + 1] += f * pal[k].lab[1];
      fog[3 * c + 2] += f * pal[k].lab[2];
    }
  }
  return fog;
}

// Bilinear sample of a 3-channel grid g (gw × gh over [0, X] × [0, Y], cell centres) at (x, y), into out.
function sample3(g, gw, gh, X, Y, x, y, out) {
  const fx = Math.min(gw - 1.001, Math.max(0, (x / X) * gw - 0.5));
  const fy = Math.min(gh - 1.001, Math.max(0, (y / Y) * gh - 0.5));
  const i = fx | 0;
  const j = fy | 0;
  const tx = fx - i;
  const ty = fy - j;
  for (let ch = 0; ch < 3; ch++) {
    const a = g[3 * (j * gw + i) + ch];
    const b = g[3 * (j * gw + i + 1) + ch];
    const c = g[3 * ((j + 1) * gw + i) + ch];
    const d = g[3 * ((j + 1) * gw + i + 1) + ch];
    out[ch] = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }
}

// F1–F6: the fog as sRGB (0–255, floats) on a FOG_SHORT grid. → { rgb, fw, fh, palette, grey, sw, sh }
export function fog(rgba, W, H, seed, P) {
  const X = W / Math.min(W, H);
  const Y = H / Math.min(W, H);
  const { lab, sw, sh, grey } = sample(rgba, W, H, P.tint);
  const pal = kmeans(lab, sw * sh, seed);
  const f = fogField(lab, sw, sh, pal, P.fogSigma);
  const { U } = stream(seed, ':planar:fog');
  const nx = simplex(U);
  const ny = simplex(U);
  const opt = { octaves: OCTAVES_D, lambda: LAMBDA_D, H: 0.5 };
  const wx = fbm(nx, opt);
  const wy = fbm(ny, opt);
  const fw = Math.max(2, Math.round(X * FOG_SHORT));
  const fh = Math.max(2, Math.round(Y * FOG_SHORT));
  const rgb = new Float32Array(3 * fw * fh);
  const v = [0, 0, 0];
  const A = P.fogA;
  for (let j = 0; j < fh; j++) {
    for (let i = 0; i < fw; i++) {
      const x = ((i + 0.5) / fw) * X;
      const y = ((j + 0.5) / fh) * Y;
      sample3(f, sw, sh, X, Y, x + A * wx(x, y), y + A * wy(x, y), v);
      const [L, C, h] = oklabToOklch(v);
      const out = lchToLinear(P.fogLo + (P.fogHi - P.fogLo) * L, P.fogC * C, h);
      for (let ch = 0; ch < 3; ch++) rgb[3 * (j * fw + i) + ch] = 255 * delinearise(out[ch]);
    }
  }
  return { rgb, fw, fh, palette: pal, grey, sw, sh };
}

// F6's fill: the fog grid to W × H RGBA, bilinear, with a ±½ dither per 8-bit channel.
export function fogRGB({ rgb, fw, fh }, W, H) {
  const out = new Uint8ClampedArray(4 * W * H);
  const R = mulberry32(0x85ebca6b);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(fh - 1.001, Math.max(0, ((y + 0.5) * fh) / H - 0.5));
    const j = fy | 0;
    const ty = fy - j;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(fw - 1.001, Math.max(0, ((x + 0.5) * fw) / W - 0.5));
      const i = fx | 0;
      const tx = fx - i;
      const a = 3 * (j * fw + i);
      const c = a + 3 * fw;
      const p = 4 * (y * W + x);
      for (let ch = 0; ch < 3; ch++) {
        out[p + ch] = (rgb[a + ch] * (1 - tx) + rgb[a + 3 + ch] * tx) * (1 - ty)
          + (rgb[c + ch] * (1 - tx) + rgb[c + 3 + ch] * tx) * ty + R() - 0.5;
      }
      out[p + 3] = 255;
    }
  }
  return out;
}
