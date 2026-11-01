// The Planar mode's spontaneity, E1–E5: two kinds of flash on the latent network, nothing else.
// Each fades away completely, so nothing is remembered.
//   E1  timing:  the shared Hawkes process (engine/hawkes.js, stream ':planar:time'), background rate μ,
//                branching ratio n, memory τ_h. Each event is a glint with probability π_g, else a black line.
//   E2  where:   a point uniform along the network's length (stream ':planar:flash').
//   E3  glint:   the straight line through that point, from one of its two ends (chosen at random): a
//                head moves along it at v_g for T_g or until the line ends, trailing a streak whose
//                strength falls as e^(−s/ℓ_g) behind the head; then it fades out over F_g.
//   E4  black:   a reach R ~ Exponential(mean r); the black spreads from the point along every edge at
//                v_b (a slider), to every point within network distance R; then it fades out over F_b (a slider).
//                Its front is blurred: at network distance d, with the front at ρ, its strength is
//                clamp((ρ − d) / w_f, 0, 1), so it fades to nothing over the last w_f.
//   E5  fade:    o(u) = (1 − u)² over the fade, u from 0 to 1, so every flash ends at exactly 0.
// Lengths are in canvas units (short side = 1), times in seconds.

import { stream } from './random.js';
import { Hawkes } from './hawkes.js';

export const TIMES = {
  tauH: 1, // E1's memory τ_h
  TG: 0.25, // glint travel time, at most
  ellG: 0.12, // glint streak length scale ℓ_g
  FG: 0.4, // glint fade
  wF: 0.04, // the black front's blur w_f
};
const VISIBLE = 0.1; // the revealed fraction counts strength above this
const fadeOut = (u) => (u <= 0 ? 1 : u >= 1 ? 0 : (1 - u) * (1 - u));

// Where a point at distance `d` along the network's length lies: { edge, pos } (pos from edge.a).
function locate(net, d) {
  for (let i = 0; i < net.edges.length; i++) {
    const e = net.edges[i];
    if (d <= e.length) return { edge: i, pos: d };
    d -= e.length;
  }
  const last = net.edges.length - 1;
  return { edge: last, pos: net.edges[last].length };
}

// Network distances from a point (edge, pos) to every node, by Dijkstra, up to `limit`.
function distances(net, edge, pos, limit) {
  const n = net.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  if (!net.adj) {
    net.adj = Array.from({ length: n }, () => []);
    net.edges.forEach((e, i) => {
      net.adj[e.a].push(i);
      net.adj[e.b].push(i);
    });
  }
  const e0 = net.edges[edge];
  dist[e0.a] = pos;
  dist[e0.b] = e0.length - pos;
  const done = new Uint8Array(n);
  for (;;) {
    let u = -1;
    for (let k = 0; k < n; k++) if (!done[k] && dist[k] <= limit && (u < 0 || dist[k] < dist[u])) u = k;
    if (u < 0) break;
    done[u] = 1;
    for (const i of net.adj[u]) {
      const e = net.edges[i];
      const w = e.a === u ? e.b : e.a;
      if (dist[u] + e.length < dist[w]) dist[w] = dist[u] + e.length;
    }
  }
  return dist;
}

// E4: the pieces of the network within distance ρ of the point: [[edge, s0, s1]] along each edge.
export function ball(net, edge, pos, rho) {
  const dist = distances(net, edge, pos, rho);
  const out = [];
  net.edges.forEach((e, i) => {
    const parts = [];
    if (dist[e.a] < rho) parts.push([0, Math.min(e.length, rho - dist[e.a])]);
    if (dist[e.b] < rho) parts.push([Math.max(0, e.length - (rho - dist[e.b])), e.length]);
    if (i === edge) parts.push([Math.max(0, pos - rho), Math.min(e.length, pos + rho)]);
    if (!parts.length) return;
    parts.sort((p, q) => p[0] - q[0]);
    let [s0, s1] = parts[0];
    for (const [a, b] of parts.slice(1)) {
      if (a <= s1) s1 = Math.max(s1, b);
      else {
        out.push([i, s0, s1]);
        [s0, s1] = [a, b];
      }
    }
    out.push([i, s0, s1]);
  });
  return out;
}

