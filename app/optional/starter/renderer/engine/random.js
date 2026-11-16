// Seeded randomness: cyrb53 string hash, mulberry32 uniform streams, Box–Muller Gaussians.
// Plain functions, no screen code, so the same seed always gives the same numbers.

// cyrb53: a 53-bit hash of a string.
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32: uniform numbers in [0, 1) from a 32-bit state.
export function mulberry32(a) {
  return function U() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A named stream: mulberry32 seeded with cyrb53(seed + name), e.g. stream(seed, ':skeleton').
// Each stream also draws standard normals N(0,1) by Box–Muller, two uniforms per draw.
export function stream(seed, name) {
  const U = mulberry32(cyrb53(String(seed) + name) >>> 0);
  const N = () => {
    const u1 = 1 - U(); // in (0, 1], so the log is finite
    const u2 = U();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  return { U, N };
}

// The seed shown to the person: the 53-bit hash as 14 hex digits.
export function seedText(seed) {
  return seed.toString(16).padStart(14, '0');
}
