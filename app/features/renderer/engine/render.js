// Turning the engine's numbers into pixels: the four views, the upscaled mask and the contour.

import { smoothstep } from './field.js';
import { SRGB_BYTE } from './colour.js';

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

// Grid values sampled bilinearly up to W × H, each passed through f.
function upscale(G, v, W, H, f) {
  const { gw, gh } = G;
  const out = new Float32Array(W * H);
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
      const top = v[r0 + i0] + (v[r0 + i0 + 1] - v[r0 + i0]) * fx;
      const bot = v[r1 + i0] + (v[r1 + i0 + 1] - v[r1 + i0]) * fx;
      out[p] = f(top + (bot - top) * fy);
    }
  }
  return out;
}

// Separable Gaussian blur of grid values with standard deviation s (in cells); edges clamp.
export function gaussianBlur(G, v, s) {
  const { gw, gh } = G;
  const R = Math.ceil(3 * s);
  const w = Float32Array.from({ length: 2 * R + 1 }, (_, k) => Math.exp(-((k - R) ** 2) / (2 * s * s)));
  const sum = w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < w.length; k++) w[k] /= sum;
  const tmp = new Float32Array(v.length);
  const out = new Float32Array(v.length);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      let acc = 0;
      for (let k = -R; k <= R; k++) acc += w[k + R] * v[j * gw + Math.min(gw - 1, Math.max(0, i + k))];
      tmp[j * gw + i] = acc;
    }
  }
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      let acc = 0;
      for (let k = -R; k <= R; k++) acc += w[k + R] * tmp[Math.min(gh - 1, Math.max(0, j + k)) * gw + i];
      out[j * gw + i] = acc;
    }
  }
  return out;
}

// The mask at full resolution, W × H values in [0, 1]: smoothstep(T − δ, T + δ, F').
// Without feather, F' is sampled bilinearly and the smoothstep is applied at full size (crisp edges).
// With feather (a Gaussian's standard deviation, short side = 1), the smoothstep is applied on the
// grid, the result is blurred, and that is sampled up.
export function upscaleMask(G, Fp, T, delta, W, H, feather = 0) {
  const step = (x) => smoothstep(T - delta, T + delta, x);
  if (!(feather > 0)) return upscale(G, Fp, W, H, step);
  const blurred = gaussianBlur(G, Fp.map(step), feather / G.hx);
  return upscale(G, blurred, W, H, (x) => x);
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

// P6. The base printed on the paper, per channel in linear light:
//   out_c = ramp_c(t) · exp(−α (D_w a_w,c + D_k a_k,c + C)) · (1 + α S)
// ramp is the ink–paper line in linear RGB (linearRamp), a_w and a_k the warm and ink absorbers
// (absorber()), C the signed cloudiness. t = null stands for bare paper: the Pattern view.
export function washiRGB(t, { Dw, Dk, C, S }, alpha, ramp, aw, ak, out = new Uint8ClampedArray(Dw.length * 4)) {
  const n = ramp.length / 3 - 1;
  for (let p = 0, q = 0; p < Dw.length; p++, q += 4) {
    const v = t ? t[p] : 1;
    const r = 3 * Math.round(n * (v < 0 ? 0 : v > 1 ? 1 : v));
    const lit = 1 + alpha * S[p];
    for (let c = 0; c < 3; c++) {
      const y = ramp[r + c] * Math.exp(-alpha * (Dw[p] * aw[c] + Dk[p] * ak[c] + C[p])) * lit;
      out[q + c] = SRGB_BYTE[Math.round(4095 * (y < 0 ? 0 : y > 1 ? 1 : y))];
    }
    out[q + 3] = 255;
  }
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
