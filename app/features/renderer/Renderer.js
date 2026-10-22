// Renderer: the page. It shows only the picture, which starts as a plain white image. Everything
// else is in Settings, under Advanced, folded into groups: choose an image, switch between the
// seven views (Monochrome, Mask, Field, Base, Pattern, Washi, Living), show the anchor and tap the
// picture to move it, move the sliders, and read the seed and the report.
// Living is the only view that moves: its marks are drawn every frame while it's showing.
// All the maths is in engine/, which this page mounts and feeds with pixels.
//
// Saved data: 'params' → { key: value } for every slider
//             'anchor' → { x, y } as fractions of the width and height (default 0.5, 0.5)
//             'view'   → 'monochrome' | 'mask' | 'field' | 'base' | 'pattern' | 'washi' | 'living'
//             'marks'  → true to draw the anchor (and the Field view's contour) on the picture

import { Feature, ui } from 'folio';
import { Engine, PARAMS, DEFAULTS, PATTERN_KEYS, SPONT_KEYS } from './engine/index.js';
import { sliders } from './controls.js';
import { describe, describePattern, describeLiving } from './report.js';

const { el } = ui;
const MAX_SIDE = 2048; // larger images are scaled down to this before rendering
const WHITE = [1600, 1000]; // the plain white image the page starts with
const VIEWS = [['monochrome', 'Monochrome'], ['mask', 'Mask'], ['field', 'Field'], ['base', 'Base'],
  ['pattern', 'Pattern'], ['washi', 'Washi'], ['living', 'Living']];
const DRAW_KEYS = ['k', 'gamma', 'dMin', 'dMax', 'delta', 'feather', 'alpha', 'warmth', ...PATTERN_KEYS,
  ...SPONT_KEYS]; // these don't change M1–M8
// The slider groups, folded by layer in Advanced. Composite (α, κ) mixes the pattern in, so it's with it.
const LAYERS = [
  ['Base layer', ['Monochrome', 'Patches', 'Edges']],
  ['Pattern layer', ['Fibres', 'Web', 'Specks', 'Flakes', 'Grain', 'Composite']],
  ['Spontaneity layer', ['Timing', 'Placement', 'Marks', 'Life']],
];

export default class Renderer extends Feature {
  start() {
    this.engine = new Engine();
    this.P = { ...DEFAULTS, ...this.storage.get('params', {}) };
    this.anchor = this.storage.get('anchor', { x: 0.5, y: 0.5 });
    this.current = this.storage.get('view', 'base');
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
    this.add('settings', { id: 'renderer-advanced', title: 'Advanced', order: 50, render: () => this.advanced() });
  }

  mount(container) {
    this.canvas = el('canvas', { class: 'renderer-canvas' });
    this.overlay = el('canvas', { class: 'renderer-overlay', 'aria-hidden': 'true' });
    this.stage = el('div', { class: 'renderer-stage', hidden: true, onclick: (e) => this.setAnchor(e) },
      this.canvas, this.overlay);
    this.error = ui.errorBox();
    container.append(el('div', { class: 'renderer-page' }, this.stage, this.error));
    new ResizeObserver(() => this.paintOverlay()).observe(this.stage);
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
    this.seedLine = el('p', { class: 'renderer-seed' });
    this.report = el('div', { class: 'renderer-report' });
    this.controls = sliders(PARAMS, this.P, (key, value) => this.change(key, value));
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
        el('div', { class: 'check renderer-marks' },
          ui.toggle({ checked: this.marks, label: 'Show the anchor', onChange: (on) => this.showMarks(on) }),
          el('span', {}, 'Show the anchor, and tap the picture to move it'))),
      ...LAYERS.map(([title, groups]) => fold(title,
        el('div', { class: 'renderer-sliders', 'data-own-swipe': true }, groups.map((g) => this.controls.groups.get(g))))),
      fold('Report', this.report),
      el('button', { type: 'button', class: 'btn small', onclick: () => this.reset() }, 'Back to defaults'));
    this.draw();
    return this.panel;
  }

  // The plain white image the page starts with.
  white() {
    const [W, H] = WHITE;
    this.seed = this.engine.load(new Uint8ClampedArray(W * H * 4).fill(255), W, H);
    this.error?.show(null);
    this.remask();
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
      this.seed = this.engine.load(work.getImageData(0, 0, W, H).data, W, H);
      this.error.show(null);
      this.remask();
    } catch {
      this.error.show('That file couldn\'t be read as an image. Try a JPEG or PNG.');
    }
  }

  show(id) {
    this.current = id;
    this.storage.set('view', id);
    this.draw();
  }

  setAnchor(e) {
    if (!this.marks) return;
    const box = this.stage.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    this.anchor = { x, y };
    this.storage.set('anchor', this.anchor);
    this.remask();
  }

  // Slider moves are drawn on the next frame, so a fast drag doesn't queue up renders.
  change(key, value) {
    this.P[key] = value;
    this.storage.set('params', this.P);
    this.dirtyMask ||= !DRAW_KEYS.includes(key);
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
    this.remask();
  }

  remask() {
    this.dirtyMask = false;
    if (!this.seed) return;
    this.result = this.engine.mask(this.P, this.anchor);
    this.draw();
  }

  draw() {
    if (this.tabs) for (const b of this.tabs.children) b.setAttribute('aria-selected', String(b.dataset.view === this.current));
    if (!this.stage) return;
    this.stage.hidden = !this.seed;
    if (!this.seed || !this.result) return;

    this.picture = this.engine.view(this.current, this.P, this.result);
    const { rgba, width, height } = this.picture;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    const { W, H } = this.engine.image;
    this.stage.style.aspectRatio = `${W} / ${H}`;
    this.stage.style.width = `min(100%, calc((100dvh - 140px) * ${W / H}))`; // the whole picture fits on screen
    this.stage.classList.toggle('marked', this.marks);
    this.paintOverlay();
    this.animate();

    if (!this.panel) return;
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

  // The Living view: the marks at this.clock, redrawn each frame where they are. A frame's step is
  // capped at 0.1 s, so time pauses (rather than jumps) while the page is hidden.
  animate() {
    cancelAnimationFrame(this.tick);
    if (this.current !== 'living') return;
    const live = this.engine.living(this.P, this.result, this.picture.rgba);
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

  // The anchor (every view) and the threshold contour (Field view), drawn crisp at screen size.
  paintOverlay() {
    if (!this.picture || this.stage.hidden) return;
    this.stage.classList.toggle('marked', this.marks);
    if (!this.marks) {
      this.overlay.width = 0; // clears it
      return;
    }
    const box = this.stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    this.overlay.width = w;
    this.overlay.height = h;
    const g = this.overlay.getContext('2d');
    const css = getComputedStyle(this.stage);
    g.lineWidth = 1.5 * dpr;
    if (this.current === 'field' && this.picture.contour) {
      g.strokeStyle = css.getPropertyValue('--renderer-contour').trim();
      g.beginPath();
      const segs = this.picture.contour;
      for (let i = 0; i < segs.length; i += 2) {
        g.moveTo(segs[i][0] * w, segs[i][1] * h);
        g.lineTo(segs[i + 1][0] * w, segs[i + 1][1] * h);
      }
      g.stroke();
    }
    const ax = this.anchor.x * w;
    const ay = this.anchor.y * h;
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
