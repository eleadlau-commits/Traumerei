// The Plain theme: one flat colour from the image's dominant hue (B1–B5), a blurred fluid scalar field
// that lifts its lightness (P1–P5), and a few soft lights that drift over it (G1–G3).
// The image itself never shows. Lengths are in canvas units (short side = 1).

import { LINEAR_BYTE, linearToOklab, hexToOklab, oklabToOklch, oklchToOklab, oklabToLinear, delinearise } from './colour.js';
import { stream, mulberry32, cyrb53 } from './random.js';
import { simplex3 } from './noise.js';

// ---------- B: the base colour ----------

export const C_MIN = 0.02; // below this chroma a pixel has no hue
const BINS = 72; // 5° each
const KAPPA = 20; // von Mises concentration, about 13° wide
const WINDOW = 15; // degrees either side of the peak bin's centre
const SAMPLE_LONG = 256; // the image is sampled at most this many pixels along its long side

// dominantHue(rgba, W, H, fallback '#rrggbb') → { L, C, h, grey, hist, peak }
// B1–B4 on the image sampled to at most 256 px on its long side; B5 (no hue) falls back to the tint.
export function dominantHue(rgba, W, H, fallback) {
  const k = Math.max(1, Math.max(W, H) / SAMPLE_LONG);
  const sw = Math.max(1, Math.floor(W / k));
  const sh = Math.max(1, Math.floor(H / k));
  const hist = new Float64Array(BINS);
  const Ls = [];
  const Cs = [];
  const Hs = [];
  let sumC = 0;
  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const q = 4 * (Math.min(H - 1, Math.floor((j + 0.5) * k)) * W + Math.min(W - 1, Math.floor((i + 0.5) * k)));
      const [L, a, b] = linearToOklab([LINEAR_BYTE[rgba[q]], LINEAR_BYTE[rgba[q + 1]], LINEAR_BYTE[rgba[q + 2]]]);
      const C = Math.hypot(a, b);
      sumC += C;
      if (C < C_MIN) continue;
      const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
      hist[Math.floor(h / 5) % BINS] += C;
      Ls.push(L);
      Cs.push(C);
      Hs.push(h);
    }
  }
  const n = sw * sh;
  const smooth = vonMises(hist);
  let peak = 0;
  for (let i = 1; i < BINS; i++) if (smooth[i] > smooth[peak]) peak = i;
  if (sumC / n < 0.012 || Hs.length < 0.02 * n) {
    const [L, C, h] = oklabToOklch(hexToOklab(fallback));
    return { L, C, h, grey: true, hist: smooth, peak };
  }
  const centre = peak * 5 + 2.5;
  let sx = 0;
  let sy = 0;
  const inL = [];
  const inC = [];
  for (let i = 0; i < Hs.length; i++) {
    let d = Math.abs(Hs[i] - centre);
    d = Math.min(d, 360 - d);
    if (d > WINDOW) continue;
    const r = (Hs[i] * Math.PI) / 180;
    sx += Cs[i] * Math.cos(r);
    sy += Cs[i] * Math.sin(r);
    inL.push(Ls[i]);
    inC.push(Cs[i]);
  }
  const h = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;
  return { L: median(inL), C: median(inC), h, grey: false, hist: smooth, peak };
}

// B3: ñ_k = Σ_j n_j exp(κ (cos(2π (k − j) / 72) − 1)).
export function vonMises(hist) {
  const out = new Float64Array(hist.length);
  const w = Array.from({ length: hist.length }, (_, d) => Math.exp(KAPPA * (Math.cos((2 * Math.PI * d) / hist.length) - 1)));
  for (let i = 0; i < hist.length; i++) {
    let s = 0;
    for (let j = 0; j < hist.length; j++) s += hist[j] * w[(i - j + hist.length) % hist.length];
    out[i] = s;
  }
  return out;
}

function median(a) {
  const s = Float64Array.from(a).sort();
  return s[s.length >> 1];
}

// The base after its sliders: L_b + ΔL (kept in [0.02, 0.99]) and c · C_b.
export function baseColour(hue, P) {
  return { L: Math.min(0.99, Math.max(0.02, hue.L + P.plainDL)), C: hue.C * P.plainCS, h: hue.h };
}

