// Clear space: after any change in a room (writing, deleting, editing, folding), the room measures
// the real size of what is on its canvas and gently pushes apart anything that overlaps. It works
// on blocks: what moves together (Joyce: a run of a train; Pessoa: one thought). A fixed block
// stays where it is and the others move around it. Of two that may both move, the newer one moves.
// No screen here, so it can be tested on its own (tests/clear.test.js).

export const GAP = 18; // world units kept clear between blocks

// blocks: [{ id, box: { x, y, w, h }, fixed, at }]. Returns { [id]: { dx, dy } } for those that move.
export function clearSpace(blocks, { gap = GAP, rounds = 40 } = {}) {
  const bs = blocks.filter((b) => b.box && b.box.w > 0 && b.box.h > 0)
    .map((b) => ({ ...b, x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h }));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < bs.length; i++) {
      for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i], b = bs[j];
        if (a.fixed && b.fixed) continue;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + gap;
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + gap;
        if (ox <= 0 || oy <= 0) continue;
        const mover = a.fixed ? b : b.fixed ? a : ((b.at ?? 0) >= (a.at ?? 0) ? b : a);
        const other = mover === a ? b : a;
        // Text runs down the page, so a push is down (or up) unless sideways is much shorter.
        if (oy <= ox * 1.5) {
          const dir = mover.y + mover.h / 2 >= other.y + other.h / 2 ? 1 : -1;
          mover.y += dir * Math.ceil(oy);
        } else {
          const dir = mover.x + mover.w / 2 >= other.x + other.w / 2 ? 1 : -1;
          mover.x += dir * Math.ceil(ox);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
  const out = {};
  for (const b of bs) {
    const dx = Math.round(b.x - b.box.x), dy = Math.round(b.y - b.box.y);
    if (dx || dy) out[b.id] = { dx, dy };
  }
  return out;
}

// A spot for something new (size: { w, h }) inside box ({ x, y, w, h }) that overlaps none of
// rects, with a gap; the top-left of it. Tries spread spots, then random ones; failing that, the
// one farthest from the rest.
export function clearSpot(box, rects, size, random = Math.random, { gap = GAP, tries = 80 } = {}) {
  const hits = (p) => rects.some((r) => p.x < r.x + r.w + gap && r.x < p.x + size.w + gap && p.y < r.y + r.h + gap && r.y < p.y + size.h + gap);
  const spots = [];
  const cols = 5, rows = 5;
  for (let i = 0; i < tries; i++) {
    const p = i < cols * rows
      ? { x: box.x + ((i % cols) + random()) / cols * Math.max(0, box.w - size.w), y: box.y + (Math.floor(i / cols) + random()) / rows * Math.max(0, box.h - size.h) }
      : { x: box.x + random() * Math.max(0, box.w - size.w), y: box.y + random() * Math.max(0, box.h - size.h) };
    spots.push(p);
  }
  // Spread spots in a shuffled order, so a new train doesn't always land in the same corner.
  const order = spots.map((p, i) => [random(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => spots[i]);
  const free = order.find((p) => !hits(p));
  if (free) return free;
  const far = (p) => (rects.length ? Math.min(...rects.map((r) => Math.hypot(r.x + r.w / 2 - p.x - size.w / 2, r.y + r.h / 2 - p.y - size.h / 2))) : 0);
  return order.reduce((best, p) => (far(p) > far(best) ? p : best), order[0]);
}

// The spot nearest `at` ({ x, y }, a top-left) for something new (size: { w, h }) that overlaps
// none of rects, with a gap: `at` itself when it is clear, else the first clear one on rings
// further and further out (8 directions, then more as the rings widen). Failing all, `at`.
export function nearSpot(at, rects, size, { gap = GAP, step = 40, rings = 30 } = {}) {
  const hits = (p) => rects.some((r) => p.x < r.x + r.w + gap && r.x < p.x + size.w + gap && p.y < r.y + r.h + gap && r.y < p.y + size.h + gap);
  if (!hits(at)) return { x: at.x, y: at.y };
  for (let k = 1; k <= rings; k++) {
    const n = 8 * k, d = k * step;
    const ring = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI;
      // Text runs down: rings are wider than they are tall, so it goes beside or below sooner.
      const p = { x: at.x + Math.cos(a) * d * 1.6, y: at.y + Math.sin(a) * d };
      if (!hits(p)) ring.push(p);
    }
    if (ring.length) return ring.reduce((best, p) => (Math.hypot(p.x - at.x, p.y - at.y) < Math.hypot(best.x - at.x, best.y - at.y) ? p : best));
  }
  return { x: at.x, y: at.y };
}

// The setting every ontology has: whether thoughts placed by hand may be overlapped (and are left
// out of the pass), or stay clear (and the others move around them).
export const OVERLAP = { key: 'overlap', label: 'Hand-placed can be overlapped', type: 'switch', default: true };
