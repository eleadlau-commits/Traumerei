// Renderer: the page. It shows only the picture, filling the screen edge to edge (cropped to fit
// like a cover photo), starting as a plain white image the shape of the screen. The picture is
// rendered at the screen's own pixel size (device pixels), so the paper and the marks stay sharp. Everything
// else is in Settings, under Advanced, folded into groups: choose an image, switch between the
// seven views (Monochrome, Mask, Field, Base, Pattern, Washi, Living), show the anchor and tap the
// picture to move it, move the sliders, and read the seed and the report.
// Living is the only view that moves: its marks are drawn every frame while it's showing.
// All the maths is in engine/, which this page mounts and feeds with pixels.
//
// The themes (Settings → Theme) are the engine's modes (engine/modes/): Washi is all of the above, and
// Plain is one flat colour from the picture's dominant hue, lifted by a blurred fluid field, with soft
// lights drifting over it. This page knows nothing about either: it shows a mode's views, folds and
// sliders, draws its still picture, and plays its animation. A 'pixels' animation patches the picture;
// a 'layer' animation is drawn on its own canvas (Plain's glow, a quarter of the screen, screen-blended).
//
// Saved data: 'theme'  → a mode's id: 'washi' | 'plain'
//             'plainView' → 'base' | 'pattern' | 'plain' | 'living' (each mode saves its view under its viewKey)
//             'params' → { key: value } for every slider
//             'anchor' → { x, y } as fractions of the width and height (default 0.5, 0.5)
//             'view'   → 'monochrome' | 'mask' | 'field' | 'base' | 'pattern' | 'washi' | 'living'
//             'marks'  → true to draw the anchor (and the Field view's contour) on the picture

import { Feature, ui } from 'folio';
import { Engine, PARAMS, DEFAULTS, MODES, modeById } from './engine/index.js';
import { imageSeed } from './engine/monochrome.js';
import { sliders } from './controls.js';

const { el } = ui;
const MAX_SIDE = 2048; // the seed is taken from the picture scaled down to this
const MAX_PIXELS = 6e6; // the most pixels a picture is rendered at; past that the screen scales it up
const RESIZE_MS = 400; // a resize re-renders once it has settled for this long

