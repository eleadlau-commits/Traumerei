// Home: the home page, laid over the picture (the Renderer view fills the screen behind it).
// The name sits in the middle, "Create" beneath it, then "Settings" and "Account" under that.
// The three words do nothing yet: each has its own method below, ready to be filled in.
//
// The typeface is a setting (Settings → Typeface), Tenor Sans by default. The choices are in
// fonts.js. The top bar keeps only the menu button (see style.css).
//
// Saved data: 'font' → an id from fonts.js

import { Feature, ui } from 'folio';
import { FONTS, DEFAULT_FONT, findFont, loadFont } from './fonts.js';

const { el } = ui;
const TITLE = 'Traumerei';

export default class Home extends Feature {
  start() {
    this.font = findFont(this.storage.get('font', DEFAULT_FONT));
    this.applyFont();

    this.page = el('div', { class: 'home' },
      el('h1', { class: 'home-title' }, TITLE),
      el('nav', { class: 'home-nav', 'aria-label': 'Home' },
        el('button', { type: 'button', class: 'home-link home-create', onclick: () => this.create() }, 'Create'),
        el('div', { class: 'home-row' },
          el('button', { type: 'button', class: 'home-link', onclick: () => this.settings() }, 'Settings'),
          el('button', { type: 'button', class: 'home-link', onclick: () => this.account() }, 'Account'))));
    (document.getElementById('folio-root') || document.body).append(this.page);

    // Create is also the first word in the menu (Folio adds Account, Settings and About).
    this.add('header.buttons', { id: 'home-create', label: 'Create', icon: 'plus', order: 5, onClick: () => this.create() });
    // The menu is a veil over the whole screen (style.css): tapping its empty part closes it.
    document.addEventListener('click', (e) => {
      if (e.target.matches?.('dialog.menu-drawer .menu-panel, dialog.menu-drawer .menu-list')) this.app.shell?.closeMenu?.();
    });

    this.add('settings', { id: 'home-typeface', title: 'Typeface', order: 20, render: () => this.typeface() });
  }

  // ---- The three words: nothing yet ----

  create() {}

  settings() {}

  account() {}

  // ---- Typeface ----

  applyFont() {
    document.documentElement.style.setProperty('--home-font', this.font.family);
    document.documentElement.classList.add('home-font-loading');
    loadFont(this.font).then(() => document.documentElement.classList.remove('home-font-loading'));
  }

  chooseFont(id) {
    this.font = findFont(id);
    this.storage.set('font', this.font.id);
    this.applyFont();
    this.app.shell?.refreshSettings?.();
  }

  // Settings → Typeface: one button per font, each written in its own face.
  typeface() {
    for (const f of FONTS) loadFont(f);
    return el('div', { class: 'seg home-fonts', role: 'radiogroup', 'aria-label': 'Typeface', style: `--tabs:${FONTS.length}` },
      FONTS.map((f) => el('button', {
        type: 'button',
        role: 'radio',
        'aria-checked': String(f.id === this.font.id),
        'aria-selected': String(f.id === this.font.id),
        style: `font-family:${f.family}`,
        onclick: () => this.chooseFont(f.id),
      }, f.name)));
  }
}
