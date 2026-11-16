// The Spontaneity layer, steps S1–S5: dots, dashes and marks that are drawn in, linger and dissolve.
//   S1  timing (engine/hawkes.js, shared with the other modes): a Hawkes process, λ(t) = μ + Σ_{tᵢ < t} (n / τ_h) e^(−(t − tᵢ)/τ_h), simulated exactly
//       by Ogata's thinning. n = 0 is a Poisson process; the mean rate is μ / (1 − n).
//   S2  placement: a background mark lands uniformly on the canvas, independent of the anchor and
//       the mask; an offspring lands near its parent, x = x_parent + σ_c ξ, heading θ_parent + σ_θ ξ.
//   S3  marks: a dot (a soft ellipse that spreads as it is drawn), a dash (a straight stroke) or a
//       mark (a bent stroke, a quadratic Bézier with bend h ~ N(0, σ_h²)).
//   S4  life: drawn in over T_d, held for T ~ LogNormal(μ_T, s_T), then o = e^(−(s − T_d − T)/τ_f),
//       with each mark's own fade time τ_f ~ LogNormal(μ_f, s_f).
//   S5  composite over the Washi picture, per channel in linear light: out_c = in_c · exp(−α_s D a_ink,c).
// Streams: seed + ':spont:time' (S1, and the choice of parent), ':spont:place' (S2), ':spont:marks' (S3–S4).
// The same seed and sliders always give the same marks at the same moment, however the frames fall.

import { stream } from './random.js';
import { Hawkes } from './hawkes.js';
import { smoothstep } from './field.js';
import { erf, taper } from './pattern.js';
import { LINEAR_BYTE, SRGB_BYTE } from './colour.js';

const POINTS = 16; // the stroke's polyline has POINTS + 1 points
const OUT = 5; // a mark is retired after 5 τ_f of fading (o < 0.7%)
const DEG = Math.PI / 180;

const logNormal = (rng, median, spread) => median * Math.exp(spread * rng.N());

export class Spontaneity {
  constructor(seed, X, Y, P) {
    Object.assign(this, { X, Y, P });
    this.hawkes = new Hawkes(stream(seed, ':spont:time'));
    this.place = stream(seed, ':spont:place');
    this.look = stream(seed, ':spont:marks');
    this.live = [];
    this.count = 0;
  }

  // The Hawkes state, kept readable and settable here (tests reset it to stop new marks).
  get E() { return this.hawkes.E; }
  set E(v) { this.hawkes.E = v; }
  get next() { return this.hawkes.next; }
  set next(v) { this.hawkes.next = v; }

  // S1 (engine/hawkes.js). Every event up to t, then the marks still visible at t.
  advance(t) {
    this.hawkes.advance(t, this.P, (tc, parent) => {
      const mk = this.birth(tc, parent);
      this.live.push(mk);
      this.count++;
      return mk;
    });
    this.live = this.live.filter((mk) => t - mk.t0 < mk.Td + mk.T + OUT * mk.tauF);
    return this.live;
  }

  // S2–S4 for one mark born at t0.
  birth(t0, parent) {
    const P = this.P;
    const { X, Y } = this;
    let x;
    let y;
    if (parent) {
      x = reflect(parent.x + P.sigmaC * this.place.N(), X);
      y = reflect(parent.y + P.sigmaC * this.place.N(), Y);
    } else {
      x = this.place.U() * X;
      y = this.place.U() * Y;
    }
    const L = this.look;
    // The kind: an offspring keeps its parent's with probability χ; otherwise π_dot, π_dash, the rest marks.
    const u = L.U();
    const v = L.U();
    let kind;
    if (parent && u < P.chi) kind = parent.kind;
    else {
      const total = Math.max(1, P.piDot + P.piDash);
      kind = v < P.piDot / total ? 'dot' : v < (P.piDot + P.piDash) / total ? 'dash' : 'mark';
    }
    const theta = parent ? parent.theta + P.sigmaTheta * DEG * L.N() : L.U() * 2 * Math.PI;
    const mk = {
      t0, kind, x, y, theta, parent: parent ? parent.id : null, id: this.count,
      len: logNormal(L, P.muLen, P.sLen),
      r: logNormal(L, P.muR, 0.4),
      q: 0.6 + 0.4 * L.U(),
      w: logNormal(L, P.muWm, 0.3),
      b: logNormal(L, P.muBm, 0.5),
      a: logNormal(L, P.muAm, P.sAm),
      bend: kind === 'mark' ? P.sigmaH * L.N() : 0,
      alpha: 0.15 + 0.45 * L.U(),
      beta: 0.15 + 0.45 * L.U(),
      Td: P.Td,
      T: logNormal(L, P.muT, P.sT),
      tauF: logNormal(L, P.tauF, P.sF),
    };
    if (kind !== 'dot') mk.pts = bezier(mk);
    return mk;
  }
}

