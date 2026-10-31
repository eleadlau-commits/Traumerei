// The Plain mode: one flat colour from the picture's dominant hue (B, base), lifted by a heavily
// blurred fluid field (P, pattern), with a few soft lights drifting over it (G, spontaneity).
// The maths is in engine/plain.js; this file only describes the mode (see modes/index.js).

import { DEFAULT_TINT } from '../colour.js';
import { dominantHue, baseColour, plainField, plainRGB, Glow } from '../plain.js';
import { PARAMS, PLAIN_FIELD_KEYS } from '../params.js';
import { describePlain } from '../../report.js';

const GLOW_KEYS = PARAMS.filter((p) => p.group === 'Glow').map((p) => p.key);

// B1–B5: the dominant hue of the picture, or the tint τ when it has almost none.
export const hue = (e, P) => e.stage(plainMode, 'hue', P);

// The base colour b after its sliders.
export const base = (e, P) => baseColour(hue(e, P), P);

// P1–P5: φ on its grid, cached while the field's sliders stay the same.
export const field = (e, P) => e.stage(plainMode, 'field', P);

// Pixels for a Plain view at the image's size: 'base', 'pattern', 'plain' or 'living'
// ('living' is the still picture; the glow is laid over it).
export function view(e, name, P) {
  const { W, H } = e.image;
  return { rgba: plainRGB(name, field(e, P), base(e, P), P, W, H), width: W, height: H };
}

// G1–G3: the lights (stream seed + ':plain:glow').
export function glow(e, P) {
  const { seed, X, Y } = e.image;
  return new Glow(seed, X, Y, P, base(e, P));
}

const plainMode = {
  id: 'plain',
  label: 'Plain',
  viewKey: 'plainView',
  startView: 'living',
  views: [['base', 'Base'], ['pattern', 'Pattern'], ['plain', 'Plain'], ['living', 'Living']],
  folds: [['Base layer', ['Hue']], ['Pattern layer', ['Flow', 'Dye']], ['Spontaneity layer', ['Glow']]],
  usesAnchor: false,
  // The glow's sliders only change the lights, not the still picture.
  liveKeys: GLOW_KEYS,
  stages: {
    hue: { keys: ['tint'], make: (e, P) => dominantHue(e.rgba, e.image.W, e.image.H, P.tint || DEFAULT_TINT) },
    field: {
      keys: PLAIN_FIELD_KEYS,
      make(e, P) {
        const { seed, X, Y } = e.image;
        const t0 = performance.now();
        const f = plainField(seed, X, Y, P);
        return { ...f, ms: performance.now() - t0 };
      },
    },
  },
  view: (e, name, P) => view(e, name, P),
  // The lights as Gaussian glows on a canvas at a quarter of the screen, screen-blended over the picture.
  living(e, P) {
    const g = glow(e, P);
    return {
      kind: 'layer', blend: 'screen', scale: 0.25, fill: '#000',
      at: (t) => g.at(t).map((L) => ({ type: 'glow', ...L, colour: g.colour })),
    };
  },
  report: (e, P) => ({ lines: describePlain(hue(e, P), base(e, P), field(e, P), P) }),
};

export default plainMode;
