// Colour maths: sRGB ↔ linear, OKLab lightness, OKLCh → sRGB (Björn Ottosson's matrices),
// and the 256-entry ink-to-paper lookup table.

// sRGB channel in [0, 1] → linear.
export function linearise(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Linear channel → sRGB in [0, 1], clamped.
export function delinearise(c) {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

// Linearisation of every 8-bit value, so a whole image needs no pow() per pixel.
export const LINEAR_BYTE = Float32Array.from({ length: 256 }, (_, i) => linearise(i / 255));

// OKLab L of a linear-RGB colour: l, m, s = M1 · rgb, then L from their cube roots.
export function oklabL(r, g, b) {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  return 0.2104542553 * Math.cbrt(l) + 0.7936177850 * Math.cbrt(m) - 0.0040720468 * Math.cbrt(s);
}

// OKLCh (h in degrees) → OKLab [L, a, b].
export function oklchToOklab(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  return [L, C * Math.cos(h), C * Math.sin(h)];
}

// OKLab → linear RGB, unclamped (Ottosson's inverse).
export function oklabToLinear([L, a, b]) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

// OKLab → sRGB [0, 1]³, clamped.
export function oklabToSrgb(lab) {
  return oklabToLinear(lab).map(delinearise);
}

export const INK = oklchToOklab(0.27, 0.013, 315);
export const PAPER = oklchToOklab(0.94, 0.025, 88);
// The bark tan of the Washi inclusions, from the reference paper's fibres and flakes.
export const TAN = oklchToOklab(0.8, 0.05, 75);

// An absorber that darkens paper toward a colour: per channel, a_c = −ln(colour_c / paper_c) in
// linear light, scaled so the luminance-weighted sum is 1. exp(−D · a) then darkens by about e^(−D).
export function absorber(colour, paper = PAPER) {
  const c = oklabToLinear(colour);
  const p = oklabToLinear(paper);
  const a = c.map((v, k) => -Math.log(Math.max(1e-6, v) / p[k]));
  const n = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  return a.map((v) => v / n);
}

// The ink–paper line in linear light: RAMP[3i..3i+2] = linear RGB of mix(ink, paper, i/(n − 1)).
export function linearRamp(n = 1024, ink = INK, paper = PAPER) {
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const lin = oklabToLinear([0, 1, 2].map((k) => ink[k] + (paper[k] - ink[k]) * t));
    for (let k = 0; k < 3; k++) out[3 * i + k] = Math.max(0, lin[k]);
  }
  return out;
}

// Linear [0, 1] → sRGB byte, for 4096 evenly spaced inputs.
export const SRGB_BYTE = Uint8ClampedArray.from({ length: 4096 }, (_, i) => Math.round(255 * delinearise(i / 4095)));

// LUT[3i..3i+2] = sRGB bytes of mix(ink, paper, i/255), mixed in OKLab.
export function inkPaperLUT(ink = INK, paper = PAPER) {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const lab = [0, 1, 2].map((k) => ink[k] + (paper[k] - ink[k]) * t);
    const rgb = oklabToSrgb(lab);
    for (let k = 0; k < 3; k++) lut[3 * i + k] = Math.round(255 * rgb[k]);
  }
  return lut;
}
