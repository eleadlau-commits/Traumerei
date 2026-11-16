// The Washi mode: the monochrome cut by the seeded mask (M1–M8, base), printed on the seeded washi paper
// (P1–P6, pattern), with ink marks coming and going over it (S1–S5, spontaneity).
// A mode is a plain description with no screen code (see modes/index.js for the shape). The functions
// below take the Engine `e`, which holds the picture and the caches.

import { inkPaperLUT, linearRamp, absorber, oklchToOklab, palette, DEFAULT_TINT } from '../colour.js';
import { tone as toneOf } from '../monochrome.js';
import { stream } from '../random.js';
import { skeleton } from '../skeleton.js';
import { grid, field } from '../field.js';
import { components, judge } from '../components.js';
import { paint, paintLinear, shiftedLinear, upscaleMask, maskTone, baseTone, heightTone, contour, washiRGB } from '../render.js';
import { part, combine, PARTS } from '../pattern.js';
import { Spontaneity, Living } from '../spontaneity.js';
import { keysOf } from '../params.js';
import { describe, describePattern, describeLiving } from '../../report.js';

const REROLLS = 8;
const FIELD_SHORT = 320;

// The colours from the base tint τ: ink, paper and tan (palette()), the LUT and linear ramp between
// ink and paper, and the absorbers. Remade only when τ changes.
export function colours(e, P) {
  const tint = P.tint || DEFAULT_TINT;
  if (e.tint === tint) return;
  const c = palette(tint);
  e.tint = tint;
  e.ink = c.ink;
  e.paper = c.paper;
  e.warmHue = c.warmHue;
  e.lut = inkPaperLUT(c.ink, c.paper);
  e.ramp = linearRamp(1024, c.ink, c.paper);
  e.inkAbsorber = absorber(c.ink, c.paper);
  e.tanAbsorber = c.dye ? absorber(c.paper, [1, 0, 0]) : absorber(c.tan, c.paper);
}

// Steps 3–5, cached while their parameters stay the same.
export function tone(e, P) {
  const key = [P.k, P.gamma, P.dMin, P.dMax].join();
  if (e.toneCache?.key !== key) e.toneCache = { key, t: toneOf(e.image.L, e.image.bw, P) };
  return e.toneCache.t;
}

// M1–M8 for one attempt: streams seed + ':skeleton', ':warp', ':noise', with ':n' on re-roll n.
function attempt(e, n, P, anchor, G) {
  const { seed, X, Y } = e.image;
  const tag = n ? `:${n}` : '';
  const sk = skeleton(stream(seed, ':skeleton' + tag), anchor, X, Y, P);
  const f = field(G, sk.patches, stream(seed, ':warp' + tag), stream(seed, ':noise' + tag), P);
  const comps = components(G, f.Fp, f.T, P.Amin);
  const verdict = judge(comps, anchor, sk.patches[0].r, sk.main.how, P.sigma);
  return { n, ...sk, ...f, comps, verdict };
}

// The mask with its re-rolls: the first attempt that passes, or else the best one.
export function mask(e, P, anchorFrac) {
  const { X, Y, W, H } = e.image;
  const anchor = { x: anchorFrac.x * X, y: anchorFrac.y * Y };
  const G = grid(X, Y, Math.min(FIELD_SHORT, Math.min(W, H)));
  const attempts = [];
  let best = null;
  for (let n = 0; n <= REROLLS; n++) {
    const a = attempt(e, n, P, anchor, G);
    attempts.push(a);
    if (!best || a.verdict.score < best.verdict.score) best = a;
    if (a.verdict.pass) break;
  }
  return { G, anchor, attempts, best };
}

// P1–P5 at the image's size. Each part is cached while its own sliders stay the same.
export function pattern(e, P) {
  const { seed, X, Y, W, H } = e.image;
  const c = (e.patternCache ||= { parts: {} });
  const t0 = performance.now();
  let changed = !c.Dw;
  for (const [name, keys] of Object.entries(PARTS)) {
    const key = keys.map((k) => P[k]).join();
    if (c.parts[name]?.key === key) continue;
    c.parts[name] = { key, ...part(name, seed, X, Y, W, H, P) };
    changed = true;
  }
  if (changed) Object.assign(c, combine(c.parts), { ms: performance.now() - t0 });
  return c;
}

