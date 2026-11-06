// Pages: Settings and Account as pages in the frame, the same frame as Home, the rooms page and a
// room (the frame feature: the top bar says Home › Settings, the status bar is at the foot). A
// rail down the left lists the page's sections; beside it, one panel of rows, each a label (the
// section's name) and its value (what the section draws). A click on a section in the rail goes
// to it.
//
// Settings: Folio's 'settings' slot, as every feature fills it, then Folio's own Features and
// About (settings.js). Account: the sections the 'account' slot's item gives (`sections()`, the
// account feature), drawn again on 'account:changed'. Everything that opened Folio's Settings
// window or the account's small page (the menu, Home, Settings in a room) opens these pages
// instead: the shell's openSettings, refreshSettings, closeSettings and openAccount are this
// feature's while it runs. Without it, the windows are as they were.
//
// The page is a <dialog> shown open (not modal), so while it shows the key map, the rooms page
// and the room leave keys alone, as they do for any pop-up. Escape or ← goes back.
//
// No saved data.

import { Feature, ui } from 'folio';
import { settingsSections } from './settings.js';

const { el } = ui;

export default class Pages extends Feature {
  start() {
    this.frame = this.use('frame'); // the top bar and the status bar (the frame feature), or null
    this.build();
    const shell = this.app.shell;
    if (shell) {
      const openAccount = shell.openAccount.bind(shell);
      shell.openSettings = () => this.open('settings');
      shell.refreshSettings = () => { if (this.kind === 'settings') this.draw(); };
      shell.closeSettings = () => { if (this.kind === 'settings') this.close(); };
      shell.openAccount = () => (this.account()?.sections ? this.open('account') : openAccount());
    }
    this.on('account:changed', () => { if (this.kind === 'account') this.draw(); });
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.key !== 'Escape' || e.defaultPrevented) return;
      if (e.target?.matches?.('input, textarea, select') || document.querySelector('dialog[open]:not(.pages)')) return;
      e.preventDefault();
      this.close();
    });
  }

  get isOpen() { return this.root.open; }

  // The account feature's item in Folio's 'account' slot, or null.
  account() { return this.slot('account').items[0] || null; }

  // What each page is: its name, the rail's head, its quiet line, and its sections
  // ({ id, title, icon, body }).
  page(kind) {
    if (kind === 'account') {
      const a = this.account();
      return { title: 'Account', idle: a?.name?.() ? 'Signed in' : 'Sign in to keep your rooms and settings on every device',
        sections: () => { try { return a?.sections?.() || []; } catch (err) { console.warn('Account', err); return []; } } };
    }
    return { title: 'Settings', idle: 'Changes save as you make them',
      sections: () => settingsSections(this.slot('settings'), this.app.shell?.settings) };
  }

  build() {
    this.rail = el('nav', { class: 'rail pages-rail' });
    this.panel = el('div', { class: 'page-panel pages-panel' });
    this.canvas = el('div', { class: 'page-canvas pages-canvas' }, this.panel);
    this.canvas.addEventListener('scroll', () => this.markCurrent(), { passive: true });
    this.root = el('dialog', { class: 'pages' }, this.rail, this.canvas);
  }

  open(kind = 'settings') {
    this.app.shell?.closeMenu?.();
    const fresh = kind !== this.kind || !this.root.open;
    this.kind = kind;
    const p = this.page(kind);
    this.root.setAttribute('aria-label', p.title);
    // Over whatever shows (Home, the rooms page or a room), so it is put last each time.
    (document.getElementById('folio-root') || document.body).append(this.root);
    if (!this.root.open) this.root.show();
    document.documentElement.classList.add('page-open');
    if (fresh) this.canvas.scrollTop = 0;
    this.draw();
    this.frame?.show(this, {
      crumbs: [{ label: 'Home', title: 'Back to the home page', onClick: () => this.close() }, { label: p.title, current: true }],
      back: () => this.close(),
      backLabel: 'Back',
      idle: p.idle,
    });
  }

  close() {
    if (!this.root.open) return;
    this.root.close();
    this.kind = null;
    document.documentElement.classList.remove('page-open');
    this.frame?.hide(this);
  }

  // Draws the rail and the rows again (a section's data changed), keeping where the page is.
  draw() {
    if (!this.kind) return;
    const top = this.canvas.scrollTop;
    const p = this.page(this.kind);
    this.sections = p.sections();
    this.rail.setAttribute('aria-label', `${p.title} sections`);
    this.rail.replaceChildren(el('div', { class: 'rail-head', 'aria-hidden': 'true' }, p.title),
      ...this.sections.map((s) => {
        const icon = ui.icon(s.icon);
        icon.classList.add('rail-icon');
        return el('button', { type: 'button', class: 'rail-item', title: s.title, 'data-sec': s.id, onclick: () => this.goTo(s.id) },
          icon, el('span', { class: 'rail-word' }, s.title));
      }));
    this.panel.replaceChildren(...this.sections.map((s) => el('section', { class: 'page-row pages-row', 'data-sec': s.id, 'aria-label': s.title },
      el('h3', { class: 'page-label pages-label' }, s.title),
      el('div', { class: 'pages-value' }, s.body))));
    this.canvas.scrollTop = top;
    this.markCurrent();
    if (this.root.open) this.frame?.update(this, { idle: p.idle });
  }

  goTo(id) {
    const row = this.panel.querySelector(`.pages-row[data-sec="${id}"]`);
    if (!row) return;
    this.canvas.scrollTo({ top: row.offsetTop - this.panel.offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    this.current = id;
    this.picked = Date.now(); // the scroll that follows doesn't move the mark
    this.markRail();
  }

  // The section at the top of the canvas is the one marked in the rail (the last, at the foot).
  markCurrent() {
    const rows = [...this.panel.children];
    if (!rows.length || Date.now() - (this.picked || 0) < 900) return;
    const atFoot = this.canvas.scrollTop + this.canvas.clientHeight >= this.canvas.scrollHeight - 2;
    let id = rows[0].dataset.sec;
    for (const r of rows) if (r.offsetTop - this.panel.offsetTop <= this.canvas.scrollTop + 24) id = r.dataset.sec;
    this.current = atFoot && this.canvas.scrollTop > 0 ? rows[rows.length - 1].dataset.sec : id;
    this.markRail();
  }

  markRail() {
    for (const b of this.rail.querySelectorAll('.rail-item')) b.setAttribute('aria-current', String(b.dataset.sec === this.current));
  }
}
