// The rooms page. Create (on the home page, or in the menu) slides it up from the bottom, leaving
// a strip of the home page at the top with the menu (☰) in the top-left corner, as on every page,
// a back arrow home in the top-right one, and Search (Ctrl+K, ⌘K on a Mac) in the middle. The
// page is a light opacity mask over the home picture itself, held still underneath (its
// spontaneity layer is off). It is a grid of square cells: each room is an opacity square on it
// (one cell; Messy thoughts takes four at the top left), and a room written in lately glows. A rail
// on the left holds Rooms, the floors, the Archive (a grid of its own, where no room can be made)
// and Arrange by. Typing anything here opens Messy thoughts and starts writing there.
//
// On the grid, a click chooses a square (an outline); a right-click (or a long press) opens its
// properties beside it; a double click or Enter goes in. Drag a square to move it: to a free cell,
// onto a floor, or onto Archive. The grid itself is grid.js.
//
// This feature owns the page and going in and out of the rooms page and rooms. Inside a room is the room feature's:
// going in, this page sends 'room:open' ({ id, from, seed }) and zooms out of the way; the room
// comes back through this feature's `rooms` service (showRooms). It also offers `create` (open)
// to the home page. The world is the world feature's (its service; world.js binds its rules).
//
// Saved data: 'lastRoom' (its square glows), 'note' (the comment for next time), 'hinted'.

import { Feature } from 'folio';
import { bind, room, MESSY, remove, shut, pageLook, roomLook, rgb, pageCount } from './world.js';
import { el, MAC, HINT, enterKeeps, railIcon, railWord } from './shared.js';
import { RoomsGrid } from './grid.js';
import { RoomsVerbs } from './verbs.js';
import { RoomsMany } from './many.js';
import { RoomsFloor } from './floor.js';
import { Strip } from './strip.js';
import { ROOMS_KEYS } from './keys.js';