export default class Renderer extends Feature {
  start() {
    this.engine = new Engine();
    this.P = { ...DEFAULTS, ...this.storage.get('params', {}) };
    this.anchor = this.storage.get('anchor', { x: 0.5, y: 0.5 });
    this.mode = modeById(this.storage.get('theme', 'washi'));
    this.views = Object.fromEntries(MODES.map((m) => [m.id, this.storage.get(m.viewKey, m.startView)]));
    this.marks = this.storage.get('marks', false);
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

  get current() {
    return this.views[this.mode.id];
  }

  mount(container) {
    this.canvas = el('canvas', { class: 'renderer-canvas' });
    this.overlay = el('canvas', { class: 'renderer-overlay', 'aria-hidden': 'true' });
    this.layer = el('canvas', { class: 'renderer-layer', 'aria-hidden': 'true', hidden: true });
    this.stage = el('div', { class: 'renderer-stage', hidden: true, onclick: (e) => this.setAnchor(e) },
      this.canvas, this.layer, this.overlay);
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
  // sliders stay as they were each time Settings is opened. Every mode's tabs and folds are made;
  // only the current mode's show.
  advanced() {
    if (this.panel) return this.panel;
    this.tabs = new Map(MODES.map((m) => [m.id, el('div', {
      class: `seg renderer-tabs ${m.id}`, role: 'tablist', 'aria-label': 'View', style: `--tabs:${m.views.length}`,
    }, m.views.map(([id, label]) => el('button', { type: 'button', role: 'tab', 'data-view': id, onclick: () => this.show(id) }, label)))]));
    this.seedLine = el('p', { class: 'renderer-seed' });
    this.report = el('div', { class: 'renderer-report' });
    this.controls = sliders(PARAMS, this.P, (key, value) => this.change(key, value));
    const fold = (title, ...kids) => el('details', { class: 'advanced renderer-fold' }, el('summary', {}, title),
      el('div', { class: 'renderer-fold-body' }, ...kids));
    this.folds = new Map(MODES.map((m) => [m.id, m.folds.map(([title, groups]) => fold(title,
      el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, groups.map((g) => this.controls.groups.get(g)))))]));

    this.panel = el('div', { class: 'renderer-advanced' },
      ui.hint('The tools behind the page. Changes show on the picture straight away.', { small: true }),
      fold('Picture',
        el('div', { class: 'renderer-buttons' },
          el('button', { type: 'button', class: 'btn small', onclick: () => this.choose() }, 'Choose an image'),
          el('button', { type: 'button', class: 'btn small', onclick: () => this.white() }, 'Back to white')),
        ui.hint('A chosen image stays on this device.', { small: true }),
        this.seedLine),
      fold('View',
        ...this.tabs.values(),
        el('div', { class: 'check renderer-marks' },
          ui.toggle({ checked: this.marks, label: 'Show the anchor', onChange: (on) => this.showMarks(on) }),
          el('span', {}, 'Show the anchor, and tap the picture to move it'))),
      ...[...this.folds.values()].flat(),
      fold('Report', this.report),
      el('button', { type: 'button', class: 'btn small', onclick: () => this.reset() }, 'Back to defaults'));
    this.marksRow = this.panel.querySelector('.renderer-marks');
    this.draw();
    return this.panel;
  }

  // Settings → Theme: one button per mode.
  themes() {
    this.themeTabs ||= el('div', { class: 'seg renderer-themes', role: 'radiogroup', 'aria-label': 'Theme', style: `--tabs:${MODES.length}` },
      MODES.map((m) => el('button', { type: 'button', role: 'radio', 'data-theme-id': m.id, onclick: () => this.setTheme(m.id) }, m.label)));
    this.syncTheme();
    return this.themeTabs;
  }

  setTheme(id) {
    this.mode = modeById(id);
    this.storage.set('theme', this.mode.id);
    this.draw();
  }

  // Shows the mode's own views and sliders in Advanced, and marks the chosen theme.
  syncTheme() {
    for (const b of this.themeTabs?.children || []) {
      const on = String(b.dataset.themeId === this.mode.id);
      b.setAttribute('aria-checked', on);
      b.setAttribute('aria-selected', on);
    }
    if (!this.panel) return;
    for (const [id, tabs] of this.tabs) tabs.hidden = id !== this.mode.id;
    if (this.marksRow) this.marksRow.hidden = !this.mode.usesAnchor;
    for (const [id, folds] of this.folds) for (const f of folds) f.hidden = id !== this.mode.id;
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
    this.draw();
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
    this.views[this.mode.id] = id;
    this.storage.set(this.mode.viewKey, id);
    this.draw();
  }

  setAnchor(e) {
    if (!this.marks || !this.mode.usesAnchor) return;
    const box = this.stage.getBoundingClientRect();
    const c = this.cover(box.width, box.height);
    const x = Math.min(1, Math.max(0, (e.clientX - box.left - c.x) / c.w));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top - c.y) / c.h));
    this.anchor = { x, y };
    this.storage.set('anchor', this.anchor);
    this.draw();
  }

  // Slider moves are drawn on the next frame, so a fast drag doesn't queue up renders. The engine's
  // stages remake only what a slider changes. Sliders that only change the animation remake just it.
  change(key, value) {
    this.P[key] = value;
    this.storage.set('params', this.P);
    if (this.mode.liveKeys.includes(key)) {
      if (this.anim) this.anim = this.engine.animate(this.mode, this.P, this.picture, this.ctx());
      return;
    }
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.draw();
    });
  }

  reset() {
    this.P = { ...DEFAULTS };
    this.storage.set('params', this.P);
    this.controls.set(this.P);
    this.draw();
  }

  ctx() {
    return { anchor: this.anchor };
  }

  draw() {
    for (const [id, tabs] of this.tabs || []) {
      for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.view === this.views[id]));
    }
    this.syncTheme();
    if (!this.stage) return;
    this.stage.hidden = !this.seed;
    cancelAnimationFrame(this.tick);
    this.anim = null;
    this.layer.hidden = true;
    if (!this.seed) return;

    const mode = this.mode;
    this.picture = this.engine.render(mode, this.current, this.P, this.ctx());
    const { rgba, width, height } = this.picture;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    this.paintOverlay();
    if (this.current === 'living') this.play();

    if (!this.panel) return;
    const { W, H } = this.engine.image;
    this.seedLine.replaceChildren('Seed ', el('code', {}, this.seed.seedText), ` · ${W} × ${H} px` +
      (mode.usesAnchor ? ` · anchor (${this.anchor.x.toFixed(3)}, ${this.anchor.y.toFixed(3)})` : ''));
    const r = this.engine.report(mode, this.P, this.current, this.ctx());
    this.report.replaceChildren(el('h3', {}, 'Report'), r.summary && el('p', {}, r.summary),
      ...(r.attempts || []).map((a) => el('details', { class: `renderer-attempt${a.kept ? ' kept' : ''}`, open: a.kept },
        el('summary', {}, a.title, el('span', { class: `renderer-tag ${a.pass ? 'pass' : 'fail'}` }, a.pass ? 'passes' : 'fails'),
          a.kept && el('span', { class: 'renderer-tag kept' }, 'shown')),
        el('ul', {}, a.lines.map((line) => el('li', {}, line))))),
      ...r.lines.map((line) => el('p', {}, line)));
  }

  // The Living view: the mode's animation at this.clock, every frame. A frame's step is capped at
  // 0.1 s, so time pauses (rather than jumps) while the page is hidden.
  play() {
    this.anim = this.engine.animate(this.mode, this.P, this.picture, this.ctx());
    const paint = this.anim.kind === 'pixels' ? this.pixels() : this.shapes();
    let last = null;
    const step = (now) => {
      this.clock += last === null ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      paint(this.anim);
      this.tick = requestAnimationFrame(step);
    };
    this.tick = requestAnimationFrame(step);
  }

  // A 'pixels' animation: the rectangles that changed are copied from its rgba to the picture.
  pixels() {
    const { width, height } = this.picture;
    const image = new ImageData(this.anim.rgba, width, height);
    const g = this.canvas.getContext('2d');
    return (anim) => {
      for (const [x, y, w, h] of anim.frame(this.clock)) g.putImageData(image, 0, 0, x, y, w, h);
    };
  }

  // A 'layer' animation: its shapes, drawn on the layer canvas at anim.scale of the screen's device
  // pixels, over its fill, blended over the picture by the browser with anim.blend.
  shapes() {
    this.layer.hidden = false;
    const g = this.layer.getContext('2d');
    return (anim) => {
      this.layer.style.mixBlendMode = anim.blend;
      const box = this.stage.getBoundingClientRect();
      const dpr = (window.devicePixelRatio || 1) * anim.scale;
      const w = Math.max(2, Math.round(box.width * dpr));
      const h = Math.max(2, Math.round(box.height * dpr));
      if (this.layer.width !== w || this.layer.height !== h) {
        this.layer.width = w;
        this.layer.height = h;
      }
      const c = this.cover(w, h);
      const unit = c.w / this.engine.image.X; // layer pixels per canvas unit
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = anim.fill;
      g.fillRect(0, 0, w, h);
      for (const s of anim.at(this.clock)) PAINTERS[s.type](g, s, c, unit);
    };
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
    const marks = this.marks && this.mode.usesAnchor;
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

// One painter per kind of shape a 'layer' animation returns. c: where the picture lies on the layer
// (cover()), unit: layer pixels per canvas unit.
const PAINTERS = {
  // A Gaussian light, added to what's there: a radial gradient out to 3 r, in 12 steps.
  glow(g, L, c, unit) {
    const [kr, kg, kb] = L.colour;
    g.globalCompositeOperation = 'lighter';
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
  },
};
