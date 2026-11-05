// The frame: what sits around Create's canvas, the same on the rooms page and in a room. The top
// bar is a band of flat veil holding the wordmark beside the menu (☰), where you are (a
// breadcrumb: Rooms › Floor 1 › Messy thoughts, each step a word to press), Search always at the
// right, and the back arrow; the foot holds a quiet "Saved" and a line of help. The rooms page and a room each show the frame with what it should
// say (`frame.show(owner, …)`); the one shown last is the one that shows, and hiding it brings
// back the one before (leaving a room brings back the rooms page's).
//
// It saves nothing. Its service is the only way in (README.md).

import { Feature, ui } from 'folio';

const { el } = ui;
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const HINT_MS = 9000;

export default class Frame extends Feature {
  start() {
    this.stack = []; // [{ owner, o }]: the last one shows
    this.build();
    this.provide('frame', {
      show: (owner, o) => this.show(owner, o),
      update: (owner, o) => this.update(owner, o),
      hide: (owner) => this.hide(owner),
      saved: (word) => this.saved(word),
      hint: (text) => this.hint(text),
      clearHint: () => this.clearHint(),
    });
    // A line of help fades on the first key or click.
    document.addEventListener('keydown', () => this.clearHint(), true);
    document.addEventListener('pointerdown', () => this.clearHint(), true);
  }

  build() {
    this.bar = el('div', { class: 'chrome-bar frame-bar' });
    this.wordmark = el('div', { class: 'wordmark frame-wordmark', 'aria-hidden': 'true' }, 'Traumerei');
    this.crumbs = el('nav', { class: 'crumbs frame-crumbs', 'aria-label': 'Where you are' });
    this.searchBtn = el('button', { type: 'button', class: 'word find-btn frame-search', 'aria-keyshortcuts': MAC ? 'Meta+K' : 'Control+K',
      onclick: () => this.top()?.o.search?.() },
    el('span', {}, 'Search'), el('span', { class: 'find-key' }, MAC ? '⌘K' : 'Ctrl+K'));
    this.backBtn = el('button', { type: 'button', class: 'back-btn frame-back', 'aria-label': 'Back', onclick: () => this.top()?.o.back?.() },
      ui.icon('<path d="M20 12H4M10 6l-6 6 6 6"/>'));
    this.savedMark = el('div', { class: 'saved-note frame-saved', 'aria-live': 'polite' });
    this.hintLine = el('div', { class: 'foot-hint frame-hint' });
    this.root = el('div', { class: 'frame', hidden: true },
      this.bar, this.wordmark, this.crumbs, this.searchBtn, this.backBtn, this.savedMark, this.hintLine);
    (document.getElementById('folio-root') || document.body).append(this.root);
  }

  top() { return this.stack[this.stack.length - 1] || null; }

  // Shows the frame for `owner` (on top of any other), saying what `o` says.
  show(owner, o = {}) {
    this.stack = this.stack.filter((s) => s.owner !== owner);
    this.stack.push({ owner, o: { ...o } });
    this.draw();
  }

  // Changes what `owner`'s frame says (it shows only if it is on top).
  update(owner, o = {}) {
    const s = this.stack.find((x) => x.owner === owner);
    if (!s) return;
    Object.assign(s.o, o);
    this.draw();
  }

  // Takes `owner`'s frame away; the one under it shows again, or none.
  hide(owner) {
    this.stack = this.stack.filter((s) => s.owner !== owner);
    this.draw();
  }

  draw() {
    const s = this.top();
    clearTimeout(this.hiding);
    if (!s) {
      this.root.classList.remove('on');
      this.clearHint();
      this.hiding = setTimeout(() => { if (!this.top()) this.root.hidden = true; }, 450);
      return;
    }
    const { o } = s;
    const wasHidden = this.root.hidden;
    this.root.hidden = false;
    this.searchBtn.hidden = !o.search;
    this.backBtn.setAttribute('aria-label', o.backLabel || 'Back');
    this.drawCrumbs(o.crumbs || []);
    this.root.style.setProperty('--frame-ink', o.ink || 'var(--ink)');
    if (wasHidden) this.root.getBoundingClientRect(); // so it fades in
    this.root.classList.add('on');
  }

  // Where you are: each step a word to press (or the owner's own node, as a room's name that can
  // be renamed in place), with a quiet › between them.
  drawCrumbs(list) {
    const out = [];
    list.forEach((c, i) => {
      if (i) out.push(el('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '›'));
      if (c.node) { out.push(c.node); return; }
      const attrs = { class: 'crumb', ...(c.title ? { title: c.title } : {}), ...(c.current ? { 'aria-current': 'page' } : {}) };
      out.push(c.onClick ? el('button', { type: 'button', ...attrs, onclick: c.onClick }, c.label) : el('span', attrs, c.label));
      if (c.note) out.push(el('span', { class: 'crumb-note' }, c.note));
    });
    this.crumbs.replaceChildren(...out);
  }

  // A quiet word in the corner when the world has been written down ("Saved", "Undone").
  saved(word = 'Saved') {
    this.savedMark.textContent = word;
    this.savedMark.classList.remove('on');
    void this.savedMark.offsetWidth;
    this.savedMark.classList.add('on');
  }

  // A line of help at the foot, for a while (or until the first key or click).
  hint(text) {
    this.hintLine.textContent = text;
    this.hintLine.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.clearHint(), HINT_MS);
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    this.hintLine.classList.remove('on');
  }
}
