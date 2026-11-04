// Create: rooms of thoughts. Create (on the home page, or in the menu) slides the rooms page up
// from the bottom, leaving a strip of the home page at the top with the menu (☰) in the top-left
// corner, as on every page, a back arrow home in the top-right one, and Search (Ctrl+K, ⌘K on a
// Mac) in the middle. The page is a light opacity mask over the home picture itself, held still underneath (its
// spontaneity layer is off), so nothing is drawn while it shows. It is a grid of square cells:
// each room is an opacity square on it (one cell; Messy thoughts takes four at the top left), and a
// room written in lately glows. The rooms page has pages (1 2 3 + in the rail, under Archive); a rail on
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
import { loadWorld, room, name, view, create, search, shut, archive, rooms } from './model.js';
import { gather, FALLBACK } from './ontologies/index.js';
import { openDocument } from './document.js';
import { visit, loadLog } from './attention.js';
import { lookPrefs, PALETTE } from './look.js';
import { el, MAC, KEY, WORLD, UNDO, HINTS, enterKeeps } from './shared.js';
import { RoomsPage } from './rooms.js';
import { RoomView } from './room.js';
import { Writing } from './writing.js';
import { Gestures } from './gestures.js';
import { Bars } from './bars.js';
import { Files } from './files.js';

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
    this.tagLight = null; // the tag picked in the rail's Tags list: rooms without it dim
    this.regrouping = null; // the tag whose group is being typed in the Arrange by list
    this.tagsOpen = false; // the rail's Arrange by list is open
    this.openGroup = null; // the group open in it (its name in lower case; '' for Other), or null
    this.makingTag = null; // a + field open in it: { group } for a tag in that group, { group: null } for a new group

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
    // In the menu, on the rooms page: a new room from a room Markdown file (files.js).
    this.add('header.buttons', { id: 'create-import', label: 'Import a room…', icon: 'book', order: 40,
      visible: () => !!this.root && !this.root.hidden && !this.roomId, onClick: () => { this.app.shell?.closeMenu?.(); this.importRoomFile(); } });
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
    else if (this.tagLight) { this.tagLight = null; this.drawRooms(); }
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
    const from = this.shelf ? null : this.page;
    const old = from != null && from !== page && !this.roomsPage.hidden ? this.grid.cloneNode(true) : null;
    const oldTop = this.grid.parentElement?.scrollTop || 0;
    this.page = page;
    this.shelf = false;
    this.roomPick = this.roomSel = this.making = null;
    this.renaming = null;
    this.grid.parentElement?.scrollTo?.(0, 0);
    this.drawRooms();
    if (old) this.scrollPage(old, oldTop, page > from);
  }

  // Going to another page scrolls: to a later page the old one goes up and away and the new one
  // comes up from below; to an earlier one, the other way.
  scrollPage(old, oldTop, down) {
    const wrap = this.grid.parentElement;
    if (!wrap?.animate || this.grid.animate == null || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.pageGhost?.remove();
    const H = wrap.clientHeight, d = down ? 1 : -1;
    old.classList.add('create-page-ghost');
    old.setAttribute('aria-hidden', 'true');
    old.inert = true;
    Object.assign(old.style, { position: 'absolute', top: `${this.grid.offsetTop - oldTop}px`, left: `${this.grid.offsetLeft}px`, margin: '0' });
    wrap.append(old);
    this.pageGhost = old;
    const timing = { duration: 560, easing: 'cubic-bezier(.65, 0, .25, 1)' };
    old.animate([{ transform: 'none' }, { transform: `translateY(${-d * H}px)` }], timing).finished.then(() => old.remove(), () => old.remove());
    this.grid.animate([{ transform: `translateY(${d * H}px)` }, { transform: 'none' }], timing);
  }

  showRooms() {
    const from = this.roomId && !this.roomPage.hidden ? this.roomId : null;
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
    if (from && !this.root.hidden) this.shrink(from);
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

  // Going in zooms in: the square grows into the room (a veil of the room's own colour starts on
  // the square and fills the screen) while the rooms page swells and fades behind it, as if you
  // were walking into the square. Then the room shows under the veil and the veil fades. The room
  // is ready (and can be typed in) at once; only what is seen waits.
  expand(tile) {
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    this.zoomAnim?.cancel();
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
    this.zoomRooms(a, true);
    this.expandTimer = setTimeout(() => {
      this.root.classList.remove('expanding');
      if (this.roomId) this.roomsPage.hidden = true;
      this.zoomAnim?.cancel();
      veil.classList.add('done');
      this.expandTimer = setTimeout(() => veil.remove(), 260);
    }, 500);
  }

  // Leaving zooms out, the other way: the room shrinks back into its square while the rooms page
  // settles from swollen to its place around it.
  shrink(id) {
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    this.zoomAnim?.cancel();
    const tile = this.grid.querySelector(`.create-tile[data-room="${id}"]`);
    const r = room(this.world, id);
    if (!tile || !r || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const look = this.lookOf(r);
    const a = tile.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const veil = el('div', { class: 'create-expand go', style: `background:linear-gradient(${look.top}, ${look.bottom})` });
    this.expandVeil = veil;
    this.root.append(veil);
    veil.getBoundingClientRect();
    veil.style.transform = `translate(${a.left}px, ${a.top}px) scale(${a.width / W}, ${a.height / H})`;
    veil.style.opacity = '0';
    veil.style.transition = 'transform .5s cubic-bezier(.65, 0, .25, 1), opacity .5s cubic-bezier(.7, 0, .9, .4)';
    this.zoomRooms(a, false);
    this.expandTimer = setTimeout(() => veil.remove(), 520);
  }

  // The rooms page swelling about a square (going in), or settling back from swollen (coming out).
  zoomRooms(a, going) {
    const page = this.roomsPage;
    if (!page.animate) return;
    const box = page.getBoundingClientRect();
    const scale = Math.min(6, Math.max(2.2, window.innerWidth / Math.max(1, a.width) / 2));
    const origin = `${a.left + a.width / 2 - box.left}px ${a.top + a.height / 2 - box.top}px`;
    const swollen = { transform: `scale(${scale})`, opacity: 0, transformOrigin: origin };
    const still = { transform: 'none', opacity: 1, transformOrigin: origin };
    this.zoomAnim = page.animate(going ? [still, swollen] : [swollen, still],
      { duration: going ? 500 : 520, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: going ? 'forwards' : 'none' });
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
    this.lightsField = el('input', { class: 'create-lights-field', placeholder: 'Light the rooms that hold… (or #tag)', 'aria-label': 'Search the rooms', autocomplete: 'off', spellcheck: 'false' });
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
    // Under a hairline, Arrange by: None, then the tag groups, each opening to its tags with how
    // many rooms have each. Picking a tag dims the rooms without it, as the search lights do
    // (nothing hides or moves); None, picking it again, or Escape, lets go. + makes groups and tags,
    // and a tag dragged onto a square is added to that room.
    this.tagsBtn = el('button', { type: 'button', class: 'create-rail-item create-tags-btn', 'aria-expanded': 'false',
      onclick: () => { this.tagsOpen = !this.tagsOpen; this.makingTag = null; this.drawRooms(); } }, 'Arrange by');
    this.tagsList = el('div', { class: 'create-tag-list', hidden: true, role: 'list' });
    // The rooms page's pages, in the rail under Archive: 1 2 3 +. A room dropped on a number goes to that page.
    this.pagesBar = el('nav', { class: 'create-pages', 'aria-label': 'Pages' });
    this.rail = el('nav', { class: 'create-rail', 'aria-label': 'Rooms and the Archive' }, this.railRooms, this.shelfBtn, this.pagesBar,
      el('div', { class: 'create-rail-rule', 'aria-hidden': 'true' }), this.tagsBtn, this.tagsList);
    this.shelfHead = el('div', { class: 'create-shelf-head', hidden: true }, 'Archive');
    this.roomsPage = el('section', { class: 'create-rooms', 'aria-label': 'Rooms' },
      this.lightsBar,
      this.rail,
      el('div', { class: 'create-grid-wrap' }, this.shelfHead, this.grid));

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
          this.addItem('Import into this room…', 'or drop a .md file', () => this.importIntoRoom(), false),
          this.addItem('Export as Markdown', '.md', () => this.exportRoomFile(), false),
          el('div', { class: 'create-add-rule' }),
          this.addItem('Keys', '?', () => this.showKeys(), false)),
        this.addBtn = el('button', { type: 'button', class: 'create-word create-add-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleAdd() },
          el('span', { class: 'create-add-plus', 'aria-hidden': 'true' }, '+'), 'Add')),
      this.history,
      this.trayEl,
      this.bar,
      this.sheet = el('div', { class: 'create-sheet', hidden: true }),
      this.docEl = el('div', { class: 'create-doc-veil', hidden: true }),
      this.input);

    this.searchBox = el('div', { class: 'create-search', hidden: true, role: 'dialog', 'aria-label': 'Search' });
    this.savedMark = el('div', { class: 'create-saved', 'aria-live': 'polite' });
    this.hintLine = el('div', { class: 'create-hint' });
    // A small wordmark beside the menu (☰), everywhere in Create: on the rooms page and in a room.
    this.wordmark = el('div', { class: 'create-wordmark', 'aria-hidden': 'true' }, 'Traumerei');
    this.root = el('div', { class: 'create', hidden: true }, this.roomsPage, this.roomPage, this.wordmark, this.searchBtn, this.backBtn, this.searchBox, this.savedMark, this.hintLine,
      this.noteLine = el('div', { class: 'create-note', hidden: true }),
      this.leaveBox = el('div', { class: 'create-sheet create-leave', hidden: true, role: 'dialog', 'aria-label': 'Comment for next time', onpointerdown: (e) => e.stopPropagation() }),
      this.importBox = el('div', { class: 'create-sheet create-leave create-import', hidden: true, role: 'dialog', 'aria-label': 'Import', onpointerdown: (e) => e.stopPropagation() }));
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
    this.listenForFiles();
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
  groupName(g) { return this.ontologies.find((o) => o.id === g?.of)?.groups?.name || 'Train'; } // Train, Chapter
  openDocument(id) { openDocument(this, id); } // a group as a document (document.js)

}

// Create is one class, written in several files: rooms.js (the rooms page), room.js (a room and its
// settings), writing.js, gestures.js (pointer and keys), bars.js (pop-ups) and files.js (room
// Markdown in and out). Each holds a class
// whose methods (and getters, and statics) are copied onto Create here.
function mixIn(target, ...parts) {
  for (const part of parts) {
    for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
      if (key !== 'constructor') Object.defineProperty(target.prototype, key, d);
    }
    for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(part))) {
      if (!['length', 'name', 'prototype'].includes(key)) Object.defineProperty(target, key, d);
    }
  }
}
mixIn(Create, RoomsPage, RoomView, Writing, Gestures, Bars, Files);