// OKLCh → linear RGB in [0, 1]³: keeps L and h and multiplies chroma by 0.88 until it fits sRGB.
export function lchToLinear(L, C, h) {
  L = Math.min(1, Math.max(0, L));
  let c = C;
  for (let k = 0; k < 24; k++, c *= 0.88) {
    const rgb = oklabToLinear(oklchToOklab(L, c, h));
    if (rgb.every((v) => v >= -1e-4 && v <= 1.0001)) return rgb.map((v) => Math.min(1, Math.max(0, v)));
  }
  return oklabToLinear([L, 0, 0]).map((v) => Math.min(1, Math.max(0, v)));
}

// ---------- P: the fluid scalar field ----------

export const FIELD_SHORT = 160; // the field's grid has this many cells on the short side
const STEPS = 36; // RK2 steps back along the flow
const SLICES = 9; // time slices of the velocity
const VGRID = 90; // velocity samples per canvas unit

// P1–P2: the curl velocity u = ∇⊥ψ on a grid over the sheet plus a margin of D, at SLICES times,
// normalised by its root mean square.
export function velocity(seed, X, Y, P) {
  const n = simplex3(stream(seed, ':plain:flow').U);
  const m = P.flowD + 0.15;
  const x0 = -m;
  const y0 = -m;
  const cell = 1 / VGRID;
  const gw = Math.ceil((X + 2 * m) * VGRID) + 1;
  const gh = Math.ceil((Y + 2 * m) * VGRID) + 1;
  const psi = new Float32Array(gw * gh);
  const U = [];
  let sum2 = 0;
  let count = 0;
  for (let s = 0; s < SLICES; s++) {
    const t = (s / (SLICES - 1)) * P.nu;
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const x = (x0 + i * cell) / P.lambdaPsi;
        const y = (y0 + j * cell) / P.lambdaPsi;
        psi[j * gw + i] = n(x, y, t) + 0.45 * P.eddy * n(2.3 * x + 17.1, 2.3 * y - 9.3, 1.7 * t + 4.2);
      }
    }
    const u = new Float32Array(2 * gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const ip = Math.min(gw - 1, i + 1);
        const im = Math.max(0, i - 1);
        const jp = Math.min(gh - 1, j + 1);
        const jm = Math.max(0, j - 1);
        const dx = (psi[j * gw + ip] - psi[j * gw + im]) / ((ip - im) * cell);
        const dy = (psi[jp * gw + i] - psi[jm * gw + i]) / ((jp - jm) * cell);
        u[2 * (j * gw + i)] = dy;
        u[2 * (j * gw + i) + 1] = -dx;
        sum2 += dx * dx + dy * dy;
        count++;
      }
    }
    U.push(u);
  }
  const rms = Math.sqrt(sum2 / count) || 1;
  for (const u of U) for (let i = 0; i < u.length; i++) u[i] /= rms;
  return { U, x0, y0, gw, gh, cell };
}

// Bilinear sample of one velocity slice at (x, y) into out.
function sampleVelocity(V, u, x, y, out) {
  const fx = Math.min(V.gw - 1.001, Math.max(0, (x - V.x0) / V.cell));
  const fy = Math.min(V.gh - 1.001, Math.max(0, (y - V.y0) / V.cell));
  const i = fx | 0;
  const j = fy | 0;
  const tx = fx - i;
  const ty = fy - j;
  const a = 2 * (j * V.gw + i);
  const b = a + 2;
  const c = a + 2 * V.gw;
  const d = c + 2;
  out[0] = (u[a] * (1 - tx) + u[b] * tx) * (1 - ty) + (u[c] * (1 - tx) + u[d] * tx) * ty;
  out[1] = (u[a + 1] * (1 - tx) + u[b + 1] * tx) * (1 - ty) + (u[c + 1] * (1 - tx) + u[d + 1] * tx) * ty;
}

// P3: where the point (x, y) came from, D back along the flow, in STEPS midpoint steps.
export function traceBack(V, x, y, D) {
  const h = D / STEPS;
  const a = [0, 0];
  const b = [0, 0];
  for (let s = 0; s < STEPS && h > 0; s++) {
    const tf = (1 - s / STEPS) * (SLICES - 1);
    const si = Math.min(SLICES - 2, tf | 0);
    const st = tf - si;
    sampleVelocity(V, V.U[si], x, y, a);
    sampleVelocity(V, V.U[si + 1], x, y, b);
    const mx = x - 0.5 * h * (a[0] + (b[0] - a[0]) * st);
    const my = y - 0.5 * h * (a[1] + (b[1] - a[1]) * st);
    sampleVelocity(V, V.U[si], mx, my, a);
    sampleVelocity(V, V.U[si + 1], mx, my, b);
    x -= h * (a[0] + (b[0] - a[0]) * st);
    y -= h * (a[1] + (b[1] - a[1]) * st);
  }
  return [x, y];
}

