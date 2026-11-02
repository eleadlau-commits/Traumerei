// Create: rooms of thoughts. Create (on the home page, or in the menu) opens the rooms: dark
// squares on a grid under the menu's veil, like windows of a building at night; a room written in
// lately is lit. There is always "Messy thoughts". Typing anything on the rooms page opens Messy
// thoughts and starts writing there, at a random place.
//
// A room is a canvas: drag to move around, wheel / pinch / Ctrl+wheel to zoom. Typing anywhere
// writes a thought; Enter ends it. Each room is seen through an ontological mode:
// - Joyce (the default): thoughts are joined by time into trains, read like prose. Enter goes on
//   with the same train; Ctrl+Enter starts a new train somewhere else. A train can't be broken:
//   it is dragged, and moved to another room, whole.
// - Pessoa: every thought floats on its own, laid on a loose spiral outwards in the order they
//   were written, and can be dragged anywhere.
// Select a train (Joyce) or a thought (Pessoa) to move it to another room, or a new one.
//
// A thought need not be a line of words. Two templates make bigger ones: a Passage (a title and a
// paragraph, or a small article; Alt+P) and a Picture (with a caption; Alt+I, or paste one). A
// train can be folded into one thought, a passage that keeps the train inside it and can unfold.
//
// Saved data: 'world' → see model.js. It is saved with everything else, so it follows the
// account like the settings do.

import { Feature, ui } from 'folio';
import {
  MESSY, MODES, loadWorld, room, addRoom, renameRoom, view, startTrain, addThought, addThing,
  updateThing, kindOf, trainThoughts, roomThoughts, roomTrains, lastWritten, moveTrain, moveThought,
  spiralPoint, pessoaPoint, placeThought, randomSpot, foldTrain, unfold,
} from './model.js';
import { shrinkPicture } from './picture.js';

const { el } = ui;
const LIT_FOR = 24 * 3600e3; // a room stays lit for a day after it was written in
const ZOOM = { min: 0.25, max: 4 };

