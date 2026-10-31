// Renderer: the page. It shows only the picture, filling the screen edge to edge (cropped to fit
// like a cover photo), starting as a plain white image the shape of the screen. The picture is
// rendered at the screen's own pixel size (device pixels), so the paper and the marks stay sharp. Everything
// else is in Settings, under Advanced, folded into groups: choose an image, switch between the
// seven views (Monochrome, Mask, Field, Base, Pattern, Washi, Living), show the anchor and tap the
// picture to move it, move the sliders, and read the seed and the report.
// Living is the only view that moves: its marks are drawn every frame while it's showing.
// All the maths is in engine/, which this page mounts and feeds with pixels.
//
// There are two themes (Settings → Theme). Washi is all of the above. Plain (engine/plain.js) is one
// flat colour from the picture's dominant hue, lifted by a blurred fluid field, with soft lights
// drifting over it; its views are Base, Pattern, Plain and Living, and its sliders replace Washi's.
// The glow is drawn on its own small canvas and screen-blended over the picture by the browser.
//
// Saved data: 'theme'  → 'washi' | 'plain'
//             'plainView' → 'base' | 'pattern' | 'plain' | 'living' (the Plain theme's view)
//             'params' → { key: value } for every slider
//             'anchor' → { x, y } as fractions of the width and height (default 0.5, 0.5)
//             'view'   → 'monochrome' | 'mask' | 'field' | 'base' | 'pattern' | 'washi' | 'living'
//             'marks'  → true to draw the anchor (and the Field view's contour) on the picture

import { Feature, ui } from 'folio';
import { Engine, PARAMS, DEFAULTS, PATTERN_KEYS, SPONT_KEYS, PLAIN_KEYS, PLAIN_FIELD_KEYS } from './engine/index.js';
import { imageSeed } from './engine/monochrome.js';
import { sliders } from './controls.js';
import { describe, describePattern, describeLiving, describePlain } from './report.js';

const { el } = ui;
const MAX_SIDE = 2048; // the seed is taken from the picture scaled down to this
const MAX_PIXELS = 6e6; // the most pixels a picture is rendered at; past that the screen scales it up
const RESIZE_MS = 400; // a resize re-renders once it has settled for this long
const VIEWS = [['monochrome', 'Monochrome'], ['mask', 'Mask'], ['field', 'Field'], ['base', 'Base'],
  ['pattern', 'Pattern'], ['washi', 'Washi'], ['living', 'Living']];
const DRAW_KEYS = ['k', 'gamma', 'dMin', 'dMax', 'tint', 'baseL', 'baseW', 'delta', 'feather', 'alpha', 'warmth', ...PATTERN_KEYS,
  ...SPONT_KEYS, ...PLAIN_KEYS]; // these don't change M1–M8
const THEMES = [['washi', 'Washi'], ['plain', 'Plain']];
const PLAIN_VIEWS = [['base', 'Base'], ['pattern', 'Pattern'], ['plain', 'Plain'], ['living', 'Living']];
const PLAIN_LAYERS = [['Base layer', ['Hue']], ['Pattern layer', ['Flow', 'Dye']], ['Spontaneity layer', ['Glow']]];
const DYES = [['bands', 'Bands'], ['combed', 'Combed'], ['drops', 'Drops']];
const GLOW_SCALE = 0.25; // the glow canvas is this fraction of the screen's device pixels
const GLOW_KEYS = PARAMS.filter((p) => p.group === 'Glow').map((p) => p.key);
// The slider groups, folded by layer in Advanced. Composite (α, κ) mixes the pattern in, so it's with it.
const LAYERS = [
  ['Base layer', ['Monochrome', 'Colour', 'Patches', 'Edges']],
  ['Pattern layer', ['Fibres', 'Web', 'Specks', 'Flakes', 'Grain', 'Composite']],
  ['Spontaneity layer', ['Timing', 'Placement', 'Marks', 'Life']],
];