// P4: the starting dye φ₀(x, y) in [0, 1] (stream ':plain:dye').
export function dye(seed, P) {
  const { U } = stream(seed, ':plain:dye');
  const angle = U() * Math.PI;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const lb = P.lambdaB;
  const k = 1 + 9 * (1 - P.dyeSoft);
  const edge = (v) => 0.5 + (0.5 * Math.tanh(k * v)) / Math.tanh(k);
  const phase = U() * 2 * Math.PI;
  if (P.plainDye === 'combed') {
    const phase2 = U() * 2 * Math.PI;
    return (x, y) => edge(0.65 * Math.sin((2 * Math.PI * (x * nx + y * ny)) / lb + phase)
      + 0.35 * Math.sin((2 * Math.PI * (-x * ny + y * nx)) / (2.7 * lb) + phase2));
  }
  if (P.plainDye === 'drops') {
    const side = 2.4 * lb;
    const soft = lb * (0.04 + 0.5 * P.dyeSoft);
    const cells = new Map();
    const drop = (ci, cj) => {
      const key = `${ci},${cj}`;
      if (!cells.has(key)) {
        const R = mulberry32(cyrb53(`${seed}:plain:dye:${key}`) >>> 0);
        cells.set(key, [(ci + R()) * side, (cj + R()) * side, lb * (0.45 + 0.6 * R()), R() < 0.8]);
      }
      return cells.get(key);
    };
    return (x, y) => {
      const ci = Math.floor(x / side);
      const cj = Math.floor(y / side);
      let v = 0;
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const [cx, cy, r, on] = drop(ci + a, cj + b);
          if (!on) continue;
          const q = (r - Math.hypot(x - cx, y - cy)) / soft;
          v = Math.max(v, q <= -1 ? 0 : q >= 1 ? 1 : 0.5 + 0.5 * Math.sin((q * Math.PI) / 2));
        }
      }
      return v;
    };
  }
  return (x, y) => edge(Math.sin((2 * Math.PI * (x * nx + y * ny)) / lb + phase));
}

// P5: Gaussian blur of a w × h field with standard deviation σ in cells: three box blurs each way,
// with Wells' box sizes. Edges clamp.
export function blur(f, w, h, sigma) {
  if (sigma < 0.5) return f;
  const n = 3;
  let wl = Math.floor(Math.sqrt((12 * sigma * sigma) / n + 1));
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  let a = Float32Array.from(f);
  let b = new Float32Array(f.length);
  const box = (src, dst, r, lines, len, at) => {
    for (let l = 0; l < lines; l++) {
      const idx = (k) => at(l, k < 0 ? 0 : k >= len ? len - 1 : k);
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += src[idx(k)];
      for (let k = 0; k < len; k++) {
        dst[idx(k)] = acc / (2 * r + 1);
        acc += src[idx(k + r + 1)] - src[idx(k - r)];
      }
    }
  };
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    box(a, b, r, h, w, (l, k) => l * w + k);
    box(b, a, r, w, h, (l, k) => k * w + l);
  }
  return a;
}

// P1–P5: φ on a grid of FIELD_SHORT cells along the short side of an X × Y sheet.
// Each cell takes φ₀ at its centre, traced back (the blur that follows smooths far more than a cell).
export function plainField(seed, X, Y, P) {
  const s = FIELD_SHORT;
  const pw = Math.max(2, Math.round(X * s));
  const ph = Math.max(2, Math.round(Y * s));
  const V = velocity(seed, X, Y, P);
  const phi0 = dye(seed, P);
  const phi = new Float32Array(pw * ph);
  for (let j = 0; j < ph; j++) {
    for (let i = 0; i < pw; i++) {
      const [x, y] = traceBack(V, ((i + 0.5) / pw) * X, ((j + 0.5) / ph) * Y, P.flowD);
      phi[j * pw + i] = phi0(x, y);
    }
  }
  return { phi: blur(phi, pw, ph, P.blurP * s), pw, ph };
}

// ---------- C: composite ----------

// η = min(1, (1 − L_b) / 0.35): how much room there is above the base to lighten into. A pale base
// (a beige tint, L ≈ 0.94) gets a gentler lift and glow, so neither washes it out to white.
export function headroom(L) {
  return Math.min(1, Math.max(0, (1 - L) / 0.35));
}

