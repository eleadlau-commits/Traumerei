// Create: rooms of thoughts. Create (on the home page, or in the menu) slides the rooms page up
// from the bottom, leaving a strip of the home page at the top with a back arrow (top right) home.
// The page is a still gradient of the picture's own colours under a light opacity mask, so nothing
// is drawn while it shows (the picture's animation stops underneath). It is a grid of square cells:
// each room is an opacity square on it (one cell; Messy thoughts takes four at the top left), and
// a room written in lately glows. Click an empty cell to make a room there; drag a room to move it
// to any free cell. Rooms, New room and Settings are along the bottom. Typing anything on the rooms page
// opens Messy thoughts and starts writing there, at a random place.
//
// A room fills the screen as one gradient of its own colour, with the back arrow to the rooms.
// Its tint, lightness and opacity are its own (Tint, at the bottom; look.js). A room is a canvas: drag to move around, wheel / pinch / Ctrl+wheel to zoom. Typing anywhere
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
// train can be folded into one thought, which you name, and unfolded again.
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
} from './model.js';
import { shrinkPicture } from './picture.js';
import { pageLook, roomLook, squareLook, lookPrefs, LOOK } from './look.js';

const { el } = ui;
const LIT_FOR = 24 * 3600e3; // a room stays lit for a day after it was written in
const ZOOM = { min: 0.25, max: 4 };
const GRID = { gap: 14, pad: 32, least: 4, most: 10 }; // the rooms page's cells (px)

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

    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), or null
    this.prefs = lookPrefs(this.storage.get('look'));
    this.build();
    this.add('settings', { id: 'create-rooms', title: 'Rooms', order: 18, render: () => this.settingsPane() });
    this.provide('create', this);
    document.addEventListener('keydown', (e) => this.onKey(e));
    window.addEventListener('resize', () => { if (this.roomId) this.place(); else if (!this.root.hidden) this.drawRooms(); });
    document.addEventListener('paste', (e) => this.onPaste(e));
  }

  // ---- Opening and closing ----

  open() {
    this.world = loadWorld(this.storage.get('world')); // it may have arrived from the account meanwhile
    this.app.shell?.closeMenu?.();
    clearTimeout(this.closing);
    this.colours = this.backdrop?.colours?.(); // read once: the page is still from here on
    this.paintPage();
    this.root.hidden = false;
    document.documentElement.classList.add('create-open');
    this.showRooms();
    this.root.getBoundingClientRect(); // so the slide starts from below
    this.root.classList.add('up');
    this.backdrop?.cover?.(true);
  }

  close() {
    this.closeSheet();
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
    this.stopWriting();
    this.roomId = null;
    this.sel = null;
    this.roomPage.hidden = true;
    this.roomsPage.hidden = false;
    this.root.classList.remove('in-room');
    this.backBtn.setAttribute('aria-label', 'Back to the home page');
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
    this.root.classList.add('in-room');
    this.backBtn.setAttribute('aria-label', 'Back to the rooms');
    this.tinting = false;
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
      el('div', { class: 'create-grid-wrap' }, this.grid),
      el('div', { class: 'create-rooms-foot' },
        el('nav', { class: 'create-rooms-words', 'aria-label': 'Rooms' },
          el('button', { type: 'button', class: 'create-word', 'aria-current': 'page', onclick: () => this.grid.scrollIntoView?.({ behavior: 'smooth' }) }, 'Rooms'),
          el('button', { type: 'button', class: 'create-word', onclick: () => this.newRoom() }, 'New room'),
          el('button', { type: 'button', class: 'create-word', onclick: () => this.app.shell?.openSettings?.() }, 'Settings')),
        el('p', { class: 'create-note' }, 'Start typing to write in Messy thoughts')));

    this.backBtn = el('button', { type: 'button', class: 'create-back', 'aria-label': 'Back to the home page', onclick: () => this.back() },
      ui.icon('<path d="M20 12H4M10 6l-6 6 6 6"/>'));
    this.crumbName = el('button', { type: 'button', class: 'create-crumb create-crumb-name', title: 'Rename', onclick: () => this.renameOpenRoom() });
    this.modes = el('div', { class: 'create-modes', role: 'radiogroup', 'aria-label': 'Ontological mode' });
    this.world$ = el('div', { class: 'create-world' });
    this.stage = el('div', { class: 'create-stage', 'data-own-swipe': '' }, this.world$);
    this.input = el('textarea', { class: 'create-input', 'aria-label': 'Write a thought', rows: 1, autocomplete: 'off', spellcheck: 'false' });
    this.bar = el('div', { class: 'create-bar', hidden: true });
    this.roomPage = el('section', { class: 'create-room', hidden: true, 'aria-label': 'Room' },
      this.stage,
      this.modes,
      el('div', { class: 'create-top' }, this.crumbName),
      el('div', { class: 'create-foot' },
        el('button', { type: 'button', class: 'create-word create-write', onclick: () => this.beginWriting() }, 'Write'),
        el('button', { type: 'button', class: 'create-word', title: 'Alt+P', onclick: () => this.openSheet('passage') }, 'Passage'),
        el('button', { type: 'button', class: 'create-word', title: 'Alt+I', onclick: () => this.choosePicture() }, 'Picture'),
        el('button', { type: 'button', class: 'create-word', onclick: () => this.toggleTint() }, 'Tint'),
        el('span', { class: 'create-keys' }, 'Enter ends a thought · Ctrl+Enter starts a new train · Alt+P a passage · Alt+I a picture')),
      this.bar,
      this.tintPanel = el('div', { class: 'create-tint', hidden: true }),
      this.sheet = el('div', { class: 'create-sheet', hidden: true }),
      this.input);

    this.root = el('div', { class: 'create', hidden: true }, this.roomsPage, this.roomPage, this.backBtn);
    (document.getElementById('folio-root') || document.body).append(this.root);

    this.input.addEventListener('input', () => this.onInput());
    this.input.addEventListener('keydown', (e) => this.onInputKey(e));
    this.input.addEventListener('blur', () => { if (this.draft && !this.input.value.trim()) { this.draft = null; this.drawWorld(); } });
    this.stage.addEventListener('pointerdown', (e) => this.onDown(e));
    this.stage.addEventListener('dblclick', (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (id && kindOf(this.world.things[id]) !== 'line') this.openSheet(null, id);
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
    const cols = Math.max(fit, ...all.map((r) => r.col + r.size));
    const height = this.grid.parentElement?.clientHeight || window.innerHeight;
    const rows = Math.max(Math.floor((height - 2 * GRID.pad + GRID.gap) / (cell + GRID.gap)),
      ...all.map((r) => r.row + r.size + 1));
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
        onclick: () => this.newRoom({ col, row }),
      }));
    }

    const tiles = all.map((r) => {
      const look = squareLook(r, r.id === MESSY, this.prefs);
      const last = lastWritten(this.world, r.id);
      const count = roomThoughts(this.world, r.id).length;
      const lit = last != null && now - last < LIT_FOR;
      const name = this.renaming === r.id
        ? this.nameField(r, () => { this.renaming = null; this.drawRooms(); })
        : el('span', { class: 'create-tile-name' }, r.name);
      const tile = el('div', {
        class: 'create-tile' + (lit ? ' lit' : '') + (r.id === MESSY ? ' messy' : '') + (look.alpha > 0.4 ? ' deep' : ''),
        role: 'button', tabindex: 0,
        style: `--square:${look.fill};grid-column:${r.col + 1} / span ${r.size};grid-row:${r.row + 1} / span ${r.size}`,
        'aria-label': `${r.name}, ${count} thought${count === 1 ? '' : 's'}`,
        'data-room': r.id,
        onkeydown: (e) => { if (e.target === tile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.openRoom(r.id); } },
        onpointerdown: (e) => this.onTileDown(e, r, tile),
      },
        el('div', { class: 'create-tile-label', ondblclick: (e) => { e.stopPropagation(); this.renaming = r.id; this.drawRooms(); } },
          name,
          el('span', { class: 'create-tile-count' }, count ? String(count) : '')));
      return tile;
    });
    this.grid.replaceChildren(...empty, ...tiles);
    this.grid.querySelector('.create-name-field')?.focus();
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
    const mark = (c) => {
      this.grid.querySelectorAll('.create-cell.target').forEach((n) => n.classList.remove('target'));
      if (c) this.grid.querySelector(`.create-cell[data-col="${c.col}"][data-row="${c.row}"]`)?.classList.add('target');
    };
    const moveFn = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
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
        if (ev.type === 'pointerup' && !this.renaming) this.openRoom(r.id);
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

  lookOf(r) { return roomLook(r, this.page?.average, r.id === MESSY, this.prefs); }

  // The rooms page's colours, from the picture's (read when Create opened) and Settings → Rooms.
  paintPage() {
    this.page = pageLook(this.colours, this.prefs);
    this.root.style.setProperty('--create-top', this.page.top);
    this.root.style.setProperty('--create-bottom', this.page.bottom);
    this.root.style.setProperty('--create-mask', this.page.mask);
    this.root.style.setProperty('--create-glow', `rgb(255 236 190 / ${this.prefs.glow})`);
    this.root.style.setProperty('--create-glow-in', `rgb(255 244 214 / ${(this.prefs.glow * 0.64).toFixed(3)})`);
  }

  // ---- Settings → Rooms ----

  setPref(key, value) {
    this.prefs = lookPrefs({ ...this.prefs, [key]: value });
    this.storage.set('look', this.prefs);
    this.repaint();
  }

  // Shows a change straight away, if Create is open.
  repaint() {
    this.paintPage();
    if (this.root.hidden) return;
    if (this.roomId) this.paintRoom();
    else this.drawRooms();
  }

  settingsPane() {
    const p = this.prefs;
    const slider = (label, key, min, max, step = 0.01) => {
      const out = el('output', { class: 'renderer-value' }, String(p[key]));
      return el('label', { class: 'renderer-slider' }, el('span', {}, label), out,
        el('input', { type: 'range', min, max, step, value: p[key], 'aria-label': label,
          oninput: (e) => { out.textContent = e.target.value; this.setPref(key, +e.target.value); } }));
    };
    const colour = (label, key, fallback) => el('label', { class: 'renderer-slider renderer-colour' },
      el('span', {}, label),
      el('input', { type: 'color', value: p[key] || fallback, 'aria-label': label, oninput: (e) => this.setPref(key, e.target.value) }));
    const group = (legend, ...rows) => el('fieldset', { class: 'renderer-group' }, el('legend', {}, legend), ...rows);
    const avg = this.page?.average || [242, 235, 217];
    return el('div', { class: 'create-settings' },
      ui.hint('How the rooms page and the rooms look. A room\'s own Tint (inside it) wins over these.', { small: true }),
      group('Rooms page',
        slider('Mask opacity', 'mask', 0, 0.6),
        colour('Mask colour', 'maskColour', '#000000')),
      group('Squares',
        slider('Strength', 'square', 0, 1.5),
        colour('Colour', 'squareColour', '#000000'),
        slider('Glow', 'glow', 0, 1),
        slider('Size', 'cell', 70, 180, 1)),
      group('Inside a room',
        colour('Tint', 'tint', '#' + avg.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')),
        el('button', { type: 'button', class: 'btn small', onclick: () => { this.setPref('tint', ''); this.app.shell?.refreshSettings?.(); } }, 'Tint from the picture'),
        slider('Colour strength', 'saturation', 0, 1),
        slider('Lightness', 'light', 0.05, 0.95),
        slider('Messy lightness', 'lightMessy', 0.05, 0.95)),
      el('button', { type: 'button', class: 'btn small', onclick: () => {
        this.prefs = lookPrefs(LOOK);
        this.storage.set('look', this.prefs);
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
        const kids = t.folded ? [this.thoughtNode(t)] : trainThoughts(w, t.id).map((th) => this.thoughtNode(th));
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
      const all = roomUnits(w, this.roomId);
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
    if (e.key === 'Escape') {
      if (this.sel) { this.sel = null; this.drawWorld(); } else if (this.tinting) this.toggleTint(); else this.back();
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
      const t = this.world.things[trainEl.dataset.train];
      thing = { kind: 'train', id: t.id, x: t.x, y: t.y, placed: false };
    } else if (thoughtEl && this.mode === 'pessoa') {
      const id = thoughtEl.dataset.thought;
      const p = pessoaPoint(this.world, this.roomId, id);
      thing = { kind: isLeaf(this.world.things[id]) ? 'thought' : 'train', id, x: p.x, y: p.y, placed: true };
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
      if (g.thing.placed) place(this.world, this.roomId, g.thing.id, g.to.x, g.to.y);
      else Object.assign(this.world.things[g.thing.id], g.to);
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

  // ---- The room's own look: tint, lightness, opacity ----

  toggleTint() {
    this.tinting = !this.tinting;
    this.drawTint();
  }

  drawTint() {
    if (!this.tinting || !this.roomId) { this.tintPanel.hidden = true; return; }
    const r = room(this.world, this.roomId);
    const look = this.lookOf(r);
    const set = (fields) => { update(this.world, r.id, fields); this.paintRoom(); this.save(); };
    const slider = (label, key, min, max, value) => el('label', { class: 'create-slider' },
      el('span', {}, label),
      el('input', { type: 'range', min, max, step: 0.01, value, oninput: (e) => set({ [key]: +e.target.value }) }));
    this.tintPanel.hidden = false;
    this.tintPanel.replaceChildren(
      el('label', { class: 'create-slider' },
        el('span', {}, 'Tint'),
        el('input', { type: 'color', value: look.tint, oninput: (e) => set({ tint: e.target.value }) })),
      slider('Lightness', 'light', 0.05, 0.95, look.light),
      slider('Opacity', 'opacity', 0.3, 1, look.opacity),
      el('button', { type: 'button', class: 'create-word', onclick: () => {
        delete r.tint; delete r.light; delete r.opacity;
        this.paintRoom(); this.save(); this.drawTint();
      } }, 'Back to its own'),
      el('button', { type: 'button', class: 'create-word', onclick: () => this.toggleTint() }, 'Done'));
  }

  // ---- Moving a train or thought to another room ----

  drawBar() {
    if (!this.sel) { this.bar.hidden = true; return; }
    const others = rooms(this.world).filter((r) => r.id !== this.roomId);
    const what = this.sel.kind === 'train' ? 'this train' : 'this thought';
    this.bar.hidden = false;
    this.bar.replaceChildren(
      el('span', { class: 'create-bar-label' }, `Move ${what} to`),
      ...others.map((r) => el('button', { type: 'button', class: 'create-word', onclick: () => this.moveTo(r.id) }, r.name)),
      el('button', { type: 'button', class: 'create-word', onclick: () => this.moveTo(addRoom(this.world, 'Untitled', Date.now(), null, this.cols || 6).id) }, 'A new room'),
      ...this.selActions());
  }

  // Fold, unfold and edit, for what is selected.
  selActions() {
    const out = [];
    const word = (label, fn) => el('button', { type: 'button', class: 'create-word create-bar-action', onclick: fn }, label);
    const th = this.world.things[this.sel.id];
    if (!th) return out;
    if (kindOf(th) === 'train') {
      const all = trainThoughts(this.world, th.id);
      if (th.folded) {
        out.push(word('Unfold', () => this.unfoldTrain(th.id)), word('Name', () => this.openSheet(null, th.id)));
      } else {
        if (all.length > 1) out.push(word('Fold into one thought', () => this.foldTrain(th.id)));
        if (all.length === 1 && kindOf(all[0]) !== 'line') out.push(word('Edit', () => this.openSheet(null, all[0].id)));
      }
    } else if (kindOf(th) !== 'line') out.push(word('Edit', () => this.openSheet(null, th.id)));
    return out;
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
    if (this.draft) this.commit();
    const th = id ? this.world.things[id] : null;
    kind = th ? kindOf(th) : kind;
    this.editing = { kind, id, src: src || th?.src || null };
    const keep = () => this.keepSheet();
    const keys = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); keep(); }
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
