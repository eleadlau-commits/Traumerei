// The frame: what sits around Create's canvas, the same on the rooms page and in a room. The top
// bar is a band of flat veil holding the wordmark beside the menu (☰), where you are (a
// breadcrumb: Rooms › Floor 1 › Messy thoughts, each step a word to press), Search always at the
// right, and the back arrow. The foot is the status bar, a thin band of veil: on the left it
// explains whatever the pointer is over (its data-hint, title or name, and its keys), or a line
// of help; on the right what is chosen, the mode, and Saved. It holds no things, so it is not a
// dock. While it shows, its height is --status on <html> (the docks end above it). The rooms page and a room each show the frame with what it should
// say (`frame.show(owner, …)`); the one shown last is the one that shows, and hiding it brings
// back the one before (leaving a room brings back the rooms page's).
//
// It also holds how wide the rail is (the rooms page and a room each draw their own rail in
// Folio's .rail): Ctrl+Alt+B, or the rail button at the left of the status bar, narrows it to its
// icons (48px) and back. At the foot of both rails it draws ⋯ More, which unfolds what other
// features put in the slot `rail.more` (Time). It saves how wide the rail is and whether More is
// open. Its service is the only way in (README.md).

import { Feature, ui } from 'folio';

const { el } = ui;
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const HINT_MS = 9000;
const RAIL_KEY = { id: 'frame.rail', keys: ['Ctrl+Alt+B'], words: 'narrow the rail to its icons, or widen it', order: 79 };

export default class Frame extends Feature {
  start() {
    const self = this;
    this.stack = []; // [{ owner, o }]: the last one shows
    this.narrow = !!this.storage.get('railNarrow');
    this.moreOpen = !!this.storage.get('moreOpen');
    this.defineSlot('rail.more', 'Under ⋯ More, at the foot of the rooms page\'s rail and a room\'s: { id, label, icon (a ui.ICONS name), order, run(), on?() → shown as pressed, visible?(), title?() → its hover words }.');
    this.build();
    this.drawRail();
    this.provide('frame', {
      show: (owner, o) => this.show(owner, o),
      update: (owner, o) => this.update(owner, o),
      hide: (owner) => this.hide(owner),
      saved: (word) => this.saved(word),
      hint: (text) => this.hint(text),
      clearHint: () => this.clearHint(),
      hover: (text) => this.hover(text),
      toggleRail: () => this.toggleRail(),
      more: () => this.more(),
      get railNarrow() { return self.narrow; },
    });
    this.add('keys', { ...RAIL_KEY, zone: 'everywhere', run: () => this.toggleRail() });
    // A line of help fades on the first key or click.
    document.addEventListener('keydown', () => this.clearHint(), true);
    document.addEventListener('pointerdown', () => this.clearHint(), true);
    // The status bar explains whatever the pointer is over.
    document.addEventListener('pointerover', (e) => this.over(e.target), true);
  }

  // ⋯ More, for the foot of a rail: a node the rail puts where it likes. Folded, it is one word;
  // a click unfolds what is in the slot `rail.more` under it (remembered). Empty when nothing is
  // there to show.
  more() {
    const box = el('div', { class: 'frame-more', role: 'group', 'aria-label': 'More' });
    const icon = (name) => { const s = ui.icon(name); s.classList.add('rail-icon'); return s; };
    const word = (text) => el('span', { class: 'rail-word' }, text);
    const draw = () => {
      const items = this.slot('rail.more').items
        .filter((i) => { try { return i.visible ? !!i.visible() : true; } catch { return false; } })
        .sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
      if (!items.length) { box.replaceChildren(); return; }
      box.replaceChildren(
        el('div', { class: 'rail-rule' }),
        el('button', { type: 'button', class: 'rail-item frame-more-btn', 'aria-expanded': String(this.moreOpen), title: 'More',
          onclick: () => { this.moreOpen = !this.moreOpen; this.storage.set('moreOpen', this.moreOpen); draw(); } },
        icon('dots'), word('More')),
        ...(this.moreOpen ? items.map((i) => el('button', {
          type: 'button', class: 'rail-item frame-more-item', 'aria-pressed': String(!!i.on?.()), title: i.title?.() || i.label,
          onclick: () => i.run(),
        }, icon(i.icon), word(i.label))) : []));
    };
    draw();
    return box;
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
    this.savedMark = el('span', { class: 'status-saved frame-saved', 'aria-live': 'polite' }, 'Saved');
    this.hintLine = el('span', { class: 'status-info frame-info' });
    this.selEl = el('span', { class: 'frame-sel' });
    this.modeEl = el('span', { class: 'frame-mode' });
    this.railBtn = el('button', { type: 'button', class: 'frame-rail-btn', 'aria-keyshortcuts': 'Control+Alt+B',
      onclick: () => this.toggleRail() }, ui.icon('rail'));
    this.status = el('footer', { class: 'status-bar frame-status' }, this.railBtn, this.hintLine,
      el('span', { class: 'status-right' }, this.selEl, this.modeEl, this.savedMark));
    this.root = el('div', { class: 'frame', hidden: true },
      this.bar, this.wordmark, this.crumbs, this.searchBtn, this.backBtn, this.status);
    (document.getElementById('folio-root') || document.body).append(this.root);
  }

