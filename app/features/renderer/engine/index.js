// The rendering engine. No screen code and no Folio: the page mounts it and hands it pixels.
//
//   const engine = new Engine();
//   engine.load(rgba, W, H);              // monochrome lightness + seed, cached
//   const r = engine.mask(P, anchor);     // M1–M8, with re-rolls; anchor in fractions of W, H
//   const img = engine.view('base', P, r) // { rgba, width, height }
//   const pat = engine.pattern(P);        // P1–P5: { D, S, counts, ms }, cached
//
// Coordinates: the short side of the image is 1, so the canvas is [0, X] × [0, Y].

import { inkPaperLUT } from './colour.js';
import { lightness, quantiles, tone, imageSeed } from './monochrome.js';
import { stream, seedText } from './random.js';
import { skeleton } from './skeleton.js';
import { grid, field } from './field.js';
import { components, judge } from './components.js';
import { paint, upscaleMask, maskTone, baseTone, heightTone, contour, washiTone, T_MAX } from './render.js';
import { part, PARTS } from './pattern.js';

export { PARAMS, DEFAULTS, PATTERN_KEYS } from './params.js';

const REROLLS = 8;
const FIELD_SHORT = 320;

export class Engine {
  constructor() {
    this.lut = inkPaperLUT();
    this.washiLut = inkPaperLUT(undefined, undefined, T_MAX);
    this.image = null;
  }

  // Steps 1–2 and the percentiles, once per image; the seed from the 32×32 thumbnail.
  load(rgba, W, H) {
    const L = lightness(rgba);
    const s = Math.min(W, H);
    this.image = {
      W, H, X: W / s, Y: H / s,
      L, bw: quantiles(L, [0.01, 0.99]),
      seed: imageSeed(rgba, W, H),
    };
    this.toneCache = null;
    this.maskCache = null;
    this.patternCache = null;
    return { seed: this.image.seed, seedText: seedText(this.image.seed) };
  }

  // Steps 3–5, cached while their parameters stay the same.
  tone(P) {
    const key = [P.k, P.gamma, P.dMin, P.dMax].join();
    if (this.toneCache?.key !== key) this.toneCache = { key, t: tone(this.image.L, this.image.bw, P) };
    return this.toneCache.t;
  }

  // M1–M8 for one attempt: streams seed + ':skeleton', ':warp', ':noise', with ':n' on re-roll n.
  attempt(n, P, anchor, G) {
    const { seed, X, Y } = this.image;
    const tag = n ? `:${n}` : '';
    const sk = skeleton(stream(seed, ':skeleton' + tag), anchor, X, Y, P);
    const f = field(G, sk.patches, stream(seed, ':warp' + tag), stream(seed, ':noise' + tag), P);
    const comps = components(G, f.Fp, f.T, P.Amin);
    const verdict = judge(comps, anchor, sk.patches[0].r, sk.main.how, P.sigma);
    return { n, ...sk, ...f, comps, verdict };
  }

  // The mask with its re-rolls: the first attempt that passes, or else the best one.
  mask(P, anchorFrac) {
    const { X, Y, W, H } = this.image;
    const anchor = { x: anchorFrac.x * X, y: anchorFrac.y * Y };
    const G = grid(X, Y, Math.min(FIELD_SHORT, Math.min(W, H)));
    const attempts = [];
    let best = null;
    for (let n = 0; n <= REROLLS; n++) {
      const a = this.attempt(n, P, anchor, G);
      attempts.push(a);
      if (!best || a.verdict.score < best.verdict.score) best = a;
      if (a.verdict.pass) break;
    }
    return { G, anchor, attempts, best };
  }

  // P1–P5 at the image's size. Each part is cached while its own sliders stay the same.
  pattern(P) {
    const { seed, X, Y, W, H } = this.image;
    const c = (this.patternCache ||= { parts: {} });
    const t0 = performance.now();
    let changed = !c.D;
    for (const [name, keys] of Object.entries(PARTS)) {
      const key = keys.map((k) => P[k]).join();
      if (c.parts[name]?.key === key) continue;
      c.parts[name] = { key, ...part(name, seed, X, Y, W, H, P) };
      changed = true;
    }
    if (changed) {
      const { fibres, specks, flakes, grain } = c.parts;
      c.D = fibres.D.map((v, i) => v + specks.D[i] + flakes.D[i]);
      c.S = grain.S;
      c.counts = { fibres: fibres.count, specks: specks.count, flakes: flakes.count };
      c.ms = performance.now() - t0;
    }
    return c;
  }

  // Pixels for a view: 'monochrome', 'mask', 'base', 'pattern', 'washi' at the image's size;
  // 'field' at the grid's.
  view(name, P, r) {
    const { W, H } = this.image;
    const t = this.tone(P);
    if (name === 'monochrome') return { rgba: paint(t, this.lut), width: W, height: H };
    if (name === 'pattern') {
      const { D, S } = this.pattern(P);
      return { rgba: paint(washiTone(null, D, S, P.alpha), this.washiLut, undefined, T_MAX), width: W, height: H };
    }
    const { G, best } = r;
    if (name === 'field') {
      return { rgba: paint(heightTone(best.Fp, best.max), this.lut), width: G.gw, height: G.gh,
        contour: contour(G, best.Fp, best.T) };
    }
    const m = this.fullMask(P, r);
    if (name === 'washi') {
      const { D, S } = this.pattern(P);
      return { rgba: paint(washiTone(baseTone(t, m), D, S, P.alpha), this.washiLut, undefined, T_MAX), width: W, height: H };
    }
    return { rgba: paint(name === 'mask' ? maskTone(m) : baseTone(t, m), this.lut), width: W, height: H };
  }

  fullMask(P, r) {
    const c = this.maskCache;
    if (c?.r !== r || c.delta !== P.delta || c.feather !== P.feather) {
      const { W, H } = this.image;
      const m = upscaleMask(r.G, r.best.Fp, r.best.T, P.delta, W, H, P.feather);
      this.maskCache = { r, delta: P.delta, feather: P.feather, m };
    }
    return this.maskCache.m;
  }
}