// E4 with the blurred front: the network within distance ρ of the point, as pieces along which the
// distance is linear: [[edge, s0, s1, d0, d1]], not overlapping. The distance along an edge is the
// least of a few linear functions of s (through either end, or straight from the point on its own edge),
// so it is split where they cross and where it reaches ρ.
export function reach(net, edge, pos, rho) {
  const dist = distances(net, edge, pos, rho);
  const out = [];
  net.edges.forEach((e, i) => {
    const L = e.length;
    const fs = []; // [slope, intercept]: candidate distances d = slope s + intercept
    if (dist[e.a] < rho) fs.push([1, dist[e.a]]);
    if (dist[e.b] < rho) fs.push([-1, dist[e.b] + L]);
    if (i === edge) fs.push([1, -pos], [-1, pos]); // the two halves of |s − pos|
    if (!fs.length) return;
    const d = (s) => Math.min(
      dist[e.a] + s,
      dist[e.b] + L - s,
      i === edge ? Math.abs(s - pos) : Infinity,
    );
    const cuts = new Set([0, L]);
    if (i === edge) cuts.add(pos);
    for (let p = 0; p < fs.length; p++) {
      for (let q = p + 1; q < fs.length; q++) {
        const [k1, c1] = fs[p];
        const [k2, c2] = fs[q];
        if (k1 !== k2) cuts.add((c2 - c1) / (k1 - k2));
      }
      cuts.add((rho - fs[p][1]) / fs[p][0]);
    }
    const xs = [...cuts].filter((v) => v >= 0 && v <= L).sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k++) {
      const [s0, s1] = [xs[k], xs[k + 1]];
      if (s1 - s0 < 1e-12) continue;
      const [d0, d1] = [d(s0), d(s1)];
      if (Math.min(d0, d1) >= rho) continue;
      if (d0 <= rho && d1 <= rho) out.push([i, s0, s1, d0, d1]);
    }
  });
  return out;
}

// A point `s` along a straight line, in canvas units.
function onLine(net, L, s) {
  return L.horizontal ? [L.from + s, L.at] : [L.at, L.from + s];
}
// A piece [s0, s1] of an edge, in canvas units.
function onEdge(net, i, s0, s1) {
  const e = net.edges[i];
  const A = net.nodes[e.a];
  return e.horizontal ? [A.x + s0, A.y, A.x + s1, A.y] : [A.x, A.y + s0, A.x, A.y + s1];
}

export class Flashes {
  constructor(seed, net, P) {
    Object.assign(this, { seed, net, P });
    this.reset();
  }

  reset() {
    this.hawkes = new Hawkes(stream(this.seed, ':planar:time'));
    this.rng = stream(this.seed, ':planar:flash');
    this.live = [];
    this.t = 0;
  }

  // E1–E2: every event up to t, then the flashes still showing at t. Going back replays from 0.
  advance(t) {
    if (t < this.t) this.reset();
    this.t = t;
    const { P, net, rng } = this;
    this.hawkes.advance(t, { mu: P.flashMu, nH: P.flashN, tauH: TIMES.tauH }, (t0) => {
      const glint = rng.U() < P.flashPiG;
      const at = locate(net, rng.U() * net.length);
      let f;
      if (glint) {
        const L = net.lines[net.edges[at.edge].line];
        const len = L.to - L.from;
        const travel = Math.min(TIMES.TG, len / P.flashVG);
        f = { kind: 'glint', t0, line: L, len, back: rng.U() < 0.5, travel, end: t0 + travel + TIMES.FG };
      } else {
        const R = -P.flashR * Math.log(1 - rng.U());
        f = { kind: 'black', t0, at, R, end: t0 + R / P.flashVB + P.flashFB };
      }
      this.live.push(f);
      return f;
    });
    this.live = this.live.filter((f) => f.end > t);
    return this.live;
  }

