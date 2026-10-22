// Turning the engine's numbers into pixels: the four views, the upscaled mask and the contour.

import { smoothstep } from './field.js';

// t ∈ [0, 1] per pixel (0 = ink, 1 = paper) → RGBA through the ink–paper LUT.
export function paint(t, lut, out = new Uint8ClampedArray(t.length * 4)) {
  for (let p = 0, q = 0; p < t.length; p++, q += 4) {
    const v = t[p];
    const i = 3 * Math.round(255 * (v < 0 ? 0 : v > 1 ? 1 : v));
    out[q] = lut[i];
    out[q + 1] = lut[i + 1];
    out[q + 2] = lut[i + 2];
    out[q + 3] = 255;
  }
  return out;
}

// The mask at full resolution: F' sampled bilinearly from the grid, then
// smoothstep(T − δ, T + δ, F'). Returns a Float32Array of W × H values in [0, 1].
export function upscaleMask(G, Fp, T, delta, W, H) {
  const { gw, gh } = G;
  const m = new Float32Array(W * H);
  const e0 = T - delta;
  const e1 = T + delta;
  for (let py = 0, p = 0; py < H; py++) {
    let gy = ((py + 0.5) * gh) / H - 0.5;
    gy = gy < 0 ? 0 : gy > gh - 1 ? gh - 1 : gy;
    const j0 = Math.min(gh - 2, Math.floor(gy));
    const fy = gy - j0;
    const r0 = j0 * gw;
    const r1 = r0 + gw;
    for (let px = 0; px < W; px++, p++) {
      let gx = ((px + 0.5) * gw) / W - 0.5;
      gx = gx < 0 ? 0 : gx > gw - 1 ? gw - 1 : gx;
      const i0 = Math.min(gw - 2, Math.floor(gx));
      const fx = gx - i0;
      const top = Fp[r0 + i0] + (Fp[r0 + i0 + 1] - Fp[r0 + i0]) * fx;
      const bot = Fp[r1 + i0] + (Fp[r1 + i0 + 1] - Fp[r1 + i0]) * fx;
      m[p] = smoothstep(e0, e1, top + (bot - top) * fy);
    }
  }
  return m;
}

// The views, each as t per pixel for paint():
//   monochrome: t itself;  mask: mix(paper, ink, m);  base: mix(paper, monochrome, m).
// Mixing in OKLab between paper (t = 1) and the colour at t is the colour at 1 − m(1 − t).
export function maskTone(m) {
  return m.map((v) => 1 - v);
}
export function baseTone(t, m) {
  const out = new Float32Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = 1 - m[i] * (1 - t[i]);
  return out;
}

// The heightmap: F' on the grid, high = dark, scaled by its maximum.
export function heightTone(Fp, max) {
  const s = max > 0 ? 1 / max : 0;
  return Fp.map((v) => 1 - Math.min(1, Math.max(0, v * s)));
}

// Marching squares: the contour F' = T as line segments, in fractions of the width and height.
export function contour(G, Fp, T) {
  const { gw, gh } = G;
  const segs = [];
  const at = (i, j) => Fp[j * gw + i] - T;
  const cut = (a, b) => a / (a - b);
  for (let j = 0; j < gh - 1; j++) {
    for (let i = 0; i < gw - 1; i++) {
      const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
      const pts = [];
      const corners = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      for (let e = 0; e < 4; e++) {
        const a = v[e];
        const b = v[(e + 1) & 3];
        if ((a >= 0) !== (b >= 0)) {
          const s = cut(a, b);
          const [x0, y0] = corners[e];
          const [x1, y1] = corners[(e + 1) & 3];
          pts.push([(x0 + (x1 - x0) * s + 0.5) / gw, (y0 + (y1 - y0) * s + 0.5) / gh]);
        }
      }
      if (pts.length === 2) segs.push(pts[0], pts[1]);
      else if (pts.length === 4) segs.push(pts[0], pts[1], pts[2], pts[3]);
    }
  }
  return segs;
}
