// The room feature: inside a room. A room fills the screen as one gradient of its own colour, laid out like
// the rooms page: the back arrow (to the rooms) top right, the menu top left and Search in the
// middle, its name at the top, and a rail on the left with its modes, where a big room switches
// between them (and Timeline under them). A room is a canvas: drag to move around, wheel / pinch /
// Ctrl+wheel to zoom. Typing anywhere writes a thought; Enter ends it. A click chooses a thought; a
// right-click (or long press, or Enter) opens its properties beside it; a right-click on the empty
// canvas opens Add there. What is on the canvas, where it sits and what a drag does is the
// ontology's (the world feature's ontologies/). This feature keeps no mode of its own. Writing is the
// same in every room: Enter goes on with the train, and Ctrl+Enter starts a new one.
// Add (bottom left) unfolds to Thought, Passage (Alt+P), Picture (Alt+I, or paste) and Keys. A
// train can be folded into one thought, which you name, and unfolded again.
// Ctrl+K searches every room; Ctrl+Z / Ctrl+Shift+Z undo and redo; a quiet "Saved" shows when the
// world is written down, and a line of help shows the first time a room is seen.
//
// The rooms page is the rooms feature's: it sends 'room:open' ({ id, from, seed }) to go in, and
// this feature goes back through its `rooms` service (showRooms). This feature offers `room`
// (leave, hasDraft) to it, and sends 'room:changed' (a room id) when a room is written in. The
// world is the world feature's (its service; world.js binds its rules for the files here).
//
// Saved data: 'drafts' (a thought left half written, per room), 'hinted'.

import { Feature, ui } from 'folio';
import { bind, room, view, shut, MESSY, roomLook } from './world.js';
import { openDocument } from './document.js';
import { el, MAC, KEY, HINT } from './shared.js';
import { RoomView } from './view.js';
import { Writing } from './writing.js';
import { Gestures } from './gestures.js';
import { Bars } from './bars.js';