  // The pieces showing at t: { kind, x0, y0, x1, y1, a0, a1 } in canvas units, with strength a0 at
  // (x0, y0) and a1 at (x1, y1) (glints: strongest at the head, which is (x1, y1)).
  pieces(t) {
    const out = [];
    for (const f of this.advance(t)) {
      const age = t - f.t0;
      if (f.kind === 'glint') {
        const head = Math.min(age, f.travel) * this.P.flashVG;
        const o = fadeOut((age - f.travel) / TIMES.FG);
        const tail = Math.max(0, head - TIMES.ellG * Math.log(1 / VISIBLE / 0.5)); // to below 5%
        const toS = (s) => (f.back ? f.len - s : s);
        const steps = 6;
        for (let k = 0; k < steps; k++) {
          const s0 = tail + ((head - tail) * k) / steps;
          const s1 = tail + ((head - tail) * (k + 1)) / steps;
          const [x0, y0] = onLine(this.net, f.line, toS(s0));
          const [x1, y1] = onLine(this.net, f.line, toS(s1));
          out.push({ kind: 'glint', x0, y0, x1, y1, a0: o * Math.exp(-(head - s0) / TIMES.ellG), a1: o * Math.exp(-(head - s1) / TIMES.ellG) });
        }
      } else {
        const rho = Math.min(f.R, age * this.P.flashVB);
        const o = fadeOut((age - f.R / this.P.flashVB) / this.P.flashFB);
        const a = (d) => o * Math.min(1, Math.max(0, (rho - d) / TIMES.wF));
        for (const [i, s0, s1, d0, d1] of reach(this.net, f.at.edge, f.at.pos, rho)) {
          // split where the strength stops being 1, so each piece's strength is linear along it
          const dm = rho - TIMES.wF;
          const parts = (d0 - dm) * (d1 - dm) < 0 ? [[s0, d0, s0 + ((s1 - s0) * (dm - d0)) / (d1 - d0), dm], [s0 + ((s1 - s0) * (dm - d0)) / (d1 - d0), dm, s1, d1]] : [[s0, d0, s1, d1]];
          for (const [u0, e0, u1, e1] of parts) {
            const [x0, y0, x1, y1] = onEdge(this.net, i, u0, u1);
            out.push({ kind: 'black', x0, y0, x1, y1, a0: a(e0), a1: a(e1) });
          }
        }
      }
    }
    return out;
  }
}

// The revealed fraction at t: the length of the network shown at strength above VISIBLE (each part
// counted once, however many flashes cover it), over the network's total length.
export function revealed(net, flashes, t) {
  const byKey = new Map(); // 'h:at' or 'v:at' → [[from, to]]
  for (const p of flashes.pieces(t)) {
    const h = p.y0 === p.y1;
    const [u0, u1] = h ? [p.x0, p.x1] : [p.y0, p.y1];
    let lo = Math.min(u0, u1);
    let hi = Math.max(u0, u1);
    if (p.a0 !== p.a1) {
      // the strength runs between a0 and a1: keep the part above VISIBLE
      const [aLo, aHi] = (u0 < u1) ? [p.a0, p.a1] : [p.a1, p.a0];
      if (Math.max(aLo, aHi) <= VISIBLE) continue;
      if (Math.min(aLo, aHi) < VISIBLE) {
        const cut = p.kind === 'black'
          ? lo + ((VISIBLE - aLo) / (aHi - aLo)) * (hi - lo) // linear along the blurred front
          : lo + Math.log(VISIBLE / aLo) / (Math.log(aHi / aLo) / (hi - lo)); // exponential along a glint's streak
        if (aHi > aLo) lo = cut;
        else hi = cut;
      }
    } else if (p.a0 <= VISIBLE) continue;
    const key = `${h ? 'h' : 'v'}:${(h ? p.y0 : p.x0).toFixed(9)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push([lo, hi]);
  }
  let lit = 0;
  for (const parts of byKey.values()) {
    parts.sort((a, b) => a[0] - b[0]);
    let [s0, s1] = parts[0];
    for (const [a, b] of parts.slice(1)) {
      if (a <= s1) s1 = Math.max(s1, b);
      else {
        lit += s1 - s0;
        [s0, s1] = [a, b];
      }
    }
    lit += s1 - s0;
  }
  return lit / net.length;
}

// The long run: R(t) every dt over `hours` of model time; the largest R in each window of
// `windowS` seconds. → { maxima: [...], overall, mean }
export function revealRun(seed, net, P, hours, windowS = 600, dt = 0.05) {
  const f = new Flashes(seed, net, P);
  const maxima = [];
  let m = 0;
  let sum = 0;
  let count = 0;
  const steps = Math.round((hours * 3600) / dt);
  const per = Math.round(windowS / dt);
  for (let k = 1; k <= steps; k++) {
    const r = revealed(net, f, k * dt);
    m = Math.max(m, r);
    sum += r;
    count++;
    if (k % per === 0) {
      maxima.push(m);
      m = 0;
    }
  }
  return { maxima, overall: Math.max(...maxima, 0), mean: sum / count };
}