// C1: the view's pixels at W × H from φ on its pw × ph grid, filled in bilinearly, through a
// 1024-entry table φ ↦ sRGB, with a ±½ dither per 8-bit channel.
//   'base':    b everywhere
//   'pattern': φ as grey
//   'plain' / 'living': L = L_b + α η φ, C = C_b (1 − β φ), h = h_b, with η = headroom(L_b)
export function plainRGB(view, field, base, P, W, H) {
  const N = 1024;
  const eta = headroom(base.L);
  const lut = new Float32Array(3 * N);
  for (let i = 0; i < N; i++) {
    const f = i / (N - 1);
    let L = base.L + P.plainAlpha * eta * f;
    let C = base.C * (1 - P.plainBeta * f);
    if (view === 'base') [L, C] = [base.L, base.C];
    if (view === 'pattern') [L, C] = [0.12 + 0.82 * f, 0];
    const rgb = lchToLinear(L, C, base.h);
    for (let c = 0; c < 3; c++) lut[3 * i + c] = 255 * delinearise(rgb[c]);
  }
  const { phi, pw, ph } = field;
  const out = new Uint8ClampedArray(4 * W * H);
  const R = mulberry32(0x9e3779b9);
  for (let y = 0; y < H; y++) {
    const fy = Math.min(ph - 1.001, Math.max(0, ((y + 0.5) * ph) / H - 0.5));
    const j = fy | 0;
    const ty = fy - j;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(pw - 1.001, Math.max(0, ((x + 0.5) * pw) / W - 0.5));
      const i = fx | 0;
      const tx = fx - i;
      const k = j * pw + i;
      const v = (phi[k] * (1 - tx) + phi[k + 1] * tx) * (1 - ty) + (phi[k + pw] * (1 - tx) + phi[k + pw + 1] * tx) * ty;
      const q = Math.min(N - 1, Math.max(0, v * (N - 1)));
      const i0 = Math.min(N - 2, q | 0);
      const t = q - i0;
      const a = 3 * i0;
      const p = 4 * (y * W + x);
      for (let c = 0; c < 3; c++) out[p + c] = lut[a + c] + (lut[a + 3 + c] - lut[a + c]) * t + R() - 0.5;
      out[p + 3] = 255;
    }
  }
  return out;
}

// ---------- G: the glow ----------

const GLOW_DT = 1 / 30;
const MAX_LIGHTS = 9;

// G1–G3. glow.at(t) → [{ x, y, r, a }] in canvas units, the same for the same t however it's reached.
// The Ornstein–Uhlenbeck steps are taken in order from the stream, so going back in time replays from 0.
export class Glow {
  constructor(seed, X, Y, P, base) {
    this.seed = seed;
    this.X = X;
    this.Y = Y;
    this.P = P;
    const [r, g, b] = lchToLinear(P.glowL, Math.min(0.14, 1.4 * base.C + 0.03), base.h + P.glowDh);
    this.colour = [r, g, b].map((v) => Math.round(255 * delinearise(v)));
    this.eta = headroom(base.L);
    this.reset();
  }

  reset() {
    const { U, N } = stream(this.seed, ':plain:glow');
    this.N = N;
    this.t = 0;
    this.lights = Array.from({ length: MAX_LIGHTS }, () => ({
      x: U() * this.X, y: U() * this.Y, rho: 0.7 + 0.6 * U(), omega: 2 * Math.PI * (0.7 + 0.6 * U()), phase: 2 * Math.PI * U(),
    }));
  }

  at(t) {
    const P = this.P;
    if (t < this.t) this.reset();
    const sq = Math.sqrt(GLOW_DT);
    const mx = this.X / 2;
    const my = this.Y / 2;
    while (this.t + GLOW_DT <= t) {
      for (const L of this.lights) {
        L.x += -P.glowTheta * (L.x - mx) * GLOW_DT + P.glowSigma * sq * this.N();
        L.y += -P.glowTheta * (L.y - my) * GLOW_DT + P.glowSigma * sq * this.N();
      }
      this.t += GLOW_DT;
    }
    return this.lights.slice(0, P.glowN).map((L) => ({
      x: L.x, y: L.y, r: P.glowR * L.rho,
      a: (this.eta * P.glowA * (1 + P.glowBeta * Math.sin((L.omega * t) / P.glowT + L.phase))) / (1 + P.glowBeta),
    }));
  }
}
