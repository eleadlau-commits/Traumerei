// One dock: a page fixed to the left or right edge of the screen that other features open things
// in. One thing shows in it at a time. Its inner edge is dragged to set its width, which is
// remembered; a double-click on the edge sets it back. The two docks are the same class, mirrored.
// It knows nothing of Folio: Docks.js makes one per side and tells it how to save its width and
// how to say that its width changed.

import { ui } from 'folio';

const { el } = ui;
export const WIDTH = { left: 300, right: 480 }; // px: its width until it is dragged
const LEAST = 220;  // px: never narrower
const MOST = 0.7;   // of the window: never wider

export class Dock {
  // side: 'left' or 'right'. saved: its remembered width, or undefined. keep(px): remember a width.
  // resized(px): its showing width changed (0 when shut).
  constructor({ side, saved, keep, resized, label }) {
    this.side = side;
    this.usual = WIDTH[side];
    this.keep = keep;
    this.resized = resized;
    this.width = this.fit(saved ?? this.usual);
    this.shown = null; // { key, onClose, beforeClose }
    this.build(label);
  }

  fit(px) { return Math.round(Math.max(LEAST, Math.min(+px || this.usual, Math.max(LEAST, window.innerWidth * MOST)))); }

  get showing() { return this.shown ? this.width : 0; }

  build(label) {
    this.titleEl = el('div', { class: 'dock-title' });
    this.kindEl = el('div', { class: 'label dock-kind' });
    this.body = el('div', { class: 'dock-body' });
    this.edge = el('div', { class: 'dock-edge', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Drag to change the width',
      title: 'Drag to change the width · double-click for the usual width', onpointerdown: (e) => this.drag(e), ondblclick: () => this.setWidth(this.usual) });
    this.root = el('aside', { class: `panel dock dock-${this.side}`, hidden: true, 'aria-label': label,
      onpointerdown: (e) => e.stopPropagation(),
      onkeydown: (e) => {
        e.stopPropagation(); // the room's keys stay the room's
        if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); this.close(); }
      } },
      el('header', { class: 'dock-head' },
        el('div', { class: 'dock-names' }, this.kindEl, this.titleEl),
        el('button', { type: 'button', class: 'close-x dock-close', 'aria-label': 'Close', title: 'Close (Escape)', onclick: () => this.close() })),
      this.body,
      this.edge);
    for (const type of ['keyup', 'paste', 'copy', 'cut', 'wheel']) this.root.addEventListener(type, (e) => e.stopPropagation());
    (document.getElementById('folio-root') || document.body).append(this.root);
  }

  // Shows `body` (a node) in the dock, in place of whatever showed there (which is asked first, and
  // closed). kind: a quiet word above the title ("Source"). beforeClose(): true (or a promise of
  // true) when it may close. onClose(): it closed. Resolves with { close, setTitle, setKind, open }
  // or null when what showed would not close.
  async open({ key = this.side, kind = '', title = '', body, beforeClose = null, onClose = null } = {}) {
    if (this.shown && !await this.close()) return null;
    const shown = (this.shown = { key, beforeClose, onClose });
    const dock = this;
    this.kindEl.textContent = kind;
    this.titleEl.textContent = title;
    this.body.replaceChildren(body || '');
    this.root.hidden = false;
    this.setWidth(this.width, false);
    document.documentElement.classList.add(`dock-${this.side}-open`);
    return {
      close: (force = false) => (this.shown === shown ? this.close(null, force) : Promise.resolve(true)),
      setTitle: (t) => { if (this.shown === shown) this.titleEl.textContent = t; },
      setKind: (t) => { if (this.shown === shown) this.kindEl.textContent = t; },
      get open() { return dock.shown === shown; },
    };
  }

  // Closes what shows (only if it is `key`, given). Resolves true when the dock is shut.
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
    document.documentElement.classList.remove(`dock-${this.side}-open`);
    this.resized(0);
    try { shown.onClose?.(); } catch (err) { console.warn(`Dock (${this.side}): onClose`, err); }
    return true;
  }

  isOpen(key = null) { return !!this.shown && (key == null || this.shown.key === key); }

  setWidth(px, keep = true) {
    this.width = this.fit(px);
    if (keep) this.keep(this.width);
    this.root.style.width = `${this.width}px`;
    if (this.shown) this.resized(this.width);
  }

  // The window changed size: keep the width inside its bounds.
  refit() { if (this.shown) this.setWidth(this.width, false); }

  // The edge dragged: the width follows the pointer, and is remembered when let go.
  drag(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    this.edge.setPointerCapture?.(e.pointerId);
    document.documentElement.classList.add('dock-dragging');
    const move = (ev) => this.setWidth(this.side === 'right' ? window.innerWidth - ev.clientX : ev.clientX, false);
    const up = () => {
      this.edge.removeEventListener('pointermove', move);
      this.edge.removeEventListener('pointerup', up);
      this.edge.removeEventListener('pointercancel', up);
      document.documentElement.classList.remove('dock-dragging');
      this.setWidth(this.width);
    };
    this.edge.addEventListener('pointermove', move);
    this.edge.addEventListener('pointerup', up);
    this.edge.addEventListener('pointercancel', up);
  }
}
