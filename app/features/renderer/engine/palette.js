// The app's colours, all from one tint s (Settings → Colour). Every colour the app shows outside the
// picture's own marks is one of these roles, so changing s changes everything together. At the
// default beige they come out where the old fixed colours were.
//
//   paper = s itself                                  the base layer, washi, Plain, Planar's fog
//   ink   = OKLCh(0.285, 0.2 C_s, h_s)                words, the cross, Joyce's lines
//   pale  = OKLCh(0.93, 1.2 C_s, h_s)                 words on a dark room
//   veil  = OKLCh(0.977, 0.4 C_s, h_s)                the menu's veil, pop-ups, Settings
//   glow  = OKLCh(0.86, 0.1, h_s − 4°)                a lit room, a dark room's words
//
// A colour outside sRGB keeps its lightness and hue and loses chroma until it fits.
// The shade (the rooms page's mask, the squares) is the ink, or a room's colour, at an opacity.

import { hexToOklab, oklabToOklch, oklchToOklab, oklabToLinear, delinearise, DEFAULT_TINT } from './colour.js';
import { dominantHue } from './plain.js';

const fits = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

// OKLCh → sRGB bytes [r, g, b], chroma reduced until it fits.
export function toBytes(L, C, h) {
  let c = Math.max(0, C);
  let lin = oklabToLinear(oklchToOklab(L, c, h));
  for (let i = 0; i < 40 && !fits(lin); i++) {
    c *= 0.9;
    lin = oklabToLinear(oklchToOklab(L, c, h));
  }
  return lin.map((v) => Math.round(255 * delinearise(Math.min(1, Math.max(0, v)))));
}

export const hexOf = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

// roles('#rrggbb') → { paper, ink, pale, veil, glow }, each [r, g, b] in bytes.
export function roles(tint = DEFAULT_TINT) {
  const s = /^#[0-9a-f]{6}$/i.test(tint || '') ? tint : DEFAULT_TINT;
  const [L, C, h] = oklabToOklch(hexToOklab(s));
  return {
    paper: toBytes(L, C, h),
    ink: toBytes(0.285, 0.2 * C, h),
    pale: toBytes(0.93, 1.2 * C, h),
    veil: toBytes(0.977, 0.4 * C, h),
    glow: toBytes(0.86, 0.1, h - 4),
  };
}

// "From the picture": the picture's dominant hue (as Plain finds it), at the tint's own lightness
// and a quiet chroma, so the paper stays paper. Null when the picture has no colour to give.
export const PICTURE_CHROMA = { share: 0.35, least: 0.015, most: 0.06 };
export function tintFromPicture(rgba, W, H, tint = DEFAULT_TINT) {
  const found = dominantHue(rgba, W, H, tint);
  if (found.grey) return null;
  const [L] = oklabToOklch(hexToOklab(tint));
  const C = Math.min(PICTURE_CHROMA.most, Math.max(PICTURE_CHROMA.least, PICTURE_CHROMA.share * found.C));
  return hexOf(toBytes(L, C, found.h));
}