export default class Renderer extends Feature {
  start() {
    this.engine = new Engine();
    this.P = { ...DEFAULTS, ...this.storage.get('params', {}) };
    this.anchor = this.storage.get('anchor', { x: 0.5, y: 0.5 });
    this.theme = this.storage.get('theme', 'washi');
    this.current = this.storage.get('view', 'washi');
    this.plainCurrent = this.storage.get('plainView', 'living');
    this.marks = this.storage.get('marks', false);
    this.result = null;
    this.clock = 0; // seconds of the Living view's time, which runs only while it's showing
    this.picker = ui.filePicker('image/*');

    this.add('views', {
      id: 'renderer',
      label: 'Renderer',
      icon: 'palette',
      order: 10,
      start: true,
      hideTitle: true,
      mount: (container) => this.mount(container),
      render: () => this.draw(),
    });
    this.add('settings', { id: 'renderer-theme', title: 'Theme', order: 15, render: () => this.themes() });
    this.add('settings', { id: 'renderer-advanced', title: 'Advanced', order: 50, render: () => this.advanced() });
  }

  mount(container) {
    this.canvas = el('canvas', { class: 'renderer-canvas' });
    this.overlay = el('canvas', { class: 'renderer-overlay', 'aria-hidden': 'true' });
    this.glowCanvas = el('canvas', { class: 'renderer-glow', 'aria-hidden': 'true', hidden: true });
    this.stage = el('div', { class: 'renderer-stage', hidden: true, onclick: (e) => this.setAnchor(e) },
      this.canvas, this.glowCanvas, this.overlay);
    this.error = ui.errorBox();
    container.append(el('div', { class: 'renderer-page' }, this.stage, this.error));
    new ResizeObserver(() => {
      this.paintOverlay();
      clearTimeout(this.resizing);
      this.resizing = setTimeout(() => this.fit(), RESIZE_MS);
    }).observe(this.stage);
    if (!this.seed) this.white();
  }

