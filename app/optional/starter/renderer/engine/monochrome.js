// The faint monochrome (steps 1–5) and the image seed. Colouring (step 6) is the LUT in colour.js.

import { LINEAR_BYTE, oklabL } from './colour.js';
import { cyrb53 } from './random.js';

// Steps 1–2: OKLab L of every pixel of an RGBA image (sRGB linearised first).
export function lightness(rgba) {
  const n = rgba.length / 4;
  const L = new Float32Array(n);
  for (let p = 0, q = 0; p < n; p++, q += 4) {
    L[p] = oklabL(LINEAR_BYTE[rgba[q]], LINEAR_BYTE[rgba[q + 1]], LINEAR_BYTE[rgba[q + 2]]);
  }
  return L;
}

// Quantiles of values in [lo, hi] from a fine histogram (the bin centre is returned).
export function quantiles(values, ps, lo = 0, hi = 1, bins = 16384) {
  const hist = new Uint32Array(bins);
  const scale = bins / (hi - lo);
  for (let i = 0; i < values.length; i++) {
    const j = Math.floor((values[i] - lo) * scale);
    hist[j < 0 ? 0 : j >= bins ? bins - 1 : j]++;
  }
  return ps.map((p) => {
    const target = p * values.length;
    let cum = 0;
    for (let j = 0; j < bins; j++) {
      cum += hist[j];
      if (cum >= target) return lo + (j + 0.5) / scale;
    }
    return hi;
  });
}

const sigma = (x) => 1 / (1 + Math.exp(-x));

// Steps 3–5: levels between the 1st/99th percentiles b, w; sigmoid contrast k; gamma γ;
// density into [dMin, dMax]. Returns t per pixel (0 = ink, 1 = paper).
export function tone(L, [b, w], { k, gamma, dMin, dMax }) {
  const t = new Float32Array(L.length);
  const span = w - b;
  const s0 = sigma(-k / 2);
  const s1 = sigma(k / 2);
  for (let i = 0; i < L.length; i++) {
    let x = span > 1e-6 ? (L[i] - b) / span : 0.5;
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    x = (sigma(k * (x - 0.5)) - s0) / (s1 - s0);
    if (gamma !== 1) x = Math.pow(x, gamma);
    t[i] = dMin + (dMax - dMin) * x;
  }
  return t;
}

// The image's seed: cyrb53 of the image area-averaged to 32×32 greyscale (Rec. 709 luma of the
// sRGB values), quantised to 16 levels and written as one hex digit per cell.
export function imageSeed(rgba, W, H) {
  const N = 32;
  let digits = '';
  for (let j = 0; j < N; j++) {
    const y0 = Math.floor((j * H) / N);
    const y1 = Math.max(y0 + 1, Math.floor(((j + 1) * H) / N));
    for (let i = 0; i < N; i++) {
      const x0 = Math.floor((i * W) / N);
      const x1 = Math.max(x0 + 1, Math.floor(((i + 1) * W) / N));
      let sum = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const q = 4 * (y * W + x);
          sum += 0.2126 * rgba[q] + 0.7152 * rgba[q + 1] + 0.0722 * rgba[q + 2];
        }
      }
      const grey = sum / ((y1 - y0) * (x1 - x0));
      digits += Math.min(15, Math.floor(grey / 16)).toString(16);
    }
  }
  return cyrb53(digits);
}
