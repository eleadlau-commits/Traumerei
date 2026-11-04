// The side panel: a page docked on the left that other features open their editors in (the
// source editor, the content editor). One thing shows in it at a time. Its right edge is dragged
// to set its width, which is remembered; a double-click on the edge sets it back. While it shows,
// its width is published as the CSS variable --panel-width on <html> (0px when it is shut) and in
// the event 'panel:resized', so whatever sits beside it (the room) moves over instead of being
// covered. Other features use it only through the `panel` service (README.md lists it).

import { Feature, ui } from 'folio';

const { el } = ui;
const WIDTH = 480;  // px: its width until it is dragged
const LEAST = 300;  // px: never narrower
const MOST = 0.7;   // of the window: never wider

export default class Panel extends Feature {
  start() {
    this.width = this.fit(this.storage.get('width', WIDTH));
    this.shown = null; // { key, onClose, beforeClose }
    const panel = this;
    this.provide('panel', {
      open: (o) => this.open(o),
      close: (key = null, force = false) => this.close(key, force),
      isOpen: (key = null) => !!this.shown && (key == null || this.shown.key === key),
      get width() { return panel.shown ? panel.width : 0; },
    });
    this.build();
    window.addEventListener('resize', () => { if (this.shown) this.setWidth(this.width, false); });
  }

  fit(px) { return Math.round(Math.max(LEAST, Math.min(+px || WIDTH, Math.max(LEAST, window.innerWidth * MOST)))); }

  build() {
    this.titleEl = el('div', { class: 'panel-title' });
    this.kindEl = el('div', { class: 'panel-kind' });
    this.body = el('div', { class: 'panel-body' });
    this.edge = el('div', { class: 'panel-edge', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Drag to change the width',
      title: 'Drag to change the width · double-click for the usual width', onpointerdown: (e) => this.drag(e), ondblclick: () => this.setWidth(WIDTH) });
    this.root = el('aside', { class: 'panel', hidden: true, 'aria-label': 'Side panel',
      onpointerdown: (e) => e.stopPropagation(),
      onkeydown: (e) => {
        e.stopPropagation(); // the room's keys stay the room's
        if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); this.close(); }
      } },
      el('header', { class: 'panel-head' },
        el('div', { class: 'panel-names' }, this.kindEl, this.titleEl),
        el('button', { type: 'button', class: 'panel-close', 'aria-label': 'Close', title: 'Close (Escape)', onclick: () => this.close() }, '×')),
      this.body,
      this.edge);
    for (const type of ['keyup', 'paste', 'copy', 'cut', 'wheel']) this.root.addEventListener(type, (e) => e.stopPropagation());
    (document.getElementById('folio-root') || document.body).append(this.root);
  }

  // Shows `body` (a node) in the panel, in place of whatever showed there (which is asked first, and
  // closed). kind: a quiet word above the title ("Source"). beforeClose(): true (or a promise of
  // true) when it may close. onClose(): it closed. Resolves with { close, setTitle, setKind } or
  // null when what showed would not close.
  async open({ key = 'panel', kind = '', title = '', body, beforeClose = null, onClose = null } = {}) {
    if (this.shown && !await this.close()) return null;
    const shown = (this.shown = { key, beforeClose, onClose });
    this.kindEl.textContent = kind;
    this.titleEl.textContent = title;
    this.body.replaceChildren(body || '');
    this.root.hidden = false;
    this.setWidth(this.width, false);
    document.documentElement.classList.add('panel-open');
    return {
      close: (force = false) => (this.shown === shown ? this.close(null, force) : Promise.resolve(true)),
      setTitle: (t) => { if (this.shown === shown) this.titleEl.textContent = t; },
      setKind: (t) => { if (this.shown === shown) this.kindEl.textContent = t; },
      get open() { return this.shown === shown; },
    };
  }

  // Closes what shows (only if it is `key`, given). Resolves true when the panel is shut.
  async close(key = null, force = false) {
    const shown = this.shown;
    if (!shown) return true;
    if (key != null && shown.key !== key) return true;
    if (!force && shown.beforeClose) {
      let ok = false;
      try { ok = await shown.beforeClose(); } catch { ok = true; }
      if (!ok || this.shown !== shown) return false;
    }
    this.shown = null;
    this.root.hidden = true;
    this.body.replaceChildren();
    document.documentElement.classList.remove('panel-open');
    this.publish(0);
    try { shown.onClose?.(); } catch (err) { console.warn('Panel: onClose', err); }
    return true;
  }

  setWidth(px, keep = true) {
    this.width = this.fit(px);
    if (keep) this.storage.set('width', this.width);
    this.root.style.width = `${this.width}px`;
    if (this.shown) this.publish(this.width);
  }

  publish(px) {
    document.documentElement.style.setProperty('--panel-width', `${px}px`);
    this.emit('panel:resized', { width: px });
  }

  // The edge dragged: the width follows the pointer, and is remembered when let go.
  drag(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.edge.setPointerCapture?.(e.pointerId);
    document.documentElement.classList.add('panel-dragging');
    const move = (ev) => this.setWidth(ev.clientX, false);
    const up = () => {
      this.edge.removeEventListener('pointermove', move);
      this.edge.removeEventListener('pointerup', up);
      this.edge.removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('panel-dragging');
      this.setWidth(this.width);
    };
    this.edge.addEventListener('pointermove', move);
    this.edge.addEventListener('pointerup', up);
    this.edge.addEventListener('pointercancel', up);
  }
}