// Reflect a coordinate back into [0, side].
function reflect(v, side) {
  v = Math.abs(v) % (2 * side);
  return v > side ? 2 * side - v : v;
}

// The stroke's centre line: from x − (len/2) e to x + (len/2) e, pulled sideways by bend · len at the middle.
function bezier({ x, y, theta, len, bend }) {
  const ex = Math.cos(theta);
  const ey = Math.sin(theta);
  const ax = x - (len / 2) * ex;
  const ay = y - (len / 2) * ey;
  const bx = x + (len / 2) * ex;
  const by = y + (len / 2) * ey;
  const cx = x - 2 * bend * len * ey; // the control point; the curve passes bend · len from the chord
  const cy = y + 2 * bend * len * ex;
  const pts = new Float32Array(2 * (POINTS + 1));
  for (let k = 0; k <= POINTS; k++) {
    const u = k / POINTS;
    const p = (1 - u) ** 2;
    const q = 2 * u * (1 - u);
    const r = u * u;
    pts[2 * k] = p * ax + q * cx + r * bx;
    pts[2 * k + 1] = p * ay + q * cy + r * by;
  }
  return pts;
}

// S4. The mark's state s seconds after its birth: how much is drawn (g) and its opacity (o).
export function life(mk, s) {
  if (s <= 0) return { g: 0, o: 0 };
  const g = smoothstep(0, mk.Td, s);
  const o = s < mk.Td + mk.T ? 1 : Math.exp(-(s - mk.Td - mk.T) / mk.tauF);
  return { g, o };
}

// The mark's box in canvas units, padded by its reach.
export function reach(mk, px) {
  const b = Math.sqrt(mk.b * mk.b + (px / 2) ** 2);
  if (mk.kind === 'dot') {
    const e = mk.r + 3 * b;
    return [mk.x - e, mk.y - e, mk.x + e, mk.y + e];
  }
  const e = mk.w / 2 + 3 * b;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let k = 0; k < mk.pts.length; k += 2) {
    x0 = Math.min(x0, mk.pts[k]);
    x1 = Math.max(x1, mk.pts[k]);
    y0 = Math.min(y0, mk.pts[k + 1]);
    y1 = Math.max(y1, mk.pts[k + 1]);
  }
  return [x0 - e, y0 - e, x1 + e, y1 + e];
}

// S3. Adds one mark's density at time t into D (W × H), within its box.
export function addMark(mk, t, cv, D) {
  const { g, o } = life(mk, t - mk.t0);
  const amp = mk.a * o;
  if (amp < 1e-3 || g <= 0) return;
  const { W, H, scale, px } = cv;
  const [bx0, by0, bx1, by1] = mk.box;
  const i0 = Math.max(0, Math.floor(bx0 * scale));
  const i1 = Math.min(W - 1, Math.ceil(bx1 * scale));
  const j0 = Math.max(0, Math.floor(by0 * scale));
  const j1 = Math.min(H - 1, Math.ceil(by1 * scale));
  const b = Math.sqrt(mk.b * mk.b + (px / 2) ** 2);
  const k = 1 / (Math.SQRT2 * b);

  if (mk.kind === 'dot') {
    // An ellipse of radii r√g and q r√g at heading θ: the drop's area grows linearly as it is drawn.
    const rr = mk.r * Math.sqrt(g);
    const c = Math.cos(mk.theta);
    const s = Math.sin(mk.theta);
    for (let j = j0; j <= j1; j++) {
      const dy = (j + 0.5) / scale - mk.y;
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) / scale - mk.x;
        const u = dx * c + dy * s;
        const v = (-dx * s + dy * c) / mk.q;
        const d = Math.hypot(u, v) - rr;
        D[j * W + i] += amp * 0.5 * (1 - erf(d * k));
      }
    }
    return;
  }

  // A stroke drawn up to u = g: the nearest point of the drawn polyline, its u, and the cross-section there.
  const pts = mk.pts;
  const last = g * POINTS;
  const full = Math.floor(last);
  for (let j = j0; j <= j1; j++) {
    const py = (j + 0.5) / scale;
    for (let i = i0; i <= i1; i++) {
      const pxl = (i + 0.5) / scale;
      let best = Infinity;
      let bu = 0;
      for (let s = 0; s < Math.ceil(last); s++) {
        const ax = pts[2 * s];
        const ay = pts[2 * s + 1];
        let ex = pts[2 * s + 2] - ax;
        let ey = pts[2 * s + 3] - ay;
        const part = s < full ? 1 : last - full; // the segment being drawn is cut at the pen
        ex *= part;
        ey *= part;
        const ll = ex * ex + ey * ey;
        let f = ll > 0 ? ((pxl - ax) * ex + (py - ay) * ey) / ll : 0;
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        const qx = pxl - ax - f * ex;
        const qy = py - ay - f * ey;
        const d2 = qx * qx + qy * qy;
        if (d2 < best) {
          best = d2;
          bu = (s + f * part) / POINTS;
        }
      }
      const d = Math.sqrt(best);
      const w = mk.w;
      const E = taper(Math.min(0.999, Math.max(0.001, bu)), mk.alpha, mk.beta);
      D[j * W + i] += amp * E * 0.5 * (erf((w / 2 - d) * k) + erf((w / 2 + d) * k));
    }
  }
}