  // Advanced, in Settings: every tool, folded into groups. Made once and kept, so the folds and
  // sliders stay as they were each time Settings is opened.
  advanced() {
    if (this.panel) return this.panel;
    this.tabs = el('div', { class: 'seg renderer-tabs', role: 'tablist', 'aria-label': 'View', style: `--tabs:${VIEWS.length}` },
      VIEWS.map(([id, label]) => el('button', {
        type: 'button', role: 'tab', 'data-view': id, onclick: () => this.show(id),
      }, label)));
    this.plainTabs = el('div', { class: 'seg renderer-tabs plain', role: 'tablist', 'aria-label': 'View', style: `--tabs:${PLAIN_VIEWS.length}` },
      PLAIN_VIEWS.map(([id, label]) => el('button', {
        type: 'button', role: 'tab', 'data-view': id, onclick: () => this.show(id),
      }, label)));
    this.seedLine = el('p', { class: 'renderer-seed' });
    this.report = el('div', { class: 'renderer-report' });
    this.controls = sliders(PARAMS, this.P, (key, value) => this.change(key, value));
    // The base tint τ, a colour picker at the top of Colour. The paper, the ink and the washi's
    // inclusions all follow it.
    this.tintInput = el('input', { type: 'color', value: this.P.tint, 'aria-label': 'Tint τ',
      oninput: (e) => this.change('tint', e.target.value) });
    this.controls.groups.get('Colour').querySelector('legend').after(
      el('label', { class: 'renderer-slider renderer-colour' }, el('span', {}, 'Tint τ'), this.tintInput));
    // Plain: the tint is the colour used when the picture has almost no hue of its own.
    this.plainTint = el('input', { type: 'color', value: this.P.tint, 'aria-label': 'Tint τ for a picture with no colour',
      oninput: (e) => this.change('tint', e.target.value) });
    this.controls.groups.get('Hue').querySelector('legend').after(
      el('label', { class: 'renderer-slider renderer-colour' }, el('span', {}, 'Tint τ, for a picture with no colour'), this.plainTint));
    this.dyeTabs = el('div', { class: 'seg renderer-dyes', role: 'radiogroup', 'aria-label': 'Dye shape', style: `--tabs:${DYES.length}` },
      DYES.map(([id, label]) => el('button', {
        type: 'button', role: 'radio', 'data-dye': id, onclick: () => { this.change('plainDye', id); this.syncDye(); },
      }, label)));
    this.controls.groups.get('Dye').querySelector('legend').after(
      el('div', { class: 'renderer-slider' }, el('span', {}, 'Dye shape φ₀'), this.dyeTabs));
    this.syncDye();
    const fold = (title, ...kids) => el('details', { class: 'advanced renderer-fold' }, el('summary', {}, title),
      el('div', { class: 'renderer-fold-body' }, ...kids));

    this.panel = el('div', { class: 'renderer-advanced' },
      ui.hint('The tools behind the page. Changes show on the picture straight away.', { small: true }),
      fold('Picture',
        el('div', { class: 'renderer-buttons' },
          el('button', { type: 'button', class: 'btn small', onclick: () => this.choose() }, 'Choose an image'),
          el('button', { type: 'button', class: 'btn small', onclick: () => this.white() }, 'Back to white')),
        ui.hint('A chosen image stays on this device.', { small: true }),
        this.seedLine),
      fold('View',
        this.tabs,
        this.plainTabs,
        el('div', { class: 'check renderer-marks' },
          ui.toggle({ checked: this.marks, label: 'Show the anchor', onChange: (on) => this.showMarks(on) }),
          el('span', {}, 'Show the anchor, and tap the picture to move it'))),
      ...(this.washiFolds = LAYERS.map(([title, groups]) => fold(title,
        el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, groups.map((g) => this.controls.groups.get(g)))))),
      ...(this.plainFolds = PLAIN_LAYERS.map(([title, groups]) => fold(title,
        el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, groups.map((g) => this.controls.groups.get(g)))))),
      fold('Report', this.report),
      el('button', { type: 'button', class: 'btn small', onclick: () => this.reset() }, 'Back to defaults'));
    this.marksRow = this.panel.querySelector('.renderer-marks');
    this.draw();
    return this.panel;
  }

  // Settings → Theme: Washi or Plain.
  themes() {
    this.themeTabs ||= el('div', { class: 'seg renderer-themes', role: 'radiogroup', 'aria-label': 'Theme', style: `--tabs:${THEMES.length}` },
      THEMES.map(([id, label]) => el('button', { type: 'button', role: 'radio', 'data-theme-id': id, onclick: () => this.setTheme(id) }, label)));
    this.syncTheme();
    return this.themeTabs;
  }

  setTheme(id) {
    this.theme = id;
    this.storage.set('theme', id);
    if (id === 'washi' && !this.result) this.remask();
    else this.draw();
  }

  // Shows the theme's own views and sliders in Advanced, and marks the chosen theme.
  syncTheme() {
    const plain = this.theme === 'plain';
    for (const b of this.themeTabs?.children || []) {
      const on = String(b.dataset.themeId === this.theme);
      b.setAttribute('aria-checked', on);
      b.setAttribute('aria-selected', on);
    }
    if (!this.panel) return;
    this.tabs.hidden = plain;
    this.plainTabs.hidden = !plain;
    if (this.marksRow) this.marksRow.hidden = plain;
    for (const f of this.washiFolds) f.hidden = plain;
    for (const f of this.plainFolds) f.hidden = !plain;
  }

  syncDye() {
    for (const b of this.dyeTabs.children) {
      const on = String(b.dataset.dye === this.P.plainDye);
      b.setAttribute('aria-checked', on);
      b.setAttribute('aria-selected', on);
    }
  }

  // The plain white image the page starts with, the shape of the screen so it fills it uncropped.
  white() {
    this.source = null;
    this.render();
  }

  // The screen in device pixels: what the picture covers, so one picture pixel is one screen pixel.
  screen() {
    const dpr = window.devicePixelRatio || 1;
    const box = this.stage?.getBoundingClientRect();
    const w = box?.width || innerWidth || 1600;
    const h = box?.height || innerHeight || 1000;
    return { w: Math.max(1, Math.round(w * dpr)), h: Math.max(1, Math.round(h * dpr)) };
  }

  // The size to render a picture of shape W0 × H0 at: just big enough to cover the screen at full
  // resolution (cropped like a cover photo), at most MAX_PIXELS. Everything is in canvas units
  // (short side = 1), so a bigger render is the same picture, only sharper.
  size(W0, H0) {
    const { w, h } = this.screen();
    let k = Math.max(w / W0, h / H0);
    k = Math.min(k, Math.sqrt(MAX_PIXELS / (W0 * H0)));
    return { W: Math.max(1, Math.round(W0 * k)), H: Math.max(1, Math.round(H0 * k)) };
  }

  // Loads the picture (the chosen image, or white the shape of the screen) at the screen's size.
  // The seed comes from the chosen image at MAX_SIDE, so it doesn't change with the screen.
  render() {
    const { w, h } = this.screen();
    const src = this.source;
    const { W, H } = src ? this.size(src.W, src.H) : this.size(w, h);
    let rgba;
    if (src) {
      const work = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
      work.imageSmoothingQuality = 'high';
      work.drawImage(src.bitmap, 0, 0, W, H);
      rgba = work.getImageData(0, 0, W, H).data;
    } else {
      rgba = new Uint8ClampedArray(W * H * 4).fill(255);
    }
    this.seed = this.engine.load(rgba, W, H, src?.seed);
    this.error?.show(null);
    this.remask();
  }

  // After a resize: render again if the size the screen needs has changed by more than 10%,
  // or if white no longer has the screen's shape.
  fit() {
    if (!this.engine.image) return;
    const { W, H } = this.engine.image;
    const { w, h } = this.screen();
    const want = this.source ? this.size(this.source.W, this.source.H) : this.size(w, h);
    if (Math.abs(want.W / W - 1) > 0.1 || Math.abs(want.H / H - 1) > 0.1) this.render();
  }

  showMarks(on) {
    this.marks = on;
    this.storage.set('marks', on);
    this.paintOverlay();
  }

  async choose() {
    const file = await this.picker.pick();
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const W = Math.max(1, Math.round(bitmap.width * scale));
      const H = Math.max(1, Math.round(bitmap.height * scale));
      const work = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
      work.drawImage(bitmap, 0, 0, W, H);
      const seed = imageSeed(work.getImageData(0, 0, W, H).data, W, H);
      this.source = { bitmap, W: bitmap.width, H: bitmap.height, seed };
      this.render();
    } catch {
      this.error.show('That file couldn\'t be read as an image. Try a JPEG or PNG.');
    }
  }

  show(id) {
    if (this.theme === 'plain') {
      this.plainCurrent = id;
      this.storage.set('plainView', id);
    } else {
      this.current = id;
      this.storage.set('view', id);
    }
    this.draw();
  }

  setAnchor(e) {
    if (!this.marks || this.theme === 'plain') return;
    const box = this.stage.getBoundingClientRect();
    const c = this.cover(box.width, box.height);
    const x = Math.min(1, Math.max(0, (e.clientX - box.left - c.x) / c.w));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top - c.y) / c.h));
    this.anchor = { x, y };
    this.storage.set('anchor', this.anchor);
    this.remask();
  }

  // Slider moves are drawn on the next frame, so a fast drag doesn't queue up renders.
  change(key, value) {
    this.P[key] = value;
    this.storage.set('params', this.P);
    this.dirtyMask ||= !DRAW_KEYS.includes(key);
    // Plain's glow sliders only change the lights, not the still picture.
    if (this.theme === 'plain' && GLOW_KEYS.includes(key)) {
      if (this.glow) this.glow = this.engine.glow(this.P);
      return;
    }
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.dirtyMask) this.remask();
      else this.draw();
    });
  }

  reset() {
    this.P = { ...DEFAULTS };
    this.storage.set('params', this.P);
    this.controls.set(this.P);
    this.tintInput.value = this.P.tint;
    this.plainTint.value = this.P.tint;
    this.syncDye();
    this.remask();
  }

  // M1–M8, which only Washi needs: Plain doesn't use the mask, so it's made when Washi is next shown.
  remask() {
    this.dirtyMask = false;
    if (!this.seed) return;
    this.result = this.theme === 'washi' ? this.engine.mask(this.P, this.anchor) : null;
    this.draw();
  }

  draw() {
    if (this.tabs) for (const b of this.tabs.children) b.setAttribute('aria-selected', String(b.dataset.view === this.current));
    if (this.plainTabs) for (const b of this.plainTabs.children) b.setAttribute('aria-selected', String(b.dataset.view === this.plainCurrent));
    this.syncTheme();
    if (!this.stage) return;
    this.stage.hidden = !this.seed;
    if (this.theme === 'plain') return this.drawPlain();
    this.glowCanvas.hidden = true;
    if (!this.seed) return;
    if (!this.result) return this.remask();

    this.picture = this.engine.view(this.current, this.P, this.result);
    const { rgba, width, height } = this.picture;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    this.stage.classList.toggle('marked', this.marks);
    this.paintOverlay();
    this.animate();

    if (!this.panel) return;
    const { W, H } = this.engine.image;
    this.seedLine.replaceChildren('Seed ', el('code', {}, this.seed.seedText),
      ` · ${W} × ${H} px · anchor (${this.anchor.x.toFixed(3)}, ${this.anchor.y.toFixed(3)})`);
    const r = describe(this.result);
    this.report.replaceChildren(el('h3', {}, 'Report'), el('p', {}, r.summary),
      ...r.attempts.map((a) => el('details', { class: `renderer-attempt${a.kept ? ' kept' : ''}`, open: a.kept },
        el('summary', {}, a.title, el('span', { class: `renderer-tag ${a.pass ? 'pass' : 'fail'}` }, a.pass ? 'passes' : 'fails'),
          a.kept && el('span', { class: 'renderer-tag kept' }, 'shown')),
        el('ul', {}, a.lines.map((line) => el('li', {}, line))))),
      this.engine.patternCache?.Dw && el('p', {}, describePattern(this.engine.patternCache)),
      this.current === 'living' && el('p', {}, describeLiving(this.P)));
  }

  // The Plain theme: the still picture, and in its Living view the glow over it.
  drawPlain() {
    cancelAnimationFrame(this.tick);
    if (!this.seed) return;
    this.picture = this.engine.plainView(this.plainCurrent, this.P);
    const { rgba, width, height } = this.picture;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    this.paintOverlay();
    this.glowCanvas.hidden = this.plainCurrent !== 'living';
    if (this.plainCurrent === 'living') this.animateGlow();

    if (!this.panel) return;
    const { W, H } = this.engine.image;
    this.seedLine.replaceChildren('Seed ', el('code', {}, this.seed.seedText), ` · ${W} × ${H} px`);
    const r = describePlain(this.engine.hue(this.P), this.engine.plainBase(this.P), this.engine.plainField(this.P), this.P);
    this.report.replaceChildren(el('h3', {}, 'Report'), ...r.map((line) => el('p', {}, line)));
  }

  // G: the lights at this.clock, drawn each frame as Gaussian radial gradients, added together, on a
  // canvas at GLOW_SCALE of the screen that the browser screen-blends over the picture.
  animateGlow() {
    this.glow = this.engine.glow(this.P);
    const g = this.glowCanvas.getContext('2d');
    let last = null;
    const step = (now) => {
      this.clock += last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      const box = this.stage.getBoundingClientRect();
      const dpr = (window.devicePixelRatio || 1) * GLOW_SCALE;
      const w = Math.max(2, Math.round(box.width * dpr));
      const h = Math.max(2, Math.round(box.height * dpr));
      if (this.glowCanvas.width !== w || this.glowCanvas.height !== h) {
        this.glowCanvas.width = w;
        this.glowCanvas.height = h;
      }
      const c = this.cover(w, h);
      const { X } = this.engine.image;
      const unit = c.w / X; // screen pixels per canvas unit
      const [kr, kg, kb] = this.glow.colour;
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (const L of this.glow.at(this.clock)) {
        const x = c.x + L.x * unit;
        const y = c.y + L.y * unit;
        const R = 3 * L.r * unit;
        const grad = g.createRadialGradient(x, y, 0, x, y, R);
        for (let s = 0; s <= 12; s++) {
          const q = s / 12;
          const e = L.a * Math.exp(-((3 * q) ** 2) / 2);
          grad.addColorStop(q, `rgb(${Math.round(kr * e)},${Math.round(kg * e)},${Math.round(kb * e)})`);
        }
        g.fillStyle = grad;
        g.fillRect(x - R, y - R, 2 * R, 2 * R);
      }
      this.tick = requestAnimationFrame(step);
    };
    this.tick = requestAnimationFrame(step);
  }

  // The Living view: the marks at this.clock, redrawn each frame where they are. A frame's step is
  // capped at 0.1 s, so time pauses (rather than jumps) while the page is hidden.
  animate() {
    cancelAnimationFrame(this.tick);
    if (this.current !== 'living') return;
    const live = this.engine.living(this.P, this.picture.rgba);
    const { width, height } = this.picture;
    const image = new ImageData(live.rgba, width, height);
    const g = this.canvas.getContext('2d');
    let last = null;
    const step = (now) => {
      this.clock += last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      for (const [x, y, w, h] of live.frame(this.clock)) g.putImageData(image, 0, 0, x, y, w, h);
      this.tick = requestAnimationFrame(step);
    };
    this.tick = requestAnimationFrame(step);
  }

  // Where the picture lies in a box w × h when it covers it (object-fit: cover): its size and the
  // offset of its top left corner, which is negative on the sides that are cropped.
  cover(w, h) {
    const { W, H } = this.engine.image;
    const k = Math.max(w / W, h / H);
    return { x: (w - W * k) / 2, y: (h - H * k) / 2, w: W * k, h: H * k };
  }

  // The anchor (every view) and the threshold contour (Field view), drawn crisp at screen size.
  paintOverlay() {
    if (!this.picture || this.stage.hidden) return;
    const marks = this.marks && this.theme === 'washi';
    this.stage.classList.toggle('marked', marks);
    if (!marks) {
      this.overlay.width = 0; // clears it
      return;
    }
    const box = this.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    this.overlay.width = w;
    this.overlay.height = h;
    const c = this.cover(w, h);
    const px = (x) => c.x + x * c.w;
    const py = (y) => c.y + y * c.h;
    const g = this.overlay.getContext('2d');
    const css = getComputedStyle(this.stage);
    g.lineWidth = 1.5 * dpr;
    if (this.current === 'field' && this.picture.contour) {
      g.strokeStyle = css.getPropertyValue('--renderer-contour').trim();
      g.beginPath();
      const segs = this.picture.contour;
      for (let i = 0; i < segs.length; i += 2) {
        g.moveTo(px(segs[i][0]), py(segs[i][1]));
        g.lineTo(px(segs[i + 1][0]), py(segs[i + 1][1]));
      }
      g.stroke();
    }
    const ax = px(this.anchor.x);
    const ay = py(this.anchor.y);
    const r = 7 * dpr;
    g.strokeStyle = css.getPropertyValue('--renderer-anchor').trim();
    g.beginPath();
    g.arc(ax, ay, r, 0, 2 * Math.PI);
    g.moveTo(ax - 2 * r, ay);
    g.lineTo(ax + 2 * r, ay);
    g.moveTo(ax, ay - 2 * r);
    g.lineTo(ax, ay + 2 * r);
    g.stroke();
  }
}