// Pixels for a view: 'monochrome', 'mask', 'base', 'pattern', 'washi' at the image's size;
// 'field' at the grid's. 'living' is the Washi picture, which living() then draws marks over.
// Every view uses the colours of the base tint τ (colours()).
// Brightness ΔL and warmth Δw move the monochrome (and so the base) in the Monochrome, Base, Washi and
// Living views; the Mask and Field views stay on the plain ink–paper line.
export function view(e, name, P, r) {
  const { W, H } = e.image;
  colours(e, P);
  const t = tone(e, P);
  const delta = shift(e, P);
  if (name === 'monochrome') {
    return { rgba: delta ? paintLinear(shiftedLinear(t, null, delta, e.ink, e.paper)) : paint(t, e.lut), width: W, height: H };
  }
  if (name === 'pattern') return { rgba: washi(e, null, P), width: W, height: H };
  const { G, best } = r;
  if (name === 'field') {
    return { rgba: paint(heightTone(best.Fp, best.max), e.lut), width: G.gw, height: G.gh,
      contour: contour(G, best.Fp, best.T) };
  }
  const m = fullMask(e, P, r);
  if (name === 'mask') return { rgba: paint(maskTone(m), e.lut), width: W, height: H };
  const tb = baseTone(t, m);
  const lin = delta ? shiftedLinear(tb, m, delta, e.ink, e.paper) : null;
  if (name === 'washi' || name === 'living') return { rgba: washi(e, tb, P, lin), width: W, height: H };
  return { rgba: lin ? paintLinear(lin) : paint(tb, e.lut), width: W, height: H };
}

// The base's shift Δ in OKLab from brightness ΔL and warmth Δw, or null when both are 0.
// Warmth moves toward the tan's hue, which follows the tint.
function shift(e, P) {
  const dL = P.baseL || 0;
  const dW = P.baseW || 0;
  if (!dL && !dW) return null;
  const [, a, b] = oklchToOklab(0, dW, e.warmHue);
  return [dL, a, b];
}

// P6 over base tone t (null for bare paper), or over lin, the shifted base in linear RGB.
// Warmth κ mixes the inclusions' absorber from ink to tan.
function washi(e, t, P, lin = null) {
  const k = P.warmth;
  const aw = e.tanAbsorber.map((v, c) => k * v + (1 - k) * e.inkAbsorber[c]);
  return washiRGB(t, pattern(e, P), P.alpha, e.ramp, aw, e.inkAbsorber, lin);
}

// S1–S5: the marks over the Washi pixels `rgba` (streams seed + ':spont:…'). They depend only on the
// seed and their own sliders, never on the anchor or the mask. The process is replayed from 0, so a
// slider change shows its marks at the same moment t.
export function living(e, P, rgba) {
  colours(e, P);
  const { seed, X, Y, W, H } = e.image;
  return new Living(new Spontaneity(seed, X, Y, P), rgba, W, H, e.inkAbsorber, P.alphaS);
}

export function fullMask(e, P, r) {
  const c = e.maskCache;
  if (c?.r !== r || c.delta !== P.delta || c.feather !== P.feather) {
    const { W, H } = e.image;
    const m = upscaleMask(r.G, r.best.Fp, r.best.T, P.delta, W, H, P.feather);
    e.maskCache = { r, delta: P.delta, feather: P.feather, m };
  }
  return e.maskCache.m;
}

// Only the patch and edge sliders change M1–M8; δ and the feather only change how the mask is drawn.
const MASK_KEYS = keysOf(['Patches', 'Edges']).filter((k) => k !== 'delta' && k !== 'feather');

const washiMode = {
  id: 'washi',
  label: 'Washi',
  viewKey: 'view',
  startView: 'washi',
  views: [['monochrome', 'Monochrome'], ['mask', 'Mask'], ['field', 'Field'], ['base', 'Base'],
    ['pattern', 'Pattern'], ['washi', 'Washi'], ['living', 'Living']],
  // The slider groups, folded by layer. Composite (α, κ) mixes the pattern in, so it's with it.
  folds: [
    ['Base layer', ['Monochrome', 'Colour', 'Patches', 'Edges']],
    ['Pattern layer', ['Fibres', 'Web', 'Specks', 'Flakes', 'Grain', 'Composite']],
    ['Spontaneity layer', ['Timing', 'Placement', 'Marks', 'Life']],
  ],
  usesAnchor: true,
  liveKeys: [],
  stages: {
    mask: { keys: MASK_KEYS, make: (e, P, anchor) => mask(e, P, anchor) },
  },
  view: (e, name, P, { anchor }) => view(e, name, P, e.stage(washiMode, 'mask', P, anchor)),
  living: (e, P, picture) => ({ kind: 'pixels', ...pixels(living(e, P, picture.rgba)) }),
  report(e, P, name, { anchor }) {
    const r = describe(e.stage(washiMode, 'mask', P, anchor));
    return {
      ...r,
      lines: [e.patternCache?.Dw && describePattern(e.patternCache), name === 'living' && describeLiving(P)].filter(Boolean),
    };
  },
};

export default washiMode;

// The Living object as a 'pixels' animation: frame(t) → the rectangles of rgba that changed.
const pixels = (live) => ({ rgba: live.rgba, frame: (t) => live.frame(t) });
