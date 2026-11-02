// Create: rooms of thoughts. Create (on the home page, or in the menu) slides the rooms page up
// from the bottom, leaving a strip of the home page at the top with a back arrow (top right) home.
// The page is a light opacity mask over the home picture itself, held still underneath (its
// spontaneity layer is off), so nothing is drawn while it shows. It is a grid of square cells:
// each room is an opacity square on it (one cell; Messy thoughts takes four at the top left), and
// a room written in lately glows. Click an empty cell to make a room there; drag a room to move it
// to any free cell. Rooms, New room and Settings are along the bottom. Typing anything on the rooms page
// opens Messy thoughts and starts writing there, at a random place.
//
// On the rooms page, hovering over a square outlines it; a click chooses it and shows its options
// beside it (name, Go in, colour, lightness, opacity, size, Delete); a double click goes in.
//
// A room fills the screen as one gradient of its own colour, with the back arrow to the rooms.
// A room is a canvas: drag to move around, wheel / pinch / Ctrl+wheel to zoom. Typing anywhere
// writes a thought; Enter ends it. Each room is seen through an ontological mode:
// - Joyce (the default): thoughts are joined by time into trains. Each thought stands on its own,
//   joined to the next by a line: taut between quick thoughts, slack after a pause (model.js
//   slack). Drag a thought to move it alone (the line follows); double-click a train to choose it
//   whole, then drag it. Enter goes on with the train; Ctrl+Enter starts a new one. Hovering over
//   Joyce drops down Timeline: a list down the left of everything written in the room, in the
//   order it was last changed, with its train as a tag (Joyce's tags only).
//   A click on a thought (or a double click on a train) opens a pop-up beside it to edit it.
// - Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they
//   were written, and can be dragged anywhere.
// Add (bottom left) unfolds to Thought, Passage (Alt+P), Picture (Alt+I, or paste) and the room's
// settings. A train can be folded into one thought, which you name, and unfolded again.
// Ctrl+K searches every room; Ctrl+Z / Ctrl+Shift+Z undo and redo; a quiet "Saved" shows when the
// world is written down, and a line of help shows the first time each page is seen.
//
// Everything is a thought (model.js): lines, passages, pictures, trains and rooms are all kinds
// of one object, so moving, folding and naming work the same on any of them.
//
// Saved data: 'world' → see model.js. It is saved with everything else, so it follows the
// account like the settings do.

import { Feature, ui } from 'folio';
import {
  MESSY, MODES, loadWorld, room, rooms, addRoom, name, view, startTrain, addThought, create, update,
  remove, move, fold, unfold, kindOf, isLeaf, thoughtText, trainThoughts, roomThoughts, roomTrains,
  roomUnits, lastWritten, spiralPoint, pessoaPoint, place, randomSpot, gridRooms, placeRoom,
  trainSpots, nextSpot, nudge, slack, strand, timeline, tagName, search, sizeRoom, hash, lastChanged,
  cells, roomAt, shut, lock, archive, archived, restore, peek, roomHits, DESC,
} from './model.js';
import { shrinkPicture } from './picture.js';
import { visit, light, loadLog } from './attention.js';
import { pageLook, roomLook, squareLook, lookPrefs, savedLook, toOklch, rgb, LOOK, PALETTE } from './look.js';

const { el } = ui;
const ZOOM = { min: 0.25, max: 4 };
const GRID = { gap: 14, pad: 32, least: 4, most: 10 }; // the rooms page's cells (px)
const UNDO = 60;           // how many steps back Ctrl+Z goes
const SVG = 'http://www.w3.org/2000/svg';
const HINTS = {
  rooms: 'Click a square to change it · double-click to go in · click an empty square for a new room · or just start typing',
  room: 'Type anywhere to write · Enter ends a thought · Ctrl+Enter starts a new train · double-click a train to move it whole · Ctrl+K searches · Ctrl+Z undoes',
};

