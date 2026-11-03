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

// The setting every ontology has: whether thoughts placed by hand may be overlapped (and are left
// out of the pass), or stay clear (and the others move around them).
export const OVERLAP = { key: 'overlap', label: 'Hand-placed can be overlapped', type: 'switch', default: true };