// S5. The living picture: the static Washi pixels with the marks over them, redrawn only where marks are.
//   const living = new Living(process, rgba, W, H, inkAbsorber, α_s);
//   const rects = living.frame(t); // [x, y, w, h] pixel rectangles of living.rgba that changed
export class Living {
  constructor(process, base, W, H, ak, alpha) {
    const scale = Math.min(W, H);
    Object.assign(this, { process, base, W, H, ak, alpha });
    this.cv = { W, H, scale, px: 1 / scale };
    this.rgba = new Uint8ClampedArray(base);
    this.D = new Float32Array(W * H);
    this.drawn = [];
  }

  frame(t) {
    const live = this.process.advance(t);
    for (const mk of live) mk.box ||= reach(mk, this.cv.px);
    const dirty = new Set([...this.drawn, ...live]);
    const rects = [...dirty].map((mk) => this.rect(mk.box)).filter((r) => r[2] > 0 && r[3] > 0);
    const { D, W } = this;
    for (const [x, y, w, h] of rects) for (let j = y; j < y + h; j++) D.fill(0, j * W + x, j * W + x + w);
    for (const mk of live) addMark(mk, t, this.cv, D);
    for (const r of rects) this.composite(r);
    this.drawn = live.slice();
    return rects;
  }

  rect([x0, y0, x1, y1]) {
    const { W, H, cv } = this;
    const i0 = Math.max(0, Math.floor(x0 * cv.scale));
    const j0 = Math.max(0, Math.floor(y0 * cv.scale));
    const i1 = Math.min(W - 1, Math.ceil(x1 * cv.scale));
    const j1 = Math.min(H - 1, Math.ceil(y1 * cv.scale));
    return [i0, j0, i1 - i0 + 1, j1 - j0 + 1];
  }

  composite([x, y, w, h]) {
    const { D, W, base, rgba, ak, alpha } = this;
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const p = j * W + i;
        const q = 4 * p;
        const d = alpha * D[p];
        if (d === 0) {
          rgba[q] = base[q];
          rgba[q + 1] = base[q + 1];
          rgba[q + 2] = base[q + 2];
          continue;
        }
        for (let c = 0; c < 3; c++) {
          const v = LINEAR_BYTE[base[q + c]] * Math.exp(-d * ak[c]);
          rgba[q + c] = SRGB_BYTE[Math.round(4095 * (v < 0 ? 0 : v > 1 ? 1 : v))];
        }
      }
    }
  }
}

// What to expect: the mean rate μ / (1 − n) and the number visible at once, rate × mean life.
export function expected(P) {
  const n = Math.min(P.nH, 0.95);
  const rate = P.mu / (1 - n);
  const life = P.Td + P.muT * Math.exp(P.sT * P.sT / 2) + P.tauF * Math.exp(P.sF * P.sF / 2);
  return { rate, visible: rate * life, cluster: 1 / (1 - n) };
}
