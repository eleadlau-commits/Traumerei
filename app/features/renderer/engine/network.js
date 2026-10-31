// The Planar mode's pattern, N1–N4: a latent network of horizontal and vertical lines that tiles the
// whole frame with rectangles, like a Mondrian grid. It is never drawn in the Planar view; only the
// flashes will show it. It doesn't depend on the picture, which only gives the seed.
//   N1  grid:    m = round(ρ X) columns and n = round(ρ Y) rows, with gaps ∝ LogNormal(1, s_g) so
//                some bands are wide and some narrow (stream ':planar:net:grid').
//   N2  merge:   until a share μ of the cells has gone, pick a cell at random and join it to a random
//                neighbour that shares a whole side with it, so the pair is still a rectangle
//                (stream ':planar:net:merge').
//   N3  graph:   the rectangles' sides inside the frame, split at every junction, as segments between
//                nodes. The frame's own edge is not a line.
//   N4  lines:   each run of collinear segments joined end to end is one straight line, the path a
//                glint travels along.
// Lengths are in canvas units (short side = 1).

import { stream } from './random.js';

const GAP_SPREAD = 0.6; // s_g
const EPS = 1e-9;

// N1–N2. → [[x0, y0, x1, y1]] rectangles tiling [0, X] × [0, Y]
export function tiles(seed, X, Y, P) {
  const grid = stream(seed, ':planar:net:grid');
  const cuts = (k, side) => {
    const g = Array.from({ length: k }, () => Math.exp(GAP_SPREAD * grid.N()));
    const total = g.reduce((a, b) => a + b, 0);
    const out = [0];
    for (const v of g) out.push(out[out.length - 1] + (side * v) / total);
    out[k] = side;
    return out;
  };
  const m = Math.max(1, Math.round(P.netRho * X));
  const n = Math.max(1, Math.round(P.netRho * Y));
  const xs = cuts(m, X);
  const ys = cuts(n, Y);
  let cells = [];
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) cells.push([xs[i], ys[j], xs[i + 1], ys[j + 1]]);

  const merge = stream(seed, ':planar:net:merge');
  const same = (a, b) => Math.abs(a - b) < EPS;
  const joins = (a, b) => ((same(a[2], b[0]) || same(b[2], a[0])) && same(a[1], b[1]) && same(a[3], b[3]))
    || ((same(a[3], b[1]) || same(b[3], a[1])) && same(a[0], b[0]) && same(a[2], b[2]));
  const target = Math.max(1, Math.round(m * n * (1 - P.netMu)));
  for (let tries = 0; cells.length > target && tries < 50 * m * n; tries++) {
    const a = cells[Math.floor(merge.U() * cells.length)];
    const nb = cells.filter((b) => b !== a && joins(a, b));
    if (!nb.length) continue;
    const b = nb[Math.floor(merge.U() * nb.length)];
    cells = cells.filter((c) => c !== a && c !== b);
    cells.push([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  }
  return cells;
}

// N3–N4. → { rects, nodes: [{ x, y, deg }], edges: [{ a, b, horizontal, length, line }],
//            lines: [{ horizontal, at, from, to, edges: [edge index] }], length }
// Node and edge order is fixed (sorted), so indices are stable for the same tiles.
export function network(rects, X, Y) {
  const key = (x, y) => `${x.toFixed(9)},${y.toFixed(9)}`;
  const inside = (v, side) => v > EPS && v < side - EPS;
  // Every rectangle side inside the frame, as [horizontal, at, from, to].
  const sides = [];
  for (const [x0, y0, x1, y1] of rects) {
    if (inside(y0, Y)) sides.push([true, y0, x0, x1]);
    if (inside(y1, Y)) sides.push([true, y1, x0, x1]);
    if (inside(x0, X)) sides.push([false, x0, y0, y1]);
    if (inside(x1, X)) sides.push([false, x1, y0, y1]);
  }
  // The points where segments may end: every side's ends, on its own line.
  const stops = new Map(); // 'h:at' or 'v:at' → Set of positions along it
  const at = (h, c) => `${h ? 'h' : 'v'}:${c.toFixed(9)}`;
  for (const [h, c, a, b] of sides) {
    if (!stops.has(at(h, c))) stops.set(at(h, c), new Map());
    const s = stops.get(at(h, c));
    s.set(a.toFixed(9), a);
    s.set(b.toFixed(9), b);
  }
  // Perpendicular sides that meet a line also split it (a T from the other side).
  for (const [h, c, a, b] of sides) {
    for (const v of [a, b]) {
      const s = stops.get(at(!h, v));
      if (s) s.set(c.toFixed(9), c);
    }
  }
  const seen = new Map(); // edge key → edge
  for (const [h, c, a, b] of sides) {
    const pos = [...stops.get(at(h, c)).values()].filter((v) => v >= a - EPS && v <= b + EPS).sort((p, q) => p - q);
    for (let k = 0; k + 1 < pos.length; k++) {
      const [p, q] = [pos[k], pos[k + 1]];
      if (q - p < EPS) continue;
      const A = h ? [p, c] : [c, p];
      const B = h ? [q, c] : [c, q];
      const ek = `${key(...A)}|${key(...B)}`;
      if (!seen.has(ek)) seen.set(ek, { A, B, horizontal: h, length: q - p });
    }
  }
  const raw = [...seen.values()].sort((e, f) => (e.horizontal - f.horizontal) || (e.horizontal ? e.A[1] - f.A[1] || e.A[0] - f.A[0] : e.A[0] - f.A[0] || e.A[1] - f.A[1]));
  const index = new Map();
  const nodes = [];
  const node = ([x, y]) => {
    const k = key(x, y);
    if (!index.has(k)) {
      index.set(k, nodes.length);
      nodes.push({ x, y, deg: 0 });
    }
    return index.get(k);
  };
  const edges = raw.map((e) => {
    const a = node(e.A);
    const b = node(e.B);
    nodes[a].deg++;
    nodes[b].deg++;
    return { a, b, horizontal: e.horizontal, length: e.length, line: -1 };
  });
  // N4: runs of collinear edges, end to end.
  const lines = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const prev = lines[lines.length - 1];
    const c = e.horizontal ? nodes[e.a].y : nodes[e.a].x;
    const from = e.horizontal ? nodes[e.a].x : nodes[e.a].y;
    const to = e.horizontal ? nodes[e.b].x : nodes[e.b].y;
    if (prev && prev.horizontal === e.horizontal && Math.abs(prev.at - c) < EPS && Math.abs(prev.to - from) < EPS) {
      prev.to = to;
      prev.edges.push(i);
    } else {
      lines.push({ horizontal: e.horizontal, at: c, from, to, edges: [i] });
    }
    e.line = lines.length - 1;
  }
  const length = edges.reduce((s, e) => s + e.length, 0);
  return { rects, nodes, edges, lines, length };
}

