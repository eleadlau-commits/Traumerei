// Create: rooms of thoughts. Create (on the home page, or in the menu) slides the rooms page up
// from the bottom, leaving a strip of the home page at the top with the menu (☰) in the top-left
// corner, as on every page, a back arrow home in the top-right one, and Search (Ctrl+K, ⌘K on a
// Mac) in the middle. The page is a light opacity mask over the home picture itself, held still underneath (its
// spontaneity layer is off), so nothing is drawn while it shows. It is a grid of square cells:
// each room is an opacity square on it (one cell; Messy thoughts takes four at the top left), and a
// room written in lately glows. The rooms page has pages (1 2 3 + along the bottom); a thin rail on
// the left holds Rooms and the Archive (a grid of its own, where no room can be made). Typing
// anything on the rooms page opens Messy thoughts and starts writing there.
//
// A room is seen through an ontology (ontologies/: Joyce, Pessoa, …). A small room (1 × 1)
// keeps the one mode it was made with; a big one (Messy thoughts, or any 2 × 2 room) switches
// between them. A new room (click an empty cell) asks which.
//
// On the grid, a click chooses a square (an outline); a right-click (or a long press) opens its
// properties beside it (name, Go in, colour, lightness, opacity, size, Lock, Archive, Delete); a
// double click or Enter goes in. Drag a square to move it: to a free cell, onto a page number to
// move it to that page, or onto Archive.
//
// A room fills the screen as one gradient of its own colour, laid out like the rooms page: the back
// arrow (to the rooms) top right, the menu top left and Search in the middle, its name at the top, and a rail on the left
// with its modes, where a big room switches between them (and Joyce has Timeline under it).
// A room is a canvas: drag to move around, wheel / pinch / Ctrl+wheel to zoom. Typing anywhere
// writes a thought; Enter ends it. A click chooses a thought; a right-click (or long press, or
// Enter) opens its properties beside it; a right-click on the empty canvas opens Add there.
// What is on the canvas, where it sits and what a drag does is the ontology's: see its file.
// Create keeps no mode of its own. Writing is the same in every room: Enter goes on with the
// train, and Ctrl+Enter starts a new one.
// Add (bottom left) unfolds to Thought, Passage (Alt+P), Picture (Alt+I, or paste) and Keys. A
// train can be folded into one thought, which you name, and unfolded again.
// Ctrl+K searches every room; Ctrl+Z / Ctrl+Shift+Z undo and redo; a quiet "Saved" shows when the
// world is written down, and a line of help shows the first time each page is seen.
//
// Everything is a thought (model.js): items (items/), groups and rooms. A room is seen through an
// ontology (ontologies/), which says what is on its canvas and where; more can come from other
// features through the slot 'create.ontologies'.
//
// Saved data: 'world3' → see model.js. It is saved with everything else, so it follows the
// account like the settings do. The older shape under 'world' is not read, and is cleared.

import { Feature, ui } from 'folio';
import {
  MESSY, DEFAULT_MODE, loadWorld, room, addRoom, name, view, startTrain,
  create, update, remove, move, fold, unfold, kindOf, isLeaf, isGroup, groupOf, thoughtText, trainThoughts, roomThoughts,
  roomTrains, randomSpot, gridRooms, placeRoom,
  search, sizeRoom,
  cells, roomAt, shut, lock, archive, archived, restore, peek, DESC, roomsOn, toPage, pageCount,
  addPage, isBig, rooms, roomTags, addTag, removeTag, allTags, roomSetting, setRoomSetting, resetRoomSettings, seedRoomSettings, applySettingsToAll, hash,
} from './model.js';
import { shrinkPicture } from './picture.js';
import { ITEMS } from './items/index.js';
import { maths } from './maths.js';
import { gather, FALLBACK } from './ontologies/index.js';
import { clearSpace, clearSpot, OVERLAP } from './clear.js';
import { visit, light, loadLog } from './attention.js';
import { pageLook, roomLook, squareLook, lookPrefs, savedLook, toOklch, rgb, LOOK, PALETTE } from './look.js';

const { el } = ui;
const ZOOM = { min: 0.25, max: 4 };
const GRID = { gap: 14, pad: 32, least: 4, most: 10, rail: 72 }; // the rooms page's cells (px); the rail on the left
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const KEY = MAC ? '⌘K' : 'Ctrl+K';
const HOLD = 520;          // ms: a long press opens properties, as a right-click does
const WORLD = 'world3';     // where the world is saved (model.js)
const UNDO = 60;           // how many steps back Ctrl+Z goes
const HINTS = {
  rooms: 'Click to choose · double-click to go in · right-click for properties · or just start typing',
  room: 'Type anywhere to write · Enter ends a thought · click to choose · right-click for properties · Ctrl+K searches · Ctrl+Z undoes',
};

// One rule for every box: Enter keeps; Ctrl+Enter (Cmd+Enter) puts a new line in a box that takes lines.
// Returns true when the box should be kept.
function enterKeeps(e) {
  e.preventDefault();
  if (!(e.ctrlKey || e.metaKey)) return true;
  if (e.target.tagName === 'TEXTAREA') e.target.setRangeText('\n', e.target.selectionStart, e.target.selectionEnd, 'end');
  return false;
}

