// How rooms look: plain colour maths, no screen (tested in tests/look.test.js).
//
// The rooms page is a still gradient, top to bottom, from the home picture's own colours made a
// little darker (DARKEN), so nothing has to be drawn while it shows. Each room is a gradient of
// one colour: its tint (by default the picture's average colour) at its lightness (by default
// LIGHT, and darker for Messy thoughts), shown at its opacity over the picture. Words in a room
// are dark ink on a light room and pale light on a dark one.

export const PAPER = [242, 235, 217]; // the base tint, when there's no picture to read
export const DARKEN = 0.9;            // the rooms page, against the picture
export const LIGHT = 0.8;             // a room's lightness, by default
export const LIGHT_MESSY = 0.62;      // Messy thoughts: a little darker
export const OPACITY = 1;
export const SATURATION = 0.22;       // the most a room takes of the picture's colour, by default
export const SPREAD = 0.05;           // a room's gradient: this much lighter at the top, darker at the bottom
export const INK = '#2b2a28';
export const PALE = '#f1e8d2';

export const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function rgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const css = (c, a = 1) => `rgb(${c.map(Math.round).join(' ')} / ${+a.toFixed(3)})`;

export function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function fromHsl([h, s, l]) {
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// The picture's colours ({ top, bottom } from the backdrop, or null) → the rooms page's gradient.
export function pageLook(colours) {
  const top = colours?.top || PAPER, bottom = colours?.bottom || PAPER;
  return { top: css(top.map((v) => v * DARKEN)), bottom: css(bottom.map((v) => v * DARKEN)), average: mix(top, bottom, 0.5) };
}

// One room's look, given the picture's average colour: its gradient, the ink for its words,
// and whether it is a dark room.
export function roomLook(room, average = PAPER, messy = false) {
  const tint = rgb(room?.tint) || average;
  const [h, s0] = toHsl(tint);
  const s = room?.tint ? s0 : Math.min(s0, SATURATION); // the picture's own colour, kept quiet
  const l = room?.light ?? (messy ? LIGHT_MESSY : LIGHT);
  const a = room?.opacity ?? OPACITY;
  const at = (dl) => fromHsl([h, s, clamp(l + dl, 0, 1)]);
  const dark = l < 0.55;
  return {
    top: css(at(SPREAD), a),
    bottom: css(at(-SPREAD), a),
    flat: css(at(0), a),
    ink: dark ? PALE : INK,
    dark,
    tint: hex(tint),
    light: l,
    opacity: a,
  };
}
