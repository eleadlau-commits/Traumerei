// Pages: Settings as a page in the frame, the same frame as Home, the rooms page and a room (the
// frame feature: the top bar says Home › Settings, the status bar is at the foot). A rail down the
// left lists its sections; beside it, one panel of rows, each a label (the section's name) and
// its value (what the section draws). A click on a section in the rail goes to it.
//
// The sections are Folio's 'settings' slot, as every feature fills it, then Folio's own Features
// and About. Everything that opened Folio's Settings window (the menu, Home, Settings in a room)
// opens this page instead: the shell's openSettings, refreshSettings and closeSettings are this
// feature's while it runs. Without it, the window is as it was.
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
      shell.openSettings = () => this.open();
      shell.refreshSettings = () => { if (this.isOpen) this.draw(); };
      shell.closeSettings = () => this.close();
    }
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.key !== 'Escape' || e.defaultPrevented) return;
      if (e.target?.matches?.('input, textarea, select') || document.querySelector('dialog[open]:not(.pages)')) return;
      e.preventDefault();
      this.close();
    });
  }

  get isOpen() { return this.root.open; }

  build() {
    this.rail = el('nav', { class: 'rail pages-rail', 'aria-label': 'Settings sections' });
    this.panel = el('div', { class: 'page-panel pages-panel' });
    this.canvas = el('div', { class: 'page-canvas pages-canvas' }, this.panel);
    this.canvas.addEventListener('scroll', () => this.markCurrent(), { passive: true });
    this.root = el('dialog', { class: 'pages', 'aria-label': 'Settings' }, this.rail, this.canvas);
  }

  open() {
    this.app.shell?.closeMenu?.();
    // Over whatever shows (Home, the rooms page or a room), so it is put last each time.
    (document.getElementById('folio-root') || document.body).append(this.root);
    if (!this.root.open) this.root.show();
    document.documentElement.classList.add('page-open');
    this.draw();
    this.canvas.scrollTop = 0;
    this.markCurrent();
    this.frame?.show(this, {
      crumbs: [{ label: 'Home', title: 'Back to the home page', onClick: () => this.close() }, { label: 'Settings', current: true }],
      back: () => this.close(),
      backLabel: 'Back',
      idle: 'Changes save as you make them',
    });
  }

  close() {
    if (!this.root.open) return;
    this.root.close();
    document.documentElement.classList.remove('page-open');
    this.frame?.hide(this);
  }

  // Draws the rail and the rows again (a section's data changed), keeping where the page is.
  draw() {
    const top = this.canvas.scrollTop;
    this.sections = settingsSections(this.slot('settings'), this.app.shell?.settings);
    this.rail.replaceChildren(el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Settings'),
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
