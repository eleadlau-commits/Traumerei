// The rendering engine. No screen code and no Folio: the page mounts it and hands it pixels.
// Each mode (Washi, Plain) is a description in engine/modes/ that the engine runs; see modes/index.js.
//
//   const engine = new Engine();
//   engine.load(rgba, W, H);                       // monochrome lightness + seed, cached
//   const pic = engine.render(mode, 'base', P, ctx) // a mode's view: { rgba, width, height }
//   const anim = engine.animate(mode, P, pic, ctx)  // its spontaneity, a pure function of t
//   engine.stage(mode, name, P, input)              // a mode's cached stage
//
// The older calls stay, for Washi: mask(P, anchor), view(name, P, r), pattern(P), living(P, rgba);
// and for Plain: hue(P), plainBase(P), plainField(P), plainView(name, P), glow(P).
//
// Coordinates: the short side of the image is 1, so the canvas is [0, X] × [0, Y].

import { DEFAULT_TINT } from './colour.js';
import { lightness, quantiles, imageSeed } from './monochrome.js';
import { seedText } from './random.js';
import * as washi from './modes/washi.js';
import * as plain from './modes/plain.js';

export { PARAMS, DEFAULTS, PATTERN_KEYS, SPONT_KEYS, PLAIN_KEYS, PLAIN_FIELD_KEYS, keysOf } from './params.js';
export { expected } from './spontaneity.js';
export { MODES, modeById } from './modes/index.js';

export class Engine {
  constructor() {
    this.image = null;
    this.stages = {};
    washi.colours(this, { tint: DEFAULT_TINT });
  }

  // Steps 1–2 and the percentiles, once per image; the seed from the 32×32 thumbnail.
  // seed: pass one to keep it when the same picture is loaded again at another size.
  load(rgba, W, H, seed = imageSeed(rgba, W, H)) {
    const L = lightness(rgba);
    this.rgba = rgba; // kept for the modes that read the picture's colours
    const s = Math.min(W, H);
    this.image = {
      W, H, X: W / s, Y: H / s,
      L, bw: quantiles(L, [0.01, 0.99]),
      seed,
    };
    this.toneCache = null;
    this.maskCache = null;
    this.patternCache = null;
    this.stages = {};
    return { seed: this.image.seed, seedText: seedText(this.image.seed) };
  }

  // A mode's stage, made again only when the values of its keys or its input change.
  stage(mode, name, P, input = null) {
    const def = mode.stages[name];
    const key = `${def.keys.map((k) => P[k]).join()}|${JSON.stringify(input)}`;
    const id = `${mode.id}:${name}`;
    if (this.stages[id]?.key !== key) this.stages[id] = { key, value: def.make(this, P, input) };
    return this.stages[id].value;
  }

  render(mode, name, P, ctx = {}) {
    return mode.view(this, name, P, ctx);
  }

  animate(mode, P, picture, ctx = {}) {
    return mode.living(this, P, picture, ctx);
  }

  report(mode, P, name, ctx = {}) {
    return mode.report(this, P, name, ctx);
  }

  // ---- Washi (engine/modes/washi.js) ----
  colours(P) { return washi.colours(this, P); }
  tone(P) { return washi.tone(this, P); }
  mask(P, anchor) { return washi.mask(this, P, anchor); }
  pattern(P) { return washi.pattern(this, P); }
  view(name, P, r) { return washi.view(this, name, P, r); }
  living(P, rgba) { return washi.living(this, P, rgba); }
  fullMask(P, r) { return washi.fullMask(this, P, r); }

  // ---- Plain (engine/modes/plain.js) ----
  hue(P) { return plain.hue(this, P); }
  plainBase(P) { return plain.base(this, P); }
  plainField(P) { return plain.field(this, P); }
  plainView(name, P) { return plain.view(this, name, P); }
  glow(P) { return plain.glow(this, P); }
}
