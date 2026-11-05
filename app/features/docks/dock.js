// One dock: a page fixed to the left or right edge of the screen that other features open things
// in. It holds one thing per tab: opening into a tab replaces what that tab held (asked first),
// opening into another tab keeps it and brings the new one to the front. While it holds two or
// more, a row of tabs shows at its top. Its inner edge is dragged to set its width, which is
// remembered; a double-click on the edge sets it back. Hidden while it holds something, it leaves a
// 28px strip at its edge with the name of each thing it holds written sideways ("Loose · 3"); a
// click on a name brings the dock back with that in front. The two docks are the same class, mirrored.
// It knows nothing of Folio: Docks.js makes one per side and tells it how to save its width and
// how to say that its width changed.

import { ui } from 'folio';

const { el } = ui;
export const WIDTH = { left: 280, right: 340 }; // px: its width until it is dragged
const LEAST = { left: 220, right: 280 };        // px: never narrower
const MOST = 560;                               // px: never wider (nor wider than 70% of the window)
export const STRIP = 28;                        // px: the strip a hidden dock leaves

export class Dock {
  // side: 'left' or 'right'. saved: its remembered width, or undefined. keep(px): remember a width.
  // resized(px): its showing width changed (0 when shut). tab: the tab a thing opens in when it
  // names none ('' for a dock without tabs).
  // keyLabel(): the dock's key as the screen shows it ("Ctrl+Alt+E"), shown in its tab strip.
  constructor({ side, saved, keep, resized, label, tab = '', keyLabel = () => '' }) {
    this.side = side;
    this.keyLabel = keyLabel;
    this.least = LEAST[side];
    this.usual = WIDTH[side];
    this.keep = keep;
    this.resized = resized;
    this.width = this.fit(saved ?? this.usual);
    this.firstTab = tab;
    this.held = [];     // what it holds, one per tab, in the order the tabs show: { key, tab, kind, title, label, page, beforeClose, onClose }
    this.front = null;  // the one in front
    this.tucked = false; // hidden by its key, or Canvas only, with what it holds kept
    this.bare = false;   // Canvas only: not even its strip shows
    this.build(label);
  }

  fit(px) { return Math.round(Math.max(this.least, Math.min(+px || this.usual, MOST, Math.max(this.least, window.innerWidth * 0.7)))); }

  get showing() { return this.held.length && !this.tucked ? this.width : 0; }
  get visible() { return this.held.length > 0 && !this.tucked; }
  get stripped() { return this.held.length > 0 && this.tucked && !this.bare; }
  get taken() { return this.visible ? this.width : this.stripped ? STRIP : 0; } // px of the screen's side it takes