export default class Create extends Feature {
  start() {
    this.world = loadWorld(this.storage.get('world'));
    this.roomId = null;   // the open room, or null on the rooms page
    this.draft = null;    // the thought being written: { train | null, x, y }
    this.current = {};    // per room: the train Enter goes on with
    this.fresh = false;   // Ctrl+Enter was pressed: the next thought starts a new train
    this.sel = null;      // { kind: 'train' | 'thought', id }
    this.renaming = null; // a room id whose name is being edited
    this.roomSel = null;  // the room chosen on the rooms page, whose options show beside it
    this.editing = null;  // the Passage / Picture sheet: { kind, id | null, src? }
    this.picker = ui.filePicker('image/*');
    this.lastRoom = this.storage.get('lastRoom') || null; // the room last gone into: its square glows
    this.drafts = this.storage.get('drafts', {}) || {};    // per room: a thought left half written { text, train, x, y }
    this.shelf = false;   // the Archive page is showing, instead of the grid
    this.lights = null;   // the rooms page's search lights: what is being looked for, or null

    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), or null
    this.prefs = lookPrefs(this.storage.get('look'));
    // The app's colours (Renderer, Settings → Colour), and any change to them.
    this.palette = this.backdrop?.palette?.() || PALETTE;
    document.addEventListener('palette', (e) => { this.palette = e.detail; this.repaint(); });
    this.attention = loadLog(this.storage.get('attention'));
    this.build();
    this.add('settings', { id: 'create-rooms', title: 'Rooms', order: 30, render: () => this.settingsPane() });
    this.provide('create', this);
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => { if (this.roomId) this.place(); else if (!this.root.hidden) this.drawRooms(); });
    document.addEventListener('paste', (e) => this.onPaste(e));
  }

  // ---- Opening and closing ----

  open() {
    this.world = loadWorld(this.storage.get('world')); // it may have arrived from the account meanwhile
    this.undoStack = [];
    this.redoStack = [];
    this.lastSnap = this.snap();
    this.app.shell?.closeMenu?.();
    clearTimeout(this.closing);
    this.colours = this.backdrop?.colours?.(); // read once: the page is still from here on
    this.palette = this.backdrop?.palette?.() || this.palette;
    this.paintPage();
    this.shelf = false;
    this.root.hidden = false;
    document.documentElement.classList.add('create-open');
    this.showRooms();
    this.root.getBoundingClientRect(); // so the slide starts from below
    this.root.classList.add('up');
    this.backdrop?.cover?.(true);
  }

  close() {
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
      document.documentElement.classList.remove('create-open');
    }, 520);
  }

  back() {
    if (this.roomId) this.showRooms(); else this.close();
  }

  showRooms() {
    this.closeSheet();
    this.shelveDraft();
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.roomSel = null;
    this.closeAdd();
    this.roomPage.hidden = true;
    this.roomsPage.hidden = false;
    this.root.classList.remove('in-room', 'expanding');
    this.expandVeil?.remove();
    this.backBtn.setAttribute('aria-label', 'Back to the home page');
    document.documentElement.classList.remove('create-dark');
    this.drawRooms();
  }

  openRoom(id) {
    if (!room(this.world, id)) return;
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
    this.roomPage.hidden = false;
    this.root.classList.add('in-room');
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
    const text = this.input.value;
    if (this.draft && text.trim()) this.drafts[this.roomId] = { text, train: this.draft.train || null, x: this.draft.x ?? 0, y: this.draft.y ?? 0 };
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
    this.draft = t && t.parent === this.roomId ? { train: d.train } : { train: null, x: d.x, y: d.y };
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
    }
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.storage.set('world', this.world); this.showSaved(); }, 250);
  }

  snap() { return JSON.stringify({ things: this.world.things, places: this.world.places }); }

  undo(back = true) {
    const from = back ? this.undoStack : this.redoStack, to = back ? this.redoStack : this.undoStack;
    if (!from.length) { this.toast(back ? 'Nothing to undo' : 'Nothing to redo'); return; }
    to.push(this.lastSnap);
    this.lastSnap = from.pop();
    const { things, places } = JSON.parse(this.lastSnap);
    Object.assign(this.world, { things, places });
    this.sel = null;
    this.draft = null;
    clearTimeout(this.saveTimer);
    this.storage.set('world', this.world);
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
    this.shelfBtn = el('button', { type: 'button', class: 'create-word create-shelf-btn', onclick: () => this.toggleShelf() });
    this.shelfHead = el('div', { class: 'create-shelf-head', hidden: true }, 'Archive');
    this.roomsPage = el('section', { class: 'create-rooms', 'aria-label': 'Rooms' },
      this.lightsBar,
      el('div', { class: 'create-grid-wrap' }, this.shelfHead, this.grid),
      el('div', { class: 'create-rooms-foot' }, this.shelfBtn));

    this.backBtn = el('button', { type: 'button', class: 'create-back', 'aria-label': 'Back to the home page', onclick: () => this.back() },
      ui.icon('<path d="M20 12H4M10 6l-6 6 6 6"/>'));
    this.crumbName = el('button', { type: 'button', class: 'create-crumb create-crumb-name', title: 'Rename', onclick: () => this.renameOpenRoom() });
    this.modes = el('div', { class: 'create-modes', role: 'radiogroup', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'create-world' });
    this.stage = el('div', { class: 'create-stage', 'data-own-swipe': '' }, this.world$);
    this.input = el('textarea', { class: 'create-input', 'aria-label': 'Write a thought', rows: 1, autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'create-options create-edit', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.history = el('aside', { class: 'create-history', hidden: true, 'aria-label': 'Timeline', onpointerdown: (e) => e.stopPropagation() });
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
          this.addItem('Keys', '?', () => this.showKeys())),
        this.addBtn = el('button', { type: 'button', class: 'create-word create-add-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleAdd() },
          el('span', { class: 'create-add-plus', 'aria-hidden': 'true' }, '+'), 'Add')),
      this.history,
      this.bar,
      this.sheet = el('div', { class: 'create-sheet', hidden: true }),
      this.input);

    this.searchBox = el('div', { class: 'create-search', hidden: true, role: 'dialog', 'aria-label': 'Search' });
    this.savedMark = el('div', { class: 'create-saved', 'aria-live': 'polite' });
    this.hintLine = el('div', { class: 'create-hint' });
    this.root = el('div', { class: 'create', hidden: true }, this.roomsPage, this.roomPage, this.backBtn, this.searchBox, this.savedMark, this.hintLine);
    (document.getElementById('folio-root') || document.body).append(this.root);

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onInputKey(e));
    this.input.addEventListener('blur', () => { if (this.draft && !this.input.value.trim()) { this.draft = null; this.drawWorld(); } });
    this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
    this.stage.addEventListener('dblclick', (e) => this.onDouble(e));
    this.stage.addEventListener('contextmenu', (e) => e.preventDefault()); // Ctrl+click on a Mac would open a menu and lose the drag
    document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && this.roomId && !this.draft && !e.target.matches?.('input, textarea, select')) { this.spaceDown = true; this.stage.classList.add('panning'); } });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.spaceDown = false; this.stage.classList.remove('panning'); } });
    document.addEventListener('pointerdown', (e) => {
      this.hintLine.classList.remove('on');
      if (!this.addMenu.hidden && !e.target.closest('.create-add')) this.closeAdd();
    });
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  // ---- The rooms page ----

  // How many columns fit, and how big a cell is.
  gridSize() {
    const width = (this.grid.parentElement?.clientWidth || window.innerWidth) - 2 * GRID.pad;
    const fit = Math.floor((width + GRID.gap) / (this.prefs.cell + GRID.gap));
    const cols = Math.min(GRID.most, Math.max(GRID.least, fit));
    const cell = Math.max(56, Math.min(this.prefs.cell, Math.floor((width - GRID.gap * (cols - 1)) / cols)));
    return { cols, cell };
  }

  drawRooms() {
    const now = Date.now();
    const { cols: fit, cell } = this.gridSize();
    const all = gridRooms(this.world, fit);
    const shelved = archived(this.world);
    if (this.shelf && !shelved.length) this.shelf = false;
    this.shelfBtn.hidden = !shelved.length;
    this.shelfBtn.textContent = this.shelf ? 'Rooms' : `Archive · ${shelved.length}`;
    this.shelfHead.hidden = !this.shelf;
    this.roomsPage.classList.toggle('shelf', this.shelf);
    this.grid.classList.toggle('peek-always', this.prefs.peek >= 0.5);
    const hits = this.lights?.trim() ? roomHits(this.world, this.lights) : null;
    this.grid.classList.toggle('lights', !!hits);
    if (hits) {
      const n = Object.keys(hits).length;
      this.lightsNote.textContent = n ? `${n} room${n === 1 ? '' : 's'} · Enter goes in` : 'Nothing yet with those words';
    } else this.lightsNote.textContent = '';
    if (this.shelf) { this.drawShelf(shelved, fit, cell, hits); return; }
    // The grid grows: always a spare column and row past the furthest room, and at least the
    // size set in Settings → Rooms. The page scrolls when it is bigger than the screen.
    const cols = Math.max(fit, this.prefs.cols || 0, ...all.map((r) => r.col + r.size + 1));
    const height = this.grid.parentElement?.clientHeight || window.innerHeight;
    const rows = Math.max(Math.floor((height - 2 * GRID.pad + GRID.gap) / (cell + GRID.gap)),
      this.prefs.rows || 0, ...all.map((r) => r.row + r.size + 1));
    this.cols = cols;
    this.grid.style.setProperty('--cols', cols);
    this.grid.style.setProperty('--cell', cell + 'px');
    this.grid.style.setProperty('--cell-gap', GRID.gap + 'px');

    const taken = new Set();
    for (const r of all) for (let c = 0; c < r.size; c++) for (let d = 0; d < r.size; d++) taken.add(`${r.col + c},${r.row + d}`);
    const empty = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (taken.has(`${col},${row}`)) continue;
      empty.push(el('button', {
        type: 'button', class: 'create-cell', 'aria-label': 'New room here',
        style: `grid-column:${col + 1};grid-row:${row + 1}`,
        'data-col': col, 'data-row': row,
        onclick: () => { if (this.roomSel) { this.roomSel = null; this.drawRooms(); } else this.newRoom({ col, row }); },
      }));
    }

    const tiles = all.map((r) => this.tile(r, now, hits));
    const chosen = this.roomSel && all.find((r) => r.id === this.roomSel);
    this.grid.replaceChildren(...empty, ...tiles, ...(chosen ? [this.roomOptions(chosen, cell, cols)] : []));
    this.grid.querySelector('.create-name-field')?.focus();
    if (!this.root.hidden) this.hint('rooms');
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
      : el('span', { class: 'create-tile-name' }, r.name);
    const lines = peek(this.world, r.id, (r.size || 1) > 1 ? 3 : 1);
    const found = hits?.[r.id] || 0;
    const tile = el('div', {
      class: 'create-tile' + (lit ? ' lit' : '') + (r.id === MESSY ? ' messy' : '') + (look.alpha > 0.4 ? ' deep' : '') + (this.roomSel === r.id ? ' chosen' : '')
        + (this.lastRoom === r.id ? ' last' : '') + (r.locked ? ' locked' : '') + (hits ? (found ? ' found' : ' unlit') : ''),
      role: 'button', tabindex: 0,
      style: `--lit:${glow.toFixed(3)};--square:${look.fill};grid-column:${r.col + 1} / span ${r.size};grid-row:${r.row + 1} / span ${r.size}`,
      'aria-label': `${r.name}, ${count} thought${count === 1 ? '' : 's'}`,
      'data-room': r.id,
      'aria-expanded': String(this.roomSel === r.id),
      onkeydown: (e) => {
        if (e.target !== tile) return;
        if (e.key === 'Enter') { e.preventDefault(); this.openRoom(r.id); }
        if (e.key === ' ') { e.preventDefault(); this.chooseRoom(r.id); }
      },
      onpointerdown: (e) => this.onTileDown(e, r, tile),
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
    this.roomSel = null;
    this.drawRooms();
    this.grid.parentElement?.scrollTo?.(0, 0);
  }

  // The archived rooms, in rows, in the order they were made. A click shows Restore, Go in and
  // Delete; a double click goes in.
  drawShelf(shelved, cols, cell, hits) {
    this.cols = cols;
    this.grid.style.setProperty('--cols', cols);
    this.grid.style.setProperty('--cell', cell + 'px');
    this.grid.style.setProperty('--cell-gap', GRID.gap + 'px');
    const tiles = shelved.map((r, i) => {
      const t = this.tile({ ...r, size: 1 }, Date.now(), hits);
      t.style.gridColumn = `${(i % cols) + 1}`;
      t.style.gridRow = `${Math.floor(i / cols) + 1}`;
      t.dataset.room = r.id;
      return t;
    });
    const at = shelved.findIndex((r) => r.id === this.roomSel);
    const panel = at < 0 ? null : this.shelfOptions(shelved[at], at % cols, Math.floor(at / cols), cell, cols);
    this.grid.replaceChildren(...tiles, ...(panel ? [panel] : []));
  }

  shelfOptions(r, col, row, cell, cols) {
    const step = cell + GRID.gap;
    const right = col + 1 + 2 <= cols;
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'create-word ' + extra, onclick: fn }, label);
    return el('div', {
      class: 'create-options' + (right ? '' : ' left'),
      style: right ? `left:${(col + 1) * step + 4}px;top:${row * step}px` : `right:${(cols - col) * step + 4 - GRID.gap}px;top:${row * step}px`,
      onpointerdown: (e) => e.stopPropagation(),
    },
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

  // The room the lights found most in.
  bestLit() {
    const hits = roomHits(this.world, this.lights || '');
    return Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  chooseRoom(id) {
    this.roomSel = this.roomSel === id ? null : id;
    this.renaming = null;
    this.drawRooms();
  }

  // A chosen room's options, beside its square: its name, Go in, its colour, lightness and opacity
  // (the only place a room's colour is set), its size, Back to the tint, and Delete (not for Messy).
  roomOptions(r, cell, cols) {
    const step = cell + GRID.gap;
    const right = r.col + r.size + 1 + 2 <= cols; // room for the panel on the right
    const set = (fields) => { update(this.world, r.id, fields); this.save(); this.drawRoomsSoon(); };
    const look = this.lookOf(r);
    const lightness = el('input', { type: 'range', min: 0.05, max: 0.98, step: 0.01, value: look.light, 'aria-label': 'Lightness', oninput: (e) => set({ light: +e.target.value }) });
    const nameField = el('input', {
      class: 'create-options-name', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
      onchange: (e) => { name(this.world, r.id, e.target.value); this.save(); this.drawRooms(); },
    });
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'create-word ' + extra, onclick: fn }, label);
    const panel = el('div', {
      class: 'create-options' + (right ? '' : ' left'),
      style: right
        ? `left:${(r.col + r.size) * step + 4}px;top:${r.row * step}px`
        : `right:${(cols - r.col) * step + 4 - GRID.gap}px;top:${r.row * step}px`,
      onpointerdown: (e) => e.stopPropagation(),
    },
      nameField,
      // A line or two about the room: shown under its name inside, and in its square's peek.
      el('textarea', {
        class: 'create-options-desc', rows: 2, maxlength: DESC, placeholder: 'A line about this room', 'aria-label': 'Description',
        onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.target.blur(); } },
        onchange: (e) => { update(this.world, r.id, { desc: e.target.value }); this.save(); this.drawRooms(); },
      }, r.desc || ''),
      word('Go in', () => this.openRoom(r.id), 'create-options-go'),
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
          this.roomSel = null;
          this.save();
          this.drawRooms();
          this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
        }, 'create-options-delete') : null));
    return panel;
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

  // Pressing a room opens it; dragging it moves it to the cell it is let go over, if that is free.
  onTileDown(e, r, tile) {
    if (e.button || e.target.closest('input')) return;
    const start = { x: e.clientX, y: e.clientY };
    const grab = this.cellAt(e.clientX, e.clientY);
    const offset = grab ? { col: grab.col - r.col, row: grab.row - r.row } : { col: 0, row: 0 };
    let dragging = false, target = null;
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
        cells({ ...r, col: c.col, row: c.row }).every(([cc, rr]) => { const o = roomAt(this.world, cc, rr, r.id); return !o; });
      drop.hidden = false;
      drop.classList.toggle('taken', !free);
      drop.style.gridColumn = `${c.col + 1} / span ${size}`;
      drop.style.gridRow = `${c.row + 1} / span ${size}`;
    };
    const moveFn = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (r.locked || r.archived) return; // a locked room keeps its place; an archived one has none
      if (!dragging && Math.hypot(dx, dy) < 5) return;
      if (!dragging) { dragging = true; tile.classList.add('dragging'); this.grid.classList.add('dragging'); }
      tile.style.transform = `translate(${dx}px, ${dy}px)`;
      target = spot(ev);
      mark(target);
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', moveFn);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      mark(null);
      this.grid.classList.remove('dragging');
      if (!dragging) {
        if (ev.type !== 'pointerup' || this.renaming) return;
        const now = Date.now();
        const twice = this.lastTap?.id === r.id && now - this.lastTap.at < 380;
        this.lastTap = { id: r.id, at: now };
        if (twice) this.openRoom(r.id);
        else { this.roomSel = r.id; this.drawRooms(); }
        return;
      }
      if (target && placeRoom(this.world, r.id, target.col, target.row, this.cols)) this.save();
      this.drawRooms();
    };
    window.addEventListener('pointermove', moveFn);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // A new room, in the cell asked for (or the first free one), with its name ready to write.
  newRoom(cell = null) {
    const r = addRoom(this.world, 'Untitled', Date.now(), cell, this.cols || this.gridSize().cols);
    this.save();
    this.renaming = r.id;
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

  get mode() { return view(this.world, this.roomId).mode; }

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
        slider('Line tension', 'tension', 0, 1)),
      ui.hint('A room\'s own colour is in its pop-up on the rooms page: click its square.', { small: true }),
      el('button', { type: 'button', class: 'btn small', onclick: () => {
        this.prefs = lookPrefs(LOOK);
        this.storage.set('look', savedLook(this.prefs));
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
    this.modes.replaceChildren(...MODES.map((m) => {
      const btn = el('button', {
        type: 'button', role: 'radio', class: 'create-mode',
        'aria-checked': String(m.id === this.mode),
        onclick: () => this.setMode(m.id),
      }, m.name);
      if (m.id !== 'joyce') return btn;
      // Hovering over Joyce unfolds the timeline.
      return el('span', { class: 'create-mode-wrap' + (v.timeline && this.mode === 'joyce' ? ' open' : '') }, btn,
        el('button', {
          type: 'button', class: 'create-mode create-timeline-btn', 'aria-pressed': String(!!v.timeline && this.mode === 'joyce'),
          onclick: () => this.toggleTimeline(),
        }, 'Timeline'));
    }));
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

  get historyOpen() { return this.mode === 'joyce' && !!view(this.world, this.roomId).timeline; }

  toggleTimeline() {
    const v = view(this.world, this.roomId);
    if (this.mode !== 'joyce') v.mode = 'joyce';
    v.timeline = !v.timeline;
    this.sel = null;
    this.save();
    this.drawRoom();
  }

  setMode(id) {
    view(this.world, this.roomId).mode = id;
    view(this.world, this.roomId).timeline = false;
    this.sel = null;
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
    if (this.mode === 'joyce') {
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('class', 'create-strands');
      const tension = this.prefs.tension ?? 0.5;
      for (const t of roomTrains(w, this.roomId)) {
        const chosen = (this.sel?.kind === 'train' && this.sel.id === t.id) || this.isSel(t.id);
        if (t.folded) {
          nodes.push(el('div', {
            class: 'create-bead create-folded' + (chosen ? ' selected' : ''), 'data-train': t.id,
            style: `left:${t.x}px;top:${t.y}px`,
          }, this.thoughtNode(t)));
          continue;
        }
        const spots = trainSpots(w, t.id);
        const all = trainThoughts(w, t.id);
        const knots = all.map((th) => ({ th, ...spots[th.id] }));
        if (this.draft?.train === t.id) knots.push({ th: { at: Date.now() }, ...nextSpot(w, t.id), draft: true });
        const g = document.createElementNS(SVG, 'g');
        g.setAttribute('data-train', t.id);
        g.setAttribute('class', 'create-strand' + (chosen ? ' selected' : ''));
        for (let k = 1; k < knots.length; k++) {
          const a = knots[k - 1], b = knots[k];
          const p = { x: a.x - 14, y: a.y + 15 }, q = { x: b.x - 14, y: b.y + 15 };
          const d = strand(p, q, slack(a.th, b.th, Math.hypot(q.x - p.x, q.y - p.y), tension));
          for (const cls of ['create-strand-hit', 'create-strand-line']) {
            const path = document.createElementNS(SVG, 'path');
            path.setAttribute('d', d);
            path.setAttribute('class', cls);
            g.append(path);
          }
        }
        for (const k of knots) {
          const dot = document.createElementNS(SVG, 'circle');
          dot.setAttribute('cx', k.x - 14);
          dot.setAttribute('cy', k.y + 15);
          dot.setAttribute('r', 2.6);
          dot.setAttribute('class', 'create-knot');
          g.append(dot);
        }
        svg.append(g);
        for (const k of knots) {
          nodes.push(el('div', {
            class: 'create-bead' + (chosen || this.isSel(k.th.id) ? ' selected' : '') + (this.found === k.th.id ? ' found' : ''),
            'data-train': t.id, ...(k.draft ? {} : { 'data-thought': k.th.id }),
            style: `left:${k.x}px;top:${k.y}px`,
          }, k.draft ? this.draftNode() : this.thoughtNode(k.th)));
        }
      }
      if (this.draft && !this.draft.train) {
        nodes.push(el('div', { class: 'create-bead', style: `left:${this.draft.x}px;top:${this.draft.y}px` }, this.draftNode()));
      }
      nodes.unshift(svg);
    } else {
      const all = roomUnits(w, this.roomId);
      for (const th of all) {
        const p = pessoaPoint(w, this.roomId, th.id);
        nodes.push(el('div', {
          class: 'create-float' + (this.isSel(th.id) ? ' selected' : '') + (this.found === th.id ? ' found' : ''),
          'data-thought': th.id,
          style: `left:${p.x}px;top:${p.y}px`,
        }, this.thoughtNode(th)));
      }
      if (this.draft) {
        const p = spiralPoint(all.length, 'draft');
        nodes.push(el('div', { class: 'create-float', style: `left:${p.x}px;top:${p.y}px` }, this.draftNode()));
      }
    }
    this.world$.replaceChildren(...nodes);
    this.drawBar();
  }

  // The timeline: a list down the left of everything written in the room, in the order it was
  // last changed (latest at the bottom), each with its time and its train as a tag. A click
  // takes the view to it.
  drawHistory() {
    if (!this.historyOpen) { this.history.hidden = true; return; }
    const items = timeline(this.world, this.roomId);
    const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const list = el('ol', { class: 'create-history-list' }, items.map(({ th, train }) => el('li', {},
      el('button', {
        type: 'button', class: 'create-history-item' + (this.sel?.id === th.id || this.sel?.id === train.id ? ' on' : ''),
        style: `--tag:hsl(${hash(train.id) % 360} 32% 46%)`,
        onclick: () => this.goTo({ id: th.id, kind: kindOf(th), room: this.roomId }),
      },
        el('span', { class: 'create-history-meta' },
          el('span', { class: 'create-history-time' }, when(lastChanged(th))),
          el('span', { class: 'create-tag' }, tagName(this.world, train.id))),
        el('span', { class: 'create-history-text' }, thoughtText(this.world, th))))));
    this.history.hidden = false;
    this.history.replaceChildren(
      el('div', { class: 'create-history-head' },
        el('span', {}, 'Timeline'),
        el('button', { type: 'button', class: 'create-history-close', 'aria-label': 'Close the timeline', onclick: () => this.toggleTimeline() }, '×')),
      items.length ? list : el('p', { class: 'create-history-none' }, 'Nothing written here yet'));
    list.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  // One thought, drawn by its kind.
  thoughtNode(th) {
    const kind = kindOf(th);
    if (kind === 'passage' || kind === 'train') { // a folded train reads as one passage
      const body = kind === 'train' ? thoughtText(this.world, th) : th.body;
      return el('div', { class: 'create-passage' + (kind === 'train' ? ' folded' : ''), 'data-id': th.id },
        th.title ? el('div', { class: 'create-passage-title' }, th.title) : null,
        body ? el('div', { class: 'create-passage-body' }, body) : null);
    }
    if (kind === 'picture') {
      return el('figure', { class: 'create-picture', 'data-id': th.id },
        el('img', { src: th.src, alt: th.text || 'A picture', draggable: 'false' }),
        th.text ? el('figcaption', {}, th.text) : null);
    }
    return el('span', { class: 'create-thought', 'data-id': th.id }, th.text);
  }

  draftNode() {
    this.draftEl = el('span', { class: 'create-thought create-draft' }, this.input.value);
    return this.draftEl;
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
      else if (this.sel) { this.sel = null; this.drawWorld(); }
      else if (this.roomSel) { this.roomSel = null; this.drawRooms(); }
      else if (!this.roomId && this.lights != null) this.closeLights();
      else if (!this.roomId && this.shelf) this.toggleShelf();
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
    this.input.value += seed;
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    this.showDraft();
  }

  freeSpot() {
    const taken = roomTrains(this.world, this.roomId).map((t) => ({ x: t.x, y: t.y }));
    return randomSpot(this.visibleBox(), taken);
  }

  onInput() {
    if (!this.draft) { this.beginWriting(); return; }
    if (this.draftEl) this.draftEl.textContent = this.input.value;
    this.showDraft();
  }

  onInputKey(e) {
    if (e.altKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
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
    if (!d || !text.trim()) { this.drawWorld(); return; }
    const train = d.train ? this.world.things[d.train] : startTrain(this.world, this.roomId, d.x, d.y);
    addThought(this.world, train.id, text);
    this.current[this.roomId] = train.id;
    this.save();
    this.drawWorld();
  }

  stopWriting() {
    if (this.draft) this.commit();
    this.input.blur();
  }

  // Keeps the thought being written on the screen, moving the view if it has gone off it.
  showDraft() {
    if (!this.draftEl) return;
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

  onDown(e) {
    const middle = e.button === 1;
    if (e.button !== 0 && !middle && e.pointerType === 'mouse') return;
    const pointers = (this.pointers ||= new Map());
    if (e.pointerType === 'mouse') pointers.clear(); // a mouse is one pointer: forget one whose release was lost (a Mac's Ctrl+click menu)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.stage.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { this.gesture = { kind: 'pinch', ...this.pinchState() }; return; }

    const v = view(this.world, this.roomId);
    const trainEl = e.target.closest('[data-train]');
    const thoughtEl = e.target.closest('[data-thought]');
    let thing = null;
    const hitId = thoughtEl?.dataset.thought || trainEl?.dataset.train;
    const pan = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
    if (e.ctrlKey || e.metaKey || middle || this.spaceDown) { e.preventDefault(); this.gesture = { kind: 'pan', ...pan }; } // Ctrl+drag (or Space+drag, or the middle button) moves the canvas
    else if (this.sel?.kind === 'many' && hitId && this.isSel(hitId)) this.gesture = { kind: 'group', ...pan, from: this.groupSpots() };
    else if (!hitId && e.pointerType === 'mouse') this.gesture = { kind: 'box', ...pan }; // a drag on the empty canvas draws a selection box
    if (this.gesture) { this.listen(e); return; }
    if (trainEl && this.mode === 'joyce') {
      const t = this.world.things[trainEl.dataset.train];
      const whole = !thoughtEl || (this.sel?.kind === 'train' && this.sel.id === t.id) || t.folded;
      if (whole) thing = { kind: 'train', id: t.id, x: t.x, y: t.y, live: true };
      else {
        const id = thoughtEl.dataset.thought;
        const p = trainSpots(this.world, t.id)[id];
        thing = { kind: 'thought', id, x: p.x, y: p.y, live: true, bead: true };
      }
    } else if (thoughtEl && this.mode === 'pessoa') {
      const id = thoughtEl.dataset.thought;
      const p = pessoaPoint(this.world, this.roomId, id);
      thing = { kind: isLeaf(this.world.things[id]) ? 'thought' : 'train', id, x: p.x, y: p.y, placed: true };
    }
    if (this.locked && thing) thing.still = true; // a locked room: a tap still chooses it, a drag moves the view
    this.gesture = { kind: thing ? 'drag' : 'pan', thing, el: trainEl || thoughtEl, x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
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
      // Joyce: the thought (or its whole train) moves, and the line follows it.
      const x = Math.round(g.thing.x + dx / v.zoom), y = Math.round(g.thing.y + dy / v.zoom);
      if (g.thing.bead) nudge(this.world, g.thing.id, x, y);
      else Object.assign(this.world.things[g.thing.id], { x, y });
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
    if (!g || g.kind === 'pinch') { this.save(); return; }
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
      // Two taps on the same train (the page is redrawn between them, so no dblclick comes).
      const train = this.mode === 'joyce' && g.el?.dataset.train;
      const now = Date.now();
      if (train && this.lastTap?.train === train && now - this.lastTap.at < 400) this.sel = { kind: 'train', id: train };
      this.lastTap = train ? { train, at: now } : null;
      if (!g.thing && this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    if (g.thing?.live) { this.drawWorld(); this.save(); return; }
    if (g.thing && g.to) {
      if (g.thing.placed) place(this.world, this.roomId, g.thing.id, g.to.x, g.to.y);
      else Object.assign(this.world.things[g.thing.id], g.to);
    }
    this.save();
  }

  // ---- Keys: delete, choose all, nudge, and the list of them all (?) ----

  // Returns true when the key was one of these, and was used.
  shortcut(e, mod) {
    const k = e.key;
    if (k === '?' && !mod) { e.preventDefault(); this.showKeys(); return true; }
    if (!this.roomId) {
      // The rooms page: Delete removes the chosen room (Ctrl+Z brings it back).
      if ((k === 'Delete' || k === 'Backspace') && this.roomSel && this.roomSel !== MESSY && !room(this.world, this.roomSel)?.locked) {
        e.preventDefault();
        const r = room(this.world, this.roomSel);
        remove(this.world, this.roomSel);
        this.roomSel = null;
        this.save();
        this.drawRooms();
        this.toast(`Deleted ${r?.name || 'the room'}. Ctrl+Z brings it back.`);
        return true;
      }
      if (k === 'Enter' && this.roomSel) { e.preventDefault(); this.openRoom(this.roomSel); return true; }
      return false;
    }
    if (mod && !e.altKey && k.toLowerCase() === 'a') { // choose everything in the room
      e.preventDefault();
      const ids = this.mode === 'pessoa'
        ? roomUnits(this.world, this.roomId).map((th) => th.id)
        : roomTrains(this.world, this.roomId).flatMap((t) => (t.folded ? [t.id] : trainThoughts(this.world, t.id).map((th) => th.id)));
      this.sel = ids.length > 1 ? { kind: 'many', ids } : ids.length ? { kind: 'thought', id: ids[0] } : null;
      this.drawWorld();
      return true;
    }
    if (!this.sel) return false;
    if (this.locked && (k === 'Delete' || k === 'Backspace' || k.startsWith('Arrow'))) { e.preventDefault(); this.toast('This room is locked.'); return true; }
    if (k === 'Delete' || k === 'Backspace') {
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
      ['Alt+P · Alt+I', 'a passage · a picture'], ['Click · double-click', 'choose a thought · its whole train'],
      ['Drag the canvas', 'a box to choose many'], ['Ctrl+drag', 'move around'], ['Ctrl+A', 'choose everything'],
      ['Delete', 'delete what is chosen'], ['Arrows · Shift+arrows', 'nudge what is chosen'],
      ['Ctrl+K', 'search every room'], ['Ctrl+Z · Ctrl+Shift+Z', 'undo · redo'], ['Escape', 'let go, or go back'], ['?', 'these keys'],
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
    for (const n of this.world$.querySelectorAll('[data-thought], .create-folded[data-train]')) {
      const q = n.getBoundingClientRect();
      if (q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom) continue;
      ids.add(n.dataset.thought || n.dataset.train);
    }
    const all = [...ids];
    this.sel = !all.length ? null : all.length === 1
      ? { kind: kindOf(this.world.things[all[0]]) === 'train' ? 'train' : 'thought', id: all[0] }
      : { kind: 'many', ids: all };
    this.drawWorld();
  }

  // Where each chosen thing is now (world units), to move them together.
  groupSpots(ids = this.sel.ids) {
    const out = {};
    for (const id of ids) {
      const th = this.world.things[id];
      if (!th) continue;
      if (this.mode === 'pessoa') out[id] = pessoaPoint(this.world, this.roomId, id);
      else if (kindOf(th) === 'train') out[id] = { x: th.x, y: th.y };
      else out[id] = trainSpots(this.world, th.parent)[id];
    }
    return out;
  }

  putAt(id, x, y) {
    const th = this.world.things[id];
    if (!th) return;
    if (this.mode === 'pessoa') place(this.world, this.roomId, id, x, y);
    else if (kindOf(th) === 'train') Object.assign(th, { x, y });
    else nudge(this.world, id, x, y);
  }

  // Double-click: in Joyce, chooses the whole train (then drag it from any of its thoughts or its
  // line); on a passage, picture or folded train in Pessoa, opens it to edit.
  onDouble(e) {
    window.getSelection?.()?.removeAllRanges();
    const trainEl = e.target.closest('[data-train]');
    if (this.mode === 'joyce' && trainEl) {
      this.sel = { kind: 'train', id: trainEl.dataset.train };
      this.drawWorld();
      return;
    }
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id && kindOf(this.world.things[id]) !== 'line') this.openSheet(null, id);
  }

  // ---- Add: the one word at the bottom, which unfolds to the templates and the room's settings ----

  addItem(label, note, fn) {
    return el('button', { type: 'button', class: 'create-add-item', role: 'menuitem', onclick: () => { this.closeAdd(); fn(); } },
      el('span', {}, label), el('span', { class: 'create-add-note' }, note));
  }

  toggleAdd() {
    const open = this.addMenu.hidden;
    this.addMenu.hidden = !open;
    this.addBtn.setAttribute('aria-expanded', String(open));
    this.addBtn.classList.toggle('open', open);
    if (open) this.addMenu.querySelector('button')?.focus();
  }

  closeAdd() {
    if (!this.addMenu || this.addMenu.hidden) return;
    this.addMenu.hidden = true;
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
    let p = null;
    if (this.mode === 'joyce') {
      const t = kindOf(th) === 'train' ? th : this.world.things[th.parent];
      p = t.folded || kindOf(th) === 'train' ? { x: t.x, y: t.y } : trainSpots(this.world, t.id)[f.id];
    } else {
      const t = this.world.things[th.parent];
      p = pessoaPoint(this.world, f.room, t?.folded ? t.id : f.id);
    }
    if (p) { v.x = p.x + 120; v.y = p.y + 20; this.place(); }
    this.found = kindOf(th) === 'train' ? null : f.id;
    this.sel = { kind: kindOf(th) === 'train' ? 'train' : 'thought', id: th.id }; // and its edit pop-up opens
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

  drawBar() {
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
    const title = { line: 'Thought', passage: 'Passage', picture: 'Picture', train: th.folded ? 'A folded train' : 'Train' }[kind];
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
    if (kind === 'train') {
      const n = trainThoughts(this.world, th.id).length;
      rows.push(field(th.title, 'Name this train', (e) => { name(this.world, th.id, e.target.value); done(); }),
        el('div', { class: 'create-options-row' },
          el('span', { class: 'create-options-note' }, `${n} thought${n === 1 ? '' : 's'}`),
          th.folded ? word('Unfold', () => this.unfoldTrain(th.id))
            : n > 1 ? word('Fold into one', () => this.foldTrain(th.id)) : null));
    }
    const others = rooms(this.world).filter((r) => r.id !== this.roomId && !r.locked);
    const pick = el('select', { class: 'create-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? addRoom(this.world, 'Untitled', Date.now(), null, this.cols || 6).id : e.target.value;
        if (to) this.moveTo(to);
      } },
      el('option', { value: '' }, 'Move to…'),
      ...others.map((r) => el('option', { value: r.id }, r.name)),
      el('option', { value: '+' }, 'A new room'));
    rows.push(el('div', { class: 'create-options-row' }, pick),
      el('div', { class: 'create-options-row' },
        kind !== 'train' && this.mode === 'joyce' ? word('The whole train', () => { this.sel = { kind: 'train', id: th.parent }; this.drawWorld(); }) : null,
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

  // Many things chosen with the box: move them to a room together, or delete them.
  drawManyBar() {
    if (this.locked) { this.bar.hidden = true; return; }
    const ids = this.sel.ids.filter((id) => this.world.things[id]);
    const others = rooms(this.world).filter((r) => r.id !== this.roomId && !r.locked);
    const pick = el('select', { class: 'create-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? addRoom(this.world, 'Untitled', Date.now(), null, this.cols || 6).id : e.target.value;
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

  foldTrain(trainId) {
    if (!fold(this.world, trainId)) return;
    this.sel = null;
    this.save();
    this.drawWorld();
    this.openSheet(null, trainId); // name it
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
    const cur = this.current[this.roomId];
    const t = this.world.things[cur];
    if (!this.fresh && t?.parent === this.roomId && !t.folded) return { train: cur };
    const spot = this.freeSpot();
    this.fresh = false;
    return { train: null, x: Math.round(spot.x), y: Math.round(spot.y) };
  }

  async choosePicture() {
    const file = await this.picker.pick();
    if (file) this.takePicture(file);
  }

  onPaste(e) {
    if (this.root.hidden || !this.roomId || this.editing) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    this.takePicture(file);
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
  // an existing thought (id). Keep (Ctrl+Enter) saves it; Escape or Cancel leaves it.
  openSheet(kind, id = null, src = null) {
    if (!this.roomId) return;
    if (this.locked) { this.toast('This room is locked.'); return; }
    if (this.draft) this.commit();
    const th = id ? this.world.things[id] : null;
    kind = th ? kindOf(th) : kind;
    this.editing = { kind, id, src: src || th?.src || null };
    const keep = () => this.keepSheet();
    const keys = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.target.tagName === 'INPUT')) { e.preventDefault(); keep(); } // Enter keeps a name; a passage's body takes Ctrl+Enter
      if (e.key === 'Escape') { e.preventDefault(); this.closeSheet(); }
    };
    const fields = [];
    if (kind === 'train') {
      this.sheetTitle = el('input', { class: 'create-sheet-title', placeholder: 'Name this train of thought', 'aria-label': 'Name', value: th.title || '', onkeydown: keys });
      fields.push(this.sheetTitle, el('div', { class: 'create-sheet-preview' }, thoughtText(this.world, th)));
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
      el('div', { class: 'create-sheet-kind' }, { passage: 'Passage', picture: 'Picture', train: 'A folded train' }[kind]),
      ...fields,
      el('div', { class: 'create-sheet-words' },
        el('button', { type: 'button', class: 'create-word', onclick: keep }, 'Keep'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.closeSheet() }, 'Cancel'),
        el('span', { class: 'create-keys' }, 'Ctrl+Enter keeps it')));
    this.sheet.hidden = false;
    (kind === 'picture' ? this.sheetCaption : kind === 'passage' && th ? this.sheetBody : this.sheetTitle).focus();
  }

  keepSheet() {
    const ed = this.editing;
    if (!ed) return;
    if (ed.kind === 'train') name(this.world, ed.id, this.sheetTitle.value);
    else {
      const fields = ed.kind === 'passage'
        ? { kind: 'passage', title: this.sheetTitle.value, body: this.sheetBody.value }
        : { kind: 'picture', src: ed.src, text: this.sheetCaption.value };
      if (ed.id) update(this.world, ed.id, fields);
      else {
        const t = this.target();
        const train = t.train ? this.world.things[t.train] : startTrain(this.world, this.roomId, t.x, t.y);
        if (create(this.world, train.id, fields)) this.current[this.roomId] = train.id;
        else if (!t.train) remove(this.world, train.id);
      }
    }
    this.save();
    this.closeSheet();
    this.drawWorld();
  }

  closeSheet() {
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
