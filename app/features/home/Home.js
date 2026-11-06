// Home: the home page, laid over the picture (the Renderer view fills the screen behind it), in
// the same frame as the rooms page and a room (the frame feature: the top bar saying "Home", the
// status bar at the foot). It is kept clean: no rail and no Search. The name sits in the middle,
// "Create" beneath it, then the quick-thought line (quick.js): faint words, "Note down a messy
// thought…", where typing anywhere on Home writes; Enter drops the thought in Messy thoughts'
// loose tray. Create opens the rooms (the rooms feature); Settings, Account and About are in the
// menu.
//
// The typeface is a setting (Settings → Typeface), Tenor Sans by default. The choices are in
// fonts.js.
//
// Saved data: 'font' → an id from fonts.js

import { Feature, ui } from 'folio';
import { FONTS, DEFAULT_FONT, READING, findFont, loadFont } from './fonts.js';
import { quickLine } from './quick.js';

const { el } = ui;
const TITLE = 'Träumerei';

export default class Home extends Feature {
  start() {
    this.font = findFont(this.storage.get('font', DEFAULT_FONT));
    this.applyFont();
    loadFont(READING); // the reading face for thoughts (--font-read in base.css), whatever the typeface

    this.w = this.use('world');       // Messy thoughts, for the quick thought (the world feature), or null
    this.frame = this.use('frame');   // the top bar and the status bar (the frame feature), or null
    this.quick = quickLine({
      drop: (text) => this.drop(text),
      live: () => this.showing() && !document.querySelector('dialog[open], .search:not([hidden])'),
    });
    this.page = el('div', { class: 'home' },
      el('div', { class: 'home-centre' },
        el('h1', { class: 'home-title' }, TITLE),
        el('nav', { class: 'home-nav', 'aria-label': 'Home' },
          el('button', { type: 'button', class: 'word home-link home-create', onclick: () => this.create() }, 'Create')),
        this.quick.el));
    (document.getElementById('folio-root') || document.body).append(this.page);
    this.frame?.show(this, {
      crumbs: [{ label: 'Home', current: true }],
      idle: this.w ? 'Type anywhere to note down a messy thought · Enter drops it in Messy thoughts · Ctrl+Enter new line' : 'Create opens the rooms',
    });

    // Create is also the first word in the menu (Folio adds Account, Settings and About).
    this.add('header.buttons', { id: 'home-create', label: 'Create', icon: 'plus', order: 5, onClick: () => this.create() });
    // The menu is a veil over the whole screen (style.css): tapping its empty part closes it.
    document.addEventListener('click', (e) => {
      if (e.target.matches?.('dialog.menu-drawer .menu-panel, dialog.menu-drawer .menu-list')) this.app.shell?.closeMenu?.();
    });

    this.add('settings', { id: 'home-typeface', title: 'Typeface', order: 20, render: () => this.typeface() });
  }

  // ---- Create ----

  create() { this.use('create')?.open(); }

  // Whether Home is what shows: no rooms page over it.
  showing() { return !document.documentElement.classList.contains('rooms-open'); }

  // ---- The quick thought ----

  // Keeps `text` as a loose thought of Messy thoughts, waiting in its tray in every mode (as a
  // thought added from the tray does). Read afresh first (it may have come from the account), and
  // written down at once, so the rooms page finds it. Says where it went in the status bar.
  // True when it went.
  drop(text) {
    if (!this.w) return false;
    const { model, groups } = this.w.lib;
    const world = this.w.load(); // Messy thoughts is always there: a world without it is given it again
    this.w.begin();
    const th = model.create(world, model.MESSY, { kind: 'line', text });
    if (!th) { this.frame?.hint('Messy thoughts is locked: nothing was dropped'); return false; }
    groups.wait(world, model.MESSY, th.id);
    this.w.save();
    this.w.write();
    this.frame?.hint('Dropped in Messy thoughts');
    return true;
  }

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