  build(label) {
    // Every dock wears the same frame: a strip of tabs (one for each thing it holds) with its key and ×
    // on the right, then the front one's quiet kind and title, then its body.
    this.tabsEl = el('div', { class: 'dock-tabs', role: 'tablist' });
    this.keyEl = el('span', { class: 'key dock-key' });
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
      el('div', { class: 'tab-strip dock-strip' }, this.tabsEl,
        el('div', { class: 'tab-tail' }, this.keyEl,
          el('button', { type: 'button', class: 'close-x dock-close', 'aria-label': 'Close', title: 'Close (Escape)', onclick: () => this.close() }))),
      this.headEl = el('header', { class: 'dock-head' },
        el('div', { class: 'dock-names' }, this.kindEl, this.titleEl)),
      this.body,
      this.edge);
    for (const type of ['keyup', 'paste', 'copy', 'cut', 'wheel']) this.root.addEventListener(type, (e) => e.stopPropagation());
    // The strip it leaves while hidden: a name for each thing it holds, written sideways.
    this.stripEl = el('nav', { class: `dock-tuck dock-tuck-${this.side}`, hidden: true, 'aria-label': `${label} (hidden)`,
      onpointerdown: (e) => e.stopPropagation() });
    (document.getElementById('folio-root') || document.body).append(this.root, this.stripEl);
  }

  // Shows `body` (a node) in tab `tab` (the dock's first tab when none is named), in front, in
  // place of whatever that tab held (which is asked first, and closed); the other tabs keep theirs.
  // kind: a quiet word above the title ("Source"). beforeClose(): true (or a promise of true) when
  // it may close. onClose(): it closed. Resolves with { close, setTitle, setKind, open } or null
  // when what the tab held would not close.
  async open({ key = this.side, tab = this.firstTab, kind = '', title = '', label = '', body, beforeClose = null, onClose = null } = {}) {
    const there = this.held.find((x) => x.tab === tab);
    if (there && !await this.closeOne(there)) return null;
    if (this.held.some((x) => x.tab === tab)) return null; // something else opened there meanwhile
    const page = el('div', { class: 'dock-page' }, body || '');
    const shown = { key, tab, kind, title, label, page, beforeClose, onClose };
    this.held.push(shown);
    this.body.append(page);
    this.front = shown;
    this.tucked = false;
    this.root.hidden = false;
    this.draw();
    document.documentElement.classList.add(`dock-${this.side}-open`); // (before the width is sent, so what moves over has moved)
    this.setWidth(this.width, false);
    const dock = this;
    return {
      close: (force = false) => (this.held.includes(shown) ? this.closeOne(shown, force) : Promise.resolve(true)),
      setTitle: (t) => { shown.title = t; if (this.front === shown) this.draw(); },
      setKind: (t) => { shown.kind = t; if (this.front === shown) this.draw(); },
      setLabel: (t) => { shown.label = t; this.draw(); },
      get open() { return dock.held.includes(shown); },
    };
  }

  // The tabs, the names over the front one, and only its page showing.
  draw() {
    const f = this.front;
    this.kindEl.textContent = f?.kind || '';
    this.titleEl.textContent = f?.title || '';
    this.headEl.hidden = !f?.kind && !f?.title;
    for (const x of this.held) x.page.hidden = x !== f;
    // The first tab (the right dock's Editor) always leads; the rest in the order they opened.
    const tabs = [...this.held].sort((a, b) => (b.tab === this.firstTab) - (a.tab === this.firstTab));
    this.tabsEl.replaceChildren(...tabs.map((x) => el('button', {
      type: 'button', class: 'tab dock-tab', role: 'tab', 'aria-selected': String(x === f),
      onclick: () => this.bring(x),
    }, x.tab || x.kind || 'Untitled')));
    this.keyEl.textContent = this.keyLabel() || '';
    this.drawStrip();
  }

  // Its name for one thing it holds: the strip's label, else its tab, else its kind.
  nameOf(x) { return x.label || x.tab || x.kind || 'Untitled'; }

  // The strip it leaves while hidden, and the room it takes: <html> has dock-left-strip (or
  // -right) while it shows, and --dock-left is its width.
  drawStrip() {
    const on = this.stripped;
    this.stripEl.hidden = !on;
    document.documentElement.classList.toggle(`dock-${this.side}-strip`, on);
    if (!on) { this.stripEl.replaceChildren(); return; }
    const key = this.keyLabel();
    this.stripEl.replaceChildren(...this.held.map((x) => el('button', {
      type: 'button', class: 'tab dock-tuck-tab', title: `Show ${this.nameOf(x)}${key ? ` · ${key}` : ''}`,
      onclick: () => this.bring(x),
    }, this.nameOf(x))));
  }

  bring(x) {
    if (!this.held.includes(x)) return false;
    this.front = x;
    if (this.tucked) this.tuck(false);
    this.draw();
    return true;
  }

  find(key) { return key == null ? this.front : this.held.find((x) => x.key === key) || null; }

  // Brings what holds `key` to the front (and the dock back, if hidden). False when it holds none.
  show(key) { const x = this.find(key); return x ? this.bring(x) : false; }

  // Closes what holds `key`, or the one in front when none is given. Resolves true when it closed
  // (or there was nothing to close).
  async close(key = null, force = false) {
    const x = this.find(key);
    return x ? this.closeOne(x, force) : true;
  }

  // Closes everything it holds, each asked first unless `force`. Resolves true when the dock is shut.
  async closeAll(force = false) {
    for (const x of this.held.slice()) await this.closeOne(x, force);
    return !this.held.length;
  }

  async closeOne(shown, force = false) {
    if (!this.held.includes(shown)) return true;
    if (!force && shown.beforeClose) {
      let ok = false;
      try { ok = await shown.beforeClose(); } catch { ok = true; }
      if (!ok) return false;
      if (!this.held.includes(shown)) return true; // closed meanwhile
    }
    this.held = this.held.filter((x) => x !== shown);
    shown.page.remove();
    if (this.front === shown) this.front = this.held[this.held.length - 1] || null;
    // Its owner hears that it closed before anyone hears the width change: a feature that redraws on
    // the width (the rooms page) would otherwise open it again while its owner still thinks it shows.
    try { shown.onClose?.(); } catch (err) { console.warn(`Dock (${this.side}): onClose`, err); }
    if (!this.held.length) {
      this.tucked = false;
      this.root.hidden = true;
      document.documentElement.classList.remove(`dock-${this.side}-open`);
      this.drawStrip();
      this.resized(0);
    }
    this.draw();
    return true;
  }

  // Hides the dock (on) or brings it back, keeping what it holds. False when it holds nothing.
  tuck(on) {
    if (!this.held.length) return false;
    this.tucked = !!on;
    this.root.hidden = this.tucked;
    document.documentElement.classList.toggle(`dock-${this.side}-open`, !this.tucked);
    if (this.tucked && this.root.contains(document.activeElement)) document.activeElement.blur();
    this.drawStrip();
    this.resized(this.taken);
    return true;
  }

  // Canvas only (on): hidden, it leaves no strip either.
  setBare(on) {
    if (this.bare === !!on) return;
    this.bare = !!on;
    this.drawStrip();
    this.resized(this.taken);
  }

  // Whether it holds `key` (anything, when none is given), in front or not.
  isOpen(key = null) { return key == null ? this.held.length > 0 : !!this.find(key); }

  // Whether `key` is in front and the dock shows.
  isShowing(key) { return this.visible && this.front?.key === key; }

  setWidth(px, keep = true) {
    this.width = this.fit(px);
    if (keep) this.keep(this.width);
    this.root.style.width = `${this.width}px`;
    if (this.visible) this.resized(this.width);
  }

  // The window changed size: keep the width inside its bounds.
  refit() { if (this.visible) this.setWidth(this.width, false); }

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
