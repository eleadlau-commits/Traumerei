// How rooms look: plain colour maths, no screen (tested in tests/look.test.js).
//
// Every colour here comes from the app's palette (Renderer, Settings → Colour: one tint, and the
// roles made from it: paper, ink, pale, veil, glow), handed in as { paper, ink, pale, glow } hex.
// The rooms page is an opacity mask (the ink at MASK) laid over the home picture itself, which is
// held still underneath (its spontaneity layer off), so nothing is drawn while it shows.
// A room is one colour r = (L_r, C_r, h_r) in OKLCh: the hue and chroma of its own colour (or the
// paper's, if it has none) at its lightness L_r (by default LIGHT, and darker for Messy thoughts).
// Inside, it fills the screen as a gentle gradient of r at its opacity. On the rooms page its
// square is a deeper, more vivid version of r, (L_r − DEEPER, vivid × C_r, h_r), at
// α = strength × (1.2 − L_r) × opacity, so a square shows the colour of its inside, a darker room
// is a deeper square and Messy thoughts the deepest. Words are the ink on a
// light room and the pale on a dark one.

export const PALETTE = { paper: '#f2ebd9', ink: '#2b2a27', pale: '#f0e7d2', glow: '#efcc83' }; // the default tint's
export const MASK = 0.1;              // the rooms page: the opacity of its mask over the picture
export const SQUARE = 0.6;            // a square's strength
export const DEEPER = 0.25;           // a square is this much darker (OKLab L) than its room inside
export const VIVID = 1.6;             // and its chroma this many times its inside's (Settings → Rooms → Colour strength)
export const LIGHT = 0.86;            // a room's lightness inside (OKLab L), by default
export const LIGHT_MESSY = 0.72;      // Messy thoughts: a little darker
export const DARK = 0.6;              // below this lightness a room is dark, and its words pale
export const OPACITY = 1;
export const SPREAD = 0.035;          // a room's gradient: this much lighter at the top, darker at the bottom

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

// OKLab (Ottosson), the same maths as the renderer's engine/colour.js.
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const delin = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export function toOklch([R, G, B]) {
  const [r, g, b] = [R, G, B].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return [L, Math.hypot(A, Bb), ((Math.atan2(Bb, A) * 180) / Math.PI + 360) % 360];
}
function linear(L, C, h) {
  const t = (h * Math.PI) / 180, a = C * Math.cos(t), b = C * Math.sin(t);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
// OKLCh → [r, g, b] bytes; a colour outside sRGB loses chroma (keeping its lightness and hue) until it fits.
export function fromOklch([L, C, h]) {
  let c = Math.max(0, C), v = linear(L, c, h);
  for (let i = 0; i < 40 && v.some((x) => x < -1e-4 || x > 1 + 1e-4); i++) v = linear(L, (c *= 0.9), h);
  return v.map((x) => Math.round(255 * delin(clamp(x, 0, 1))));
}

// Settings → Rooms: what each one changes, and its default. Saved as 'look' in the create area,
// with v: 2 (lightness in OKLab L; before that it was HSL, so older lightness values are dropped).
export const LOOK = {
  mask: MASK,         // the rooms page's mask: how much of it covers the picture
  square: SQUARE,     // how strong the rooms' squares are
  glow: 0.55,         // how brightly a room written in lately glows
  light: LIGHT,        // a room's lightness inside, by default
  lightMessy: LIGHT_MESSY,  // Messy thoughts' lightness inside
  vivid: VIVID,       // how strongly a square shows its room's colour
  peek: 0,            // a square's last thoughts: 0 when hovered over, 1 always
};

// Saved settings, checked and filled in with the defaults.
export function lookPrefs(saved) {
  const out = { ...LOOK };
  if (!saved || typeof saved !== 'object') return out;
  const old = saved.v !== 2;
  for (const [k, d] of Object.entries(LOOK)) {
    if (old && (k === 'light' || k === 'lightMessy')) continue;
    const v = saved[k];
    if (typeof d === 'number' && Number.isFinite(+v) && v !== '' && v != null) out[k] = +v;
  }
  return out;
}
export const savedLook = (prefs) => ({ ...prefs, v: 2 });

const pal = (palette) => ({ ...PALETTE, ...(palette || {}) });

// The picture's colours ({ top, bottom } from the backdrop, or null) → the rooms page's gradient,
// and its mask: the ink at the mask's opacity.
export function pageLook(colours, prefs = LOOK, palette = PALETTE) {
  const paper = rgb(pal(palette).paper);
  const top = colours?.top || paper, bottom = colours?.bottom || paper;
  return { top: css(top), bottom: css(bottom), mask: css(rgb(pal(palette).ink), prefs.mask) };
}

// A room's colour inside, in OKLCh: its own colour's hue and chroma (or the paper's), at its lightness.
export function roomColour(room, messy = false, prefs = LOOK, palette = PALETTE) {
  const [, C, h] = toOklch(rgb(room?.tint) || rgb(pal(palette).paper));
  const L = clamp(room?.light ?? (messy ? prefs.lightMessy : prefs.light), 0.02, 0.99);
  return [L, C, h];
}

// A room's square on the rooms page: a deeper version of its colour, at one alpha, laid over the
// page like a mask.
export function squareLook(room, messy = false, prefs = LOOK, palette = PALETTE) {
  const [L, C, h] = roomColour(room, messy, prefs, palette);
  const a = clamp(prefs.square * (1.2 - L) * (room?.opacity ?? OPACITY), 0, 0.95);
  return { fill: css(fromOklch([Math.max(0.03, L - DEEPER), C * (prefs.vivid ?? VIVID), h]), a), alpha: a };
}

// One room's look inside: its gradient, the ink for its words, and whether it is a dark room.
export function roomLook(room, palette = PALETTE, messy = false, prefs = LOOK) {
  const p = pal(palette);
  const [L, C, h] = roomColour(room, messy, prefs, p);
  const a = room?.opacity ?? OPACITY;
  const at = (dl) => fromOklch([clamp(L + dl, 0, 1), C, h]);
  const dark = L < DARK;
  return {
    top: css(at(SPREAD), a),
    bottom: css(at(-SPREAD), a),
    flat: css(at(0), a),
    ink: dark ? p.pale : p.ink,
    dark,
    colour: hex(at(0)),
    light: L,
    opacity: a,
  };
}
