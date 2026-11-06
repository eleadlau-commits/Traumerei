// The room feature: inside a room. A room fills the screen as one gradient of its own colour, laid out like
// the rooms page: the back arrow (to the rooms) top right, the menu top left and Search in the
// middle, its name at the top, and a rail on the left with its modes, where a big room switches
// between them. A room is a canvas: drag to move around, wheel / pinch /
// Ctrl+wheel to zoom. Typing anywhere writes a thought; Enter ends it. A click chooses a thought; a
// right-click (or long press, or Enter) opens its properties beside it; a right-click on the empty
// canvas opens Add there. What is on the canvas, where it sits and what a drag does is the
// ontology's (the world feature's ontologies/). This feature keeps no mode of its own. Writing is the
// same in every room: Enter goes on with the train, and Ctrl+Enter starts a new one.
// A right-click on the empty canvas opens Add there: Thought, Passage (Alt+P), Picture (Alt+I, or
// paste) and Import. The loose dock's + has Passage, Picture and Import too, which land loose;
// Export, Edit as text and Keys are under ⋯ More at the foot of the rail. A
// group can be closed into one thought, which you name, and opened again.
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
import { bind, room, view, shut, MESSY, roomLook, sides, twinOf } from './world.js';
import { openDocument } from './document.js';
import { el, HINT } from './shared.js';

// The status bar's quiet line in a room, while the pointer is over nothing in particular.
const IDLE = 'Type anywhere to write · Enter keeps it · Ctrl+Enter a new train · Right-click edits';
// What it says over a thought or a group on the canvas.
const OVER = {
  thought: 'Thought · Click to choose · Triple-click to write in it · Right-click edits · Drag to move',
  group: 'Click to choose · Double-click for the whole group · Right-click edits',
};
import { RoomView } from './view.js';
import { Writing } from './writing.js';
import { Gestures } from './gestures.js';
import { Bars } from './bars.js';
import { Twin } from './twin.js';
import { ROOM_KEYS } from './keys.js';
import * as verbs from './verbs.js';

