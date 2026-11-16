// The mask's skeleton, steps M1–M4: patch areas by stick-breaking, the main centre near the anchor,
// each patch's ellipse, and the secondaries placed around the main patch.
// All draws come from one stream { U, N } in a fixed order.

const MAX_PIECES = 12;
const TRIES = 20;

// The canvas [0, X] × [0, Y] inset by m on every side (collapses to the centre if too small).
function inset(X, Y, m) {
  const mx = Math.min(m, X / 2);
  const my = Math.min(m, Y / 2);
  return { x0: mx, x1: X - mx, y0: my, y1: Y - my };
}
const inside = (box, x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;

// M1. A_i = κ·V_i·∏_{j<i}(1 − V_j), V_i = 1 − U^(1/θ); stop below A_min or at 12 pieces.
// Sorted largest first, so A[0] is the main patch. The first piece is always kept.
export function stickBreaking(U, { kappa, theta, Amin }) {
  const A = [];
  let rest = 1;
  for (let i = 0; i < MAX_PIECES; i++) {
    const V = 1 - Math.pow(U(), 1 / theta);
    const Ai = kappa * V * rest;
    if (Ai < Amin && A.length > 0) break;
    A.push(Math.max(Ai, Amin));
    rest *= 1 - V;
  }
  return A.sort((p, q) => q - p);
}

// M2. Main centre ~ N(anchor, σ²I), re-sampled into the canvas inset by 0.5r; the anchor after
// 20 tries; uniform in the inset with probability ε.
export function mainCentre({ U, N }, anchor, r, X, Y, { sigma, epsilon }) {
  const box = inset(X, Y, 0.5 * r);
  const e = U();
  if (e < epsilon) {
    const x = box.x0 + (box.x1 - box.x0) * U();
    const y = box.y0 + (box.y1 - box.y0) * U();
    return { x, y, how: 'uniform' };
  }
  for (let k = 0; k < TRIES; k++) {
    const x = anchor.x + sigma * N();
    const y = anchor.y + sigma * N();
    if (inside(box, x, y)) return { x, y, how: k === 0 ? 'gaussian' : `gaussian, ${k + 1} tries` };
  }
  return { x: anchor.x, y: anchor.y, how: 'anchor (20 tries missed)' };
}

// M3. Aspect ρ = e^Z, Z ~ N(0, s²); semi-axes r√ρ, r/√ρ; rotation φ ~ U[0, π).
export function ellipse({ U, N }, A, s) {
  const r = Math.sqrt(A / Math.PI);
  const rho = Math.exp(s * N());
  return { A, r, a: r * Math.sqrt(rho), b: r / Math.sqrt(rho), phi: Math.PI * U() };
}

// M1–M4 together. Returns { patches, main, pieces, dropped }; patches[0] is the main patch.
export function skeleton(rng, anchor, X, Y, P) {
  const areas = stickBreaking(rng.U, P);
  const shapes = [];
  const rMain = Math.sqrt(areas[0] / Math.PI);
  const main = mainCentre(rng, anchor, rMain, X, Y, P);
  for (const A of areas) shapes.push(ellipse(rng, A, P.s));

  const patches = [{ ...shapes[0], x: main.x, y: main.y, main: true }];
  let dropped = 0;
  for (let i = 1; i < shapes.length; i++) {
    const p = shapes[i];
    const box = inset(X, Y, 0.5 * p.r);
    let placed = null;
    for (let k = 0; k < TRIES && !placed; k++) {
      const d = rMain * (1.6 + 0.4 * rng.N());
      const ang = 2 * Math.PI * rng.U();
      const x = main.x + d * Math.cos(ang);
      const y = main.y + d * Math.sin(ang);
      if (!inside(box, x, y)) continue;
      const clear = patches.every((q) => Math.hypot(x - q.x, y - q.y) >= 0.8 * (p.r + q.r));
      if (clear) placed = { ...p, x, y, main: false };
    }
    if (placed) patches.push(placed);
    else dropped++;
  }
  return { patches, main, pieces: areas.length, dropped };
}
