// Renderer: the page. Choose an image, tap it to set the anchor, switch between the six views
// (Monochrome, Mask, Field, Base, Pattern, Washi), move the sliders, and read the seed and the report.
// All the maths is in engine/, which this page mounts and feeds with pixels.
//
// Saved data: 'params' → { key: value } for every slider
//             'anchor' → { x, y } as fractions of the width and height (default 0.5, 0.5)
//             'view'   → 'monochrome' | 'mask' | 'field' | 'base' | 'pattern' | 'washi'

import { Feature, ui } from 'folio';
import { Engine, PARAMS, DEFAULTS, PATTERN_KEYS } from './engine/index.js';
import { sliders } from './controls.js';
import { describe, describePattern } from './report.js';

const { el } = ui;
const MAX_SIDE = 2048; // larger images are scaled down to this before rendering
const VIEWS = [['monochrome', 'Monochrome'], ['mask', 'Mask'], ['field', 'Field'], ['base', 'Base'],
  ['pattern', 'Pattern'], ['washi', 'Washi']];
const DRAW_KEYS = ['k', 'gamma', 'dMin', 'dMax', 'delta', 'feather', 'alpha', ...PATTERN_KEYS]; // these don't change M1–M8

export default class Renderer extends Feature {
  start() {
    this.engine = new Engine();
    this.P = { ...DEFAULTS, ...this.storage.get('params', {}) };
    this.anchor = this.storage.get('anchor', { x: 0.5, y: 0.5 });
    this.current = this.storage.get('view', 'base');
    this.result = null;
    this.picker = ui.filePicker('image/*');

    this.add('views', {
      id: 'renderer',
      label: 'Renderer',
      icon: 'palette',
      order: 10,
      start: true,
      subtitle: () => (this.seed ? `Seed ${this.seed.seedText}` : 'Choose an image to begin'),
      mount: (container, { head, actions }) => this.mount(container, head, actions),
      render: () => this.draw(),
    });
  }

  mount(container, head, actions) {
    this.tabs = el('div', { class: 'seg renderer-tabs', role: 'tablist', style: `--tabs:${VIEWS.length}` },
      VIEWS.map(([id, label]) => el('button', {
        type: 'button', role: 'tab', 'data-view': id, onclick: () => this.show(id),
      }, label)));
    head.append(this.tabs);
    actions.append(el('button', {
      type: 'button', class: 'icon-btn ghost', 'aria-label': 'Choose an image', title: 'Choose an image',
      onclick: () => this.choose(),
    }, ui.icon('plus')));

    this.canvas = el('canvas', { class: 'renderer-canvas' });
    this.overlay = el('canvas', { class: 'renderer-overlay', 'aria-hidden': 'true' });
    this.stage = el('div', { class: 'renderer-stage', hidden: true, onclick: (e) => this.setAnchor(e) },
      this.canvas, this.overlay);
    this.empty = el('button', { type: 'button', class: 'missing renderer-empty', onclick: () => this.choose() },
      el('b', {}, 'Choose an image'),
      el('span', {}, 'It stays on this device. Then tap the picture to move the anchor.'));
    this.error = ui.errorBox();

    this.seedLine = el('p', { class: 'renderer-seed' });
    this.report = el('div', { class: 'renderer-report' });
    this.controls = sliders(PARAMS, this.P, (key, value) => this.change(key, value));
    const reset = el('button', { type: 'button', class: 'btn small', onclick: () => this.reset() }, 'Back to defaults');

    container.append(el('div', { class: 'renderer-page' },
      this.empty, this.stage, this.error, this.seedLine, this.controls.node, reset, this.report));
    new ResizeObserver(() => this.paintOverlay()).observe(this.stage);
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
      this.refresh(); // the seed goes in the title's status line
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
    if (!this.tabs) return;
    for (const b of this.tabs.children) b.setAttribute('aria-selected', String(b.dataset.view === this.current));
    this.empty.hidden = !!this.seed;
    this.stage.hidden = !this.seed;
    if (!this.seed || !this.result) return;

    this.picture = this.engine.view(this.current, this.P, this.result);
    const { rgba, width, height } = this.picture;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    const { W, H } = this.engine.image;
    this.stage.style.aspectRatio = `${W} / ${H}`;
    this.stage.style.width = `min(100%, ${(70 * W) / H}vh)`; // tall pictures fit on screen
    this.paintOverlay();

    this.seedLine.replaceChildren('Seed ', el('code', {}, this.seed.seedText),
      ` · ${W} × ${H} px · anchor (${this.anchor.x.toFixed(3)}, ${this.anchor.y.toFixed(3)})`);
    const r = describe(this.result);
    this.report.replaceChildren(el('h3', {}, 'Report'), el('p', {}, r.summary),
      ...r.attempts.map((a) => el('details', { class: `renderer-attempt${a.kept ? ' kept' : ''}`, open: a.kept },
        el('summary', {}, a.title, el('span', { class: `renderer-tag ${a.pass ? 'pass' : 'fail'}` }, a.pass ? 'passes' : 'fails'),
          a.kept && el('span', { class: 'renderer-tag kept' }, 'shown')),
        el('ul', {}, a.lines.map((line) => el('li', {}, line))))),
      this.engine.patternCache?.D && el('p', {}, describePattern(this.engine.patternCache)));
  }

  // The anchor (every view) and the threshold contour (Field view), drawn crisp at screen size.
  paintOverlay() {
    if (!this.picture || this.stage.hidden) return;
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
