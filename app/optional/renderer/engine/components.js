// Step M8: connected components of the thresholded field, and the rules an attempt must pass.

// 8-connected components of { F' ≥ T } on grid G. Components smaller than Amin are ignored.
// Returns [{ area, x, y }] largest first, in canvas coordinates (short side = 1).
export function components(G, Fp, T, Amin) {
  const { gw, gh } = G;
  const label = new Int32Array(gw * gh);
  const stack = new Int32Array(gw * gh);
  const cell = G.hx * G.hy;
  const found = [];
  let next = 0;
  for (let start = 0; start < Fp.length; start++) {
    if (label[start] || Fp[start] < T) continue;
    next++;
    let top = 0;
    let count = 0;
    let sx = 0;
    let sy = 0;
    stack[top++] = start;
    label[start] = next;
    while (top) {
      const p = stack[--top];
      const i = p % gw;
      const j = (p - i) / gw;
      count++;
      sx += i;
      sy += j;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= gh) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= gw) continue;
          const q = jj * gw + ii;
          if (!label[q] && Fp[q] >= T) {
            label[q] = next;
            stack[top++] = q;
          }
        }
      }
    }
    const area = count * cell;
    if (area >= Amin) {
      found.push({ area, x: (sx / count + 0.5) * G.hx, y: (sy / count + 0.5) * G.hy });
    }
  }
  return found.sort((p, q) => q.area - p.area);
}

const RATIO = 0.85;

// The rules: (1) the largest component's centroid lies within max(3σ, r_main) of the anchor,
// skipped when the main centre was placed uniformly (it wandered on purpose); (2) every pair of
// components has area ratio (smaller / larger) below 0.85.
// Returns { pass, score, near, pairs } where a lower score is a better attempt (0 = pass).
export function judge(comps, anchor, rMain, mainHow, sigma) {
  const limit = Math.max(3 * sigma, rMain);
  let near;
  if (mainHow === 'uniform') near = { skipped: true, pass: true, limit };
  else if (!comps.length) near = { pass: false, distance: Infinity, limit };
  else {
    const distance = Math.hypot(comps[0].x - anchor.x, comps[0].y - anchor.y);
    near = { pass: distance <= limit, distance, limit };
  }
  const pairs = [];
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      const ratio = comps[j].area / comps[i].area;
      if (ratio >= RATIO) pairs.push({ i, j, ratio });
    }
  }
  let score = 0;
  if (!near.pass) score += Number.isFinite(near.distance) ? 1 + near.distance / limit : 100;
  for (const p of pairs) score += 1 + (p.ratio - RATIO);
  return { pass: near.pass && !pairs.length, score, near, pairs };
}
