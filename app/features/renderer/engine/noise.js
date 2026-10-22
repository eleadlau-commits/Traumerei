// Seeded 2D simplex noise (Gustavson's formulation) and fractal Brownian motion.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

// simplex(U) → n(x, y) in about [-1, 1], with its permutation shuffled by the uniform stream U.
// Draws exactly 255 numbers from U.
export function simplex(U) {
  const p = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(U() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const corner = (gi, x, y) => {
    const t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = GRAD[gi & 7];
    return t * t * t * t * (g[0] * x + g[1] * y);
  };

  return function n(x, y) {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    return 70 * (
      corner(perm[ii + perm[jj]], x0, y0) +
      corner(perm[ii + i1 + perm[jj + j1]], x1, y1) +
      corner(perm[ii + 1 + perm[jj + 1]], x2, y2));
  };
}

// fBm(x) = Σ_o g^o · n(2^o x / λ) / Σ_o g^o, with gain g = 2^(−H). Normalised to about [-1, 1].
export function fbm(n, { octaves, lambda, H }) {
  const g = Math.pow(2, -H);
  let norm = 0;
  for (let o = 0, a = 1; o < octaves; o++, a *= g) norm += a;
  return function f(x, y) {
    let sum = 0;
    let a = 1;
    let fr = 1 / lambda;
    for (let o = 0; o < octaves; o++) {
      sum += a * n(x * fr + 31.7 * o, y * fr + 47.3 * o); // shifted so octaves don't line up
      a *= g;
      fr *= 2;
    }
    return sum / norm;
  };
}