export default class Create extends Feature {
  start() {
    if (this.storage.has('world')) this.storage.set('world', null); // the older shape: not kept
    this.world = loadWorld(this.savedWorld());
    this.roomId = null;   // the open room, or null on the rooms page
    this.draft = null;    // the thought being written: { train | null, x, y }, or { train, edit } for a thought opened again
    this.current = {};    // per room: the train Enter goes on with
    this.fresh = false;   // Ctrl+Enter was pressed: the next thought starts a new train
    this.sel = null;      // { kind: 'train' | 'thought', id }
    this.renaming = null; // a room id whose name is being edited
    this.roomPick = null; // the room chosen (outlined) on a grid
    this.roomSel = null;  // the room whose properties show beside it
    this.making = null;   // an empty cell clicked: { col, row }, where the new room's kinds show
    this.page = 0;        // the rooms page's page that shows
    this.barFor = null;   // in a room: what the properties pop-up is open for (selKey)
    this.editing = null;  // the Passage / Picture sheet: { kind, id | null, src? }
    this.picker = ui.filePicker('image/*');
    this.lastRoom = this.storage.get('lastRoom') || null; // the room last gone into: its square glows
    this.drafts = this.storage.get('drafts', {}) || {};    // per room: a thought left half written { text, train, x, y }
    this.shelf = false;   // the Archive page is showing, instead of the grid
    this.lights = null;   // the rooms page's search lights: what is being looked for, or null

    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), or null
    this.prefs = lookPrefs(this.storage.get('look'));
    // The global ontology settings ({ [ontology]: { key: value } }): what a new room starts with.
    this.ontPrefs = this.storage.get('ontologies') || {};
    // The app's colours (Renderer, Settings → Colour), and any change to them.
    this.palette = this.backdrop?.palette?.() || PALETTE;
    document.addEventListener('palette', (e) => { this.palette = e.detail; this.repaint(); });
    this.attention = loadLog(this.storage.get('attention'));
    // More ontologies can come from other features: see ontologies/index.js for their shape.
    this.defineSlot('create.ontologies', 'A way of seeing a room\'s thoughts: { id, name, note, groups, units, point, drop, … } (see create/ontologies/index.js).');
    this.build();
    this.add('settings', { id: 'create-rooms', title: 'Rooms', order: 30, render: () => this.settingsPane() });
    this.provide('create', this);
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => { if (this.roomId) this.place(); else if (!this.root.hidden) this.drawRooms(); });
    // Mathematics' fonts arrive after the first drawing: measure again so nothing overlaps.
    document.fonts?.addEventListener?.('loadingdone', () => { if (this.roomId) this.clearSoon(); });
    document.addEventListener('paste', (e) => this.onPaste(e));
    document.addEventListener('copy', (e) => this.onCopy(e));
  }

  savedWorld() { return this.storage.get(WORLD); }

  // ---- Opening and closing ----

  open() {
    this.world = loadWorld(this.savedWorld()); // it may have arrived from the account meanwhile
    this.undoStack = [];
    this.redoStack = [];
    this.lastSnap = this.snap();
    this.edited = new Set(); // the rooms changed on this visit: they glow when you leave
    this.leaving = false;
    this.showNote();
    this.app.shell?.closeMenu?.();
    clearTimeout(this.closing);
    this.colours = this.backdrop?.colours?.(); // read once: the page is still from here on
    this.palette = this.backdrop?.palette?.() || this.palette;
    this.paintPage();
    this.shelf = false;
    this.page = 0;
    this.roomPick = null;
    this.root.hidden = false;
    document.documentElement.classList.add('create-open');
    this.showRooms();
    this.root.getBoundingClientRect(); // so the slide starts from below
    this.root.classList.add('up');
    this.backdrop?.cover?.(true);
  }

  close() {
    this.leaving = false;
    this.leaveBox.hidden = true;
    this.closeSheet();
    this.closeSearch();
    this.closeLights();
    this.shelveDraft();
    this.stopWriting();
    this.backdrop?.cover?.(false);
    this.root.classList.remove('up');
    document.documentElement.classList.remove('create-dark');
    clearTimeout(this.closing);
    this.closing = setTimeout(() => {
      this.root.hidden = true;
      document.documentElement.classList.remove('create-open', 'create-in-room');
    }, 520);
  }

  // Back: from a room to the rooms page; from the Archive to the rooms; from the rooms page home.
  back() {
    if (this.roomId) this.showRooms();
    else if (this.shelf) this.toggleShelf();
    else if (this.edited?.size && !this.leaving) this.askNote();
    else this.close();
  }

  // ---- A comment for next time ----

  // Leaving after changing rooms: their squares glow, and a pop-up offers a line for next time.
  askNote() {
    this.leaving = true;
    this.drawRooms();
    const text = el('textarea', { class: 'create-sheet-body', rows: 3, placeholder: 'Where you were, what to pick up next', 'aria-label': 'Comment for next time' });
    const keep = () => {
      const t = text.value.trim();
      if (t) this.storage.set('note', { text: t, at: Date.now() });
      this.close();
    };
    text.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'Enter' && !e.isComposing && enterKeeps(e)) keep();
    };
    this.leaveBox.replaceChildren(
      el('div', { class: 'create-sheet-kind' }, 'Add a comment for next time?'),
      text,
      el('div', { class: 'create-sheet-words' },
        el('button', { type: 'button', class: 'create-word', onclick: keep }, 'Keep'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.close() }, 'Skip'),
        el('span', { class: 'create-keys' }, 'Enter keeps it · Ctrl+Enter a new line')));
    this.leaveBox.hidden = false;
    text.focus();
  }

  // The comment left last time, faint under the search bar until it is dismissed.
  showNote() {
    const note = this.storage.get('note');
    this.noteLine.hidden = !note?.text;
    if (!note?.text) return;
    this.noteLine.replaceChildren(el('span', {}, note.text),
      el('button', { type: 'button', class: 'create-word create-note-x', title: 'Dismiss', onclick: () => { this.storage.set('note', null); this.noteLine.hidden = true; } }, 'dismiss'));
  }

  // Shows a page of the rooms page.
  showPage(page = this.page) {
    if (this.roomId) this.showRooms();
    this.closeLights();
    this.page = page;
    this.shelf = false;
    this.roomPick = this.roomSel = this.making = null;
    this.renaming = null;
    this.grid.parentElement?.scrollTo?.(0, 0);
    this.drawRooms();
  }

  showRooms() {
    this.closeSheet();
    this.shelveDraft();
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.roomSel = this.making = null;
    this.closeAdd();
    this.roomPage.hidden = true;
    this.roomsPage.hidden = false;
    this.root.classList.remove('in-room', 'expanding');
    document.documentElement.classList.remove('create-in-room');
    this.expandVeil?.remove();
    this.backBtn.setAttribute('aria-label', 'Back to the home page');
    document.documentElement.classList.remove('create-dark');
    this.drawRooms();
  }

  // Goes into a room. Back then goes to its page (or the Archive, if it was opened from there).
  openRoom(id) {
    const r = room(this.world, id);
    if (!r) return;
    if (!this.shelf) this.page = r.page || 0;
    this.closeLights();
    this.attention = loadLog(this.storage.get('attention'));
    visit(this.attention, id);
    this.storage.set('attention', this.attention);
    this.lastRoom = id;
    this.storage.set('lastRoom', id);
    // Going in from the rooms page, the room's square grows to fill the screen first.
    const tile = !this.roomId && !this.roomsPage.hidden && this.grid.querySelector(`.create-tile[data-room="${id}"]`);
    this.roomId = id;
    this.sel = null;
    this.draft = null;
    this.gearFor = this.settingsFor = null;
    this.roomPage.hidden = false;
    this.root.classList.add('in-room');
    document.documentElement.classList.add('create-in-room');
    this.backBtn.setAttribute('aria-label', 'Back to the rooms');
    this.closeAdd();
    this.drawRoom();
    if (tile) this.expand(tile); else this.roomsPage.hidden = true;
    this.takeDraft();
    this.hint('room');
  }

  // The square grows into the room: a veil of the room's own colour starts on the square and
  // fills the screen, then the room shows under it and the veil fades. The room is ready (and
  // can be typed in) at once; only what is seen waits.
  expand(tile) {
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { this.roomsPage.hidden = true; return; }
    const look = this.lookOf(room(this.world, this.roomId));
    const a = tile.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const veil = el('div', { class: 'create-expand', style: `background:linear-gradient(${look.top}, ${look.bottom});transform:translate(${a.left}px, ${a.top}px) scale(${a.width / W}, ${a.height / H})` });
    this.expandVeil = veil;
    this.root.classList.add('expanding');
    this.root.append(veil);
    veil.getBoundingClientRect();
    veil.classList.add('go');
    veil.style.transform = 'none';
    this.expandTimer = setTimeout(() => {
      this.root.classList.remove('expanding');
      if (this.roomId) this.roomsPage.hidden = true;
      veil.classList.add('done');
      this.expandTimer = setTimeout(() => veil.remove(), 260);
    }, 430);
  }

  // A thought left half written when leaving a room is kept for it (its square shows a dot), and
  // put back when the room is gone into again.
  shelveDraft() {
    if (!this.roomId) return;
    if (this.draft?.edit) this.commit(); // a thought opened again is simply kept
    const text = this.input.value;
    if (this.draft && text.trim()) this.drafts[this.roomId] = { text, train: this.draft.train || null, x: this.draft.x ?? 0, y: this.draft.y ?? 0, ...(this.draft.for ? { for: this.draft.for } : {}) };
    else delete this.drafts[this.roomId];
    this.storage.set('drafts', this.drafts);
    this.draft = null;
    this.input.value = '';
    this.input.blur();
  }

  takeDraft() {
    const d = this.drafts[this.roomId];
    if (!d) return;
    delete this.drafts[this.roomId];
    this.storage.set('drafts', this.drafts);
    if (this.locked) return;
    const t = d.train && this.world.things[d.train];
    this.draft = t && t.parent === this.roomId ? { train: d.train } : { train: null, x: d.x, y: d.y, ...(d.for ? { for: d.for } : {}) };
    this.input.value = d.text;
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    this.showDraft();
  }

  get locked() { return !!this.roomId && shut(this.world, this.roomId); }

  // Saves the world. A change to the thoughts or rooms (not just where the view is) is a step
  // Ctrl+Z can take back.
  save() {
    const now = this.snap();
    if (now !== this.lastSnap) {
      this.undoStack.push(this.lastSnap);
      if (this.undoStack.length > UNDO) this.undoStack.shift();
      this.redoStack = [];
      this.lastSnap = now;
      if (this.roomId) this.edited?.add(this.roomId);
    }
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.storage.set(WORLD, this.world); this.showSaved(); }, 250);
    if (this.roomId) this.clearSoon();
  }

  snap() { const w = this.world; return JSON.stringify({ things: w.things, own: w.own, pages: w.pages }); }

  undo(back = true) {
    const from = back ? this.undoStack : this.redoStack, to = back ? this.redoStack : this.undoStack;
    if (!from.length) { this.toast(back ? 'Nothing to undo' : 'Nothing to redo'); return; }
    to.push(this.lastSnap);
    this.lastSnap = from.pop();
    const { things, own = {}, pages = 1 } = JSON.parse(this.lastSnap);
    Object.assign(this.world, { things, own, pages });
    this.sel = null;
    this.roomSel = this.making = null;
    this.draft = null;
    clearTimeout(this.saveTimer);
    this.storage.set(WORLD, this.world);
    this.showSaved(back ? 'Undone' : 'Redone');
    if (this.roomId && !room(this.world, this.roomId)) this.showRooms();
    else if (this.roomId) this.drawRoom();
    else this.drawRooms();
  }

  // A quiet word in the corner when the world has been written down.
  showSaved(word = 'Saved') {
    this.savedMark.textContent = word;
    this.savedMark.classList.remove('on');
    void this.savedMark.offsetWidth;
    this.savedMark.classList.add('on');
  }

  // A line of help, once, the first time each page is seen. It fades on the first key or click.
  hint(which) {
    const seen = this.storage.get('hinted', {}) || {};
    if (seen[which]) return;
    this.storage.set('hinted', { ...seen, [which]: true });
    this.hintLine.textContent = HINTS[which];
    this.hintLine.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hintLine.classList.remove('on'), 9000);
  }

  // ---- Building the pages ----

  build() {
    this.grid = el('div', { class: 'create-grid' });
    // Search lights (Ctrl+K on the rooms page): the rooms without the words dim.
    this.lightsField = el('input', { class: 'create-lights-field', placeholder: 'Light the rooms that hold…', 'aria-label': 'Search the rooms', autocomplete: 'off', spellcheck: 'false' });
    this.lightsBar = el('div', { class: 'create-lights', hidden: true }, this.lightsField,
      this.lightsNote = el('span', { class: 'create-lights-note' }));
    this.lightsField.addEventListener('input', () => { this.lights = this.lightsField.value; this.drawRooms(); });
    this.lightsField.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.closeLights(); }
      if (e.key === 'Enter') { e.preventDefault(); const best = this.bestLit(); if (best) this.openRoom(best); }
    });
    // The rail on the left, under the menu: the rooms, and the Archive. A room dragged onto Archive
    // goes there.
    this.railRooms = el('button', { type: 'button', class: 'create-rail-item', onclick: () => { if (this.shelf) this.toggleShelf(); } }, 'Rooms');
    this.shelfBtn = el('button', { type: 'button', class: 'create-rail-item create-shelf-btn', 'data-drop': 'archive', onclick: () => { if (!this.shelf) this.toggleShelf(); } },
      'Archive');
    this.rail = el('nav', { class: 'create-rail', 'aria-label': 'Rooms and the Archive' }, this.railRooms, this.shelfBtn);
    this.shelfHead = el('div', { class: 'create-shelf-head', hidden: true }, 'Archive');
    // The rooms page's pages: 1 2 3 +. A room dropped on a number goes to that page.
    this.pagesBar = el('nav', { class: 'create-pages', 'aria-label': 'Pages' });
    this.roomsPage = el('section', { class: 'create-rooms', 'aria-label': 'Rooms' },
      this.lightsBar,
      this.rail,
      el('div', { class: 'create-grid-wrap' }, this.shelfHead, this.grid),
      this.pagesBar);

    this.backBtn = el('button', { type: 'button', class: 'create-back', 'aria-label': 'Back to the home page', onclick: () => this.back() },
      ui.icon('<path d="M20 12H4M10 6l-6 6 6 6"/>'));
    // Search, a bar in the middle of the top row: the rooms page's lights, or a room's search of every room.
    this.searchBtn = el('button', { type: 'button', class: 'create-word create-search-btn', 'aria-keyshortcuts': MAC ? 'Meta+K' : 'Control+K',
      onclick: () => { if (this.roomId) this.openSearch(); else if (this.lights != null) this.closeLights(); else this.openLights(); } },
    el('span', {}, 'Search'), el('span', { class: 'create-search-key' }, KEY));
    this.crumbName = el('button', { type: 'button', class: 'create-crumb create-crumb-name', title: 'Rename', onclick: () => this.renameOpenRoom() });
    // The room's rail, where the rooms page has Rooms and Archive: its modes (a big room switches
    // between them; a small one names its one), and Timeline under Joyce.
    this.modes = el('nav', { class: 'create-rail create-modes', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'create-world' });
    this.stage = el('div', { class: 'create-stage', 'data-own-swipe': '' }, this.world$);
    this.input = el('textarea', { class: 'create-input', 'aria-label': 'Write a thought', rows: 1, wrap: 'off', autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'create-options create-edit', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.history = el('aside', { class: 'create-history', hidden: true, 'aria-label': 'Timeline', onpointerdown: (e) => e.stopPropagation() });
    this.trayEl = el('div', { class: 'create-tray', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.roomPage = el('section', { class: 'create-room', hidden: true, 'aria-label': 'Room' },
      this.stage,
      this.modes,
      el('div', { class: 'create-top' }, this.crumbName, this.crumbDesc = el('div', { class: 'create-crumb-desc' })),
      el('div', { class: 'create-add' },
        this.addMenu = el('div', { class: 'create-add-menu', hidden: true, role: 'menu' },
          this.addItem('Thought', 'Just type', () => this.beginWriting()),
          this.addItem('Passage', 'Alt+P', () => this.openSheet('passage')),
          this.addItem('Picture', 'Alt+I, or paste', () => this.choosePicture()),
          el('div', { class: 'create-add-rule' }),
          this.addItem('Keys', '?', () => this.showKeys(), false)),
        this.addBtn = el('button', { type: 'button', class: 'create-word create-add-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleAdd() },
          el('span', { class: 'create-add-plus', 'aria-hidden': 'true' }, '+'), 'Add')),
      this.history,
      this.trayEl,
      this.bar,
      this.sheet = el('div', { class: 'create-sheet', hidden: true }),
      this.input);

    this.searchBox = el('div', { class: 'create-search', hidden: true, role: 'dialog', 'aria-label': 'Search' });
    this.savedMark = el('div', { class: 'create-saved', 'aria-live': 'polite' });
    this.hintLine = el('div', { class: 'create-hint' });
    this.root = el('div', { class: 'create', hidden: true }, this.roomsPage, this.roomPage, this.searchBtn, this.backBtn, this.searchBox, this.savedMark, this.hintLine,
      this.noteLine = el('div', { class: 'create-note', hidden: true }),
      this.leaveBox = el('div', { class: 'create-sheet create-leave', hidden: true, role: 'dialog', 'aria-label': 'Comment for next time', onpointerdown: (e) => e.stopPropagation() }));
    (document.getElementById('folio-root') || document.body).append(this.root);

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => { this.onInputKey(e); requestAnimationFrame(() => this.paintDraft()); });
    this.input.addEventListener('blur', () => { if (this.draft && !this.draft.edit && !this.input.value.trim()) { this.draft = null; this.drawWorld(); } else this.paintDraft(); });
    // The caret and the selection on the canvas follow the hidden box's.
    document.addEventListener('selectionchange', () => { if (document.activeElement === this.input) this.paintDraft(); });
    this.input.addEventListener('selectionchange', () => this.paintDraft());
    this.input.addEventListener('focus', () => this.paintDraft());
    this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
    // A press in the thought being written keeps the hidden box focused (and no page selection starts).
    this.stage.addEventListener('mousedown', (e) => { if (e.target.closest?.('.create-draft')) e.preventDefault(); });
    this.stage.addEventListener('dblclick', (e) => this.onDouble(e));
    this.stage.addEventListener('contextmenu', (e) => this.onContext(e));
    document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && this.roomId && !this.draft && !e.target.matches?.('input, textarea, select')) { this.spaceDown = true; this.stage.classList.add('panning'); } });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.spaceDown = false; this.stage.classList.remove('panning'); } });
    document.addEventListener('pointerdown', (e) => {
      this.hintLine.classList.remove('on');
      if (!this.addMenu.hidden && !e.target.closest('.create-add-menu, .create-add-btn')) this.closeAdd();
    });
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  // ---- The rooms page ----

  // How many columns fit, and how big a cell is.
  gridSize() {
    const width = (this.grid.parentElement?.clientWidth || window.innerWidth) - 2 * GRID.pad - (window.innerWidth > 560 ? GRID.rail : 0);
    const fit = Math.floor((width + GRID.gap) / (this.prefs.cell + GRID.gap));
    const cols = Math.min(GRID.most, Math.max(GRID.least, fit));
    const cell = Math.max(56, Math.min(this.prefs.cell, Math.floor((width - GRID.gap * (cols - 1)) / cols)));
    return { cols, cell };
  }

  // For each room shown (ids), how many thoughts in it (and its name) hold the words.
  hitsOn(ids, query = this.lights) {
    const out = {};
    if (!query?.trim()) return out;
    for (const f of search(this.world, query, Infinity)) {
      for (let th = this.world.things[f.id]; th; th = this.world.things[th.parent]) {
        if (ids.has(th.id)) { out[th.id] = (out[th.id] || 0) + 1; break; }
      }
    }
    return out;
  }

  drawRooms() {
    const now = Date.now();
    this.page = Math.min(this.page, pageCount(this.world) - 1);
    const { cols: fit, cell } = this.gridSize();
    const all = gridRooms(this.world, fit, this.page);
    const shelved = archived(this.world);
    this.shelfBtn.setAttribute('aria-current', String(this.shelf));
    this.railRooms.setAttribute('aria-current', String(!this.shelf));
    this.shelfHead.hidden = !this.shelf;
    this.roomsPage.classList.toggle('shelf', this.shelf);
    this.drawPages();
    this.backBtn.setAttribute('aria-label', this.shelf ? 'Back to the rooms' : 'Back to the home page');
    this.grid.classList.toggle('peek-always', this.prefs.peek >= 0.5);
    const shown = new Set((this.shelf ? shelved : all).map((r) => r.id));
    if (!shown.has(this.roomPick)) this.roomPick = null; // chosen things not on this grid are let go
    if (!shown.has(this.roomSel)) this.roomSel = null;
    const hits = this.lights?.trim() ? this.hitsOn(shown) : null;
    this.grid.classList.toggle('lights', !!hits);
    if (hits) {
      const n = Object.keys(hits).length;
      this.lightsNote.textContent = n ? `${n} room${n === 1 ? '' : 's'} · Enter goes in` : 'Nothing here yet with those words';
    } else this.lightsNote.textContent = '';
    if (this.shelf) { this.drawShelf(shelved, fit, cell, hits); return; }
    // The grid grows: always a spare column and row past the furthest room, and at least the
    // size set in Settings → Rooms. The page scrolls when it is bigger than the screen.
    const cols = Math.max(fit, this.prefs.cols || 0, ...all.map((r) => r.col + r.size + 1));
    const height = this.grid.parentElement?.clientHeight || window.innerHeight;
    const rows = Math.max(Math.floor((height - GRID.pad - 64 + GRID.gap) / (cell + GRID.gap)),
      this.prefs.rows || 0, ...all.map((r) => r.row + r.size + 1));
    this.cols = cols;
    this.grid.style.setProperty('--cols', cols);
    this.grid.style.setProperty('--cell', cell + 'px');
    this.grid.style.setProperty('--cell-gap', GRID.gap + 'px');

    const taken = new Set();
    for (const r of all) for (let c = 0; c < (r.size || 1); c++) for (let d = 0; d < (r.size || 1); d++) taken.add(`${r.col + c},${r.row + d}`);
    const empty = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (taken.has(`${col},${row}`)) continue;
      const making = this.making?.col === col && this.making?.row === row;
      empty.push(el('button', {
        type: 'button', class: 'create-cell' + (making ? ' target' : ''), 'aria-label': 'New room here',
        style: `grid-column:${col + 1};grid-row:${row + 1}`,
        'data-col': col, 'data-row': row,
        onclick: () => this.onCell(col, row),
        oncontextmenu: (e) => { e.preventDefault(); this.roomSel = null; this.roomPick = null; this.making = { col, row }; this.drawRooms(); },
      }));
    }

    const tiles = all.map((r) => this.tile(r, now, hits));
    const panels = [];
    const chosen = this.roomSel && all.find((r) => r.id === this.roomSel);
    if (chosen) panels.push(this.roomOptions(chosen, cell, cols));
    if (this.making) panels.push(this.kindOptions(this.making, cell, cols));
    this.grid.replaceChildren(...empty, ...tiles, ...panels);
    this.grid.querySelector('.create-name-field')?.focus();
    if (!this.root.hidden) this.hint('rooms');
  }

  // A click on an empty cell: it lets go of what was chosen, or (if nothing was) shows the kinds
  // of room to make there.
  onCell(col, row) {
    if (this.roomSel || this.making) { this.roomSel = this.making = null; this.drawRooms(); return; }
    this.roomPick = null;
    this.making = { col, row };
    this.drawRooms();
    this.grid.querySelector('.create-kinds button')?.focus({ preventScroll: true });
  }

  // Where a pop-up beside a square (or a cell) goes: on its right if there is room, else its left.
  beside(c, cell, cols, extra = '') {
    const step = cell + GRID.gap;
    const size = c.size || 1;
    const right = c.col + size + 1 + 2 <= cols;
    return {
      class: 'create-options' + (right ? '' : ' left') + extra,
      style: right ? `left:${(c.col + size) * step + 4}px;top:${c.row * step}px` : `right:${(cols - c.col) * step + 4 - GRID.gap}px;top:${c.row * step}px`,
      onpointerdown: (e) => e.stopPropagation(),
      oncontextmenu: (e) => e.stopPropagation(),
    };
  }

  // The kinds of room a new one can be, beside the empty cell clicked.
  kindOptions(c, cell, cols) {
    return el('div', this.beside(c, cell, cols, ' create-kinds'),
      el('div', { class: 'create-options-label' }, 'A new room'),
      ...this.ontologies.map((k) => el('button', { type: 'button', class: 'create-kind', onclick: () => this.newRoom(c, k.id) },
        el('span', { class: 'create-kind-name' }, k.name), el('span', { class: 'create-add-note' }, k.note || ''))));
  }

  drawPages() {
    const n = pageCount(this.world);
    this.pagesBar.hidden = this.shelf;
    this.pagesBar.replaceChildren(
      ...Array.from({ length: n }, (_, i) => el('button', {
        type: 'button', class: 'create-word create-page', 'data-page': i, 'aria-label': `Page ${i + 1}`,
        ...(i === this.page ? { 'aria-current': 'page' } : {}),
        onclick: () => this.showPage(i),
      }, String(i + 1))),
      el('button', { type: 'button', class: 'create-word create-page', 'aria-label': 'A new page', title: 'A new page', onclick: () => {
        const i = addPage(this.world);
        this.save();
        this.showPage(i);
      } }, '+'));
  }

  // One room's square: its colour, its light, its name and count; its last thoughts (the peek);
  // a glow if it was the last room gone into, a dot if a thought was left half written there, a
  // thin bar along its top if it is locked, and how many finds it holds while the lights are on.
  tile(r, now = Date.now(), hits = null) {
    const look = squareLook(r, r.id === MESSY, this.prefs, this.palette);
    const written = roomThoughts(this.world, r.id);
    const count = written.length;
    const glow = light(this.attention, r.id, written.slice(-40).map((th) => th.at), now);
    const lit = glow > 0.04;
    const name = this.renaming === r.id
      ? this.nameField(r, () => { this.renaming = null; this.drawRooms(); })
      : el('span', { class: 'create-tile-name', title: r.name }, r.name);
    const lines = peek(this.world, r.id, (r.size || 1) > 1 ? 3 : 1);
    const found = hits?.[r.id] || 0;
    const tile = el('div', {
      class: 'create-tile' + (lit ? ' lit' : '') + (r.id === MESSY ? ' messy' : '') + (look.alpha > 0.4 ? ' deep' : '') + (this.roomSel === r.id ? ' chosen' : '')
        + (this.roomPick === r.id ? ' picked' : '')
        + (this.lastRoom === r.id || (this.leaving && this.edited?.has(r.id)) ? ' last' : '') + (r.locked ? ' locked' : '') + (hits ? (found ? ' found' : ' unlit') : ''),
      role: 'button', tabindex: 0,
      style: `--lit:${glow.toFixed(3)};--square:${look.fill};grid-column:${r.col + 1} / span ${r.size};grid-row:${r.row + 1} / span ${r.size}`,
      'aria-label': `${r.name}, ${count} thought${count === 1 ? '' : 's'}`,
      'aria-selected': String(this.roomPick === r.id),
      'data-room': r.id,
      'aria-expanded': String(this.roomSel === r.id),
      onkeydown: (e) => {
        if (e.target !== tile) return;
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); this.openRoom(r.id); }
        if (e.key === ' ') { e.preventDefault(); this.pickRoom(r.id); }
        if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); this.chooseRoom(r.id, true); }
      },
      onfocus: () => { if (this.roomPick !== r.id && !this.roomSel) { this.roomPick = r.id; tile.classList.add('picked'); this.grid.querySelectorAll('.create-tile.picked').forEach((t) => { if (t !== tile) t.classList.remove('picked'); }); } },
      onpointerdown: (e) => this.onTileDown(e, r, tile),
      oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); if (this.held !== r.id) this.chooseRoom(r.id, true); this.held = null; },
    },
      lines.length || r.desc ? el('div', { class: 'create-peek', 'aria-hidden': 'true' },
        r.desc ? el('div', { class: 'create-peek-desc' }, r.desc) : null,
        ...lines.map((t) => el('div', { class: 'create-peek-line' }, t))) : null,
      this.drafts[r.id] ? el('span', { class: 'create-tile-dot', title: 'A thought left half written' }) : null,
      found ? el('span', { class: 'create-tile-found' }, String(found)) : null,
      el('div', { class: 'create-tile-label' },
        name,
        el('span', { class: 'create-tile-count' }, count ? String(count) : '')));
    return tile;
  }

  // ---- The Archive: rooms taken off the grid, on a page of their own ----

  toggleShelf() {
    this.shelf = !this.shelf;
    this.roomSel = this.roomPick = this.making = null;
    this.drawRooms();
    this.grid.parentElement?.scrollTo?.(0, 0);
  }

  // The archived rooms, on a grid like the rooms page's, in the order they were archived. Its empty
  // cells make nothing. A click chooses a room; a right-click shows Go in, Restore and Delete; a
  // double click goes in.
  drawShelf(shelved, cols, cell, hits) {
    this.cols = cols;
    this.grid.style.setProperty('--cols', cols);
    this.grid.style.setProperty('--cell', cell + 'px');
    this.grid.style.setProperty('--cell-gap', GRID.gap + 'px');
    const height = this.grid.parentElement?.clientHeight || window.innerHeight;
    const rows = Math.max(Math.floor((height - GRID.pad - 64 + GRID.gap) / (cell + GRID.gap)), Math.ceil(shelved.length / cols) + 1);
    const empty = [];
    for (let i = shelved.length; i < rows * cols; i++) {
      empty.push(el('div', { class: 'create-cell inert', 'aria-hidden': 'true', style: `grid-column:${(i % cols) + 1};grid-row:${Math.floor(i / cols) + 1}`, onclick: () => { if (this.roomSel || this.roomPick) { this.roomSel = this.roomPick = null; this.drawRooms(); } } }));
    }
    const tiles = shelved.map((r, i) => {
      const t = this.tile({ ...r, size: 1 }, Date.now(), hits);
      t.style.gridColumn = `${(i % cols) + 1}`;
      t.style.gridRow = `${Math.floor(i / cols) + 1}`;
      t.dataset.room = r.id;
      return t;
    });
    const at = shelved.findIndex((r) => r.id === this.roomSel);
    const panel = at < 0 ? null : this.shelfOptions(shelved[at], at % cols, Math.floor(at / cols), cell, cols);
    this.grid.replaceChildren(...empty, ...tiles, ...(panel ? [panel] : []));
  }

  shelfOptions(r, col, row, cell, cols) {
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'create-word ' + extra, onclick: fn }, label);
    return el('div', this.beside({ col, row }, cell, cols),
      el('div', { class: 'create-options-label' }, r.name),
      r.desc ? el('p', { class: 'create-options-note' }, r.desc) : null,
      word('Go in', () => this.openRoom(r.id), 'create-options-go'),
      word('Restore', () => {
        restore(this.world, r.id, null, this.gridSize().cols);
        this.roomSel = null;
        this.save();
        this.drawRooms();
        this.toast(`${r.name} is back among the rooms.`);
      }),
      word('Delete', () => {
        remove(this.world, r.id);
        this.roomSel = null;
        this.save();
        this.drawRooms();
        this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
      }, 'create-options-delete'));
  }

  // ---- Search lights ----

  openLights() {
    this.lights = this.lights ?? '';
    this.lightsBar.hidden = false;
    this.lightsField.value = this.lights;
    this.lightsField.focus();
    this.lightsField.select();
  }

  closeLights() {
    if (this.lights == null) return;
    this.lights = null;
    this.lightsBar.hidden = true;
    this.lightsField.value = '';
    if (!this.roomId && !this.root.hidden) this.drawRooms();
  }

  // The room the lights found most in, on the page that shows.
  bestLit() {
    const ids = new Set((this.shelf ? archived(this.world) : roomsOn(this.world, this.page)).map((r) => r.id));
    const hits = this.hitsOn(ids);
    return Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  // A click on a square chooses it (an outline); the properties wait for a right-click.
  pickRoom(id) {
    if (this.roomSel && this.roomSel !== id) this.roomSel = null;
    this.making = null;
    this.roomPick = id;
    this.drawRooms();
    this.grid.querySelector(`.create-tile[data-room="${id}"]`)?.focus({ preventScroll: true });
  }

  // Opens (or, with open false, toggles) a room's properties beside its square.
  chooseRoom(id, open = false) {
    this.roomSel = open || this.roomSel !== id ? id : null;
    this.roomPick = id;
    this.making = null;
    this.renaming = null;
    this.drawRooms();
  }

  // A room's properties, beside its square: its name and description, Go in, its mode (one, or
  // all of them for a big room), its tags, its colour, lightness and opacity (the only place its colour is
  // set), its size, Back to the tint, Lock, Archive and Delete (not for Messy).
  roomOptions(r, cell, cols) {
    const set = (fields) => { update(this.world, r.id, fields); this.save(); this.drawRoomsSoon(); };
    const look = this.lookOf(r);
    const lightness = el('input', { type: 'range', min: 0.05, max: 0.98, step: 0.01, value: look.light, 'aria-label': 'Lightness', oninput: (e) => set({ light: +e.target.value }) });
    const nameField = el('input', {
      class: 'create-options-name', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
      onchange: (e) => { name(this.world, r.id, e.target.value); this.save(); this.drawRooms(); },
    });
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'create-word ' + extra, onclick: fn }, label);
    const panel = el('div', this.beside(r, cell, cols),
      nameField,
      // A line or two about the room: shown under its name inside, and in its square's peek.
      el('textarea', {
        class: 'create-options-desc', rows: 2, maxlength: DESC, placeholder: 'A line about this room', 'aria-label': 'Description',
        onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.target.blur(); } },
        onchange: (e) => { update(this.world, r.id, { desc: e.target.value }); this.save(); this.drawRooms(); },
      }, r.desc || ''),
      word('Go in', () => this.openRoom(r.id), 'create-options-go'),
      // Its kind: a small room keeps its one mode; a big one switches inside.
      // (its tags below name the modes).
      el('p', { class: 'create-options-note' }, isBig(r) ? 'Every mode · switched inside' : 'One mode'),
      this.tagsRow(r),
      // A colour picked is what the room is inside: its hue and chroma, and its lightness too.
      el('label', { class: 'create-slider' }, el('span', {}, 'Colour'),
        el('input', { type: 'color', value: look.colour, 'aria-label': 'Colour', oninput: (e) => {
          const L = toOklch(rgb(e.target.value))[0];
          set({ tint: e.target.value, light: Math.round(L * 1000) / 1000 });
          lightness.value = L;
        } })),
      el('label', { class: 'create-slider' }, el('span', {}, 'Lightness'), lightness),
      el('label', { class: 'create-slider' }, el('span', {}, 'Opacity'),
        el('input', { type: 'range', min: 0.3, max: 1, step: 0.01, value: look.opacity, 'aria-label': 'Opacity', oninput: (e) => set({ opacity: +e.target.value }) })),
      r.locked ? null : el('div', { class: 'create-options-row' },
        el('span', { class: 'create-options-label' }, 'Size'),
        ...[1, 2].map((n) => el('button', {
          type: 'button', class: 'create-word', 'aria-pressed': String((r.size || 1) === n),
          onclick: () => {
            if (sizeRoom(this.world, r.id, n, this.cols)) { this.save(); this.drawRooms(); }
            else this.toast('There isn\'t room for it to grow here. Move it first.');
          },
        }, n === 1 ? '1 × 1' : '2 × 2'))),
      el('div', { class: 'create-options-row' },
        r.tint || r.light != null || r.opacity != null ? word('Back to the tint', () => {
          delete r.tint; delete r.light; delete r.opacity; this.save(); this.drawRooms();
        }) : null,
        // Locked: nothing inside can change, and the square stays where it is.
        word(r.locked ? 'Unlock' : 'Lock', () => { lock(this.world, r.id, !r.locked); this.save(); this.drawRooms(); }),
        r.id !== MESSY && !r.locked ? word('Archive', () => {
          archive(this.world, r.id);
          this.roomSel = null;
          this.save();
          this.drawRooms();
          this.toast(`${r.name} is in the Archive.`);
        }) : null,
        r.id !== MESSY && !r.locked ? word('Delete', () => {
          remove(this.world, r.id);
          this.roomSel = this.roomPick = null;
          this.save();
          this.drawRooms();
          this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
        }, 'create-options-delete') : null));
    return panel;
  }

  // A room's tags in its properties: a chip each (its ontology's can't be taken off; the rest have
  // a ×), and a "+ tag" field that suggests the tags other rooms have. Enter adds what is typed.
  tagsRow(r) {
    const onts = this.ontologies;
    const mine = roomTags(this.world, r.id, onts);
    const had = new Set(mine.map((o) => o.tag.toLowerCase()));
    const after = (fn) => { if (fn()) { this.save(); this.tagFocus = r.id; this.drawRooms(); } };
    const list = el('datalist', { id: 'create-tag-list' },
      ...allTags(this.world, onts, true).filter((t) => !had.has(t.tag.toLowerCase())).map((t) => el('option', { value: t.tag })));
    const field = el('input', {
      class: 'create-tag-field', placeholder: '+ tag', 'aria-label': 'Add a tag', list: 'create-tag-list', maxlength: 30, autocomplete: 'off', spellcheck: 'false',
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; after(() => addTag(this.world, r.id, v, onts)); }
        if (e.key === 'Escape') e.target.blur();
        if (e.key === 'Backspace' && !e.target.value) { const last = mine.filter((o) => !o.auto).pop(); if (last) after(() => removeTag(this.world, r.id, last.tag)); }
      },
    });
    if (this.tagFocus === r.id) { this.tagFocus = null; requestAnimationFrame(() => field.focus({ preventScroll: true })); }
    return el('div', { class: 'create-tags', role: 'group', 'aria-label': 'Tags' },
      ...mine.map((o) => el('span', { class: 'create-chip' + (o.auto ? ' auto' : ''), title: o.auto ? 'Its mode: always a tag' : '' },
        o.tag,
        o.auto ? null : el('button', { type: 'button', class: 'create-chip-x', 'aria-label': `Take off ${o.tag}`, onclick: () => after(() => removeTag(this.world, r.id, o.tag)) }, '×'))),
      field, list);
  }

  // Redraws the squares on the next frame (sliders move many times a frame).
  drawRoomsSoon() {
    if (this.roomsFrame) return;
    this.roomsFrame = requestAnimationFrame(() => {
      this.roomsFrame = 0;
      for (const tile of this.grid.querySelectorAll('.create-tile')) {
        const r = room(this.world, tile.dataset.room);
        if (r) tile.style.setProperty('--square', squareLook(r, r.id === MESSY, this.prefs, this.palette).fill);
      }
    });
  }

  // The grid cell under a point, or null.
  cellAt(x, y) {
    const box = this.grid.getBoundingClientRect();
    const step = parseFloat(this.grid.style.getPropertyValue('--cell')) + GRID.gap;
    const col = Math.floor((x - box.left) / step), row = Math.floor((y - box.top) / step);
    return col >= 0 && row >= 0 && col < this.cols ? { col, row } : null;
  }

  // What is under a point while a square is dragged: a page number, or the Archive.
  dropAt(x, y) {
    const n = document.elementFromPoint(x, y);
    const page = n?.closest?.('[data-page]');
    if (page) return { page: +page.dataset.page, el: page };
    const shelf = n?.closest?.('[data-drop="archive"]');
    if (shelf) return { archive: true, el: shelf };
    return null;
  }

  // Pressing a square chooses it, twice goes in, a long press opens its properties; dragging it
  // moves it to the cell it is let go over, if that is free (a room dropped on another snaps
  // back), or onto a page number or Archive.
  onTileDown(e, r, tile) {
    if (e.button || e.target.closest('input, textarea, select')) return;
    if (e.ctrlKey && MAC) return; // a Mac's Ctrl+click is a right-click (oncontextmenu)
    const start = { x: e.clientX, y: e.clientY };
    const grab = this.cellAt(e.clientX, e.clientY);
    const offset = grab ? { col: grab.col - r.col, row: grab.row - r.row } : { col: 0, row: 0 };
    let dragging = false, target = null, over = null;
    this.held = null;
    // A long press (touch, or a pen) opens the properties, as a right-click does.
    const hold = e.pointerType !== 'mouse' && setTimeout(() => { this.held = r.id; finish(); this.chooseRoom(r.id, true); }, HOLD);
    const spot = (ev) => {
      const at = this.cellAt(ev.clientX, ev.clientY);
      return at && { col: at.col - offset.col, row: at.row - offset.row };
    };
    // Where it would land: a shadow the room's own size (2 × 2 for a big room), faint if taken.
    const drop = el('div', { class: 'create-drop', hidden: true });
    this.grid.append(drop);
    const mark = (c) => {
      if (!c) { drop.hidden = true; return; }
      const size = r.size || 1;
      const free = c.col >= 0 && c.row >= 0 && c.col + size <= this.cols &&
        cells({ ...r, col: c.col, row: c.row }).every(([cc, rr]) => !roomAt(this.world, cc, rr, r.id, this.page));
      drop.hidden = false;
      drop.classList.toggle('taken', !free);
      drop.style.gridColumn = `${c.col + 1} / span ${size}`;
      drop.style.gridRow = `${c.row + 1} / span ${size}`;
    };
    const lit = (n) => {
      for (const x of this.root.querySelectorAll('.drop-on')) if (x !== n) x.classList.remove('drop-on');
      n?.classList.add('drop-on');
    };
    const moveFn = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 5) return;
      clearTimeout(hold);
      if (r.locked || r.archived) return; // a locked room keeps its place; an archived one has none
      if (!dragging) { dragging = true; tile.classList.add('dragging'); this.grid.classList.add('dragging'); this.roomSel = null; }
      tile.style.transform = `translate(${dx}px, ${dy}px)`;
      over = this.dropAt(ev.clientX, ev.clientY);
      if (over?.page === (r.page || 0)) over = null; // already on that page
      if ((over?.archive || over?.page != null) && r.id === MESSY) over = null; // Messy stays where it is
      lit(over?.el);
      target = over ? null : spot(ev);
      mark(target);
    };
    const finish = () => {
      clearTimeout(hold);
      window.removeEventListener('pointermove', moveFn);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      mark(null);
      drop.remove();
      lit(null);
      tile.classList.remove('dragging');
      this.grid.classList.remove('dragging');
    };
    const up = (ev) => {
      finish();
      if (!dragging) {
        if (ev.type !== 'pointerup' || this.renaming || this.held) return;
        const now = Date.now();
        const twice = this.lastTap?.id === r.id && now - this.lastTap.at < 380;
        this.lastTap = { id: r.id, at: now };
        if (twice) this.openRoom(r.id);
        else this.pickRoom(r.id);
        return;
      }
      tile.style.transform = '';
      const cols = this.cols || this.gridSize().cols;
      if (over?.page != null) {
        if (toPage(this.world, r.id, over.page, cols)) { this.save(); this.toast(`${r.name} is on page ${over.page + 1}.`); }
      } else if (over?.archive) {
        if (archive(this.world, r.id)) { this.save(); this.toast(`${r.name} is in the Archive.`); }
      } else if (target && placeRoom(this.world, r.id, target.col, target.row, this.cols)) this.save();
      this.drawRooms();
    };
    window.addEventListener('pointermove', moveFn);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // A new room of a kind (its mode), in the cell asked for (or the first free one), with
  // its name ready to write.
  newRoom(cell = null, kind = DEFAULT_MODE) {
    const r = addRoom(this.world, 'Untitled', Date.now(), cell, this.cols || this.gridSize().cols, { page: this.page }, kind);
    if (r) seedRoomSettings(this.world, r.id, this.ontPrefs);
    this.making = null;
    if (!r) { this.toast('A room can\'t be made here.'); this.drawRooms(); return; }
    this.save();
    this.renaming = r.id;
    this.roomPick = r.id;
    this.drawRooms();
    this.grid.querySelector('.create-name-field')?.select();
  }

  // An input for a room's name: Enter or leaving it keeps the name, Escape keeps the old one.
  nameField(r, done) {
    let finished = false;
    const finish = (keep) => {
      if (finished) return;
      finished = true;
      if (keep) { name(this.world, r.id, field.value); this.save(); }
      done();
    };
    const field = el('input', {
      class: 'create-name-field', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      },
      onblur: () => finish(true),
    });
    return field;
  }

  // ---- A room ----

  // The ontologies there are (ontologies/index.js), and the one a room is seen through: a room
  // whose ontology is missing (its feature switched off, say) is seen through Pessoa.
  get ontologies() {
    return gather(this.slot('create.ontologies').items, (o, lacks) => console.warn('Create: an ontology was skipped; it lacks', lacks.join(', '), o));
  }
  ontology(id) {
    const all = this.ontologies;
    return all.find((o) => o.id === id) || all.find((o) => o.id === FALLBACK);
  }
  get mode() { return this.ontology(view(this.world, this.roomId).mode).id; }
  get ont() { return this.ontology(this.mode); }
  get el() { return el; } // for an ontology drawing its canvas (ontologies/index.js)

  lookOf(r) { return roomLook(r, this.palette, r.id === MESSY, this.prefs); }

  // The rooms page's colours, from the picture's (read when Create opened) and Settings → Rooms.
  paintPage() {
    this.page = pageLook(this.colours, this.prefs, this.palette);
    this.root.style.setProperty('--create-top', this.page.top);
    this.root.style.setProperty('--create-bottom', this.page.bottom);
    this.root.style.setProperty('--create-mask', this.page.mask);
    // A lit room's glow: the palette's glow, lightened toward white.
    const glow = rgb(this.palette.glow) || [239, 204, 131];
    const lift = (t, a) => `rgb(${glow.map((v) => Math.round(v + (255 - v) * t)).join(' ')} / ${a.toFixed(3)})`;
    this.root.style.setProperty('--create-glow', lift(0.55, this.prefs.glow));
    this.root.style.setProperty('--create-glow-in', lift(0.7, this.prefs.glow * 0.64));
  }

  // ---- Settings → Rooms ----

  setPref(key, value) {
    this.prefs = lookPrefs({ ...this.prefs, [key]: value });
    this.storage.set('look', savedLook(this.prefs));
    this.repaint();
  }

  // ---- Ontology settings: global ones here, each room's own in its rail ----

  // An ontology's settings, and the one every ontology has (clear space's overlap).
  settingsOf(o) { return [...(o?.settings || []), OVERLAP]; }

  globalSetting(of, st) { const v = this.ontPrefs[of]?.[st.key]; return v !== undefined ? v : st.default; }

  setOntPref(of, key, value) {
    (this.ontPrefs[of] ||= {})[key] = value;
    this.storage.set('ontologies', this.ontPrefs);
  }

  // Every room takes the global settings.
  applyToAllRooms() {
    applySettingsToAll(this.world, this.ontPrefs);
    this.storage.set(WORLD, this.world);
    this.toast('Every room now has the global settings.');
    this.repaint();
  }

  // The open room's value of one of its ontology's settings (an ontology reads it as c.setting(key)).
  setting(key, ont = this.ont) {
    const st = this.settingsOf(ont).find((x) => x.key === key);
    return st ? roomSetting(this.world, this.roomId, ont.id, st, this.ontPrefs) : undefined;
  }

  // One setting as a row: a slider, or an on/off switch (type: 'switch').
  settingRow(st, value, onChange) {
    if (st.type === 'switch') {
      return el('label', { class: 'renderer-slider create-switch-row' }, el('span', {}, st.label), el('span'),
        ui.toggle({ checked: !!value, label: st.label, onChange }));
    }
    const out = el('output', { class: 'renderer-value' }, String(value));
    return el('label', { class: 'renderer-slider' }, el('span', {}, st.label), out,
      el('input', { type: 'range', min: st.min, max: st.max, step: st.step ?? 0.01, value, 'aria-label': st.label,
        oninput: (e) => { out.textContent = e.target.value; onChange(+e.target.value); } }));
  }

  // A plain new room (Move to… → a new room), starting from the global settings.
  addPlainRoom() {
    const r = addRoom(this.world, 'Untitled', Date.now(), null, this.cols || 6);
    seedRoomSettings(this.world, r.id, this.ontPrefs);
    return r.id;
  }

  // Shows a change straight away, if Create is open.
  repaint() {
    this.paintPage();
    if (this.root.hidden) return;
    if (this.roomId) this.paintRoom();
    else this.drawRooms();
  }

  // Settings → Rooms, in two folds. The colours come from Settings → Colour, and each room's own
  // colour from its pop-up on the rooms page.
  settingsPane() {
    const p = this.prefs;
    const slider = (label, key, min, max, step = 0.01) => {
      const out = el('output', { class: 'renderer-value' }, String(p[key]));
      return el('label', { class: 'renderer-slider' }, el('span', {}, label), out,
        el('input', { type: 'range', min, max, step, value: p[key], 'aria-label': label,
          oninput: (e) => { out.textContent = e.target.value; this.setPref(key, +e.target.value); } }));
    };
    const fold = (title, ...rows) => el('details', { class: 'advanced renderer-fold' }, el('summary', {}, title),
      el('div', { class: 'renderer-fold-body' }, el('div', { class: 'renderer-sliders' }, ...rows)));
    return el('div', { class: 'create-settings' },
      fold('The rooms page',
        slider('Mask opacity', 'mask', 0, 0.6),
        slider('Square strength', 'square', 0, 1.5),
        slider('Colour strength', 'vivid', 0.5, 3),
        slider('Glow', 'glow', 0, 1),
        slider('Size', 'cell', 70, 180, 1),
        slider('Columns at least', 'cols', 0, 30, 1),
        slider('Rows at least', 'rows', 0, 30, 1),
        // A square's last thoughts: shown when it is hovered over, or always.
        el('label', { class: 'renderer-slider' }, el('span', {}, 'Peek'), el('span'),
          el('select', { 'aria-label': 'Peek', onchange: (e) => this.setPref('peek', +e.target.value) },
            el('option', { value: 0, ...(p.peek < 0.5 ? { selected: '' } : {}) }, 'When hovered over'),
            el('option', { value: 1, ...(p.peek >= 0.5 ? { selected: '' } : {}) }, 'Always')))),
      fold('Inside a room',
        slider('Lightness', 'light', 0.05, 0.98),
        slider('Messy lightness', 'lightMessy', 0.05, 0.98),
        // Each ontology's own settings (Joyce: its line's tension): the global ones, which a new
        // room starts from. Each room keeps its own (the ⚙ beside the mode in its rail).
        ...this.ontologies.flatMap((o) => [
          el('p', { class: 'create-settings-ont' }, o.name),
          ...this.settingsOf(o).map((st) => this.settingRow(st, this.globalSetting(o.id, st), (v) => this.setOntPref(o.id, st.key, v)))]),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.applyToAllRooms() }, 'Apply to all rooms')),
      ui.hint('A room\'s own colour is in its pop-up on the rooms page: click its square.', { small: true }),
      el('button', { type: 'button', class: 'btn small', onclick: () => {
        this.prefs = lookPrefs(LOOK);
        this.storage.set('look', savedLook(this.prefs));
        this.ontPrefs = {};
        this.storage.set('ontologies', this.ontPrefs);
        this.repaint();
        this.app.shell?.refreshSettings?.();
      } }, 'Back to defaults'));
  }

  // The open room's colours, on the room page (and the menu's lines take its ink).
  paintRoom() {
    const look = this.lookOf(room(this.world, this.roomId));
    for (const [k, v] of Object.entries({ '--room-top': look.top, '--room-bottom': look.bottom, '--room-ink': look.ink })) {
      this.roomPage.style.setProperty(k, v);
      this.root.style.setProperty(k, v);
    }
    this.roomPage.classList.toggle('dark', look.dark);
    document.documentElement.classList.toggle('create-dark', look.dark);
    return look;
  }

  drawRoom() {
    const r = room(this.world, this.roomId);
    this.paintRoom();
    if (this.renaming === r.id) {
      this.crumbName.replaceChildren(this.nameField(r, () => { this.renaming = null; this.drawRoom(); }));
      this.crumbName.querySelector('input').focus();
    } else this.crumbName.replaceChildren(r.name);
    this.crumbDesc.textContent = r.desc || '';
    this.crumbDesc.hidden = !r.desc;
    this.roomPage.classList.toggle('locked', !!this.locked);
    const v = view(this.world, this.roomId);
    // The rail, where the rooms page has Rooms and Archive: a big room (Messy, or 2 × 2) lists the
    // ontologies and switches between them; a small one shows its one. Hovering over a mode shows a
    // small ⚙ beside it, which opens this room's settings for it. Under a hairline, Timeline.
    const big = isBig(r);
    const items = [];
    for (const m of big ? this.ontologies : [this.ont]) {
      const on = m.id === this.mode;
      const word = big
        ? el('button', { type: 'button', class: 'create-rail-item', role: 'radio', 'aria-checked': String(on), 'aria-current': String(on),
          onclick: () => { if (on) this.toggleGear(m.id); else this.setMode(m.id); } }, m.name)
        : el('span', { class: 'create-rail-item create-rail-fixed', 'aria-current': 'true', title: 'A small room keeps one mode. Make it 2 × 2 to switch.',
          onclick: () => this.toggleGear(m.id) }, m.name);
      const gear = this.settingsOf(m).length ? el('button', {
        type: 'button', class: 'create-gear', 'aria-label': `${m.name} settings for this room`, title: 'Settings for this room',
        'aria-expanded': String(this.settingsFor === m.id), onclick: () => this.openRoomSettings(m.id),
      }, '⚙') : null;
      items.push(el('div', { class: 'create-rail-row' + (this.gearFor === m.id || this.settingsFor === m.id ? ' show' : '') }, word, gear));
    }
    items.push(el('div', { class: 'create-rail-rule', 'aria-hidden': 'true' }));
    items.push(el('button', {
      type: 'button', class: 'create-rail-item create-rail-view', 'aria-pressed': String(this.historyOpen),
      onclick: () => this.togglePanel(),
    }, 'Timeline'));
    const card = this.settingsFor && this.roomSettingsCard();
    if (card) items.push(card);
    this.modes.setAttribute('role', 'group');
    this.modes.replaceChildren(...items);
    this.root.dataset.mode = this.mode;
    this.root.classList.toggle('history-open', this.historyOpen);
    this.drawHistory();
    this.place();
    this.drawWorld();
  }

  renameOpenRoom() {
    if (this.renaming) return;
    this.renaming = this.roomId;
    this.drawRoom();
  }

  // The room's Timeline, down the right: a view of its thoughts in time, in any mode.
  get historyOpen() { return !!this.roomId && !!view(this.world, this.roomId).timeline; }

  togglePanel() {
    const v = view(this.world, this.roomId);
    v.timeline = !v.timeline;
    this.save();
    this.drawRoom();
  }

  // Touch has no hover: tapping the current mode shows its ⚙ (and tapping again hides it).
  toggleGear(id) {
    this.gearFor = this.gearFor === id ? null : id;
    this.drawRoom();
  }

  openRoomSettings(id) {
    this.settingsFor = this.settingsFor === id ? null : id;
    this.gearFor = null;
    this.drawRoom();
  }

  // This room's settings for one ontology, in a card beside the rail, with Reset to global.
  roomSettingsCard() {
    const o = this.ontologies.find((x) => x.id === this.settingsFor);
    if (!o) return null;
    const close = () => { this.settingsFor = null; this.drawRoom(); };
    return el('div', { class: 'create-options create-room-settings', role: 'dialog', 'aria-label': `${o.name} settings for this room`,
      onpointerdown: (e) => e.stopPropagation(), onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } } },
      el('div', { class: 'create-room-settings-head' },
        el('span', {}, o.name),
        el('button', { type: 'button', class: 'create-history-close', 'aria-label': 'Close', onclick: close }, '×')),
      el('p', { class: 'create-room-settings-note' }, 'For this room only'),
      ...this.settingsOf(o).map((st) => this.settingRow(st, this.setting(st.key, o), (v) => {
        setRoomSetting(this.world, this.roomId, o.id, st.key, v);
        this.storage.set(WORLD, this.world);
        this.drawWorld();
      })),
      el('button', { type: 'button', class: 'create-word create-room-settings-reset', onclick: () => {
        resetRoomSettings(this.world, this.roomId, o.id);
        this.storage.set(WORLD, this.world);
        this.drawRoom();
      } }, 'Reset to global'));
  }

  // Only a big room switches its mode.
  setMode(id) {
    if (!isBig(room(this.world, this.roomId))) return;
    const v = view(this.world, this.roomId);
    v.mode = id;
    this.sel = null;
    this.gearFor = null;
    if (this.settingsFor) this.settingsFor = id;
    this.save();
    this.drawRoom();
  }

  // The world's transform: the view's x, y (world units) sit at the middle of the screen.
  place() {
    const v = view(this.world, this.roomId);
    const { width, height } = this.stage.getBoundingClientRect();
    this.world$.style.transform = `translate(${width / 2 - v.x * v.zoom}px, ${height / 2 - v.y * v.zoom}px) scale(${v.zoom})`;
    this.positionEdit?.();
  }

  toWorld(clientX, clientY) {
    const v = view(this.world, this.roomId);
    const b = this.stage.getBoundingClientRect();
    return { x: v.x + (clientX - b.left - b.width / 2) / v.zoom, y: v.y + (clientY - b.top - b.height / 2) / v.zoom };
  }

  // What's on the screen, in world units, less a margin all round.
  visibleBox(margin = 0.18) {
    const v = view(this.world, this.roomId);
    const { width, height } = this.stage.getBoundingClientRect();
    const w = width / v.zoom, h = height / v.zoom;
    return { x: v.x - w / 2 + w * margin, y: v.y - h / 2 + h * margin, w: w * (1 - 2 * margin) * 0.75, h: h * (1 - 2 * margin) };
  }

  drawWorld() {
    if (!this.roomId) return;
    const w = this.world;
    const nodes = [];
    this.draftEl = null;
    if (this.ont.draw) nodes.push(...this.ont.draw(this));
    else {
      // An ontology without a canvas of its own    } else {
      // Any other ontology: its units, each where it says.
      const ont = this.ont;
      for (const th of ont.units(w, this.roomId)) {
        const p = ont.point(w, this.roomId, th.id) || { x: 0, y: 0 };
        nodes.push(el('div', {
          class: 'create-float' + (this.isSel(th.id) ? ' selected' : '') + (this.found === th.id ? ' found' : ''),
          'data-thought': th.id,
          style: `left:${p.x}px;top:${p.y}px`,
        }, this.thoughtNode(th)));
      }
      if (this.draft && !this.draft.edit) {
        const p = ont.draftPoint?.(w, this.roomId) || (this.draft.train ? null : this.draft) || this.freeSpot();
        nodes.push(el('div', { class: 'create-float', style: `left:${p.x}px;top:${p.y}px` }, this.draftNode()));
      }
    }
    this.world$.replaceChildren(...nodes);
    this.drawBar();
    this.drawTray();
    this.clearSoon();
  }

  // ---- Clear space (clear.js): after any change, what overlaps is pushed apart ----

  clearSoon() {
    if (this.clearFrame) return;
    this.clearFrame = requestAnimationFrame(() => { this.clearFrame = 0; this.clearRoom(); });
  }

  // Measures each block on the canvas (world units) and moves the ones that overlap. What was
  // placed by hand is left out (it can be overlapped) or stays put while the rest moves around it,
  // as the room's 'overlap' setting says. The thought being written stays where it is.
  clearRoom(depth = 0) {
    if (!this.roomId || this.root.hidden || this.locked || this.gesture?.moved || this.roomPage.hidden) return;
    const w = this.world, ont = this.ont, roomId = this.roomId;
    // The ontology hears each thought's real size first (Joyce steps its trains by them).
    if (ont.measured && depth < 3) {
      const sizes = new Map([...this.drawnRects()].filter(([id]) => w.things[id]));
      if (ont.measured(sizes)) {
        this.drawWorld();
        cancelAnimationFrame(this.clearFrame);
        this.clearFrame = 0;
        this.clearRoom(depth + 1);
        return;
      }
    }
    const overlap = this.setting('overlap') !== false;
    const blocks = ont.blocks ? ont.blocks(w, roomId) : ont.units(w, roomId).map((u) => ({ id: u.id, thoughts: [u.id], hand: false, at: u.at ?? 0 }));
    const nodes = new Map();
    for (const n of this.world$.querySelectorAll('[data-thought]')) nodes.set(n.dataset.thought, n);
    const editing = this.draft?.edit || null;
    const measured = [];
    const origin = this.world$.getBoundingClientRect(), zoom = view(w, roomId).zoom || 1;
    for (const b of blocks) {
      if (b.hand && overlap) continue;
      const els = b.thoughts.map((id) => nodes.get(id)).filter(Boolean);
      if (b.tail && b.group) els.push(...this.world$.querySelectorAll(`div[data-group="${b.group}"]:not([data-thought])`));
      if (!els.length) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const n of els) { // on the screen, then in world units (a thought may be centred by a transform)
        const r = n.getBoundingClientRect();
        x0 = Math.min(x0, (r.left - origin.left) / zoom); y0 = Math.min(y0, (r.top - origin.top) / zoom);
        x1 = Math.max(x1, (r.right - origin.left) / zoom); y1 = Math.max(y1, (r.bottom - origin.top) / zoom);
      }
      const writing = (b.tail && this.draft?.train && this.draft.train === b.group && !this.draft.edit)
        || (editing && (b.thoughts.includes(editing) || b.id === editing));
      measured.push({ id: b.id, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, fixed: !!b.hand || !!writing, at: b.at });
    }
    const moves = clearSpace(measured);
    const ids = Object.keys(moves);
    if (!ids.length) return;
    const saved = this.snap() === this.lastSnap; // nothing waiting to be saved as its own step
    for (const id of ids) {
      const { dx, dy } = moves[id];
      if (ont.shift) ont.shift(w, roomId, id, dx, dy);
      else {
        const p = ont.point(w, roomId, id);
        if (p) ont.drop(w, roomId, id, p.x + dx, p.y + dy);
      }
    }
    // The push belongs to the change that caused it: Ctrl+Z takes both back together.
    if (saved) this.lastSnap = this.snap();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.storage.set(WORLD, this.world); }, 250);
    // Redrawn at once (a second pass may find what the first push made overlap).
    this.drawWorld();
    cancelAnimationFrame(this.clearFrame);
    this.clearFrame = 0;
    if (depth < 2) this.clearRoom(depth + 1);
  }

  // The Timeline down the right: everything written in the room, in the order it was last changed
  // (latest at the bottom), each with its time and, where the mode groups thoughts, its group as a
  // tag (Joyce: its train). A click takes the view to it.
  drawHistory() {
    if (!this.historyOpen) { this.history.hidden = true; return; }
    const w = this.world, ont = this.ont;
    const changed = (th) => Math.max(th.at ?? 0, th.edited ?? 0);
    const items = roomThoughts(w, this.roomId).slice().sort((a, b) => changed(a) - changed(b) || a.at - b.at);
    const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const list = items.length ? el('ol', { class: 'create-history-list' }, items.map((th) => {
      const tag = ont.tag?.(w, th.id) || null;
      return el('li', {}, el('button', {
        type: 'button', class: 'create-history-item' + (this.sel?.id === th.id || (tag && this.sel?.id === tag.id) ? ' on' : ''),
        style: tag ? `--tag:hsl(${hash(tag.id) % 360} 32% 46%)` : '',
        onclick: () => this.goTo({ id: th.id, kind: kindOf(th), room: this.roomId }),
      },
        el('span', { class: 'create-history-meta' },
          el('span', { class: 'create-history-time' }, when(changed(th))),
          tag ? el('span', { class: 'create-tag' }, tag.name) : null),
        el('span', { class: 'create-history-text' }, thoughtText(w, th))));
    })) : null;
    this.history.hidden = false;
    this.history.replaceChildren(
      el('div', { class: 'create-history-head' },
        el('span', {}, 'Timeline'),
        el('button', { type: 'button', class: 'create-history-close', 'aria-label': 'Close Timeline', onclick: () => this.togglePanel() }, '×')),
      list || el('p', { class: 'create-history-none' }, 'Nothing written here yet'));
    list?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  // One thought, drawn by its kind.
  thoughtNode(th) {
    if (this.draft?.edit === th.id) return this.draftNode(); // a thought opened again to write in
    const kind = kindOf(th);
    if (kind === 'group') { // a folded group reads as one passage
      const body = thoughtText(this.world, th);
      return el('div', { class: 'create-passage folded', 'data-id': th.id },
        th.title ? el('div', { class: 'create-passage-title' }, maths(th.title)) : null,
        body ? el('div', { class: 'create-passage-body' }, maths(body)) : null);
    }
    return (ITEMS[kind] || ITEMS.line).node(th, el);
  }

  draftNode() {
    this.draftEl = el('span', { class: 'create-thought create-draft' });
    this.paintDraft();
    return this.draftEl;
  }

  // Draws the thought being written from the hidden box: its words, the selection, and the caret
  // where the selection's moving end is.
  paintDraft() {
    const d = this.draftEl;
    if (!d) return;
    const v = this.input.value;
    const a = this.input.selectionStart ?? v.length, b = this.input.selectionEnd ?? v.length;
    const back = this.input.selectionDirection === 'backward';
    const caret = document.activeElement === this.input || !d.isConnected ? el('span', { class: 'create-caret', 'aria-hidden': 'true' }) : null;
    const parts = a === b
      ? [v.slice(0, a), caret, v.slice(a)]
      : [v.slice(0, a), back ? caret : null, el('span', { class: 'create-chosen' }, v.slice(a, b)), back ? null : caret, v.slice(b)];
    // An empty thought, or one ending in a new line, still has a line for the caret to stand on.
    if (!v || v.endsWith('\n')) parts.push(el('span', { class: 'create-pad', 'aria-hidden': 'true' }, '\u200b'));
    d.replaceChildren(...parts.filter((p) => p != null && p !== '').map((p) => (p instanceof Node ? p : document.createTextNode(p))));
  }

  // Where each letter of the thought being written is on the screen (measured, not guessed).
  letterBoxes() {
    const out = [];
    let i = 0;
    const range = document.createRange();
    for (const n of this.draftEl?.childNodes || []) {
      if (n.classList?.contains('create-pad')) { out.push({ i, r: n.getBoundingClientRect(), end: true }); continue; }
      const t = n.nodeType === 3 ? n : n.classList?.contains('create-chosen') ? n.firstChild : null;
      if (!t) continue;
      for (let k = 0; k < t.length; k++) {
        range.setStart(t, k);
        range.setEnd(t, k + 1);
        const rs = range.getClientRects();
        const r = rs[rs.length - 1];
        if (r && (r.width || r.height)) out.push({ i: i + k, r, nl: t.data[k] === '\n' });
      }
      i += t.length;
    }
    return out;
  }

  // The place in the thought being written nearest a point on the screen.
  offsetAt(x, y) {
    const len = this.input.value.length;
    const boxes = this.letterBoxes();
    if (!boxes.length) return len;
    const gap = (r) => (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0);
    const near = boxes.reduce((m, b) => (gap(b.r) < gap(m.r) ? b : m));
    const mid = (near.r.top + near.r.bottom) / 2, half = (near.r.bottom - near.r.top) / 2 || 8;
    const line = boxes.filter((b) => Math.abs((b.r.top + b.r.bottom) / 2 - mid) < half);
    for (const b of line) if (b.end || b.nl || x < (b.r.left + b.r.right) / 2) return b.i;
    return line[line.length - 1].i + 1;
  }

  // Chooses letters in the thought being written: from `anchor` to `focus` (the caret's end).
  selectText(anchor, focus = anchor) {
    this.input.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? 'backward' : 'forward');
    this.input.focus({ preventScroll: true });
    this.paintDraft();
  }

  // The word (or run of spaces, or one sign) at a place in the text.
  static wordAround(v, i) {
    const word = (c) => !!c && /[\p{L}\p{N}_'’]/u.test(c);
    const space = (c) => !!c && c !== '\n' && /\s/.test(c);
    let a = i, b = i;
    const kind = word(v[i]) || word(v[i - 1]) ? word : space(v[i]) || space(v[i - 1]) ? space : null;
    if (!kind) return [i, Math.min(v.length, i + 1)];
    while (kind(v[a - 1])) a--;
    while (kind(v[b])) b++;
    return [a, b];
  }

  // Puts letters in the hidden box as if typed, so Ctrl+Z inside the thought can take them back.
  typeIn(text) {
    const box = this.input;
    box.focus({ preventScroll: true });
    if (!document.execCommand?.('insertText', false, text)) {
      box.setRangeText(text, box.selectionStart, box.selectionEnd, 'end');
      this.onInput();
    }
  }

  // ---- Writing ----

  onKey(e) {
    if (this.root.hidden || document.querySelector('dialog[open]')) return;
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    this.hintLine.classList.remove('on');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); if (this.roomId) this.openSearch(); else this.openLights(); return; }
    if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !this.editing) {
      e.preventDefault();
      this.undo(e.key.toLowerCase() === 'z' && !e.shiftKey);
      return;
    }
    if (e.key === 'Escape') {
      if (!this.addMenu.hidden) this.closeAdd();
      else if (this.roomId && this.sel && this.barFor) { this.barFor = null; this.drawBar(); }
      else if (this.sel) { this.sel = null; this.drawWorld(); }
      else if (!this.roomId && (this.roomSel || this.making)) { this.roomSel = this.making = null; this.drawRooms(); }
      else if (!this.roomId && this.roomPick) { this.roomPick = null; this.drawRooms(); }
      else if (!this.roomId && this.lights != null) this.closeLights();
      else this.back();
      return;
    }
    if (this.editing) return;
    if (this.shortcut(e, mod)) return;
    if (this.roomId && e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && this.roomId) { this.fresh = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.('button') && e.key === ' ') return; // Space on a word presses it
    if (e.key === ' ' && !this.draft) return; // a lone Space is held to move around (Space+drag)
    e.preventDefault();
    if (!this.roomId) this.openRoom(MESSY);
    this.beginWriting(e.key);
  }

  // Starts a thought (if one isn't started), with `seed` as its first letters.
  beginWriting(seed = '') {
    if (!this.roomId) return;
    if (this.locked) { this.toast('This room is locked. Unlock it from its square to write here.'); return; }
    if (!this.draft) {
      this.draft = this.target();
      this.sel = null;
    }
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    if (seed) this.typeIn(seed);
    this.showDraft();
  }

  // Where a new train starts: a clear space on the screen, away from everything already drawn
  // (measured as drawn, so a long train counts all the way down).
  freeSpot() {
    const rects = [...this.drawnRects().values()];
    const NEW = { w: 340, h: 64 }; // room for a new thought's first line or two
    const p = clearSpot(this.visibleBox(), rects.map((r) => ({ ...r, x: r.x + 20 })), NEW);
    return { x: Math.round(p.x + 20), y: Math.round(p.y) }; // the thought's words start right of its knot
  }

  // Each drawn thought's box in world units (Map id → { x, y, w, h }): data-thought nodes, and a
  // group drawn as one (a folded train, or a thought being written in a train).
  drawnRects() {
    const out = new Map();
    const origin = this.world$.getBoundingClientRect(), zoom = view(this.world, this.roomId).zoom || 1;
    let k = 0;
    for (const n of this.world$.querySelectorAll('[data-thought], div[data-group]')) {
      const r = n.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      out.set(n.dataset.thought || `g${k++}`, { x: (r.left - origin.left) / zoom, y: (r.top - origin.top) / zoom, w: r.width / zoom, h: r.height / zoom });
    }
    return out;
  }

  onInput() {
    if (!this.draft) { this.beginWriting(); return; }
    this.paintDraft();
    this.showDraft();
  }

  onInputKey(e) {
    if (e.altKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
    }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    // Ctrl+Z undoes typing inside the thought; once it is empty, it undoes whole steps again.
    if (mod && !e.altKey && (k === 'z' || k === 'y') && !this.input.value) {
      e.preventDefault();
      if (this.draft?.edit) { this.draft = null; this.drawWorld(); return; } // let go of the thought opened again, unchanged
      this.stopWriting();
      this.undo(k === 'z' && !e.shiftKey);
      return;
    }
    // Backspace in an empty thought goes back into the end of the one before it, as a line joins.
    if (e.key === 'Backspace' && !e.altKey && !this.input.value) {
      const was = this.draft;
      if (!was && !this.fresh && !this.locked) this.draft = this.target(); // just after Enter: the next thought, not yet begun
      if (this.stepBack()) { e.preventDefault(); return; }
      this.draft = was;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commit();
      if (e.ctrlKey || e.metaKey) this.fresh = true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.stopWriting();
    }
  }

  commit() {
    const text = this.input.value;
    this.input.value = '';
    const d = this.draft;
    this.draft = null;
    if (d?.edit) { // a thought opened again: kept as it is now, or gone if it was emptied
      const th = this.world.things[d.edit];
      if (th && !text.trim()) remove(this.world, d.edit);
      else if (th && text !== th.text) update(this.world, d.edit, { text });
      if (this.world.things[d.train]) this.current[this.roomId] = d.train;
      this.save();
      this.drawWorld();
      return;
    }
    if (!d || !text.trim()) { this.drawWorld(); return; }
    this.keepNew(d, { kind: 'line', text });
    this.save();
    this.drawWorld();
  }

  // The ontology new thoughts are written into: the room's, or Joyce's trains when it makes no
  // groups of its own (Pessoa).
  get writer() { return this.ont.groups ? this.ont : this.ontology(DEFAULT_MODE); }

  // Keeps a new thought (fields) from draft d: into the group it goes on with, or one the writing
  // ontology begins (ontologies/index.js: begin), or loose in the room when it begins none. Returns
  // the thought, or null.
  keepNew(d, fields, now = Date.now()) {
    const w = this.world, wr = this.writer;
    let g = d.train && w.things[d.train];
    const made = !g;
    if (!g) g = wr.begin ? wr.begin(w, this.roomId, { x: d.x ?? 0, y: d.y ?? 0, for: d.for ?? null }, now) : startTrain(w, this.roomId, d.x ?? 0, d.y ?? 0, now);
    const th = create(w, g ? g.id : this.roomId, fields, now);
    if (!th && made && g && w.things[g.id]) remove(w, g.id);
    if (th && g && w.things[g.id]) this.current[this.roomId] = g.id;
    else if (th) delete this.current[this.roomId];
    return th;
  }

  // Starts writing a new thought at x, y (world units), with no group to go on with; for is kept
  // with it and handed to the writing ontology's begin (a move's own note: say, the chapter it is
  // a child of).
  write({ x, y, for: note = null } = {}) {
    if (!this.roomId || this.locked) return;
    if (this.draft) this.commit();
    this.sel = null;
    this.draft = { train: null, x: Math.round(x ?? 0), y: Math.round(y ?? 0), ...(note != null ? { for: note } : {}) };
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    this.showDraft();
  }

  // Backspace in an empty thought: opens the thought before it in its train, the caret at its end.
  // An emptied thought that was opened again goes first. Returns false when there is nothing before.
  stepBack() {
    const d = this.draft, w = this.world;
    if (!d?.train || !w.things[d.train]) return false;
    const list = trainThoughts(w, d.train);
    const at = d.edit ? list.findIndex((th) => th.id === d.edit) : list.length;
    const prev = list[at - 1];
    if (d.edit) {
      const t = w.things[d.train];
      const spot = { x: t.x ?? 0, y: t.y ?? 0 };
      remove(w, d.edit);
      this.save();
      this.draft = w.things[d.train] ? { train: d.train } : { train: null, ...spot };
    }
    if (prev && kindOf(prev) === 'line') {
      this.draft = { train: d.train, edit: prev.id };
      this.input.value = prev.text || '';
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    } else if (!d.edit) return false;
    this.drawWorld();
    this.showDraft();
    return true;
  }

  // Opens a thought already written to write in, on the canvas where it is, the caret at its end.
  // Only a line (a passage or a picture has its own sheet); not in a locked room.
  editThought(id) {
    const th = this.world.things[id];
    if (!th || kindOf(th) !== 'line' || this.locked) return false;
    if (this.draft) this.commit();
    this.sel = null;
    this.lastTap = null;
    this.draft = { train: groupOf(this.world, id, this.writer.id)?.id || null, edit: id };
    this.input.value = th.text || '';
    this.input.focus({ preventScroll: true });
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.drawWorld();
    this.showDraft();
    return true;
  }

  stopWriting() {
    if (this.draft) this.commit();
    this.input.blur();
  }

  // Keeps the thought being written on the screen, moving the view if it has gone off it.
  showDraft() {
    if (!this.draftEl?.isConnected) return;
    const r = this.draftEl.getBoundingClientRect();
    const b = this.stage.getBoundingClientRect();
    const pad = 60;
    let dx = 0, dy = 0;
    if (r.right > b.right - pad) dx = r.right - (b.right - pad);
    if (r.left < b.left + pad) dx = r.left - (b.left + pad);
    if (r.bottom > b.bottom - pad * 2) dy = r.bottom - (b.bottom - pad * 2);
    if (r.top < b.top + pad * 1.5) dy = r.top - (b.top + pad * 1.5);
    if (!dx && !dy) return;
    const v = view(this.world, this.roomId);
    v.x += dx / v.zoom;
    v.y += dy / v.zoom;
    this.place();
  }

  // ---- Moving around, and moving things ----

  // A right-click in a room: on a thought (or a train), its properties; on the empty canvas, Add
  // just there. A Mac's Ctrl+click is a right-click too, but Ctrl+drag moves around, so it waits
  // to see whether the pointer moves (onUp, or a moment later).
  onContext(e) {
    e.preventDefault();
    if (Date.now() - (this.heldAt || 0) < 900) return; // a long press opened it already; this is the browser's own
    if (e.ctrlKey && e.button === 0 && this.gesture?.kind === 'pan') {
      const g = this.gesture;
      g.ctx = { x: e.clientX, y: e.clientY, target: e.target };
      clearTimeout(this.ctxTimer);
      this.ctxTimer = setTimeout(() => { if (this.gesture === g && !g.moved) { this.gesture = null; this.contextAt(g.ctx); } }, 450);
      return;
    }
    this.contextAt({ x: e.clientX, y: e.clientY, target: e.target });
  }

  contextAt({ x, y, target }) {
    this.gesture = null;
    clearTimeout(this.ctxTimer);
    if (!this.roomId) return;
    const { groupEl, thoughtEl, hit } = this.hitAt(target);
    if (!hit) { this.openAddAt(x, y); return; }
    if (this.sel?.kind === 'many' && this.isSel(hit)) { this.openProps(this.sel); return; }
    this.openProps(this.picked(groupEl, thoughtEl));
  }

  // What is under the pointer on the canvas: a thought (data-thought) and the group it is drawn in
  // (data-group, when the ontology draws its groups, as Joyce does its trains).
  hitAt(target) {
    const groupEl = target.closest?.('[data-group]') || null;
    const thoughtEl = target.closest?.('[data-thought]') || null;
    return { groupEl, thoughtEl, hit: thoughtEl?.dataset.thought || groupEl?.dataset.group };
  }

  // What a tap there chooses: the whole group (from its line, a folded group, or a group already
  // chosen), or the one thought.
  picked(groupEl, thoughtEl) {
    const g = groupEl && this.world.things[groupEl.dataset.group];
    if (g && (!thoughtEl || g.folded || (this.sel?.kind === 'train' && this.sel.id === g.id))) return { kind: 'train', id: g.id };
    const id = thoughtEl?.dataset.thought;
    return id ? { kind: isLeaf(this.world.things[id]) ? 'thought' : 'train', id } : null;
  }

  // Add, unfolded at a point on the canvas: what is made goes there.
  openAddAt(x, y) {
    if (this.locked) return;
    if (this.draft) this.stopWriting();
    this.sel = null;
    this.drawWorld();
    this.addAt = this.toWorld(x, y);
    this.addMenu.hidden = false;
    this.addMenu.classList.add('at');
    this.addBtn.setAttribute('aria-expanded', 'true');
    const w = this.addMenu.offsetWidth || 300, h = this.addMenu.offsetHeight || 220;
    this.addMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`;
    this.addMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - h - 8))}px`;
    this.addMenu.querySelector('button')?.focus();
  }

  onDown(e) {
    const middle = e.button === 1;
    if (e.button !== 0 && !middle && e.pointerType === 'mouse') return;
    const pointers = (this.pointers ||= new Map());
    if (e.pointerType === 'mouse') pointers.clear(); // a mouse is one pointer: forget one whose release was lost (a Mac's Ctrl+click menu)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.stage.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { this.gesture = { kind: 'pinch', ...this.pinchState() }; return; }
    // In the thought being written: a click places the caret, a drag chooses letters, Shift extends.
    if (this.draftEl?.isConnected && e.target.closest?.('.create-draft') && !(e.ctrlKey || e.metaKey) && !middle && !this.spaceDown) {
      e.preventDefault();
      const at = this.offsetAt(e.clientX, e.clientY);
      const box = this.input;
      // Presses close together count up, as a word processor's do: two choose the word, three the thought.
      const now = Date.now(), last = this.lastPress;
      const count = last && now - last.at < 500 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 6 ? (last.count % 3) + 1 : 1;
      this.lastPress = { at: now, x: e.clientX, y: e.clientY, count };
      this.gesture = { kind: 'text', x0: e.clientX, y0: e.clientY, moved: false };
      this.listen(e);
      if (count === 2) { const [a, b] = Create.wordAround(box.value, at); this.gesture.anchor = a; this.selectText(a, b); return; }
      if (count === 3) { this.gesture.anchor = 0; this.selectText(0, box.value.length); return; }
      const anchor = e.shiftKey ? (box.selectionDirection === 'backward' ? box.selectionEnd : box.selectionStart) : at;
      this.gesture.anchor = anchor;
      this.selectText(anchor, at);
      return;
    }

    // The ontology's own presses (ontologies/index.js: press), such as Russell's arrows.
    if (!middle && !this.spaceDown && !(e.ctrlKey || e.metaKey) && this.ont.press?.(this, e)) {
      pointers.delete(e.pointerId);
      if (this.stage.hasPointerCapture?.(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
      return;
    }

    const v = view(this.world, this.roomId);
    const { groupEl, thoughtEl, hit: hitId } = this.hitAt(e.target);
    let thing = null;
    const pan = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
    if (e.ctrlKey || e.metaKey || middle || this.spaceDown) { // Ctrl+drag (or Space+drag, or the middle button) moves the canvas; a Ctrl+click toggles one
      e.preventDefault();
      this.gesture = { kind: 'pan', ...pan, ...((e.ctrlKey || e.metaKey) && !middle ? { toggle: true, pick: this.picked(groupEl, thoughtEl) } : {}) };
    }
    else if (this.sel?.kind === 'many' && hitId && this.isSel(hitId)) this.gesture = { kind: 'group', ...pan, from: this.groupSpots() };
    else if (!hitId && e.pointerType === 'mouse') this.gesture = { kind: 'box', ...pan }; // a drag on the empty canvas draws a selection box
    if (this.gesture) { this.listen(e); return; }
    const pick = this.picked(groupEl, thoughtEl);
    if (pick) {
      const p = this.ont.point(this.world, this.roomId, pick.id) || { x: 0, y: 0 };
      thing = { ...pick, x: p.x, y: p.y, ...(this.ont.live ? { live: true } : { placed: true }) };
    }
    if (this.locked && thing) thing.still = true; // a locked room: a tap still chooses it, a drag moves the view
    this.gesture = { kind: thing ? 'drag' : 'pan', thing, el: groupEl || thoughtEl, at: thoughtEl?.dataset.thought, add: e.shiftKey, x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
    // A long press (touch, or a pen) opens the properties, or Add on the empty canvas.
    if (e.pointerType !== 'mouse') {
      const g = this.gesture, at = { x: e.clientX, y: e.clientY, target: e.target };
      clearTimeout(this.ctxTimer);
      this.ctxTimer = setTimeout(() => { if (this.gesture === g && !g.moved && this.pointers.size === 1) { this.heldAt = Date.now(); this.contextAt(at); } }, HOLD);
    }
    this.listen(e);
  }

  listen() {
    const pointers = this.pointers;
    const move = (ev) => this.onMove(ev);
    const up = (ev) => {
      pointers.delete(ev.pointerId);
      if (pointers.size) { if (pointers.size === 1) this.gesture = null; return; }
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
      this.onUp();
    };
    if (pointers.size === 1) {
      this.stage.addEventListener('pointermove', move);
      this.stage.addEventListener('pointerup', up);
      this.stage.addEventListener('pointercancel', up);
    }
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    const v = view(this.world, this.roomId);
    return { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: v.zoom, mid: this.toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
  }

  onMove(e) {
    if (!this.pointers?.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (!g) return;
    const v = view(this.world, this.roomId);
    if (g.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (g.z0 * d) / g.d0, g.mid);
      return;
    }
    if (g.kind === 'text') { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) >= 3) this.selectText(g.anchor, this.offsetAt(e.clientX, e.clientY)); return; }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    if (g.kind === 'box') { this.drawBox(g, e); return; }
    if (g.kind === 'drag' && g.thing?.still) { g.kind = 'pan'; }
    if (g.kind === 'group') {
      if (this.locked) return;
      for (const [id, p] of Object.entries(g.from)) this.putAt(id, Math.round(p.x + dx / v.zoom), Math.round(p.y + dy / v.zoom));
      if (!this.liveFrame) this.liveFrame = requestAnimationFrame(() => { this.liveFrame = 0; this.drawWorld(); });
      return;
    }
    if (g.kind === 'pan') {
      v.x = g.vx - dx / v.zoom;
      v.y = g.vy - dy / v.zoom;
      this.place();
    } else if (g.thing.live) {
      // A live ontology (Joyce): the thought (or its whole group) moves, and its line follows it.
      const x = Math.round(g.thing.x + dx / v.zoom), y = Math.round(g.thing.y + dy / v.zoom);
      this.ont.drop(this.world, this.roomId, g.thing.id, x, y);
      if (!this.liveFrame) this.liveFrame = requestAnimationFrame(() => { this.liveFrame = 0; this.drawWorld(); });
    } else {
      const x = g.thing.x + dx / v.zoom, y = g.thing.y + dy / v.zoom;
      g.el.style.left = `${x}px`;
      g.el.style.top = `${y}px`;
      g.to = { x: Math.round(x), y: Math.round(y) };
    }
  }

  onUp() {
    const g = this.gesture;
    this.gesture = null;
    clearTimeout(this.ctxTimer);
    if (!g || g.kind === 'pinch') { this.save(); return; }
    if (g.ctx && !g.moved) { this.contextAt(g.ctx); return; } // a Mac's Ctrl+click
    if (g.toggle && !g.moved) { if (g.pick) this.chooseMore(g.pick, true); return; } // Ctrl+click (Cmd+click on a Mac): in or out of the choice
    if (g.add && g.thing && !g.moved) { this.chooseMore(g.thing); return; } // Shift+click: added to the choice
    if (g.kind === 'text') { this.input.focus({ preventScroll: true }); return; }
    if (g.kind === 'box') { this.endBox(g); return; }
    if (g.kind === 'group') {
      if (!g.moved) { this.sel = null; this.drawWorld(); return; }
      this.drawWorld();
      this.save();
      return;
    }
    if (!g.moved) {
      // A tap: on a thought (or a folded train, or a line) selects it; on empty space clears the
      // selection. Double-click selects a whole train (onDouble).
      const keep = this.sel?.kind === 'train' && g.thing?.kind === 'train' && this.sel.id === g.thing.id;
      this.sel = keep ? this.sel : g.thing ? { kind: g.thing.kind, id: g.thing.id } : null;
      // Two taps on the same group (the page is redrawn between them, so no dblclick comes).
      const train = g.el?.dataset.group;
      const now = Date.now();
      if (train && this.lastTap?.train === train && now - this.lastTap.at < 400) this.sel = { kind: 'train', id: train };
      // Three taps on the same thought open it to write in, just where it is.
      const n = g.at && this.lastTap?.thought === g.at && now - this.lastTap.at < 400 ? this.lastTap.n + 1 : 1;
      this.lastTap = train || g.at ? { train, thought: g.at, n, at: now } : null;
      if (n === 3 && this.editThought(g.at)) return;
      if (!g.thing && this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    if (g.thing?.live) { this.drawWorld(); this.save(); return; }
    if (g.thing && g.to) {
      if (g.thing.placed) this.ont.drop(this.world, this.roomId, g.thing.id, g.to.x, g.to.y);
      else Object.assign(this.world.things[g.thing.id], g.to);
    }
    this.save();
  }

  // ---- Keys: delete, choose all, nudge, and the list of them all (?) ----

  // The key that deletes what is chosen: Delete (on a Mac, which has none, Cmd+Backspace too).
  // A plain Backspace never does: it is for letters.
  deletes(e) { return e.key === 'Delete' || (MAC && e.metaKey && e.key === 'Backspace'); }

  // Returns true when the key was one of these, and was used.
  shortcut(e, mod) {
    const k = e.key;
    if (k === '?' && !mod) { e.preventDefault(); this.showKeys(); return true; }
    if (!this.roomId) {
      // A grid: Delete removes the chosen room (Ctrl+Z brings it back); Enter goes in; the
      // ContextMenu key (or Shift+F10) opens its properties.
      const id = this.roomSel || this.roomPick;
      const r = id && room(this.world, id);
      if (this.deletes(e) && r && r.id !== MESSY && !shut(this.world, r.id)) {
        e.preventDefault();
        remove(this.world, r.id);
        this.roomSel = this.roomPick = null;
        this.save();
        this.drawRooms();
        this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
        return true;
      }
      if (k === 'Enter' && r) { e.preventDefault(); this.openRoom(r.id); return true; }
      if ((k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) && r) { e.preventDefault(); this.chooseRoom(r.id, true); return true; }
      return false;
    }
    if ((k === 'Enter' && !mod && !e.shiftKey) || k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
      // In a room: Enter (or the ContextMenu key) opens the properties of what is chosen.
      if (!this.sel) return false;
      e.preventDefault();
      this.openProps(this.sel);
      return true;
    }
    if (mod && !e.altKey && k.toLowerCase() === 'a') { // choose everything in the room
      e.preventDefault();
      const ids = this.ont.units(this.world, this.roomId).map((th) => th.id);
      this.sel = ids.length > 1 ? { kind: 'many', ids } : ids.length ? { kind: 'thought', id: ids[0] } : null;
      this.drawWorld();
      return true;
    }
    if (!this.sel) return false;
    if (this.locked && (this.deletes(e) || k.startsWith('Arrow'))) { e.preventDefault(); this.toast('This room is locked.'); return true; }
    if (this.deletes(e)) {
      e.preventDefault();
      const ids = this.sel.ids || [this.sel.id];
      ids.forEach((id) => remove(this.world, id));
      this.sel = null;
      this.save();
      this.drawWorld();
      this.toast(`Deleted${ids.length > 1 ? ` ${ids.length}` : ''}. Ctrl+Z brings it back.`);
      return true;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[k] && !mod) { // nudge what is chosen; Shift for bigger steps
      e.preventDefault();
      const step = e.shiftKey ? 60 : 10;
      const ids = this.sel.ids || [this.sel.id];
      const from = this.groupSpots(ids);
      for (const [id, p] of Object.entries(from)) this.putAt(id, p.x + arrows[k][0] * step, p.y + arrows[k][1] * step);
      this.save();
      this.drawWorld();
      return true;
    }
    return false;
  }

  showKeys() {
    const rows = [
      ['Type anywhere', 'write a thought'], ['Enter', 'keep it, and go on with the train'], ['Ctrl+Enter', 'a new train'],
      ['Alt+P · Alt+I', 'a passage · a picture'], ['Click · double-click', 'choose a thought · its whole train'], ['Triple-click', 'write in a thought, where it is'],
      ['Right-click · Enter', 'the properties of what is chosen'], ['Right-click the canvas', 'Add, just there'],
      ['Drag the canvas', 'a box to choose many'], ['Ctrl+drag', 'move around'], ['Ctrl+A', 'choose everything'],
      ['Shift+click · Ctrl+click', 'add to the choice · in or out of it'], ['Ctrl+C · Ctrl+V', 'copy what is chosen · put a copy here'],
      ['Delete', 'delete what is chosen'], ['Backspace in an empty thought', 'back into the one before'],
      ['Arrows · Shift+arrows', 'nudge what is chosen'],
      [KEY, 'search every room'], ['Ctrl+Z · Ctrl+Shift+Z', 'undo · redo'], ['Escape', 'let go, or go back'], ['?', 'these keys'],
    ];
    this.searchBox.replaceChildren(el('div', { class: 'create-search-panel create-keys-panel' },
      el('div', { class: 'create-options-label' }, 'Keys'),
      el('dl', { class: 'create-keys-list' }, rows.flatMap(([a, b]) => [el('dt', {}, a), el('dd', {}, b)]))));
    this.searchBox.hidden = false;
    this.searchBox.onpointerdown = () => this.closeSearch();
    const close = (ev) => { ev.stopPropagation(); ev.preventDefault(); this.closeSearch(); document.removeEventListener('keydown', close, true); };
    document.addEventListener('keydown', close, true);
  }

  // ---- Choosing many: a box drawn on the empty canvas ----

  isSel(id) { return this.sel?.id === id || !!this.sel?.ids?.includes(id); }

  drawBox(g, e) {
    const b = this.stage.getBoundingClientRect();
    if (!this.box) { this.box = el('div', { class: 'create-box' }); this.stage.append(this.box); }
    const x = Math.min(g.x0, e.clientX) - b.left, y = Math.min(g.y0, e.clientY) - b.top;
    Object.assign(this.box.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(e.clientX - g.x0)}px`, height: `${Math.abs(e.clientY - g.y0)}px` });
    g.rect = { left: Math.min(g.x0, e.clientX), top: Math.min(g.y0, e.clientY), right: Math.max(g.x0, e.clientX), bottom: Math.max(g.y0, e.clientY) };
  }

  endBox(g) {
    this.box?.remove();
    this.box = null;
    if (!g.moved || !g.rect) { // a plain click on the canvas: nothing chosen
      this.sel = null;
      if (this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    const r = g.rect;
    const ids = new Set();
    for (const n of this.world$.querySelectorAll('[data-thought], .create-folded[data-group]')) {
      const q = n.getBoundingClientRect();
      if (q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom) continue;
      ids.add(n.dataset.thought || n.dataset.group);
    }
    this.sel = this.selOf([...ids]);
    this.drawWorld();
  }

  // The choice for a list of ids: nothing, one thought or train, or many.
  selOf(ids) {
    if (!ids.length) return null;
    if (ids.length > 1) return { kind: 'many', ids };
    return { kind: isGroup(this.world.things[ids[0]]) ? 'train' : 'thought', id: ids[0] };
  }

  // Adds a thought (or a train) to what is chosen; `toggle` takes it out again if it is in.
  chooseMore(pick, toggle = false) {
    const ids = this.sel ? [...(this.sel.ids || [this.sel.id])] : [];
    const i = ids.indexOf(pick.id);
    if (i < 0) ids.push(pick.id);
    else if (toggle) ids.splice(i, 1);
    this.sel = this.selOf(ids);
    this.barFor = null;
    this.drawWorld();
  }

  // ---- Copying thoughts: Ctrl+C keeps what is chosen, Ctrl+V puts copies in this room (or another) ----

  // The chosen thoughts and trains, as copies to make: their fields, and where each sat.
  copyOf(ids) {
    const w = this.world, out = [];
    const fields = (th) => { const { id, parent, at, edited, members, ...f } = th; return f; };
    for (const id of ids) {
      const th = w.things[id];
      if (!th) continue;
      const train = isGroup(th) ? th : null;
      if (!train && ids.some((o) => o !== id && isGroup(w.things[o]) && w.things[o].members?.includes(id))) continue; // its train is copied whole
      if (train && train.of !== 'joyce') continue;
      if (!train && !isLeaf(th)) continue;
      const p = this.ont.point(w, this.roomId, id) || { x: train?.x ?? 0, y: train?.y ?? 0 };
      out.push(train
        ? { x: p.x, y: p.y, title: train.title || '', folded: !!train.folded, keep: !!train.keep, items: trainThoughts(w, id).map(fields) }
        : { x: p.x, y: p.y, items: [fields(th)] });
    }
    return out;
  }

  onCopy(e) {
    if (this.root.hidden || !this.roomId || !this.sel || this.editing) return;
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const units = this.copyOf(this.sel.ids || [this.sel.id]);
    if (!units.length) return;
    const text = units.map((u) => u.items.map((f) => thoughtText(this.world, f)).join('\n')).join('\n\n');
    this.clip = { units, text };
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    this.toast(`Copied${units.length > 1 ? ` ${units.length}` : ''}. Ctrl+V puts a copy in any room.`);
  }

  // Puts copies of the copied thoughts in the open room, around a free spot, as they sat, and chooses them.
  pasteThoughts() {
    if (this.locked) { this.toast('This room is locked.'); return; }
    if (this.draft) this.stopWriting();
    const w = this.world, units = this.clip.units;
    const cx = units.reduce((a, u) => a + u.x, 0) / units.length, cy = units.reduce((a, u) => a + u.y, 0) / units.length;
    const spot = this.freeSpot();
    let now = Date.now();
    const made = [];
    for (const u of units) {
      const train = startTrain(w, this.roomId, Math.round(spot.x + u.x - cx), Math.round(spot.y + u.y - cy), now);
      if (!train) continue;
      const items = u.items.map((f) => create(w, train.id, f, now++)).filter(Boolean);
      if (!items.length) { remove(w, train.id); continue; }
      if (u.title) train.title = u.title;
      if (u.folded) train.folded = true;
      if (u.keep) train.keep = true;
      made.push(u.items.length === 1 && !u.title ? items[0].id : train.id);
    }
    if (!made.length) return;
    this.sel = this.selOf(made);
    this.save();
    this.drawWorld();
  }

  // Where each chosen thing is now (world units), to move them together.
  groupSpots(ids = this.sel.ids) {
    const out = {};
    for (const id of ids) {
      if (!this.world.things[id]) continue;
      const p = this.ont.point(this.world, this.roomId, id);
      if (p) out[id] = p;
    }
    return out;
  }

  putAt(id, x, y) {
    if (this.world.things[id]) this.ont.drop(this.world, this.roomId, id, x, y);
  }

  // Double-click: where an ontology draws its groups (Joyce's trains), chooses the whole group
  // (then drag it from any of its thoughts or its line); on a passage, picture or folded group
  // floating on its own, opens it to edit.
  onDouble(e) {
    if (this.lastPress && Date.now() - this.lastPress.at < 600) return; // a double-click in the thought being written (onDown)
    window.getSelection?.()?.removeAllRanges();
    const groupEl = e.target.closest('[data-group]');
    if (groupEl) {
      this.sel = { kind: 'train', id: groupEl.dataset.group };
      this.drawWorld();
      return;
    }
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id && kindOf(this.world.things[id]) !== 'line') this.openSheet(null, id);
  }

  // ---- Add: the one word at the bottom, which unfolds to the templates and the room's settings ----

  addItem(label, note, fn, keep = true) {
    return el('button', { type: 'button', class: 'create-add-item', role: 'menuitem', onclick: () => { this.closeAdd(keep); fn(); } },
      el('span', {}, label), el('span', { class: 'create-add-note' }, note));
  }

  toggleAdd() {
    const open = this.addMenu.hidden || this.addMenu.classList.contains('at');
    this.addAt = null;
    this.addMenu.classList.remove('at');
    this.addMenu.style.left = this.addMenu.style.top = '';
    this.addMenu.hidden = !open;
    this.addBtn.setAttribute('aria-expanded', String(open));
    this.addBtn.classList.toggle('open', open);
    if (open) this.addMenu.querySelector('button')?.focus();
  }

  // Closes Add; what was asked for at a point (keep) still goes there.
  closeAdd(keep = false) {
    if (!keep) this.addAt = null;
    if (!this.addMenu || this.addMenu.hidden) return;
    this.addMenu.hidden = true;
    this.addMenu.classList.remove('at');
    this.addMenu.style.left = this.addMenu.style.top = '';
    this.addBtn.setAttribute('aria-expanded', 'false');
    this.addBtn.classList.remove('open');
  }

  // ---- Search (Ctrl+K): every thought, train and room ----

  openSearch() {
    if (this.draft) this.commit();
    const field = el('input', { class: 'create-search-field', placeholder: 'Search every room', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'create-search-list', role: 'listbox' });
    let found = [], at = 0;
    const show = () => {
      found = search(this.world, field.value);
      at = Math.min(at, Math.max(0, found.length - 1));
      list.replaceChildren(...found.map((f, i) => el('button', {
        type: 'button', class: 'create-search-item' + (i === at ? ' on' : ''), role: 'option', 'aria-selected': String(i === at),
        onclick: () => this.goTo(f),
      }, el('span', { class: 'create-search-text' }, f.text), el('span', { class: 'create-search-room' }, f.kind === 'room' ? 'Room' : f.roomName))),
      field.value.trim() && !found.length ? el('p', { class: 'create-search-none' }, 'Nothing yet with those words') : '');
    };
    field.addEventListener('input', () => { at = 0; show(); });
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.closeSearch(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(found.length - 1, at + 1); show(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); show(); }
      if (e.key === 'Enter' && found[at]) { e.preventDefault(); this.goTo(found[at]); }
    });
    this.searchBox.replaceChildren(el('div', { class: 'create-search-panel' }, field, list));
    this.searchBox.hidden = false;
    this.searchBox.onpointerdown = (e) => { if (e.target === this.searchBox) this.closeSearch(); };
    field.focus();
  }

  closeSearch() {
    if (!this.searchBox || this.searchBox.hidden) return;
    this.searchBox.hidden = true;
    this.searchBox.replaceChildren();
  }

  // Opens what was found: a room, or the room a thought is in, with the view on the thought.
  goTo(f) {
    this.closeSearch();
    if (f.kind === 'room') { this.openRoom(f.id); return; }
    if (!f.room) return;
    if (this.roomId !== f.room) this.openRoom(f.room);
    const th = this.world.things[f.id];
    const v = view(this.world, f.room);
    const p = this.ont.point(this.world, f.room, f.id);
    if (p) { v.x = p.x + 120; v.y = p.y + 20; this.place(); }
    this.found = isGroup(th) ? null : f.id;
    this.sel = { kind: isGroup(th) ? 'train' : 'thought', id: th.id }; // and its edit pop-up opens
    this.drawWorld();
    clearTimeout(this.foundTimer);
    this.foundTimer = setTimeout(() => { this.found = null; this.drawWorld(); }, 2400);
  }

  onWheel(e) {
    e.preventDefault();
    const v = view(this.world, this.roomId);
    // A mouse wheel (big steps, or lines) and Ctrl+wheel / pinch on a trackpad zoom;
    // a trackpad's two-finger scroll moves around.
    const mouse = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    if (e.ctrlKey || mouse) {
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015) * (e.deltaMode === 1 ? 30 : 1));
      this.zoomAt(e.clientX, e.clientY, v.zoom * k);
    } else {
      v.x += e.deltaX / v.zoom;
      v.y += e.deltaY / v.zoom;
      this.place();
    }
    clearTimeout(this.wheelSave);
    this.wheelSave = setTimeout(() => this.save(), 300);
  }

  // Zooms to `zoom`, keeping the world point `at` (default: the one under the screen point) still.
  zoomAt(clientX, clientY, zoom, at = this.toWorld(clientX, clientY)) {
    const v = view(this.world, this.roomId);
    v.zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
    const b = this.stage.getBoundingClientRect();
    v.x = at.x - (clientX - b.left - b.width / 2) / v.zoom;
    v.y = at.y - (clientY - b.top - b.height / 2) / v.zoom;
    this.place();
  }

  // ---- Editing what is chosen: a pop-up beside it, like a room's options on the rooms page ----

  // What is chosen, as a word: the properties pop-up shows only while it is open for this.
  selKey(sel = this.sel) { return sel ? `${sel.kind}:${sel.ids ? sel.ids.join(',') : sel.id}` : null; }

  // Chooses something and opens its properties (a right-click, a long press, Enter).
  openProps(sel) {
    this.sel = sel;
    this.barFor = this.selKey(sel);
    if (this.draft) this.stopWriting();
    this.drawWorld();
    this.bar.querySelector('textarea, input')?.focus({ preventScroll: true });
  }

  drawBar() {
    if (!this.sel || this.barFor !== this.selKey()) { this.barFor = null; this.bar.hidden = true; this.drawHistorySoon(); return; }
    if (this.sel?.kind === 'many') { this.drawManyBar(); return; }
    const th = this.sel && this.world.things[this.sel.id];
    if (!th) { this.bar.hidden = true; this.drawHistorySoon(); return; }
    const kind = kindOf(th);
    if (this.locked) { // read only: the words, and nothing to change
      this.bar.hidden = false;
      this.bar.replaceChildren(
        el('div', { class: 'create-options-label' }, 'Locked'),
        el('p', { class: 'create-edit-read' }, kind === 'picture' ? th.text || 'A picture' : thoughtText(this.world, th)));
      this.positionEdit();
      this.drawHistorySoon();
      return;
    }
    const stop = (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && e.target.tagName === 'INPUT')) e.target.blur(); };
    const field = (value, label, onchange, cls = 'create-options-name') => el('input', { class: cls, value: value || '', placeholder: label, 'aria-label': label, onkeydown: stop, onchange });
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'create-word ' + extra, onclick: fn }, label);
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    const done = () => { this.save(); this.drawWorld(); };
    const rows = [];
    const gname = (kind === 'group' && this.ontologies.find((o) => o.id === th.of)?.groups?.name) || 'Train';
    const title = kind === 'group' ? (th.folded ? `A folded ${gname.toLowerCase()}` : gname) : (ITEMS[kind]?.name || 'Thought');
    rows.push(el('div', { class: 'create-options-label' }, title));
    if (kind === 'line') {
      // Enter keeps it; Ctrl+Enter (or Cmd+Enter) starts a new line inside the thought.
      const text = el('textarea', { class: 'create-edit-text create-edit-lines', rows: 1, placeholder: 'The thought', 'aria-label': 'The thought',
        oninput: (e) => grow(e.target),
        onkeydown: (e) => {
          e.stopPropagation();
          if (e.key === 'Escape') { e.target.blur(); return; }
          if (e.key !== 'Enter' || e.isComposing) return;
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            const a = e.target.selectionStart, b = e.target.selectionEnd;
            e.target.setRangeText('\n', a, b, 'end');
            grow(e.target);
          } else e.target.blur();
        },
        onchange: (e) => { update(this.world, th.id, { text: e.target.value }); done(); } });
      text.value = th.text || '';
      rows.push(text);
      requestAnimationFrame(() => grow(text));
    }
    if (kind === 'passage') {
      rows.push(field(th.title, 'Title', (e) => { update(this.world, th.id, { title: e.target.value }); done(); }));
      const body = el('textarea', { class: 'create-edit-body', rows: 5, 'aria-label': 'Passage', onkeydown: (e) => e.stopPropagation(),
        onchange: (e) => { update(this.world, th.id, { body: e.target.value }); done(); } });
      body.value = th.body || '';
      rows.push(body, word('Open it large', () => this.openSheet(null, th.id)));
    }
    if (kind === 'picture') rows.push(field(th.text, 'A caption', (e) => { update(this.world, th.id, { text: e.target.value }); done(); }, 'create-edit-text'));
    if (kind === 'group') {
      const n = trainThoughts(this.world, th.id).length;
      rows.push(field(th.title, `Name this ${gname.toLowerCase()}`, (e) => { name(this.world, th.id, e.target.value); done(); }),
        el('div', { class: 'create-options-row' },
          el('span', { class: 'create-options-note' }, `${n} thought${n === 1 ? '' : 's'}`),
          th.folded ? word('Unfold', () => this.unfoldTrain(th.id))
            : n > 1 ? word('Fold into one', () => this.foldTrain(th.id)) : null));
      // Folded in a big room: how the other ontologies show it, in place of its thoughts or beside them.
      const elsewhere = th.folded ? this.elsewhere(th) : [];
      if (elsewhere.length) rows.push(this.keepChoice(elsewhere, !!th.keep, (keep) => { update(this.world, th.id, { keep }); done(); }));
    }
    // The ontology's own rows for what is chosen (ontologies/index.js: props), then its moves,
    // those that fit.
    try { rows.push(...(this.ont.props?.(this, th) || [])); } catch (err) { console.warn('Create: props', err); }
    const moves = (this.ont.moves || []).filter((m) => { try { return !m.when || m.when(this); } catch { return false; } });
    if (moves.length) rows.push(el('div', { class: 'create-options-row create-moves' }, ...moves.map((m) => word(m.label, () => this.runMove(m)))));
    const others = this.moveRooms();
    const pick = el('select', { class: 'create-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? this.addPlainRoom() : e.target.value;
        if (to) this.moveTo(to);
      } },
      el('option', { value: '' }, 'Move to…'),
      ...others.map((r) => el('option', { value: r.id }, r.name)),
      el('option', { value: '+' }, 'A new room'));
    rows.push(el('div', { class: 'create-options-row' }, pick),
      el('div', { class: 'create-options-row' },
        kind !== 'group' && this.ont.groups && groupOf(this.world, th.id, this.mode)
          ? word(`The whole ${this.ont.groups.name.toLowerCase()}`, () => this.openProps({ kind: 'train', id: groupOf(this.world, th.id, this.mode).id })) : null,
        word('Delete', () => {
          remove(this.world, th.id);
          this.sel = null;
          done();
          this.toast(`Deleted. Ctrl+Z brings it back.`);
        }, 'create-options-delete')));
    this.bar.hidden = false;
    this.bar.replaceChildren(...rows);
    this.positionEdit();
    this.drawHistorySoon();
  }

  // One of the ontology's moves: it changes the world (or starts writing), then the room is drawn
  // again and the change saved as one step.
  runMove(m) {
    if (this.locked) return;
    m.run(this);
    this.save();
    if (!this.draft) this.drawWorld();
  }

  // ---- The tray: thoughts the ontology hasn't placed yet, along the foot of the room ----
  // A quiet word ("Loose · 3") opens a row of them; one dragged onto the canvas goes where it is
  // let go (the ontology's drop()). Only an ontology with a tray has one, and only when it holds
  // something.

  trayItems() {
    try { return this.ont.tray?.(this.world, this.roomId) || []; } catch { return []; }
  }

  drawTray() {
    const items = this.roomId ? this.trayItems() : [];
    if (!items.length) { this.trayEl.hidden = true; this.trayEl.replaceChildren(); return; }
    const open = !!this.trayOpen;
    const word = el('button', { type: 'button', class: 'create-word create-tray-btn', 'aria-expanded': String(open),
      title: 'Thoughts not placed in this mode yet. Drag one onto the room.',
      onclick: () => { this.trayOpen = !open; this.drawTray(); } }, `Loose · ${items.length}`);
    const row = open ? el('div', { class: 'create-tray-row', role: 'list' }, items.map((th) => el('div', {
      class: 'create-tray-item', role: 'listitem', 'data-tray': th.id, title: 'Drag onto the room',
      onpointerdown: (e) => this.trayDrag(e, th.id),
    }, el('span', { class: 'create-tray-text' }, kindOf(th) === 'picture' ? th.text || 'A picture' : thoughtText(this.world, th))))) : null;
    this.trayEl.hidden = false;
    this.trayEl.replaceChildren(...(row ? [row] : []), word);
  }

  // A thought dragged out of the tray: a copy of its card follows the pointer; let go over the
  // canvas, the ontology places it there.
  trayDrag(e, id) {
    if (e.button !== 0 || this.locked) return;
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const off = { x: e.clientX - r.left, y: e.clientY - r.top };
    const ghost = card.cloneNode(true);
    ghost.classList.add('create-tray-ghost');
    Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
    this.root.append(ghost);
    const move = (ev) => { ghost.style.left = `${ev.clientX - off.x}px`; ghost.style.top = `${ev.clientY - off.y}px`; };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      ghost.remove();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (ev.type !== 'pointerup' || !over || !this.stage.contains(over) || !this.world.things[id]) return;
      const p = this.toWorld(ev.clientX - off.x, ev.clientY - off.y);
      this.ont.drop(this.world, this.roomId, id, Math.round(p.x), Math.round(p.y));
      this.save();
      this.drawWorld();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // Many things chosen with the box: move them to a room together, or delete them.
  drawManyBar() {
    if (this.locked) { this.bar.hidden = true; return; }
    const ids = this.sel.ids.filter((id) => this.world.things[id]);
    const others = this.moveRooms();
    const pick = el('select', { class: 'create-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? this.addPlainRoom() : e.target.value;
        if (!to) return;
        const v = view(this.world, to);
        ids.forEach((id, i) => move(this.world, id, to, Math.round(v.x - 200 + (i % 4) * 220), Math.round(v.y - 120 + Math.floor(i / 4) * 140)));
        this.sel = null;
        this.save();
        this.drawWorld();
        this.toast(`Moved ${ids.length} to ${room(this.world, to).name}`);
      } },
      el('option', { value: '' }, 'Move to…'),
      ...others.map((r) => el('option', { value: r.id }, r.name)),
      el('option', { value: '+' }, 'A new room'));
    this.bar.hidden = false;
    this.bar.replaceChildren(
      el('div', { class: 'create-options-label' }, `${ids.length} chosen`),
      el('p', { class: 'create-options-note' }, 'Drag any of them to move them together.'),
      el('div', { class: 'create-options-row' }, pick),
      el('div', { class: 'create-options-row' },
        el('button', { type: 'button', class: 'create-word create-options-delete', onclick: () => {
          ids.forEach((id) => remove(this.world, id));
          this.sel = null;
          this.save();
          this.drawWorld();
          this.toast(`Deleted ${ids.length}. Ctrl+Z brings them back.`);
        } }, 'Delete')));
    this.positionEdit();
    this.drawHistorySoon();
  }

  // The rooms a thought can be moved to: every room (not this one, nor a locked one).
  moveRooms() {
    return rooms(this.world).filter((r) => r.id !== this.roomId && !shut(this.world, r.id))
      .sort((a, b) => (a.id === MESSY ? -1 : b.id === MESSY ? 1 : a.name.localeCompare(b.name)));
  }

  // The pop-up sits beside what is chosen, and follows it as the view moves.
  positionEdit() {
    if (this.bar.hidden) return;
    const chosen = [...this.world$.querySelectorAll('.selected')].map((n) => n.getBoundingClientRect()).filter((r) => r.width);
    if (!chosen.length) { this.bar.style.visibility = 'hidden'; return; }
    const box = chosen.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }));
    const page = this.roomPage.getBoundingClientRect();
    const w = this.bar.offsetWidth || 236, h = this.bar.offsetHeight || 200;
    let x = box.right + 22;
    if (x + w > page.right - 16) x = box.left - w - 22;
    x = Math.max(page.left + 16, Math.min(x, page.right - w - 16));
    const y = Math.max(page.top + 64, Math.min(box.top - 8, page.bottom - h - 70));
    this.bar.style.visibility = '';
    this.bar.style.left = `${x - page.left}px`;
    this.bar.style.top = `${y - page.top}px`;
  }

  drawHistorySoon() {
    if (!this.historyOpen) return;
    clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => this.drawHistory(), 60);
  }

  // Folds a group, then asks for its name. In a big room where another ontology has laid its
  // thoughts out, the same sheet asks how that ontology shows it: Replace or Keep both.
  foldTrain(trainId) {
    const ask = this.elsewhere(this.world.things[trainId], true);
    if (!fold(this.world, trainId)) return;
    this.sel = null;
    this.save();
    this.drawWorld();
    this.openSheet(null, trainId, null, ask);
  }

  // The other ontologies of a big room that show a group (laid out: only those that have placed
  // some of its thoughts already).
  elsewhere(g, laidOut = false) {
    const r = room(this.world, g?.parent);
    if (!g || !r || !isBig(r)) return [];
    return this.ontologies.filter((o) => o.id !== g.of && (!laidOut
      || !o.placed || g.members.some((id) => o.placed(this.world, r.id, id))));
  }

  // Replace · Keep both, for how `others` show a folded group.
  keepChoice(others, keep, choose) {
    const names = others.map((o) => o.name).join(' and ');
    const pick = (label, value, note) => el('button', {
      type: 'button', class: 'create-word', 'aria-pressed': String(keep === value), title: note,
      onclick: (e) => { keep = value; choose(value); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, label);
    return el('div', { class: 'create-options-row create-keep' },
      el('span', { class: 'create-options-note' }, `In ${names}:`),
      pick('Replace', false, 'The one folded thought takes the place of its thoughts'),
      pick('Keep both', true, 'The folded thought is added beside its thoughts'));
  }

  unfoldTrain(id) {
    unfold(this.world, id);
    this.sel = null;
    this.save();
    this.drawWorld();
  }

  // ---- Passage and Picture: the two templates for bigger thoughts ----

  // Where a new thought goes: on with the current train, or a new train at a free spot.
  target() {
    if (this.addAt) { // Add, from a right-click on the canvas
      const at = this.addAt;
      this.addAt = null;
      return { train: null, x: Math.round(at.x), y: Math.round(at.y) };
    }
    const cur = this.current[this.roomId];
    const t = this.world.things[cur];
    if (!this.fresh && t?.parent === this.roomId && !t.folded && t.of === this.writer.id) return { train: cur };
    const spot = this.freeSpot();
    this.fresh = false;
    return { train: null, x: Math.round(spot.x), y: Math.round(spot.y) };
  }

  async choosePicture() {
    const file = await this.picker.pick();
    if (file) this.takePicture(file); else this.addAt = null;
  }

  onPaste(e) {
    if (this.root.hidden || !this.roomId || this.editing) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); this.takePicture(file); return; }
    // Words pasted on the canvas start a thought with them; several lines stay one thought.
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    // Thoughts copied here (Ctrl+C), as long as nothing else was copied since.
    if (this.clip && (!text || text === this.clip.text)) { e.preventDefault(); this.pasteThoughts(); return; }
    if (!text.trim() || this.locked) return;
    e.preventDefault();
    this.beginWriting(text);
  }

  async takePicture(file) {
    try {
      const src = await shrinkPicture(file);
      this.openSheet('picture', null, src);
    } catch {
      this.toast('That file couldn\'t be read as a picture.');
    }
  }

  // The sheet: a quiet panel over the room to write a passage or caption a picture, new (kind) or
  // an existing thought (id). Keep (Enter) saves it; Escape or Cancel leaves it.
  openSheet(kind, id = null, src = null, ask = []) {
    if (!this.roomId) return;
    if (this.locked) { this.toast('This room is locked.'); return; }
    if (this.draft) this.commit();
    const th = id ? this.world.things[id] : null;
    kind = th ? kindOf(th) : kind;
    this.editing = { kind, id, src: src || th?.src || null, ask: ask.length > 0, keep: !!th?.keep };
    const keep = () => this.keepSheet();
    const keys = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.isComposing && enterKeeps(e)) keep(); // as everywhere: Enter keeps, Ctrl+Enter a new line
      if (e.key === 'Escape') { e.preventDefault(); this.closeSheet(); }
    };
    const fields = [];
    if (kind === 'group') {
      this.sheetTitle = el('input', { class: 'create-sheet-title', placeholder: 'Name this train of thought', 'aria-label': 'Name', value: th.title || '', onkeydown: keys });
      fields.push(this.sheetTitle, el('div', { class: 'create-sheet-preview' }, thoughtText(this.world, th)));
      if (ask.length) fields.push(this.keepChoice(ask, this.editing.keep, (keep) => { this.editing.keep = keep; this.sheetTitle.focus(); }));
    } else if (kind === 'passage') {
      this.sheetTitle = el('input', { class: 'create-sheet-title', placeholder: 'Title', 'aria-label': 'Title', value: th?.title || '', onkeydown: keys });
      this.sheetBody = el('textarea', { class: 'create-sheet-body', placeholder: 'A paragraph, or a small article', 'aria-label': 'Passage', rows: 9, onkeydown: keys });
      this.sheetBody.value = th?.body || '';
      fields.push(this.sheetTitle, this.sheetBody);
    } else {
      this.sheetCaption = el('input', { class: 'create-sheet-title', placeholder: 'A caption (optional)', 'aria-label': 'Caption', value: th?.text || '', onkeydown: keys });
      fields.push(el('img', { class: 'create-sheet-picture', src: this.editing.src, alt: '' }), this.sheetCaption);
    }
    this.sheet.replaceChildren(
      el('div', { class: 'create-sheet-kind' }, { passage: 'Passage', picture: 'Picture', group: 'A folded train' }[kind]),
      ...fields,
      el('div', { class: 'create-sheet-words' },
        el('button', { type: 'button', class: 'create-word', onclick: keep }, 'Keep'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.closeSheet() }, 'Cancel'),
        el('span', { class: 'create-keys' }, kind === 'passage' ? 'Enter keeps it · Ctrl+Enter a new line' : 'Enter keeps it')));
    this.sheet.hidden = false;
    (kind === 'picture' ? this.sheetCaption : kind === 'passage' && th ? this.sheetBody : this.sheetTitle).focus();
  }

  keepSheet() {
    const ed = this.editing;
    if (!ed) return;
    if (ed.kind === 'group') {
      name(this.world, ed.id, this.sheetTitle.value);
      if (ed.ask) update(this.world, ed.id, { keep: ed.keep });
    }
    else {
      const fields = ed.kind === 'passage'
        ? { kind: 'passage', title: this.sheetTitle.value, body: this.sheetBody.value }
        : { kind: 'picture', src: ed.src, text: this.sheetCaption.value };
      if (ed.id) update(this.world, ed.id, fields);
      else {
        this.keepNew(this.target(), fields);
      }
    }
    this.save();
    this.closeSheet();
    this.drawWorld();
  }

  closeSheet() {
    this.addAt = null;
    this.editing = null;
    this.sheet.hidden = true;
    this.sheet.replaceChildren();
  }

  moveTo(toRoom) {
    const v = view(this.world, toRoom);
    const box = { x: v.x - 300, y: v.y - 160, w: 400, h: 320 };
    const taken = roomTrains(this.world, toRoom).map((t) => ({ x: t.x, y: t.y }));
    const spot = randomSpot(box, taken);
    const x = Math.round(spot.x), y = Math.round(spot.y);
    move(this.world, this.sel.id, toRoom, x, y);
    this.sel = null;
    this.save();
    this.drawWorld();
    this.toast(`Moved to ${room(this.world, toRoom).name}`);
  }
}