export default class Room extends Feature {
  start() {
    // The saved world, its rules, saving and undo, the ontologies, the look and the palette are the
    // world feature's (its service; world.js binds its rules for the files here).
    this.w = this.use('world');
    bind(this.w.lib);
    this.rooms = this.use('rooms'); // the rooms page: back to it, and into another room
    this.roomId = null;   // the open room, or null
    this.draft = null;    // the thought being written: { train | null, x, y }, or { train, edit } for a thought opened again
    this.current = {};    // per room: the train Enter goes on with
    this.fresh = false;   // Ctrl+Enter was pressed: the next thought starts a new train
    this.sel = null;      // { kind: 'train' | 'thought', id }
    this.renaming = null; // the open room, while its name is being edited
    this.barFor = null;   // what the properties pop-up is open for (selKey)
    this.editor = null;   // the content editor in the side panel (editor.js), while it shows
    this.editing = null;  // the Passage / Picture sheet: { kind, id | null, src? }
    this.picker = ui.filePicker('image/*');
    this.drafts = this.storage.get('drafts', {}) || {};    // per room: a thought left half written { text, train, x, y }

    this.files = this.use('roomfile');    // a room in and out as Markdown (the roomfile feature), or null
    this.finder = this.use('search');     // Search (Ctrl+K): the search feature's panel, or null
    this.panel = this.use('panel');       // the side panel on the left that editors open in, or null
    this.on('panel:resized', () => { if (this.roomId) this.place(); }); // the room moved over (style.css)
    this.on('world:palette', () => this.repaint()); // the app's colours changed (Settings → Colour)
    this.on('world:look', () => this.repaint());    // Settings → Rooms changed
    this.on('world:saved', () => { if (this.roomId) this.showSaved(); });
    this.on('world:changed', ({ undone }) => {      // a step undone or redone
      this.sel = null;
      this.draft = null;
      if (!this.roomId) return;
      this.showSaved(undone ? 'Undone' : 'Redone');
      if (!room(this.world, this.roomId)) this.back();
      else this.drawRoom();
    });
    this.on('room:open', (o) => this.enter(o));
    this.on('search:found', (f) => { if (this.roomId) this.goTo(f); }); // a find opened in Search
    this.build();
    this.add('settings', { id: 'room-look', title: 'Rooms', order: 30, render: () => this.settingsPane() });
    this.add('rooms.room', {
      leave: () => this.leave(),                // leaves the open room; returns its id, if it showed
      hasDraft: (id) => !!this.drafts[id],      // a thought was left half written there
    });
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => { if (this.roomId) this.place(); });
    // Mathematics' fonts arrive after the first drawing: measure again so nothing overlaps.
    document.fonts?.addEventListener?.('loadingdone', () => { if (this.roomId) this.clearSoon(); });
    document.addEventListener('paste', (e) => this.onPaste(e));
    document.addEventListener('copy', (e) => this.onCopy(e));
  }

  // What the world feature holds, read through its service.
  get world() { return this.w.world; }
  get prefs() { return this.w.prefs; }       // Settings → Rooms' look (look.js)
  get ontPrefs() { return this.w.globals; }  // the global ontology settings: what a new room starts with
  get palette() { return this.w.palette; }   // the app's colours
  get attention() { return this.w.attention; }

  lookOf(r) { return roomLook(r, this.palette, r.id === MESSY, this.prefs); }

  // ---- Going in and out ----

  // Goes into a room (the rooms page asked: 'room:open'). from: its square on the screen, to grow
  // out of; seed: the first letters of a thought to write.
  enter({ id, from = null, seed = '' }) {
    if (!room(this.world, id)) return;
    this.roomId = id;
    this.sel = null;
    this.draft = null;
    this.gearFor = this.settingsFor = null;
    this.root.hidden = false;
    document.documentElement.classList.add('room-open');
    this.closeAdd();
    this.drawRoom();
    if (from) this.expand(from);
    this.takeDraft();
    this.hint();
    if (seed) this.beginWriting(seed);
  }

  // Leaves the room (the rooms page shows again). Returns the room's id, if it showed.
  leave() {
    if (!this.roomId) return null;
    const from = this.root.hidden ? null : this.roomId;
    this.closeSheet();
    this.closeSearch();
    this.panel?.close(null, true);
    this.shelveDraft();
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.closeAdd();
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    this.root.classList.remove('expanding');
    this.root.hidden = true;
    document.documentElement.classList.remove('room-open', 'room-dark');
    return from;
  }

  // Back to the rooms page.
  back() { this.rooms.showRooms(); }

  // Into another room (from search, say): the rooms page goes in.
  openRoom(id) { this.rooms.openRoom(id); }

  // Going in zooms in: the square grows into the room (a veil of the room's own colour starts on
  // the square and fills the screen) while the rooms page swells and fades behind it (the rooms
  // feature). Then the room shows under the veil and the veil fades. The room is ready (and can be
  // typed in) at once; only what is seen waits.
  expand(a) {
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const look = this.lookOf(room(this.world, this.roomId));
    const W = window.innerWidth, H = window.innerHeight;
    const veil = el('div', { class: 'room-expand', style: `background:linear-gradient(${look.top}, ${look.bottom});transform:translate(${a.left}px, ${a.top}px) scale(${a.width / W}, ${a.height / H})` });
    this.expandVeil = veil;
    this.root.classList.add('expanding');
    this.root.append(veil);
    veil.getBoundingClientRect();
    veil.classList.add('go');
    veil.style.transform = 'none';
    this.expandTimer = setTimeout(() => {
      this.root.classList.remove('expanding');
      veil.classList.add('done');
      this.expandTimer = setTimeout(() => veil.remove(), 260);
    }, 500);
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

  // Saves the world (the world feature: a change to the thoughts or rooms is a step Ctrl+Z can take
  // back). A room changed on this visit glows when you leave.
  save() {
    if (this.w.save() && this.roomId) this.emit('room:changed', this.roomId);
    if (this.roomId) this.clearSoon();
  }

  undo(back = true) {
    if (!this.w.undo(back)) this.toast(back ? 'Nothing to undo' : 'Nothing to redo');
  }

  // A quiet word in the corner when the world has been written down.
  showSaved(word = 'Saved') {
    this.savedMark.textContent = word;
    this.savedMark.classList.remove('on');
    void this.savedMark.offsetWidth;
    this.savedMark.classList.add('on');
  }

  // A line of help, once, the first time a room is seen. It fades on the first key or click.
  hint() {
    if (this.storage.get('hinted')) return;
    this.storage.set('hinted', true);
    this.hintLine.textContent = HINT;
    this.hintLine.classList.add('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hintLine.classList.remove('on'), 9000);
  }

  // ---- Building the pages ----

  build() {
    this.backBtn = el('button', { type: 'button', class: 'back-btn room-back', 'aria-label': 'Back to the rooms', onclick: () => this.back() },
      ui.icon('<path d="M20 12H4M10 6l-6 6 6 6"/>'));
    // Search, a bar in the middle of the top row: a search of every room.
    this.searchBtn = el('button', { type: 'button', class: 'word find-btn room-search-btn', 'aria-keyshortcuts': MAC ? 'Meta+K' : 'Control+K',
      onclick: () => this.openSearch() },
    el('span', {}, 'Search'), el('span', { class: 'find-key' }, KEY));
    this.searchBtn.hidden = !this.finder; // no Search without the search feature
    this.crumbName = el('button', { type: 'button', class: 'word room-crumb-name', title: 'Rename', onclick: () => this.renameOpenRoom() });
    // The room's rail, where the rooms page has Rooms and Archive: its modes (a big room switches
    // between them; a small one names its one), and Timeline under Joyce.
    this.modes = el('nav', { class: 'rail room-rail room-modes', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'room-world' });
    this.stage = el('div', { class: 'room-stage', 'data-own-swipe': '' }, this.world$);
    this.input = el('textarea', { class: 'room-input', 'aria-label': 'Write a thought', rows: 1, wrap: 'off', autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'panel pop room-options room-edit', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.history = el('aside', { class: 'panel room-history', hidden: true, 'aria-label': 'Timeline', onpointerdown: (e) => e.stopPropagation() });
    this.trayEl = el('div', { class: 'room-tray', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.roomPage = el('section', { class: 'room-page', 'aria-label': 'Room' },
      this.stage,
      this.modes,
      el('div', { class: 'room-top' }, this.crumbName, this.crumbDesc = el('div', { class: 'room-crumb-desc' })),
      el('div', { class: 'room-add' },
        this.addMenu = el('div', { class: 'panel room-add-menu', hidden: true, role: 'menu' },
          this.addItem('Thought', 'Just type', () => this.beginWriting()),
          this.addItem('Passage', 'Alt+P', () => this.openSheet('passage')),
          this.addItem('Picture', 'Alt+I, or paste', () => this.choosePicture()),
          ...(this.files ? [el('div', { class: 'pick-rule' }),
            this.addItem('Import into this room…', 'or drop a .md file', () => this.importIntoRoom(), false),
            this.addItem('Export as Markdown', '.md', () => this.exportRoomFile(), false),
            ...(this.files.canEdit ? [this.addItem('Edit room as Markdown', 'in the panel', () => this.editAsMarkdown(), false)] : [])] : []),
          el('div', { class: 'pick-rule' }),
          this.addItem('Keys', '?', () => this.showKeys(), false)),
        this.addBtn = el('button', { type: 'button', class: 'word room-add-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => this.toggleAdd() },
          el('span', { class: 'room-add-plus', 'aria-hidden': 'true' }, '+'), 'Add')),
      this.history,
      this.trayEl,
      this.bar,
      this.sheet = el('div', { class: 'panel sheet room-sheet', hidden: true }),
      this.docEl = el('div', { class: 'room-doc-veil', hidden: true }),
      this.input);

    this.keysBox = el('div', { class: 'shade', hidden: true, role: 'dialog', 'aria-label': 'Keys' });
    this.savedMark = el('div', { class: 'saved-note room-saved', 'aria-live': 'polite' });
    this.hintLine = el('div', { class: 'foot-hint room-hint' });
    // A small wordmark beside the menu (☰), as on the rooms page.
    this.wordmark = el('div', { class: 'wordmark room-wordmark', 'aria-hidden': 'true' }, 'Traumerei');
    this.root = el('div', { class: 'room up in-room', hidden: true }, this.roomPage, this.wordmark, this.searchBtn, this.backBtn, this.keysBox, this.savedMark, this.hintLine);
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
    this.stage.addEventListener('mousedown', (e) => { if (e.target.closest?.('.room-draft')) e.preventDefault(); });
    this.stage.addEventListener('dblclick', (e) => this.onDouble(e));
    this.stage.addEventListener('contextmenu', (e) => this.onContext(e));
    document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && this.roomId && !this.draft && !e.target.matches?.('input, textarea, select')) { this.spaceDown = true; this.stage.classList.add('panning'); } });
    document.addEventListener('keyup', (e) => { if (e.code === 'Space') { this.spaceDown = false; this.stage.classList.remove('panning'); } });
    document.addEventListener('pointerdown', (e) => {
      this.hintLine.classList.remove('on');
      if (!this.addMenu.hidden && !e.target.closest('.room-add-menu, .room-add-btn')) this.closeAdd();
    });
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.listenForFiles();
  }

  // ---- A room ----

  // The ontologies there are (the world's), and the one a room is seen through: a room whose
  // ontology is missing (its feature switched off, say) is seen through Pessoa.
  get ontologies() { return this.w.ontologies; }
  ontology(id) { return this.w.ontology(id); }
  get mode() { return this.ontology(view(this.world, this.roomId).mode).id; }
  get ont() { return this.ontology(this.mode); }
  get el() { return el; } // for an ontology drawing its canvas (ontologies/index.js)
  groupName(g) { return this.ontologies.find((o) => o.id === g?.of)?.groups?.name || 'Train'; } // Train, Chapter
  openDocument(id) { openDocument(this, id); } // a group as a document (document.js)

  // ---- Room Markdown: the roomfile feature does the work; this feature says where ----

  // A room Markdown file dropped on a room: its groups and thoughts join it.
  listenForFiles() {
    const files = (e) => !!this.files && [...(e.dataTransfer?.types || [])].includes('Files');
    this.root.addEventListener('dragover', (e) => { if (files(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.root.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(this.files.isRoomFile);
      if (!file) { this.toast('Only a room Markdown file (.md) can be dropped here.'); return; }
      if (this.roomId) this.importIntoRoom(file);
    });
  }

  // In a room: the file's groups and thoughts join it, as its own mode sees them.
  async importIntoRoom(file = null) {
    if (!this.roomId || !this.files) return;
    const roomId = this.roomId;
    const done = await this.files.importInto(roomId, {
      file, at: () => this.freeSpot(), ok: () => this.roomId === roomId, before: () => { if (this.draft) this.commit(); } });
    if (!done) return;
    this.sel = null;
    this.save();
    this.drawRoom();
    this.toast('Imported. Ctrl+Z takes it back.');
  }

  // Downloads a room as <its name>.md (a locked room too).
  exportRoomFile(id = this.roomId) { this.files?.exportRoom(id); }

  // A group (or, with none, the whole room) as room Markdown in the source editor, in the side
  // panel; Apply puts it back as one step (read only in a locked room).
  async editAsMarkdown(groupId = null) {
    if (!this.roomId || !this.files?.canEdit) return;
    const roomId = this.roomId;
    const o = { ok: () => this.roomId === roomId, before: () => { if (this.draft) this.commit(); } };
    this.barFor = null; // the properties pop-up gives way to the panel
    this.drawWorld();
    const done = groupId ? await this.files.editGroup(roomId, groupId, o) : await this.files.editRoom(roomId, o);
    if (!done || this.roomId !== roomId) return;
    this.sel = null;
    this.save();
    this.drawRoom();
    this.toast('Applied. Ctrl+Z takes it back.');
  }

}

// Room is one class, written in several files: view.js (a room and its settings), writing.js,
// gestures.js (pointer and keys) and bars.js (pop-ups). Each holds a class
// whose methods (and getters, and statics) are copied onto Room here.
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
mixIn(Room, RoomView, Writing, Gestures, Bars);
