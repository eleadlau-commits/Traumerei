// The Planar mode's spontaneity, E1–E5: two kinds of flash on the latent network, nothing else.
// Each fades away completely, so nothing is remembered.
//   E1  timing:  the shared Hawkes process (engine/hawkes.js, stream ':planar:time'), background rate μ,
//                branching ratio n, memory τ_h. Each event is a glint with probability π_g, else a black line.
//   E2  where:   a point uniform along the network's length (stream ':planar:flash').
//   E3  glint:   the straight line through that point, from one of its two ends (chosen at random): a
//                head moves along it at v_g for T_g or until the line ends, trailing a streak whose
//                strength falls as e^(−s/ℓ_g) behind the head; then it fades out over F_g.
//   E4  black:   a reach R ~ Exponential(mean r); the black spreads from the point along every edge at
//                v_b, to every point within network distance R; then it fades out over F_b.
//   E5  fade:    o(u) = (1 − u)² over the fade, u from 0 to 1, so every flash ends at exactly 0.
// Lengths are in canvas units (short side = 1), times in seconds.

import { stream } from './random.js';
import { Hawkes } from './hawkes.js';

export const TIMES = {
  tauH: 1, // E1's memory τ_h
  vG: 1.8, // glint speed: the mean straight line (about 0.46) in about 0.25 s
  TG: 0.25, // glint travel time, at most
  ellG: 0.12, // glint streak length scale ℓ_g
  FG: 0.4, // glint fade
  vB: 1, // black spread speed: a mean segment (about 0.18) in about 0.2 s
  FB: 0.8, // black fade
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
        const travel = Math.min(TIMES.TG, len / TIMES.vG);
        f = { kind: 'glint', t0, line: L, len, back: rng.U() < 0.5, travel, end: t0 + travel + TIMES.FG };
      } else {
        const R = -P.flashR * Math.log(1 - rng.U());
        f = { kind: 'black', t0, at, R, end: t0 + R / TIMES.vB + TIMES.FB };
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
        const head = Math.min(age, f.travel) * TIMES.vG;
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
        const rho = Math.min(f.R, age * TIMES.vB);
        const o = fadeOut((age - f.R / TIMES.vB) / TIMES.FB);
        for (const [i, s0, s1] of ball(this.net, f.at.edge, f.at.pos, rho)) {
          const [x0, y0, x1, y1] = onEdge(this.net, i, s0, s1);
          out.push({ kind: 'black', x0, y0, x1, y1, a0: o, a1: o });
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
      // the strength runs exponentially between a0 and a1: keep the part above VISIBLE
      const [aLo, aHi] = (u0 < u1) ? [p.a0, p.a1] : [p.a1, p.a0];
      if (Math.max(aLo, aHi) <= VISIBLE) continue;
      if (Math.min(aLo, aHi) < VISIBLE) {
        const k = Math.log(aHi / aLo) / (hi - lo);
        const cut = lo + Math.log(VISIBLE / aLo) / k;
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