export default class Create extends Feature {
  start() {
    this.world = loadWorld(this.storage.get('world'));
    this.roomId = null;   // the open room, or null on the rooms page
    this.draft = null;    // the thought being written: { train | null, x, y }
    this.current = {};    // per room: the train Enter goes on with
    this.fresh = false;   // Ctrl+Enter was pressed: the next thought starts a new train
    this.sel = null;      // { kind: 'train' | 'thought', id }
    this.renaming = null; // a room id whose name is being edited
    this.editing = null;  // the Passage / Picture sheet: { kind, id | null, src? }
    this.picker = ui.filePicker('image/*');

    this.build();
    this.provide('create', this);
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => this.roomId && this.place());
    document.addEventListener('paste', (e) => this.onPaste(e));
  }

  // ---- Opening and closing ----

  open() {
    this.world = loadWorld(this.storage.get('world')); // it may have arrived from the account meanwhile
    this.app.shell?.closeMenu?.();
    this.root.hidden = false;
    document.documentElement.classList.add('create-open');
    this.showRooms();
  }

  close() {
    this.closeSheet();
    this.stopWriting();
    this.root.hidden = true;
    document.documentElement.classList.remove('create-open', 'create-dark');
  }

  showRooms() {
    this.closeSheet();
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.roomPage.hidden = true;
    this.roomsPage.hidden = false;
    document.documentElement.classList.remove('create-dark');
    this.drawRooms();
  }

  openRoom(id) {
    if (!room(this.world, id)) return;
    this.roomId = id;
    this.sel = null;
    this.draft = null;
    this.roomsPage.hidden = true;
    this.roomPage.hidden = false;
    document.documentElement.classList.add('create-dark');
    this.drawRoom();
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.storage.set('world', this.world), 250);
  }

  // ---- Building the pages ----

  build() {
    this.grid = el('div', { class: 'create-grid' });
    this.roomsPage = el('section', { class: 'create-rooms', 'aria-label': 'Rooms' },
      el('div', { class: 'create-side' },
        el('h2', { class: 'create-heading' }, 'Rooms'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.newRoom() }, 'New room'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.close() }, 'Home'),
        el('p', { class: 'create-note' }, 'Start typing to write in Messy thoughts.')),
      this.grid);

    this.crumbName = el('button', { type: 'button', class: 'create-crumb create-crumb-name', title: 'Rename', onclick: () => this.renameOpenRoom() });
    this.modes = el('div', { class: 'create-modes', role: 'radiogroup', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'create-world' });
    this.stage = el('div', { class: 'create-stage', 'data-own-swipe': '' }, this.world$);
    this.input = el('textarea', { class: 'create-input', 'aria-label': 'Write a thought', rows: 1, autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'create-bar', hidden: true });
    this.roomPage = el('section', { class: 'create-room', hidden: true, 'aria-label': 'Room' },
      this.stage,
      el('nav', { class: 'create-top', 'aria-label': 'Where you are' },
        el('button', { type: 'button', class: 'create-crumb', onclick: () => this.showRooms() }, 'Rooms'),
        el('span', { class: 'create-slash', 'aria-hidden': 'true' }, '/'),
        this.crumbName),
      this.modes,
      el('div', { class: 'create-foot' },
        el('button', { type: 'button', class: 'create-word create-write', onclick: () => this.beginWriting() }, 'Write'),
        el('button', { type: 'button', class: 'create-word', title: 'Alt+P', onclick: () => this.openSheet('passage') }, 'Passage'),
        el('button', { type: 'button', class: 'create-word', title: 'Alt+I', onclick: () => this.choosePicture() }, 'Picture'),
        el('span', { class: 'create-keys' }, 'Enter ends a thought · Ctrl+Enter starts a new train · Alt+P a passage · Alt+I a picture')),
      this.bar,
      this.sheet = el('div', { class: 'create-sheet', hidden: true }),
      this.input);

    this.root = el('div', { class: 'create', hidden: true }, this.roomsPage, this.roomPage);
    (document.getElementById('folio-root') || document.body).append(this.root);

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onInputKey(e));
    this.input.addEventListener('blur', () => { if (this.draft && !this.input.value.trim()) { this.draft = null; this.drawWorld(); } });
    this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
    this.stage.addEventListener('dblclick', (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (id && kindOf(this.world.thoughts[id]) !== 'line') this.openSheet(null, id);
    });
    this.stage.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  // ---- The rooms page ----

  drawRooms() {
    const now = Date.now();
    this.grid.replaceChildren(...this.world.rooms.map((r) => {
      const last = lastWritten(this.world, r.id);
      const count = roomThoughts(this.world, r.id).length;
      const lit = last != null && now - last < LIT_FOR;
      const name = this.renaming === r.id
        ? this.nameField(r, () => { this.renaming = null; this.drawRooms(); })
        : el('span', { class: 'create-tile-name' }, r.name);
      return el('div', { class: 'create-tile' },
        el('button', {
          type: 'button',
          class: 'create-window' + (lit ? ' lit' : ''),
          'aria-label': `${r.name}, ${count} thought${count === 1 ? '' : 's'}`,
          onclick: () => this.openRoom(r.id),
        }),
        el('div', { class: 'create-tile-label', ondblclick: () => { this.renaming = r.id; this.drawRooms(); } },
          name,
          el('span', { class: 'create-tile-count' }, count ? String(count) : '')));
    }));
    this.grid.querySelector('.create-name-field')?.focus();
  }

  newRoom() {
    const r = addRoom(this.world, 'Untitled');
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
      if (keep) { renameRoom(this.world, r.id, field.value); this.save(); }
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

  drawRoom() {
    const r = room(this.world, this.roomId);
    if (this.renaming === r.id) {
      this.crumbName.replaceChildren(this.nameField(r, () => { this.renaming = null; this.drawRoom(); }));
      this.crumbName.querySelector('input').focus();
    } else this.crumbName.replaceChildren(r.name);
    this.modes.replaceChildren(...MODES.map((m) => el('button', {
      type: 'button', role: 'radio', class: 'create-mode',
      'aria-checked': String(m.id === this.mode),
      onclick: () => this.setMode(m.id),
    }, m.name)));
    this.root.dataset.mode = this.mode;
    this.place();
    this.drawWorld();
  }

  renameOpenRoom() {
    if (this.renaming) return;
    this.renaming = this.roomId;
    this.drawRoom();
  }

  setMode(id) {
    view(this.world, this.roomId).mode = id;
    this.sel = null;
    this.save();
    this.drawRoom();
  }

  // The world's transform: the view's x, y (world units) sit at the middle of the screen.
  place() {
    const v = view(this.world, this.roomId);
    const { width, height } = this.stage.getBoundingClientRect();
    this.world$.style.transform = `translate(${width / 2 - v.x * v.zoom}px, ${height / 2 - v.y * v.zoom}px) scale(${v.zoom})`;
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
      for (const t of roomTrains(w, this.roomId)) {
        const kids = trainThoughts(w, t.id).map((th) => this.thoughtNode(th));
        if (this.draft?.train === t.id) kids.push(this.draftNode());
        nodes.push(el('div', {
          class: 'create-train' + (this.sel?.id === t.id ? ' selected' : ''),
          'data-train': t.id,
          style: `left:${t.x}px;top:${t.y}px`,
        }, kids));
      }
      if (this.draft && !this.draft.train) {
        nodes.push(el('div', { class: 'create-train', style: `left:${this.draft.x}px;top:${this.draft.y}px` }, this.draftNode()));
      }
    } else {
      const all = roomThoughts(w, this.roomId);
      for (const th of all) {
        const p = pessoaPoint(w, this.roomId, th.id);
        nodes.push(el('div', {
          class: 'create-float' + (this.sel?.id === th.id ? ' selected' : ''),
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

  // One thought, drawn by its kind.
  thoughtNode(th) {
    const kind = kindOf(th);
    if (kind === 'passage') {
      return el('div', { class: 'create-passage' + (th.parts ? ' folded' : ''), 'data-id': th.id },
        th.title ? el('div', { class: 'create-passage-title' }, th.title) : null,
        th.body ? el('div', { class: 'create-passage-body' }, th.body) : null);
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
    if (e.key === 'Escape') {
      if (this.sel) { this.sel = null; this.drawWorld(); } else if (this.roomId) this.showRooms(); else this.close();
      return;
    }
    if (this.editing) return;
    if (this.roomId && e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && this.roomId) { this.fresh = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.('button') && e.key === ' ') return; // Space on a word presses it
    e.preventDefault();
    if (!this.roomId) this.openRoom(MESSY);
    this.beginWriting(e.key);
  }

  // Starts a thought (if one isn't started), with `seed` as its first letters.
  beginWriting(seed = '') {
    if (!this.roomId) return;
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
    const train = d.train ? this.world.trains[d.train] : startTrain(this.world, this.roomId, d.x, d.y);
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
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const pointers = (this.pointers ||= new Map());
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.stage.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { this.gesture = { kind: 'pinch', ...this.pinchState() }; return; }

    const v = view(this.world, this.roomId);
    const trainEl = e.target.closest('[data-train]');
    const thoughtEl = e.target.closest('[data-thought]');
    let thing = null;
    if (trainEl && this.mode === 'joyce') {
      const t = this.world.trains[trainEl.dataset.train];
      thing = { kind: 'train', id: t.id, x: t.x, y: t.y };
    } else if (thoughtEl && this.mode === 'pessoa') {
      const p = pessoaPoint(this.world, this.roomId, thoughtEl.dataset.thought);
      thing = { kind: 'thought', id: thoughtEl.dataset.thought, x: p.x, y: p.y, el: thoughtEl };
    }
    this.gesture = { kind: thing ? 'drag' : 'pan', thing, el: trainEl || thoughtEl, x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };

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
    if (g.kind === 'pan') {
      v.x = g.vx - dx / v.zoom;
      v.y = g.vy - dy / v.zoom;
      this.place();
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
    if (!g.moved) {
      // A tap: on a train or thought selects it; on empty space clears the selection.
      this.sel = g.thing ? { kind: g.thing.kind, id: g.thing.id } : null;
      if (!g.thing && this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    if (g.thing && g.to) {
      if (g.thing.kind === 'train') Object.assign(this.world.trains[g.thing.id], g.to);
      else placeThought(this.world, this.roomId, g.thing.id, g.to.x, g.to.y);
    }
    this.save();
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

  // ---- Moving a train or thought to another room ----

  drawBar() {
    if (!this.sel) { this.bar.hidden = true; return; }
    const others = this.world.rooms.filter((r) => r.id !== this.roomId);
    const what = this.sel.kind === 'train' ? 'this train' : 'this thought';
    this.bar.hidden = false;
    this.bar.replaceChildren(
      el('span', { class: 'create-bar-label' }, `Move ${what} to`),
      ...others.map((r) => el('button', { type: 'button', class: 'create-word', onclick: () => this.moveTo(r.id) }, r.name)),
      el('button', { type: 'button', class: 'create-word', onclick: () => this.moveTo(addRoom(this.world, 'Untitled').id) }, 'A new room'),
      ...this.selActions());
  }

  // Fold, unfold and edit, for what is selected.
  selActions() {
    const out = [];
    const word = (label, fn) => el('button', { type: 'button', class: 'create-word create-bar-action', onclick: fn }, label);
    if (this.sel.kind === 'train') {
      const all = trainThoughts(this.world, this.sel.id);
      if (all.length > 1) out.push(word('Fold into one thought', () => this.fold(this.sel.id)));
      if (all.length === 1 && all[0].parts) out.push(word('Unfold', () => this.unfoldThought(all[0].id)));
      if (all.length === 1 && kindOf(all[0]) !== 'line') out.push(word('Edit', () => this.openSheet(null, all[0].id)));
    } else {
      const th = this.world.thoughts[this.sel.id];
      if (th?.parts) out.push(word('Unfold', () => this.unfoldThought(th.id)));
      if (th && kindOf(th) !== 'line') out.push(word('Edit', () => this.openSheet(null, th.id)));
    }
    return out;
  }

  fold(trainId) {
    const th = foldTrain(this.world, trainId);
    if (!th) return;
    this.sel = null;
    this.save();
    this.drawWorld();
    this.openSheet(null, th.id); // name it
  }

  unfoldThought(id) {
    unfold(this.world, id);
    this.sel = null;
    this.save();
    this.drawWorld();
  }

  // ---- Passage and Picture: the two templates for bigger thoughts ----

  // Where a new thought goes: on with the current train, or a new train at a free spot.
  target() {
    const cur = this.current[this.roomId];
    if (!this.fresh && this.world.trains[cur]?.room === this.roomId) return { train: cur };
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
    if (this.draft) this.commit();
    const th = id ? this.world.thoughts[id] : null;
    kind = th ? kindOf(th) : kind;
    this.editing = { kind, id, src: src || th?.src || null };
    const keep = () => this.keepSheet();
    const keys = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); keep(); }
      if (e.key === 'Escape') { e.preventDefault(); this.closeSheet(); }
    };
    const fields = [];
    if (kind === 'passage') {
      this.sheetTitle = el('input', { class: 'create-sheet-title', placeholder: 'Title', 'aria-label': 'Title', value: th?.title || '', onkeydown: keys });
      this.sheetBody = el('textarea', { class: 'create-sheet-body', placeholder: 'A paragraph, or a small article', 'aria-label': 'Passage', rows: 9, onkeydown: keys });
      this.sheetBody.value = th?.body || '';
      fields.push(this.sheetTitle, this.sheetBody);
    } else {
      this.sheetCaption = el('input', { class: 'create-sheet-title', placeholder: 'A caption (optional)', 'aria-label': 'Caption', value: th?.text || '', onkeydown: keys });
      fields.push(el('img', { class: 'create-sheet-picture', src: this.editing.src, alt: '' }), this.sheetCaption);
    }
    this.sheet.replaceChildren(
      el('div', { class: 'create-sheet-kind' }, kind === 'passage' ? (th?.parts ? 'A folded train' : 'Passage') : 'Picture'),
      ...fields,
      el('div', { class: 'create-sheet-words' },
        el('button', { type: 'button', class: 'create-word', onclick: keep }, 'Keep'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.closeSheet() }, 'Cancel'),
        el('span', { class: 'create-keys' }, 'Ctrl+Enter keeps it')));
    this.sheet.hidden = false;
    (kind === 'passage' ? (th?.parts || !th ? this.sheetTitle : this.sheetBody) : this.sheetCaption).focus();
  }

  keepSheet() {
    const ed = this.editing;
    if (!ed) return;
    const fields = ed.kind === 'passage'
      ? { kind: 'passage', title: this.sheetTitle.value, body: this.sheetBody.value }
      : { kind: 'picture', src: ed.src, text: this.sheetCaption.value };
    if (ed.id) updateThing(this.world, ed.id, fields);
    else {
      const t = this.target();
      const train = t.train ? this.world.trains[t.train] : startTrain(this.world, this.roomId, t.x, t.y);
      if (addThing(this.world, train.id, fields)) this.current[this.roomId] = train.id;
      else if (!t.train) delete this.world.trains[train.id];
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
    if (this.sel.kind === 'train') moveTrain(this.world, this.sel.id, toRoom, x, y);
    else moveThought(this.world, this.sel.id, toRoom, x, y);
    const name = room(this.world, toRoom).name;
    this.sel = null;
    this.save();
    this.drawWorld();
    this.toast(`Moved to ${name}`);
  }
}
