// Centre's layout, without a screen: the chosen nodes in the middle and every other node in rings
// around them by how many links away it is (from the nearest chosen one, so several chosen, or
// webs that never meet, all work), spaced the way a web of springs settles. With nothing chosen
// (Tidy) the whole web just settles round its middle. draw.js runs it a few steps a frame, so the
// layout moves elastically into place, and again while a node is dragged.
//
// A layout is { nodes, edges, c, alpha }: nodes [{ id, x, y, vx, vy, r, ring, pinned, dim }] (x, y
// a node's middle; r how much room it needs; ring how many links from the chosen, Infinity when
// none reach it), edges [[i, j]] (indexes into nodes), c the middle, alpha how much is left to
// settle (1 at the start, 0 when still).

export const RING = 210;     // how far apart the rings are
const LINK = 150;            // a link's own length, as a spring
const TURN = 0.03, SPRING = 0.05, PUSH = 5200, PULL = 0.08, DAMP = 0.62;
export const COOL = 0.985;   // alpha after each step
export const STILL = 0.02;   // below this, it has settled

// How many links each node is from the nearest of `from` (ids); Infinity when none reach it.
// Links count both ways: a web is about what calls up what, either way.
export function distances(ids, edges, from) {
  const near = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of edges) { near.get(a)?.push(b); near.get(b)?.push(a); }
  const out = new Map(ids.map((id) => [id, Infinity]));
  let edge = from.filter((id) => out.has(id));
  for (const id of edge) out.set(id, 0);
  for (let d = 1; edge.length; d++) {
    const next = [];
    for (const id of edge) for (const n of near.get(id)) if (out.get(n) === Infinity) { out.set(n, d); next.push(n); }
    edge = next;
  }
  return out;
}

// A layout to settle: `nodes` [{ id, x, y, w, h }] where they are now (corners and sizes),
// `links` [[fromId, toId]], `chosen` ids (none: Tidy), `reach` how many steps out show (null:
// all; those further, or never reached, go to an outer ring, faded).
export function start(nodes, links, chosen = [], reach = null) {
  const ids = nodes.map((n) => n.id), index = new Map(ids.map((id, i) => [id, i]));
  const pairs = links.filter(([a, b]) => index.has(a) && index.has(b) && a !== b);
  const dist = distances(ids, pairs, chosen);
  const far = Math.max(0, ...[...dist.values()].filter(Number.isFinite));
  const out = nodes.map((n) => {
    const d = dist.get(n.id);
    const dim = !chosen.length ? false : !Number.isFinite(d) || (reach != null && d > reach);
    return {
      id: n.id, x: n.x + n.w / 2, y: n.y + n.h / 2, vx: 0, vy: 0, w: n.w, h: n.h,
      r: Math.hypot(n.w, n.h) / 2 + 14, ring: dim ? (reach != null ? Math.min(far, reach) : far) + 1 : d, pinned: false, dim,
    };
  });
  const middle = (list) => ({ x: list.reduce((s, n) => s + n.x, 0) / (list.length || 1), y: list.reduce((s, n) => s + n.y, 0) / (list.length || 1) });
  const sources = out.filter((n) => chosen.length && n.ring === 0);
  const c = middle(sources.length ? sources : out);
  // Each ring is shared out all the way round, in the order its nodes lie round the middle now,
  // so the web spreads on every side and still keeps its rough shape.
  if (sources.length) {
    const rings = new Map();
    for (const n of out) if (n.ring > 0) rings.set(n.ring, [...(rings.get(n.ring) || []), n]);
    for (const list of rings.values()) {
      const angle = (n) => Math.atan2(n.y - c.y, n.x - c.x);
      list.sort((p, q) => angle(p) - angle(q));
      const first = angle(list[0]);
      list.forEach((n, i) => { n.angle = first + (2 * Math.PI * i) / list.length; });
    }
  }
  return { nodes: out, edges: pairs.map(([a, b]) => [index.get(a), index.get(b)]), c, alpha: 1, centred: !!sources.length };
}

// One step of settling: links pull like springs, nodes push each other off (more when they would
// overlap), and each node is drawn to its ring (with nothing chosen, gently to the middle).
export function step(L) {
  const ns = L.nodes, a = L.alpha;
  for (const [i, j] of L.edges) {
    const p = ns[i], q = ns[j];
    const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
    const rest = LINK + (p.r + q.r) * 0.5;
    const f = SPRING * (d - rest) / d * a;
    p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
  }
  for (let i = 0; i < ns.length; i++) {
    for (let j = i + 1; j < ns.length; j++) {
      const p = ns[i], q = ns[j];
      let dx = q.x - p.x, dy = q.y - p.y;
      if (!dx && !dy) { dx = (i - j) * 0.7 || 0.5; dy = 0.3; }
      const d2 = dx * dx + dy * dy, d = Math.sqrt(d2);
      const room = p.r + q.r;
      // Pushed apart a little always, and firmly while they overlap, whatever is left to settle.
      const f = PUSH / Math.max(d2, 400) * a + (d < room ? (room - d) * 0.2 : 0);
      p.vx -= dx / d * f; p.vy -= dy / d * f;
      q.vx += dx / d * f; q.vy += dy / d * f;
    }
  }
  const c = L.c;
  for (const n of ns) {
    const dx = n.x - c.x, dy = n.y - c.y, d = Math.hypot(dx, dy) || 1;
    if (L.centred) {
      const want = n.ring * RING;
      const k = (n.ring === 0 ? PULL * 2 : PULL) * a;
      n.vx += (dx / d) * (want - d) * k; n.vy += (dy / d) * (want - d) * k;
      if (n.angle != null) { // and, more gently, towards its own place round the ring
        n.vx += (c.x + Math.cos(n.angle) * want - n.x) * TURN * a;
        n.vy += (c.y + Math.sin(n.angle) * want - n.y) * TURN * a;
      }
    } else {
      n.vx -= dx * 0.004 * a; n.vy -= dy * 0.004 * a;
    }
  }
  for (const n of ns) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
    n.vx *= DAMP; n.vy *= DAMP;
    n.x += n.vx; n.y += n.vy;
  }
  L.alpha *= COOL;
  return L.alpha > STILL;
}

// Settles a layout all at once (for tests, and when the system asks for less motion).
export function settle(L, most = 400) {
  for (let i = 0; i < most && step(L); i++);
  return L;
}

// Each node's corner, as Centre shows it: { [id]: { x, y } }.
export const corners = (L) => Object.fromEntries(L.nodes.map((n) => [n.id, { x: Math.round(n.x - n.w / 2), y: Math.round(n.y - n.h / 2) }]));