export default class Rooms extends Feature {
  start() {
    this.w = this.use('world');
    bind(this.w.lib);
    this.inRoom = null;   // the room gone into (the room feature shows it), or null
    this.renaming = null; // a room id whose name is being edited on its square
    this.roomPick = null; // the room chosen (outlined) on a grid
    this.roomSel = null;  // the room whose properties show beside it
    this.floorSel = null; // the floor chosen in the rail (its properties show), or null (floor.js)
    this.floorAsk = null; // the floor whose Delete is being warned about, or null (floor.js)
    this.making = null;   // an empty cell clicked: { col, row }, where the new room's kinds show
    this.page = 0;        // the floor that shows
    this.lastRoom = this.storage.get('lastRoom') || null; // the room last gone into: its square glows
    this.shelf = false;   // the Archive page is showing, instead of the grid
    this.lights = null;   // the search lights: what is being looked for, or null
    this.tagLight = null; // the tag picked in the rail's Tags list: rooms without it dim
    this.regrouping = null; // the tag whose group is being typed in the Arrange by list
    this.tagsOpen = false; // the rail's Arrange by list is open
    this.picks = [];       // the rooms chosen, while more than one is (many.js)
    this.manyShown = false; // the Editor tab shows them all ("N rooms", many.js)
    this.openGroup = null; // the group open in it (its name in lower case; '' for Other), or null
    this.makingTag = null; // a + field open in it: { group } for a tag in that group, { group: null } for a new group
    this.edited = new Set(); // the rooms changed on this visit: they glow when you leave

    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), or null
    this.files = this.use('roomfile');    // a room in and out as Markdown (the roomfile feature), or null
    this.floors = this.use('floors');     // every floor's size, and where a room goes (the floors feature)
    this.panel = this.use('panel');       // the right dock, where a room's properties open, or null
    this.frame = this.use('frame');       // the top bar and the foot around the page (the frame feature), or null
    this.time = this.use('time');         // the Time dock (the time feature), or null: grid.js tells it when the page is drawn
    this.propsDock = null;                // a room's properties in it, while they show: { id, body, handle }
    // The page moves over beside the right dock (style.css): its squares are drawn again to fit.
    this.on('frame:rail', () => { if (!this.inRoom && !this.root.hidden) this.drawRooms(); }); // the rail narrowed or widened
    this.on('docks:resized', ({ side }) => { if (side === 'right' && !this.inRoom && !this.root.hidden) this.drawRooms(); });
    this.build();
    this.on('world:palette', () => this.repaint()); // the app's colours changed (Settings → Colour)
    this.on('world:look', () => this.repaint());    // Settings → Rooms changed
    this.on('floors:size', () => { if (!this.inRoom && !this.root.hidden) this.drawRooms(); }); // Settings → Floors changed
    this.on('world:saved', () => { if (!this.inRoom) this.showSaved(); });
    this.on('world:changed', ({ undone }) => {      // a step undone or redone
      this.roomSel = this.making = null;
      if (this.inRoom) return;
      this.showSaved(undone ? 'Undone' : 'Redone');
      this.drawRooms();
    });
    this.on('room:changed', (id) => this.edited.add(id)); // a room was written in
    // In the menu, on the rooms page: a new room from a room Markdown file (the roomfile feature).
    if (this.files) this.add('header.buttons', { id: 'rooms-import', label: 'Import a room…', icon: 'book', order: 40,
      visible: () => !!this.root && !this.root.hidden && !this.inRoom, onClick: () => { this.app.shell?.closeMenu?.(); this.importRoomFile(); } });
    this.defineSlot('rooms.room', 'The open room, shown over this page: { leave() → the id of the room that showed, or null; hasDraft(id) → whether a thought was left half written there }. One item.');
    this.provide('create', { open: () => this.open() });
    // Where the Time dock is (the time feature): the rooms page, whose days list chooses a room.
    this.add('time.place', {
      live: () => !this.root.hidden && !this.away && !this.inRoom,
      room: () => null,
      chosen: () => this.roomPick,
      go: (f) => this.showRoom(f.id),
      redraw: () => { if (!this.inRoom) this.drawRooms(); },
    });
    this.provide('rooms', {
      openRoom: (id) => this.openRoom(id), // goes into a room (from a room, too)
      showRooms: () => this.showRooms(),   // back to this page, from a room
      showFloor: (i) => { if (this.shelf) this.toggleShelf(); this.showPage(i); }, // back to this page, on floor i
      showArchive: () => { this.showRooms(); if (!this.shelf) this.toggleShelf(); }, // back to this page, on the Archive
    });
    document.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('pointerdown', (e) => this.makingAway(e), true); // the new-room menu closes on a press elsewhere (grid.js)
    this.keyMap = this.use('keys'); // the key map: the ? list, or null
    const run = { // the same verbs as in a room (room/verbs.js)
      'rooms.rename': (e) => this.renameChosen(e),
      'rooms.duplicate': (e) => this.duplicateChosen(e),
      'rooms.move': (e) => this.moveChosen(e),
      'rooms.lock': (e) => this.lockChosen(e),
      'rooms.archive': (e) => this.archiveChosen(e),
      'rooms.group': (e) => this.tagChosen(e),
      'rooms.ungroup': (e) => this.untagChosen(e),
    };
    for (const k of ROOMS_KEYS) this.add('keys', { ...k, zone: 'rooms', when: () => !this.root.hidden && !this.inRoom, ...(run[k.id] ? { run: run[k.id] } : {}) });
    window.addEventListener('resize', () => { if (!this.inRoom && !this.root.hidden) this.drawRooms(); });
  }

  // What the world feature holds, read through its service.
  get world() { return this.w.world; }
  get prefs() { return this.w.prefs; }       // Settings → Rooms' look (look.js)
  get ontPrefs() { return this.w.globals; }  // the global ontology settings: what a new room starts with
  get palette() { return this.w.palette; }   // the app's colours
  get attention() { return this.w.attention; }
  get ontologies() { return this.w.ontologies; }

  // The open room (the room feature fills the rooms.room slot), if it is there.
  get room() { return this.slot('rooms.room').items[0] || null; }

  lookOf(r) { return roomLook(r, this.palette, r.id === MESSY, this.prefs); }

  // ---- Opening and closing ----

  open() {
    this.away = false; // (close() sets it: the page is sliding away)
    this.w.load(); // it may have arrived from the account meanwhile
    this.w.begin();
    this.edited = new Set();
    this.leaving = false;
    this.showNote();
    this.app.shell?.closeMenu?.();
    clearTimeout(this.closing);
    this.colours = this.backdrop?.colours?.(); // read once: the page is still from here on
    this.w.refreshPalette();
    this.paintPage();
    this.shelf = false;
    this.page = 0;
    this.roomPick = null;
    this.root.hidden = false;
    document.documentElement.classList.add('rooms-open');
    this.showRooms();
    this.root.getBoundingClientRect(); // so the slide starts from below
    this.root.classList.add('up');
    this.frame?.show(this, { search: () => { if (this.lights != null) this.closeLights(); else this.openLights(); },
      back: () => this.back(), backLabel: 'Back to the home page' });
    this.backdrop?.cover?.(true);
  }

  close() {
    this.away = true;
    this.leaving = false;
    this.leaveBox.hidden = true;
    this.keyMap?.hide();
    this.closeLights();
    this.files?.cancel();
    this.room?.leave();
    this.frame?.hide(this);
    this.backdrop?.cover?.(false);
    this.root.classList.remove('up');
    this.time?.refresh(); // nothing for Time to show on the home page
    clearTimeout(this.closing);
    this.closing = setTimeout(() => {
      this.root.hidden = true;
      document.documentElement.classList.remove('rooms-open');
    }, 520);
  }

  // Where you are, for the frame's breadcrumb: Rooms › Floor 2 (or › Archive).
  crumbs() {
    return [
      { label: 'Rooms', title: 'The rooms', onClick: () => { if (this.shelf) this.toggleShelf(); else if (this.page) this.showPage(0); } },
      this.shelf ? { label: 'Archive', current: true } : { label: `Floor ${this.page + 1}`, current: true },
    ];
  }

  // Back: from a room to the rooms page; from the Archive to the rooms; from the rooms page home.
  back() {
    if (this.inRoom) this.showRooms();
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
    const text = el('textarea', { class: 'rooms-sheet-body', rows: 3, placeholder: 'Where you were, what to pick up next', 'aria-label': 'Comment for next time' });
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
      el('div', { class: 'label' }, 'Add a comment for next time?'),
      text,
      el('div', { class: 'sheet-words' },
        el('button', { type: 'button', class: 'word', onclick: keep }, 'Keep'),
        el('button', { type: 'button', class: 'word', onclick: () => this.close() }, 'Skip'),
        el('span', { class: 'sheet-keys' }, 'Enter keeps it · Ctrl+Enter a new line')));
    this.leaveBox.hidden = false;
    text.focus();
  }

  // The comment left last time, faint under the search bar until it is dismissed.
  showNote() {
    const note = this.storage.get('note');
    this.noteLine.hidden = !note?.text;
    if (!note?.text) return;
    this.noteLine.replaceChildren(el('span', {}, note.text),
      el('button', { type: 'button', class: 'word rooms-note-x', title: 'Dismiss', onclick: () => { this.storage.set('note', null); this.noteLine.hidden = true; } }, 'dismiss'));
  }

  // Shows a floor of the rooms page: the strip of floors slides to it (from the floor that showed).
  showPage(page = this.page) {
    if (this.inRoom) this.showRooms();
    this.closeLights();
    const slide = !this.shelf && page !== this.page && !this.roomsPage.hidden;
    this.page = page;
    this.shelf = false;
    this.roomPick = this.roomSel = this.making = null;
    this.floorSel = this.floorAsk = null;
    this.renaming = null;
    this.drawRooms({ slide });
  }

  // Back to the rooms page (from a room, the room feature leaves it, and its square takes it back).
  showRooms() {
    this.inRoom = null; // first, so a save made on the way out shows here
    const from = this.room?.leave() || null; // the room that showed, if one did
    this.roomSel = this.making = null;
    this.roomsPage.hidden = false;
    this.root.classList.remove('in-room');
    this.drawRooms();
    if (from && !this.root.hidden) this.shrink(from);
  }

  // Goes into a room (with `seed`, the first letters of a thought to write there): the room
  // feature shows it, zooming in from its square when it is on the page. Back then goes to its
  // floor (or the Archive, if it was opened from there).
  openRoom(id, seed = '') {
    const r = room(this.world, id);
    if (!r || !this.room) return;
    if (!this.shelf) this.page = r.page || 0;
    this.closeLights();
    this.w.visit(id);
    this.lastRoom = id;
    this.storage.set('lastRoom', id);
    const tile = !this.inRoom && !this.roomsPage.hidden && this.grid.querySelector(`.rooms-tile[data-room="${id}"]`);
    const from = tile ? tile.getBoundingClientRect() : null;
    // A room's properties in the dock give way to the room.
    if (this.propsDock) { this.propsDock = null; this.roomSel = null; this.panel.close('room', true); }
    this.inRoom = id;
    this.root.classList.add('in-room');
    this.emit('room:open', { id, from, seed });
    if (from) this.zoomOut(from); else this.roomsPage.hidden = true;
  }

  // Chooses a room where it is: on its floor, or in the Archive (from the Time dock).
  showRoom(id) {
    const r = room(this.world, id);
    if (!r || this.inRoom) return;
    if (!!r.archived !== this.shelf) this.toggleShelf();
    if (!r.archived && (r.page || 0) !== this.page) this.showPage(r.page || 0);
    this.roomPick = id;
    this.drawRooms();
  }

  // Going in, the rooms page swells about the square and fades (the room grows out of the square
  // over it), and then hides.
  zoomOut(a) {
    clearTimeout(this.zoomTimer);
    this.shrinkVeil?.remove();
    this.zoomAnim?.cancel();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { this.roomsPage.hidden = true; return; }
    this.zoomRooms(a, true);
    this.zoomTimer = setTimeout(() => {
      if (this.inRoom) this.roomsPage.hidden = true;
      this.zoomAnim?.cancel();
    }, 500);
  }

  // Leaving zooms out, the other way: the room shrinks back into its square while the rooms page
  // settles from swollen to its place around it.
  shrink(id) {
    this.shrinkVeil?.remove();
    clearTimeout(this.zoomTimer);
    this.zoomAnim?.cancel();
    const tile = this.grid.querySelector(`.rooms-tile[data-room="${id}"]`);
    const r = room(this.world, id);
    if (!tile || !r || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const look = this.lookOf(r);
    const a = tile.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    const veil = el('div', { class: 'expand go', style: `background:linear-gradient(${look.top}, ${look.bottom})` });
    this.shrinkVeil = veil;
    this.root.append(veil);
    veil.getBoundingClientRect();
    veil.style.transform = `translate(${a.left}px, ${a.top}px) scale(${a.width / W}, ${a.height / H})`;
    veil.style.opacity = '0';
    veil.style.transition = 'transform .5s cubic-bezier(.65, 0, .25, 1), opacity .5s cubic-bezier(.7, 0, .9, .4)';
    this.zoomRooms(a, false);
    this.zoomTimer = setTimeout(() => veil.remove(), 520);
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

  // A change to the rooms (the world feature saves it; Ctrl+Z can take it back).
  save() { this.w.save(); }

  undo(back = true) {
    if (!this.w.undo(back)) this.toast(back ? 'Nothing to undo' : 'Nothing to redo');
  }

  // A quiet word in the corner when the world has been written down.
  showSaved(word = 'Saved') { this.frame?.saved(word); }

  // A line of help, once, the first time the page is seen. It fades on the first key or click.
  hint() {
    if (this.storage.get('hinted')) return;
    this.storage.set('hinted', true);
    this.frame?.hint(HINT);
  }

  // ---- The look: the picture's colours (read when Create opened) and Settings → Rooms ----

  paintPage() {
    const page = pageLook(this.colours, this.prefs, this.palette);
    this.root.style.setProperty('--rooms-top', page.top);
    this.root.style.setProperty('--rooms-bottom', page.bottom);
    this.root.style.setProperty('--rooms-mask', page.mask);
    // A lit room's glow: the palette's glow, lightened toward white.
    const glow = rgb(this.palette.glow) || [239, 204, 131];
    const lift = (t, a) => `rgb(${glow.map((v) => Math.round(v + (255 - v) * t)).join(' ')} / ${a.toFixed(3)})`;
    this.root.style.setProperty('--rooms-glow', lift(0.55, this.prefs.glow));
    this.root.style.setProperty('--rooms-glow-in', lift(0.7, this.prefs.glow * 0.64));
  }

  // Shows a change straight away, if the page shows.
  repaint() {
    this.paintPage();
    if (!this.root.hidden && !this.inRoom) this.drawRooms();
  }

  // ---- Keys ----

  onKey(e) {
    if (this.root.hidden || this.inRoom || document.querySelector('dialog[open]')) return;
    if (e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openLights(); return; }
    if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); this.pickAll(); return; }
    if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      this.undo(e.key.toLowerCase() === 'z' && !e.shiftKey);
      return;
    }
    if (e.key === 'Escape') {
      if (this.floorAsk != null) { this.cancelFloor(); return; }
      if (this.clearPicks()) return;
      if (this.roomSel || this.making || this.floorSel != null) { this.roomSel = this.making = this.floorSel = null; this.drawRooms(); }
      else if (this.roomPick) { this.roomPick = null; this.drawRooms(); }
      else if (this.lights != null) this.closeLights();
      else this.back();
      return;
    }
    // Page Up and Page Down: the floor above or below.
    if ((e.key === 'PageUp' || e.key === 'PageDown') && !mod && !this.shelf) {
      e.preventDefault();
      const next = this.page + (e.key === 'PageDown' ? 1 : -1);
      if (next >= 0 && next < pageCount(this.world)) this.showPage(next);
      return;
    }
    if (this.shortcut(e, mod)) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.('button') && e.key === ' ') return; // Space on a word presses it
    if (e.key === ' ') return; // a lone Space does nothing here
    e.preventDefault();
    this.openRoom(MESSY, e.key); // typing anything starts a thought in Messy thoughts
  }

  // On a grid, Delete removes the chosen room (Ctrl+Z brings it back); Enter goes in;
  // the ContextMenu key (or Shift+F10) opens its properties. True when the key was used.
  shortcut(e, mod) {
    const k = e.key;
    const id = this.roomSel || this.roomPick;
    const r = id && room(this.world, id);
    const deletes = k === 'Delete' || (MAC && e.metaKey && k === 'Backspace');
    // A floor chosen in the rail: Delete warns first (floor.js); Enter then deletes, Escape cancels.
    if (this.floorAsk != null && k === 'Enter') { e.preventDefault(); this.deleteFloor(this.floorAsk); return true; }
    if (deletes && this.floorSel != null && !r && !this.picks.length) { e.preventDefault(); this.askFloor(this.floorSel); return true; }
    if (deletes && this.picks.length > 1) { e.preventDefault(); this.deleteMany(); return true; }
    if (deletes && r && r.id !== MESSY && !shut(this.world, r.id)) {
      e.preventDefault();
      remove(this.world, r.id);
      this.roomSel = this.roomPick = null;
      this.save();
      this.drawRooms();
      this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
      return true;
    }
    if (k === 'Enter' && r) { e.preventDefault(); this.openRoom(r.id); return true; }
    if ((k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) && r) { e.preventDefault(); this.askRoom(r.id); return true; }
    return false;
  }

  // Ctrl+R: the chosen room's properties open with its name chosen to type over. In a field the
  // key does nothing (it is still taken, so the page doesn't reload).
  renameChosen(e) {
    if (e?.target?.matches?.('input, textarea, select, [contenteditable]')) return;
    const id = this.roomSel || this.roomPick;
    if (!id || !room(this.world, id)) return;
    this.chooseRoom(id, true);
    const field = (this.propsDock?.body || this.grid).querySelector('.pop-name');
    field?.focus({ preventScroll: true });
    field?.select();
  }

  // ---- Room Markdown: the roomfile feature does the work; this page says where ----

  // On the rooms page: a new room from a file, in `cell` (or the first free one).
  async importRoomFile(file = null, cell = null) {
    if (!this.files) return;
    const page = this.shelf ? 0 : this.page;
    const r = await this.files.importRoom({ file, cell, page, ok: () => !this.root.hidden });
    if (!r) return;
    const at = r.page || 0; // a full floor sends it to a new one (the floors feature says so)
    this.making = this.roomSel = null;
    this.roomPick = r.id;
    this.save();
    if (this.inRoom) this.showRooms();
    if (this.shelf) this.toggleShelf();
    if (this.page !== at) this.showPage(at); else this.drawRooms();
    if (at === page) this.toast(`${r.name} is here. Ctrl+Z takes it back.`);
  }

  // Downloads a room as <its name>.md (a locked room too).
  exportRoomFile(id) { this.files?.exportRoom(id); }

  // ---- Building the page ----

  build() {
    this.grid = el('div', { class: 'rooms-grid' });
    // The floors, one strip that slides to whole floors: a wheel or trackpad gesture asks for the next.
    this.strip = new Strip({ onFloor: (i) => { if (!this.shelf && !this.inRoom) this.showPage(i); } });
    this.strip.show([[this.shelfHead = el('div', { class: 'rooms-shelf-head', hidden: true }, 'Archive'), this.grid]], 0);
    // Search lights (Ctrl+K): the rooms without the words dim.
    this.lightsField = el('input', { class: 'rooms-lights-field', placeholder: 'Light the rooms that hold… (or #tag)', 'aria-label': 'Search the rooms', autocomplete: 'off', spellcheck: 'false' });
    this.lightsBar = el('div', { class: 'panel rooms-lights', hidden: true }, this.lightsField,
      this.lightsNote = el('span', { class: 'rooms-lights-note' }));
    this.lightsField.addEventListener('input', () => { this.lights = this.lightsField.value; this.drawRooms(); });
    this.lightsField.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.closeLights(); }
      if (e.key === 'Enter') { e.preventDefault(); const best = this.bestLit(); if (best) this.openRoom(best); }
    });
    // The rail on the left (Folio's column of veil, its width the frame's): under Floors, each
    // floor, + New floor and the Archive (a room dropped on a floor goes to that floor, on Archive
    // goes there); under Arrange by, Tags; at the foot, ⋯ More (the frame feature's).
    this.shelfBtn = el('button', { type: 'button', class: 'rail-item rooms-shelf-btn', 'data-drop': 'archive', title: 'Archive',
      onclick: () => { if (!this.shelf) this.toggleShelf(); } }, railIcon('archive'), railWord('Archive'));
    // Tags opens the tag groups, each opening to its tags with how many rooms have each. Picking a
    // tag dims the rooms without it, as the search lights do (nothing hides or moves); None,
    // picking it again, or Escape, lets go. + makes groups and tags, and a tag dragged onto a
    // square is added to that room. On a narrow rail it widens the rail first.
    this.tagsBtn = el('button', { type: 'button', class: 'rail-item rooms-tags-btn', 'aria-expanded': 'false', title: 'Tags',
      onclick: () => {
        if (this.frame?.railNarrow) { this.frame.toggleRail(); this.tagsOpen = true; } else this.tagsOpen = !this.tagsOpen;
        this.makingTag = null; this.drawRooms();
      } }, railIcon('tag'), railWord('Tags'));
    this.tagsList = el('div', { class: 'rooms-tag-list rail-wide', hidden: true, role: 'list' });
    this.pagesBar = el('div', { class: 'rooms-pages', role: 'group', 'aria-label': 'Floors' });
    this.rail = el('nav', { class: 'rail rooms-rail', 'aria-label': 'Floors and the Archive' },
      el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Floors'), this.pagesBar, this.shelfBtn,
      el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Arrange by'), this.tagsBtn, this.tagsList,
      this.moreBox = el('div', { class: 'rooms-more' })); // ⋯ More, holding Time (grid.js draws it)
    this.roomsPage = el('section', { class: 'rooms-rooms', 'aria-label': 'Rooms' },
      this.lightsBar,
      this.rail,
      this.strip.el);

    // The wordmark, Search (the search lights), the back arrow, "Saved" and the line of help are
    // the frame feature's (open() shows it).
    this.root = el('div', { class: 'rooms', hidden: true }, this.roomsPage,
      this.noteLine = el('div', { class: 'rooms-note', hidden: true }),
      this.leaveBox = el('div', { class: 'panel sheet rooms-leave', hidden: true, role: 'dialog', 'aria-label': 'Comment for next time', onpointerdown: (e) => e.stopPropagation() }));
    (document.getElementById('folio-root') || document.body).append(this.root);

    // A room Markdown file dropped on the page: a new room, in the first free cell.
    const files = (e) => !!this.files && [...(e.dataTransfer?.types || [])].includes('Files');
    this.root.addEventListener('dragover', (e) => { if (files(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    this.root.addEventListener('drop', (e) => {
      if (!files(e)) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(this.files.isRoomFile);
      if (!file) { this.toast('Only a room Markdown file (.md) can be dropped here.'); return; }
      this.importRoomFile(file);
    });
  }
}

// The grid (grid.js), the verbs (verbs.js), choosing many (many.js) and a floor's properties (floor.js) are written as classes of their own, whose methods
// are copied onto Rooms here, so `this` there is this feature.
for (const part of [RoomsGrid, RoomsVerbs, RoomsMany, RoomsFloor]) {
  for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (key !== 'constructor') Object.defineProperty(Rooms.prototype, key, d);
  }
}