export default class Room extends Feature {
  start() {
    // The saved world, its rules, saving and undo, the ontologies, the look and the palette are the
    // world feature's (its service; world.js binds its rules for the files here).
    this.w = this.use('world');
    bind(this.w.lib);
    this.rooms = this.use('rooms'); // the rooms page: back to it, and into another room
    this.floors = this.use('floors'); // where a new room goes (the floors feature)
    this.roomId = null;   // the open room, or null
    this.draft = null;    // the thought being written: { train | null, x, y }, or { train, edit } for a thought opened again
    this.current = {};    // per room: the train Enter goes on with
    this.fresh = false;   // Ctrl+Enter was pressed: the next thought starts a new train
    this.sel = null;      // { kind: 'train' | 'thought', id }
    this.renaming = null; // the open room, while its name is being edited
    this.barFor = null;   // what the properties pop-up is open for (selKey)
    this.editor = null;   // the content editor in the side panel (editor.js), while it shows
    this.editing = null;  // the Passage / Picture sheet: { kind, id | null, src? }
    this.past = null;     // a day gone back to in the Time dock: { day, later, lit }, or null
    this.picker = ui.filePicker('image/*');
    this.drafts = this.storage.get('drafts', {}) || {};    // per room: a thought left half written { text, train, x, y }

    this.files = this.use('roomfile');    // a room in and out as a .traum file (the roomfile feature), or null
    this.finder = this.use('search');     // Search (Ctrl+K): the search feature's panel, or null
    this.panel = this.use('panel');       // the right dock, that editors open in, or null
    this.docks = this.use('docks');       // both docks: the loose thoughts fill the left one, or null
    this.keyMap = this.use('keys');      // the key map: the ? list, or null
    this.frame = this.use('frame');       // the top bar and the foot around the room (the frame feature), or null
    this.time = this.use('time');         // the Time dock (the time feature), or null
    const run = {
      'room.mode': (e) => this.nextMode(e.shiftKey ? -1 : 1),
      // The same verbs as on the rooms page (verbs.js).
      'room.rename': (e) => verbs.rename(this, e),
      'room.duplicate': (e) => verbs.duplicate(this, e),
      'room.fold': (e) => verbs.fold(this, e),
      'room.close': (e) => verbs.close(this, e),
      'room.group': (e) => verbs.group(this, e),
      'room.ungroup': (e) => verbs.ungroup(this, e),
      'room.join': (e) => verbs.join(this, e),
      'room.move': (e) => verbs.moveTo(this, e),
      'room.throw-back': (e) => verbs.throwBack(this, e),
      'room.lock': (e) => verbs.lock(this, e),
    };
    const live = () => !this.root.hidden && !!this.roomId;
    // Tab swaps modes only in a big room, and only while nothing (a field, a word in a dock) has
    // the focus but the room's canvas; elsewhere Tab keeps its usual job.
    const when = { 'room.mode': () => live() && this.tabSwaps(), 'room.join': () => live() && !!this.ont?.join };
    for (const k of ROOM_KEYS) this.add('keys', { ...k, zone: 'room', when: when[k.id] || live, ...(run[k.id] ? { run: run[k.id] } : {}) });
    // Editor, Export, Edit as text and Keys under ⋯ More, at the foot of the room's rail (the
    // frame feature's slot rail.more), shown only inside a room.
    if (this.frame) {
      if (this.panel) {
        this.add('rail.more', { id: 'room-editor', label: 'Editor', order: 5, visible: live, run: () => this.toggleEditor(),
          on: () => this.editorShowing(), icon: '<rect x="4" y="5" width="16" height="14"/><path d="M14 5v14"/>',
          title: () => 'Show or hide the Editor: what is chosen, or this room\'s settings' });
      }
      if (this.files) {
        this.add('rail.more', { id: 'room-export', label: 'Export', order: 20, visible: live, run: () => this.exportRoomFile(),
          icon: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 14v6h16v-6"/>', title: () => 'Export this room as a .traum file' });
        this.add('rail.more', { id: 'room-text', label: 'Edit as text', order: 21, icon: 'note', run: () => this.editAsMarkdown(),
          visible: () => live() && !!this.files.canEdit, title: () => 'Edit this room as text, in the right dock' });
      }
      if (this.keyMap) {
        this.add('rail.more', { id: 'room-keys', label: 'Keys', order: 30, icon: 'help', visible: live, run: () => this.showKeys(),
          title: () => 'Every key · ?' });
      }
    }
    this.on('docks:resized', () => { if (this.roomId) this.place(); }); // the room moved over (style.css)
    this.on('frame:rail', () => { if (this.roomId) this.place(); });    // the canvas starts beside the rail
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
    // Where the Time dock is (the time feature): this room's Timeline. A click there chooses what it
    // names; the Editor follows, but Time stays in front (bars.js).
    this.add('time.place', {
      live: () => !this.root.hidden && !!this.roomId,
      room: () => this.roomId,
      chosen: () => (this.sel && this.sel.kind !== 'many' ? this.sel.id : null),
      go: (f) => { this.fromTimeline = true; try { this.goTo(f); } finally { this.fromTimeline = false; } },
      redraw: () => { if (this.roomId) this.drawRoom(); },
      // A past day: { day, later, lit } (thought ids), or null for now (view.js markPast).
      showDay: (past) => { this.past = past; if (this.roomId) this.drawWorld(); },
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

  lookOf(r) { return roomLook(twinOf(this.world, r.id) || r, this.palette, r.id === MESSY, this.prefs); } // a Twin's side: the Twin's look

  // ---- Going in and out ----

  // Goes into a room (the rooms page asked: 'room:open'). from: its square on the screen, to grow
  // out of; seed: the first letters of a thought to write.
  enter({ id, from = null, seed = '' }) {
    const twin = sides(this.world, id); // a Twin: its left side first (twin.js)
    if (twin.length) id = twin[0].id;
    if (!room(this.world, id)) return;
    this.roomId = id;
    this.sel = null;
    this.draft = null;
    this.gearFor = this.settingsFor = null;
    this.root.hidden = false;
    document.documentElement.classList.add('room-open');
    this.frame?.show(this, { search: this.finder ? () => this.openSearch() : null, back: () => this.back(), backLabel: 'Back to the rooms', crumbs: this.crumbs(),
      idle: IDLE });
    this.closeAdd();
    this.drawRoom();
    if (from) this.expand(from);
    this.takeDraft();
    this.hint();
    if (seed) this.beginWriting(seed);
  }

  // Leaves the room (the rooms page shows again). Returns the room's id, if it showed.
  // ⋯ More → Editor: whether the right dock shows the Editor (what is chosen, or this room's
  // settings), and showing or hiding it. With nothing chosen it shows this room's settings for
  // the mode it is in.
  editorShowing() {
    return !!this.panel && (this.panel.isShowing('content') || this.panel.isShowing('mode-settings'));
  }

  toggleEditor() {
    if (!this.panel || !this.roomId) return;
    if (this.panel.isShowing('content')) this.panel.close('content');
    else if (this.panel.isShowing('mode-settings')) { this.settingsFor = null; this.drawRoom(); }
    else if (this.sel && this.sel.kind !== 'many' && this.world.things[this.sel.id]) this.openProps(this.sel);
    else this.openRoomSettings(this.mode); // draws the room, and the settings with it
  }

  leave() {
    if (!this.roomId) return null;
    const from = this.root.hidden ? null : twinOf(this.world, this.roomId)?.id || this.roomId; // a side: its Twin's square
    this.closeSheet();
    this.closeSearch();
    this.modeSettings = null; // (and closing the ⚙ settings doesn't draw the room)
    this.panel?.closeAll(true);
    this.docks?.left.close('loose', true);
    this.shelveDraft();
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.closeAdd();
    this.expandVeil?.remove();
    clearTimeout(this.expandTimer);
    this.root.classList.remove('expanding');
    this.root.hidden = true;
    this.frame?.hide(this);
    document.documentElement.classList.remove('room-open', 'room-dark');
    this.time?.refresh(); // Time shows the rooms page now, or closes
    return from;
  }

  // Back to the rooms page.
  back() { this.rooms.showRooms(); }

  // Where you are, for the frame's breadcrumb: Rooms › Floor 1 › the room (or Rooms › Archive › …).
  crumbs() {
    const r = twinOf(this.world, this.roomId) || room(this.world, this.roomId); // a Twin's side: the Twin's floor
    const floor = r?.archived ? { label: 'Archive', onClick: () => this.rooms.showArchive?.() }
      : { label: `Floor ${(r?.page || 0) + 1}`, onClick: () => this.rooms.showFloor?.(r?.page || 0) };
    return [{ label: 'Rooms', title: 'Back to the rooms', onClick: () => this.back() }, floor, { node: this.crumb }];
  }

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
    const veil = el('div', { class: 'expand', style: `background:linear-gradient(${look.top}, ${look.bottom});transform:translate(${a.left}px, ${a.top}px) scale(${a.width / W}, ${a.height / H})` });
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
  showSaved(word = 'Saved') { this.frame?.saved(word); }

  // A line of help, once, the first time a room is seen. It fades on the first key or click.
  hint() {
    if (this.storage.get('hinted')) return;
    this.storage.set('hinted', true);
    this.frame?.hint(HINT);
  }

  // ---- Building the pages ----

  build() {
    // The room's name and its line, the last step of the frame's breadcrumb (click the name to rename).
    this.crumbName = el('button', { type: 'button', class: 'crumb room-crumb-name', 'aria-current': 'page', title: 'Rename', onclick: () => this.renameOpenRoom() });
    this.crumbDesc = el('span', { class: 'crumb-note room-crumb-desc' });
    this.crumb = el('span', { class: 'room-crumb' }, this.crumbName, this.crumbDesc);
    // The room's rail, where the rooms page has Rooms and Archive: its modes (a big room switches
    // between them; a small one names its one), and Time under Views.
    this.modes = el('nav', { class: 'rail room-rail room-modes', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'room-world' });
    this.stage = el('div', { class: 'room-stage', 'data-own-swipe': '' }, this.world$);
    const otherSide = this.twinPanel(); // a Twin's other side, beside the canvas (twin.js)
    this.input = el('textarea', { class: 'room-input', 'aria-label': 'Write a thought', rows: 1, wrap: 'off', autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'panel pop room-options room-edit', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.trayEl = el('div', { class: 'room-tray', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    this.roomPage = el('section', { class: 'room-page', 'aria-label': 'Room' },
      this.stage,
      otherSide,
      this.modes,
      el('div', { class: 'room-add' },
        this.addMenu = el('div', { class: 'panel room-add-menu', hidden: true, role: 'menu' },
          this.addItem('Thought', 'Just type', () => this.beginWriting()),
          this.addItem('Passage', 'Alt+P', () => this.openSheet('passage')),
          this.addItem('Picture', 'Alt+I, or paste', () => this.choosePicture()),
          ...(this.files ? [el('div', { class: 'pick-rule' }),
            this.addItem('Import into this room…', 'or drop a .traum or .md file', () => this.importIntoRoom(), false)] : []))),
      this.trayEl,
      this.bar,
      this.sheet = el('div', { class: 'panel sheet room-sheet', hidden: true }),
      this.docEl = el('div', { class: 'room-doc-veil', hidden: true }),
      this.input);

    // The wordmark, Search, the back arrow, "Saved" and the line of help are the frame feature's
    // (enter() shows it).
    this.root = el('div', { class: 'room up in-room', hidden: true }, this.roomPage);
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
      if (!this.addMenu.hidden && !e.target.closest('.room-add-menu')) this.closeAdd();
      if (this.loose?.menu && !this.loose.menu.hidden && !e.target.closest('.room-loose-plus, .room-loose-menu')) this.closeLooseMenu();
    });
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    // The status bar explains what is under the pointer on the canvas.
    this.stage.addEventListener('pointerover', (e) => {
      const t = e.target.closest?.('[data-thought]');
      this.frame?.hover(t ? OVER.thought : e.target.closest?.('[data-train], .room-strand') ? OVER.group : null);
    });
    this.stage.addEventListener('pointerleave', () => { this.frame?.hover(null); this.mouse = null; });
    // Where the pointer last was on the canvas: typing and pasting start there (freeSpot).
    this.stage.addEventListener('pointermove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
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
  // A closed group opened (Russell's closed chapter): in the content editor, in the right dock's
  // Editor tab, with its thoughts as paragraphs to write in; without docks, as a document pop-up
  // (document.js).
  openDocument(id) {
    if (!this.panel) { openDocument(this, id); return; }
    if (this.draft) this.commit();
    this.sel = { kind: 'train', id };
    this.openProps(this.sel);
  }

  // ---- Room files (.traum): the roomfile feature does the work; this feature says where ----

  // A room file (.traum, or plain .md) dropped on a room: its groups and thoughts join it.
  listenForFiles() {
    const files = (e) => !!this.files && [...(e.dataTransfer?.types || [])].includes('Files');
    this.root.addEventListener('dragover', (e) => { if (files(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.root.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(this.files.isRoomFile);
      if (!file) { this.toast('Only a room file (.traum) or a Markdown file (.md) can be dropped here.'); return; }
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

  // Downloads a room as <its name>.traum (a locked room too).
  exportRoomFile(id = this.roomId) { this.files?.exportRoom(id); }

  // A group (or, with none, the whole room) as .traum text in the source editor, in the side
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
// gestures.js (pointer and keys), bars.js (pop-ups) and twin.js (a Twin's two sides). Each holds a class
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
mixIn(Room, RoomView, Writing, Gestures, Bars, Twin);