  // The rail: narrow (its icons, 48px) or wide. <html> has .rail-narrow while narrow (base.css
  // sets --rail from it), and frame:rail says so.
  toggleRail() {
    this.narrow = !this.narrow;
    this.storage.set('railNarrow', this.narrow);
    this.drawRail();
    this.emit('frame:rail', { narrow: this.narrow });
  }

  drawRail() {
    document.documentElement.classList.toggle('rail-narrow', this.narrow);
    const label = `${this.narrow ? 'Widen' : 'Narrow'} the rail`;
    this.railBtn.setAttribute('aria-label', label);
    this.railBtn.setAttribute('title', `${label} · Ctrl+Alt+B`);
    this.railBtn.setAttribute('aria-pressed', String(this.narrow));
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
      document.documentElement.style.setProperty('--status', '0px');
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
    this.selEl.textContent = o.selection || '';
    this.modeEl.textContent = o.mode || '';
    this.drawInfo();
    document.documentElement.style.setProperty('--status', 'var(--status-h)');
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

  // At the right of the status bar, "Saved" (with a quiet dot) when the world has been written
  // down; another word ("Undone") for a moment, then Saved again.
  saved(word = 'Saved') {
    this.savedMark.textContent = word;
    this.savedMark.classList.remove('on');
    void this.savedMark.offsetWidth;
    this.savedMark.classList.add('on');
    clearTimeout(this.savedTimer);
    if (word !== 'Saved') this.savedTimer = setTimeout(() => { this.savedMark.textContent = 'Saved'; }, 2200);
  }

  // A line of help on the left of the status bar, for a while (or until the first key or click).
  hint(text) {
    this.helpText = text;
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.clearHint(), HINT_MS);
    this.drawInfo();
  }

  clearHint() {
    if (!this.helpText) return;
    clearTimeout(this.hintTimer);
    this.helpText = '';
    this.drawInfo();
  }

  // What the owner says the pointer is over (null lets the frame find it again).
  hover(text) {
    this.hoverText = text || '';
    this.drawInfo();
  }

  // The pointer came over `node`: its data-hint, else its title or name, with its keys.
  over(node) {
    if (this.root.hidden) return;
    const t = node?.closest?.('[data-hint], [title], [aria-label]');
    let text = '';
    if (t && !t.matches('.frame-status, .frame-status *')) {
      text = t.dataset.hint || t.getAttribute('title') || (t.matches('button, a, [role="tab"], [role="separator"]') ? t.getAttribute('aria-label') : '') || '';
      const keys = t.getAttribute('aria-keyshortcuts');
      if (text && keys && !text.includes('Ctrl') && !text.includes('⌘')) text += ` · ${keys.replace(/Control/g, 'Ctrl').replace(/Meta/g, '⌘')}`;
    }
    if (text === this.overText) return;
    this.overText = text;
    this.drawInfo();
  }

  // The left of the status bar: what the pointer is over, else a line of help, else the owner's
  // quiet idle line.
  drawInfo() {
    const idle = this.top()?.o.idle || '';
    this.hintLine.textContent = this.hoverText || this.overText || this.helpText || idle;
  }
}