// The counts for the report.
export function counts(net) {
  const by = (d) => net.nodes.filter((v) => v.deg === d).length;
  return {
    rectangles: net.rects.length,
    tees: by(3),
    crosses: by(4),
    frame: by(1), // where a line meets the frame
    segments: net.edges.length,
    lines: net.lines.length,
    length: net.length,
  };
}

// The Pattern view: the network drawn over `rgba` (W × H) as lines of width `w` canvas units in `ink`
// [r, g, b], with coverage anti-aliased along their width.
export function drawNetwork(net, rgba, W, H, w, ink) {
  const out = new Uint8ClampedArray(rgba);
  const s = Math.min(W, H);
  const half = Math.max(0.5, (w * s) / 2); // in pixels
  const paint = (px, py, a) => {
    if (px < 0 || py < 0 || px >= W || py >= H || a <= 0) return;
    const q = 4 * (py * W + px);
    for (let c = 0; c < 3; c++) out[q + c] = out[q + c] + (ink[c] - out[q + c]) * Math.min(1, a);
  };
  for (const e of net.edges) {
    const A = net.nodes[e.a];
    const B = net.nodes[e.b];
    if (e.horizontal) {
      const cy = A.y * s;
      const x0 = Math.floor(A.x * s - half);
      const x1 = Math.ceil(B.x * s + half);
      for (let py = Math.floor(cy - half - 1); py <= Math.ceil(cy + half + 1); py++) {
        const a = Math.min(1, Math.max(0, half + 0.5 - Math.abs(py + 0.5 - cy)));
        for (let px = x0; px < x1; px++) paint(px, py, a);
      }
    } else {
      const cx = A.x * s;
      const y0 = Math.floor(A.y * s - half);
      const y1 = Math.ceil(B.y * s + half);
      for (let px = Math.floor(cx - half - 1); px <= Math.ceil(cx + half + 1); px++) {
        const a = Math.min(1, Math.max(0, half + 0.5 - Math.abs(px + 0.5 - cx)));
        for (let py = y0; py < y1; py++) paint(px, py, a);
      }
    }
  }
  return out;
}
