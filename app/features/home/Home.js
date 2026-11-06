// Home: the home page, laid over the picture (the Renderer view fills the screen behind it), in
// the same frame as the rooms page and a room (the frame feature: the top bar saying "Home", the
// status bar at the foot). A rail down the left holds Start (Create, Settings, Account, About)
// and Recent rooms (the rooms gone into lately, from the world's attention log; a click goes in).
// The name sits in the middle of what the rail leaves, "Create" beneath it. Create opens the
// rooms (the rooms feature); Search looks through every room (the search feature).
//
// The typeface is a setting (Settings → Typeface), Tenor Sans by default. The choices are in
// fonts.js.
//
// Saved data: 'font' → an id from fonts.js

import { Feature, ui } from 'folio';
import { FONTS, DEFAULT_FONT, READING, findFont, loadFont } from './fonts.js';

const { el } = ui;
const TITLE = 'Träumerei';
const RECENT = 5; // rooms under Recent rooms
const ROOM_ICON = '<rect x="5" y="5" width="14" height="14"/>';

export default class Home extends Feature {
  start() {
    this.font = findFont(this.storage.get('font', DEFAULT_FONT));
    this.applyFont();
    loadFont(READING); // the reading face for thoughts (--font-read in base.css), whatever the typeface

    this.w = this.use('world');       // the rooms, for Recent rooms (the world feature), or null
    this.frame = this.use('frame');   // the top bar and the status bar (the frame feature), or null
    this.rail = el('nav', { class: 'rail home-rail', 'aria-label': 'Start and recent rooms' });
    this.page = el('div', { class: 'home' },
      this.rail,
      el('div', { class: 'home-centre' },
        el('h1', { class: 'home-title' }, TITLE),
        el('nav', { class: 'home-nav', 'aria-label': 'Home' },
          el('button', { type: 'button', class: 'word home-link home-create', onclick: () => this.create() }, 'Create'))));
    (document.getElementById('folio-root') || document.body).append(this.page);
    this.drawRail();
    this.on('room:open', () => this.drawRail()); // a room was gone into: Recent rooms changes
    this.on('search:found', (f) => this.found(f));
    const search = this.use('search'); // every room's thoughts (the search feature), or null
    this.frame?.show(this, {
      crumbs: [{ label: 'Home', current: true }],
      search: search ? () => search.open() : null,
      idle: 'Create opens the rooms',
    });
    if (search) this.add('keys', { id: 'home.search', keys: ['Ctrl+K'], words: 'search every room', zone: 'home', order: 10,
      when: () => this.showing(), run: () => search.open() });

    // Create is also the first word in the menu (Folio adds Account, Settings and About).
    this.add('header.buttons', { id: 'home-create', label: 'Create', icon: 'plus', order: 5, onClick: () => this.create() });
    // The menu is a veil over the whole screen (style.css): tapping its empty part closes it.
    document.addEventListener('click', (e) => {
      if (e.target.matches?.('dialog.menu-drawer .menu-panel, dialog.menu-drawer .menu-list')) this.app.shell?.closeMenu?.();
    });

    this.add('settings', { id: 'home-typeface', title: 'Typeface', order: 20, render: () => this.typeface() });
  }

  // ---- Create, Settings, Account ----

  create() { this.use('create')?.open(); }

  settings() { this.app.shell?.openSettings?.(); }

  account() { this.app.shell?.openAccount?.(); }

  about() { this.app.shell?.openAbout?.(); }

  // Whether Home is what shows: no rooms page over it.
  showing() { return !document.documentElement.classList.contains('rooms-open'); }

  // Goes into a room: the rooms page opens, then the room.
  goIn(id) {
    this.create();
    this.use('rooms')?.openRoom(id);
  }

  // A find opened in Search while Home shows: its room opens, then the room is told again where
  // to go (the room feature goes to finds in an open room).
  found(f) {
    if (!this.showing() || !f?.room) return;
    this.goIn(f.room);
    if (!this.showing()) this.emit('search:found', f);
  }

  // ---- The rail ----

  // The rooms gone into lately, latest first: rooms still on the floors (a Twin's side counts as
  // the Twin).
  recent() {
    const world = this.w?.world;
    if (!world) return [];
    const { model } = this.w.lib;
    const last = new Map();
    for (const [id, times] of Object.entries(this.w.attention || {})) {
      const r = model.topRoom(world, id);
      if (!r || r.archived || !times.length) continue;
      last.set(r.id, Math.max(last.get(r.id) || 0, times[times.length - 1]));
    }
    return [...last].sort((a, b) => b[1] - a[1]).slice(0, RECENT).map(([id]) => world.things[id]);
  }

  drawRail() {
    const icon = (name) => { const s = ui.icon(name); s.classList.add('rail-icon'); return s; };
    const item = (label, name, run, title = label) => el('button', { type: 'button', class: 'rail-item', title, onclick: run },
      icon(name), el('span', { class: 'rail-word' }, label));
    const rooms = this.recent();
    this.rail.replaceChildren(
      el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Start'),
      item('Create', 'plus', () => this.create(), 'Create: the rooms'),
      item('Settings', 'gear', () => this.settings()),
      item('Account', 'account', () => this.account()),
      item('About', 'info', () => this.about()),
      ...(rooms.length ? [el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Recent rooms'),
        ...rooms.map((r) => item(r.name || 'Untitled', ROOM_ICON, () => this.goIn(r.id), `Go into ${r.name || 'Untitled'}`))] : []));
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
