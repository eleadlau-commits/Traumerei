// Part of the rooms feature. The rooms page: its grid of squares, floors, Archive shelf, Arrange by
// (tags) list, search lights, a room's properties beside its square, dragging squares, and making a
// room. Its methods join the Rooms class (end of Rooms.js), so `this` is the feature.

import {
  MESSY, DEFAULT_MODE, room, addRoom, name, update, remove, move, fold, roomThoughts,
  search, cells, roomAt, lock, archive, archived, restore,
  peek, DESC, roomsOn, pageCount, addPage, isBig, rooms, roomTags, addTag, removeTag,
  hasTag, tidyTag, tagsByGroup, tagGroup, setTagGroup, ONTOLOGY, makeTag, makeGroup,
  seedRoomSettings, allTags, groupNames, light, squareLook, toOklch, rgb,
} from './world.js';
import { el, GRID, MAC, HOLD, HINT } from './shared.js';

export class RoomsGrid {
  // ---- The rooms page ----

  // Every floor's columns and rows (the floors feature's size), and how big a cell is: as big as
  // lets the whole floor fit the canvas, so a floor never scrolls (below 56 px a cell stops
  // shrinking, and then it does).
  gridSize() {
    const { cols, rows } = this.floors.size;
    const wrap = this.grid.parentElement;
    const css = wrap && getComputedStyle(wrap);
    const pad = (a, b) => (css ? (parseFloat(css[a]) || 0) + (parseFloat(css[b]) || 0) : 0);
    const width = (wrap?.clientWidth || window.innerWidth) - (css ? pad('paddingLeft', 'paddingRight') : 2 * GRID.pad + GRID.rail);
    const height = (wrap?.clientHeight || window.innerHeight) - (css ? pad('paddingTop', 'paddingBottom') : GRID.pad + 64);
    const fit = Math.min((width - GRID.gap * (cols - 1)) / cols, (height - GRID.gap * (rows - 1)) / rows);
    return { cols, rows, cell: Math.max(56, Math.floor(fit)) };
  }

  // For each room shown (ids), how many thoughts in it (and its name) hold the words. A query that
  // starts with # looks for a tag instead: the rooms with a tag that starts so are lit (true).
  hitsOn(ids, query = this.lights) {
    const out = {};
    if (!query?.trim()) return out;
    if (query.trim().startsWith('#')) {
      const want = tidyTag(query).toLowerCase();
      if (!want) return out;
      for (const id of ids) if (roomTags(this.world, id, this.ontologies).some((o) => o.tag.toLowerCase().startsWith(want))) out[id] = true;
      return out;
    }
    for (const f of search(this.world, query, Infinity)) {
      for (let th = this.world.things[f.id]; th; th = this.world.things[th.parent]) {
        if (ids.has(th.id)) { out[th.id] = (out[th.id] || 0) + 1; break; }
      }
    }
    return out;
  }

  // slide: the strip of floors slides from the floor that showed to this one.
  drawRooms({ slide = false } = {}) {
    const now = Date.now();
    this.page = Math.min(this.page, pageCount(this.world) - 1);
    const { cols, rows, cell } = this.gridSize();
    if (this.floors.settle(this.page).length) this.save(); // rooms with no cell, or off the board, are placed
    const all = roomsOn(this.world, this.page);
    const shelved = archived(this.world);
    this.shelfBtn.setAttribute('aria-current', String(this.shelf));
    this.railRooms.setAttribute('aria-current', String(!this.shelf));
    this.shelfHead.hidden = !this.shelf;
    this.roomsPage.classList.toggle('shelf', this.shelf);
    this.drawPages();
    if (!this.inRoom) {
      const chosen = room(this.world, this.roomSel || this.roomPick);
      this.frame?.update(this, { backLabel: this.shelf ? 'Back to the rooms' : 'Back to the home page', crumbs: this.crumbs(),
        selection: chosen ? `${chosen.name} chosen` : '', mode: this.shelf ? 'Archive' : `Floor ${this.page + 1} of ${pageCount(this.world)}`, idle: HINT });
    }
    this.grid.classList.toggle('peek-always', this.prefs.peek >= 0.5);
    const shown = new Set((this.shelf ? shelved : all).map((r) => r.id));
    if (!shown.has(this.roomPick)) this.roomPick = null; // chosen things not on this grid are let go
    if (!shown.has(this.roomSel)) this.roomSel = null;
    const byTag = this.lights?.trim().startsWith('#');
    let hits = this.lights?.trim() && (!byTag || tidyTag(this.lights)) ? this.hitsOn(shown) : null;
    if (hits) {
      const n = Object.keys(hits).length;
      this.lightsNote.textContent = n ? `${n} room${n === 1 ? '' : 's'} · Enter goes in` : byTag ? 'No room has that tag' : 'Nothing here yet with those words';
    } else this.lightsNote.textContent = '';
    // A tag picked in the rail dims the rooms without it too (and with the lights, only those with both are lit).
    if (this.tagLight) {
      const tagged = {};
      for (const id of shown) if (hasTag(this.world, id, this.tagLight, this.ontologies) && (!hits || hits[id])) tagged[id] = hits?.[id] || true;
      hits = tagged;
    }
    this.grid.classList.toggle('lights', !!hits);
    this.drawTags();
    if (this.shelf) { this.strip.show([[this.shelfHead, this.grid]], 0); this.drawShelf(shelved, cols, cell, hits); return; }
    // The floor is the floors feature's fixed board: it never grows a row or column. Every floor
    // is in the strip, one under another: this one drawn here, the others as still copies.
    this.cols = cols;
    this.strip.show(Array.from({ length: pageCount(this.world) },
      (_, i) => (i === this.page ? [this.shelfHead, this.grid] : this.floorCopy(i, cols, rows, cell, now))), this.page, { slide });
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
        type: 'button', class: 'rooms-cell' + (making ? ' target' : ''), 'aria-label': 'New room here',
        style: `grid-column:${col + 1};grid-row:${row + 1}`,
        'data-col': col, 'data-row': row,
        onclick: () => this.onCell(col, row),
        // A right-click opens a small menu with Import file… (a left click shows the kinds of room).
        oncontextmenu: (e) => {
          e.preventDefault(); if (!this.files) return; this.roomSel = null; this.roomPick = null; this.making = { col, row, menu: true }; this.drawRooms();
          this.grid.querySelector('.rooms-cell-menu button')?.focus({ preventScroll: true });
        },
      }));
    }

    const tiles = all.map((r) => this.tile(r, now, hits));
    const panels = [];
    const chosen = this.roomSel && all.find((r) => r.id === this.roomSel);
    if (chosen && !this.panel) panels.push(this.roomOptions(chosen, cell, cols));
    if (this.panel) this.dockRoom(chosen || null);
    if (this.making) panels.push(this.making.menu ? this.cellMenu(this.making, cell, cols) : this.kindOptions(this.making, cell, cols));
    this.grid.replaceChildren(...empty, ...tiles, ...panels);
    this.grid.querySelector('.rooms-name-field')?.focus();
    if (!this.root.hidden) this.hint('rooms');
  }

  // Another floor, as it is, for the strip: its squares on its empty cells, not to be pressed
  // (it becomes the drawn floor when the strip comes to rest on it).
  floorCopy(page, cols, rows, cell, now) {
    const all = roomsOn(this.world, page).filter((r) => r.col != null);
    const taken = new Set();
    for (const r of all) for (const [c, rr] of cells(r)) taken.add(`${c},${rr}`);
    const empty = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      if (!taken.has(`${col},${row}`)) empty.push(el('div', { class: 'rooms-cell', style: `grid-column:${col + 1};grid-row:${row + 1}` }));
    }
    const g = el('div', { class: 'rooms-grid rooms-grid-copy', 'aria-hidden': 'true', inert: '', 'data-floor': page },
      ...empty, ...all.map((r) => this.tile(r, now, null)));
    g.style.setProperty('--cols', cols);
    g.style.setProperty('--cell', cell + 'px');
    g.style.setProperty('--cell-gap', GRID.gap + 'px');
    return g;
  }

  // A click on an empty cell: it lets go of what was chosen, or (if nothing was) shows the kinds
  // of room to make there.
  onCell(col, row) {
    if (this.roomSel || this.making) { this.roomSel = this.making = null; this.drawRooms(); return; }
    this.roomPick = null;
    this.making = { col, row };
    this.drawRooms();
    this.grid.querySelector('.rooms-kinds button')?.focus({ preventScroll: true });
  }

  // Where a pop-up beside a square (or a cell) goes: on its right if there is room, else its left.
  beside(c, cell, cols, extra = '') {
    const step = cell + GRID.gap;
    const size = c.size || 1;
    const right = c.col + size + 1 + 2 <= cols;
    return {
      class: 'panel pop rooms-options' + (right ? '' : ' left') + extra,
      style: right ? `left:${(c.col + size) * step + 4}px;top:${c.row * step}px` : `right:${(cols - c.col) * step + 4 - GRID.gap}px;top:${c.row * step}px`,
      onpointerdown: (e) => e.stopPropagation(),
      oncontextmenu: (e) => e.stopPropagation(),
    };
  }

  // The kinds of room a new one can be, beside the empty cell clicked.
  kindOptions(c, cell, cols) {
    return el('div', this.beside(c, cell, cols, ' rooms-kinds'),
      el('div', { class: 'label' }, 'A new room'),
      ...this.ontologies.map((k) => el('button', { type: 'button', class: 'pick rooms-kind', onclick: () => this.newRoom(c, k.id) },
        el('span', { class: 'rooms-kind-name' }, k.name), el('span', { class: 'pick-note' }, k.note || ''))),
      // Or a room from a room Markdown file (the roomfile feature), in this cell.
      this.files && el('button', { type: 'button', class: 'pick rooms-kind rooms-kind-import', onclick: () => { this.making = null; this.drawRooms(); this.importRoomFile(null, c); } },
        el('span', { class: 'rooms-kind-name' }, 'Import a room…'), el('span', { class: 'pick-note' }, 'from a .md file')));
  }

  // The menu a right-click on an empty cell opens: Import file…, a room from a room Markdown file
  // (the roomfile feature), placed in this cell.
  cellMenu(c, cell, cols) {
    return el('div', { ...this.beside(c, cell, cols, ' rooms-kinds rooms-cell-menu'), role: 'menu' },
      el('button', { type: 'button', class: 'pick rooms-kind rooms-kind-import', role: 'menuitem',
        onclick: () => { this.making = null; this.drawRooms(); this.importRoomFile(null, { col: c.col, row: c.row }); } },
      el('span', { class: 'rooms-kind-name' }, 'Import file…'), el('span', { class: 'pick-note' }, '.md')));
  }

  drawPages() {
    const n = pageCount(this.world);
    this.pagesBar.hidden = this.shelf;
    this.pagesBar.replaceChildren(
      ...Array.from({ length: n }, (_, i) => el('button', {
        type: 'button', class: 'rail-item rooms-page', 'data-page': i,
        ...(i === this.page ? { 'aria-current': 'page' } : {}),
        onclick: () => this.showPage(i),
      }, `Floor ${i + 1}`)),
      el('button', { type: 'button', class: 'rail-item rooms-page rooms-page-new', onclick: () => {
        const i = addPage(this.world);
        this.save();
        this.showPage(i);
      } }, '+ New floor'));
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
      : el('span', { class: 'rooms-tile-name', title: r.name }, r.name);
    const lines = peek(this.world, r.id, (r.size || 1) > 1 ? 3 : 1);
    const found = hits?.[r.id] || 0;
    const tile = el('div', {
      class: 'rooms-tile' + (lit ? ' lit' : '') + (r.id === MESSY ? ' messy' : '') + (look.alpha > 0.4 ? ' deep' : '') + (this.roomSel === r.id ? ' chosen' : '')
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
      onfocus: () => { if (this.roomPick !== r.id && !this.roomSel) { this.roomPick = r.id; tile.classList.add('picked'); this.grid.querySelectorAll('.rooms-tile.picked').forEach((t) => { if (t !== tile) t.classList.remove('picked'); }); } },
      onpointerdown: (e) => this.onTileDown(e, r, tile),
      oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); if (this.held !== r.id) this.chooseRoom(r.id, true); this.held = null; },
    },
      lines.length || r.desc ? el('div', { class: 'rooms-peek', 'aria-hidden': 'true' },
        r.desc ? el('div', { class: 'rooms-peek-desc' }, r.desc) : null,
        ...lines.map((t) => el('div', { class: 'rooms-peek-line' }, t))) : null,
      this.room?.hasDraft(r.id) ? el('span', { class: 'rooms-tile-dot', title: 'A thought left half written' }) : null,
      typeof found === 'number' && found ? el('span', { class: 'rooms-tile-found' }, String(found)) : null,
      el('div', { class: 'rooms-tile-label' },
        name,
        el('span', { class: 'rooms-tile-count' }, count ? String(count) : '')));
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
      empty.push(el('div', { class: 'rooms-cell inert', 'aria-hidden': 'true', style: `grid-column:${(i % cols) + 1};grid-row:${Math.floor(i / cols) + 1}`, onclick: () => { if (this.roomSel || this.roomPick) { this.roomSel = this.roomPick = null; this.drawRooms(); } } }));
    }
    const tiles = shelved.map((r, i) => {
      const t = this.tile({ ...r, size: 1 }, Date.now(), hits);
      t.style.gridColumn = `${(i % cols) + 1}`;
      t.style.gridRow = `${Math.floor(i / cols) + 1}`;
      t.dataset.room = r.id;
      return t;
    });
    const at = shelved.findIndex((r) => r.id === this.roomSel);
    const panel = at < 0 || this.panel ? null : this.shelfOptions(shelved[at], at % cols, Math.floor(at / cols), cell, cols);
    if (this.panel) this.dockRoom(at < 0 ? null : shelved[at], true);
    this.grid.replaceChildren(...empty, ...tiles, ...(panel ? [panel] : []));
  }

  shelfOptions(r, col, row, cell, cols) {
    return el('div', this.beside({ col, row }, cell, cols), el('div', { class: 'label' }, r.name), ...this.shelfRows(r));
  }

  // What an archived room offers: Go in, Restore and Delete.
  shelfRows(r) {
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'word ' + extra, onclick: fn }, label);
    return [
      r.desc ? el('p', { class: 'pop-note' }, r.desc) : null,
      word('Go in', () => this.openRoom(r.id), 'rooms-options-go'),
      word('Restore', () => {
        restore(this.world, r.id);
        const out = this.floors.place(r.id); // its old floor, else a new one
        this.roomSel = null;
        this.save();
        this.drawRooms();
        if (!out?.spilled) this.toast(`${r.name} is back among the rooms.`);
      }),
      word('Delete', () => {
        remove(this.world, r.id);
        this.roomSel = null;
        this.save();
        this.drawRooms();
        this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
      }, 'pop-delete'),
    ];
  }

  // A room's properties in the right dock's Editor tab (the docks feature's panel service), in place
  // of the pop-up beside its square: opened when a room's properties are asked for (roomSel),
  // switched when another room is chosen while they show, closed when none is. The dock's × or
  // Escape lets the room go. shelf: an archived room (Go in, Restore, Delete).
  dockRoom(r, shelf = false) {
    const open = this.propsDock;
    if (!r) {
      if (open) { this.propsDock = null; this.panel.close('room', true); }
      return;
    }
    const rows = (shelf ? [el('div', { class: 'title-field' }, r.name), ...this.shelfRows(r)] : this.roomDockRows(r)).filter(Boolean);
    const kind = shelf ? 'Archived room' : 'Room';
    if (open && this.panel.isOpen('room')) {
      open.id = r.id;
      open.body.replaceChildren(...rows);
      open.handle?.setKind(kind);
      return;
    }
    const body = el('div', { class: 'rooms-props' }, ...rows);
    const now = (this.propsDock = { id: r.id, body, handle: null });
    // (open() fills the dock at once; its handle comes after). The name is the title field.
    this.panel.open({ key: 'room', kind, title: '', body,
      onClose: () => {
        if (this.propsDock !== now) return; // let go here, or the room was gone into
        this.propsDock = null;
        if (!this.roomSel) return;
        this.roomSel = null;
        if (!this.inRoom && !this.root.hidden) this.drawRooms();
      } })
      .then((h) => { if (this.propsDock === now) { if (h) now.handle = h; else this.propsDock = null; } });
  }

  // ---- Arrange by, in the rail: the tag groups, their tags, and how many rooms have each ----

  // None first (every room bright), then each group (Ontology first, Other last, for the tags in
  // none). A click on a group opens it to its tags; a click on a tag lights its rooms and dims the
  // rest. A right-click on a tag (a long press on a phone) asks for its group. + under a group's
  // tags makes a tag there; + at the foot makes a group. A tag (not a mode's) dragged onto a
  // square is added to that room.
  drawTags() {
    const onts = this.ontologies;
    const grouped = tagsByGroup(this.world, onts, this.shelf);
    const tags = grouped.flatMap((g) => g.tags);
    if (this.tagLight && !tags.some((t) => t.tag.toLowerCase() === this.tagLight.toLowerCase())) this.tagLight = null;
    this.tagsBtn.setAttribute('aria-expanded', String(this.tagsOpen));
    this.tagsBtn.classList.toggle('on', !!this.tagLight);
    this.tagsList.hidden = !this.tagsOpen;
    if (!this.tagsOpen) return;
    const keyOf = (g) => (g.group || '').toLowerCase();
    if (this.tagLight && this.openGroup == null) this.openGroup = (tagGroup(this.world, this.tagLight, onts) || '').toLowerCase();
    const pick = (t) => {
      const on = this.tagLight?.toLowerCase() === t.tag.toLowerCase();
      if (this.regrouping?.toLowerCase() === t.tag.toLowerCase()) return this.groupField(t.tag);
      const mode = tagGroup(this.world, t.tag, onts) === ONTOLOGY;
      let timer = 0;
      return el('button', {
        type: 'button', class: 'rail-item rooms-tag-pick' + (mode ? '' : ' draggable'), role: 'listitem', 'aria-pressed': String(on),
        title: `${t.n} room${t.n === 1 ? '' : 's'}${mode ? '' : ' · drag onto a room to tag it · right-click to put it in a group'}`,
        onclick: () => { if (this.heldTag) { this.heldTag = false; return; } this.tagLight = on ? null : t.tag; this.drawRooms(); },
        oncontextmenu: (e) => { e.preventDefault(); if (!mode) { this.regrouping = t.tag; this.drawTags(); } },
        onpointerdown: (e) => {
          if (mode) return;
          if (e.pointerType !== 'mouse') timer = setTimeout(() => { this.heldTag = true; this.regrouping = t.tag; this.drawTags(); }, HOLD);
          this.dragTag(e, t.tag, () => clearTimeout(timer));
        },
        onpointerup: () => clearTimeout(timer), onpointerleave: () => clearTimeout(timer),
      }, el('span', { class: 'rooms-tag-name' }, t.tag), el('span', { class: 'rooms-tag-n' }, String(t.n)));
    };
    const plus = (group, label) => this.makingTag && this.makingTag.group === group
      ? this.makeField(group)
      : el('button', { type: 'button', class: 'rail-item rooms-tag-plus', title: label, 'aria-label': label,
        onclick: () => { this.makingTag = { group }; this.drawTags(); } }, el('span', { 'aria-hidden': 'true' }, '+'), group == null ? 'group' : 'tag');
    const none = !this.tagLight;
    this.tagsList.replaceChildren(
      el('button', { type: 'button', class: 'rail-item rooms-tag-head', role: 'listitem', 'aria-pressed': String(none),
        title: 'Every room bright', onclick: () => { this.tagLight = null; this.openGroup = null; this.makingTag = null; this.drawRooms(); } }, 'None'),
      ...grouped.map((g) => {
        const key = keyOf(g), open = this.openGroup === key;
        const lit = this.tagLight && (tagGroup(this.world, this.tagLight, onts) || '').toLowerCase() === key;
        return el('div', { class: 'rooms-tag-fold' + (open ? ' open' : ''), role: 'listitem' },
          el('button', { type: 'button', class: 'rail-item rooms-tag-head', 'aria-expanded': String(open), 'aria-pressed': String(!!lit),
            onclick: () => { this.openGroup = open ? null : key; this.makingTag = null; this.drawTags(); } },
          el('span', {}, g.group || 'Other'), el('span', { class: 'rooms-tag-caret', 'aria-hidden': 'true' }, '›')),
          open ? el('div', { class: 'rooms-tag-tags', role: 'list' },
            ...g.tags.map(pick),
            g.group === ONTOLOGY ? null : plus(g.group || '', `A new tag${g.group ? ' in ' + g.group : ''}`)) : null);
      }),
      plus(null, 'A new group'));
  }

  // The + field: a new tag in a group (Enter makes it; it shows with 0 rooms until dragged onto
  // one), or a new group (Enter makes it and opens it). Escape, or an empty Enter, leaves it.
  makeField(group) {
    const forGroup = group == null;
    const done = (keep, value) => {
      this.makingTag = null;
      if (keep && value.trim()) {
        if (forGroup ? makeGroup(this.world, value) : makeTag(this.world, value, group, this.ontologies)) {
          this.save();
          if (forGroup) this.openGroup = tidyTag(value).toLowerCase();
        }
      }
      this.drawTags();
    };
    const field = el('input', {
      class: 'rooms-tag-field rooms-make-field', placeholder: forGroup ? 'New group' : 'New tag',
      'aria-label': forGroup ? 'A new group' : 'A new tag', maxlength: 30, autocomplete: 'off', spellcheck: 'false',
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); done(true, e.target.value); }
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
      },
      onblur: (e) => { if (this.makingTag) done(true, e.target.value); },
    });
    queueMicrotask(() => field.focus({ preventScroll: true })); // once it is on the page, before the next key
    return el('div', { class: 'rooms-group-edit', role: 'listitem' }, field);
  }

  // Dragging a tag from the Arrange by list: a small chip follows the pointer, and the square it is
  // let go over gets the tag. A press that doesn't move stays a click.
  dragTag(e, tag, moved) {
    if (e.button) return;
    const start = { x: e.clientX, y: e.clientY };
    let chip = null, over = null;
    const tileAt = (ev) => document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('.rooms-tile[data-room]') || null;
    const move = (ev) => {
      if (!chip) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        moved();
        chip = el('div', { class: 'panel rooms-tag-ghost', 'aria-hidden': 'true' }, tag);
        this.root.append(chip);
        this.grid.classList.add('tag-dragging');
      }
      chip.style.transform = `translate(${ev.clientX + 10}px, ${ev.clientY + 8}px)`;
      const t = tileAt(ev);
      if (t !== over) { over?.classList.remove('tag-over'); over = t; over?.classList.add('tag-over'); }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!chip) return;
      chip.remove();
      this.grid.classList.remove('tag-dragging');
      over?.classList.remove('tag-over');
      this.heldTag = true; // the click that follows the drop does nothing
      setTimeout(() => { this.heldTag = false; }, 0);
      const id = ev.type === 'pointerup' && tileAt(ev)?.dataset.room;
      const r = id && room(this.world, id);
      if (!r) return;
      if (addTag(this.world, id, tag, this.ontologies)) {
        this.save();
        this.drawRooms();
        this.toast(`${r.name} is tagged ${tag}.`);
      } else this.toast(`${r.name} has ${tag} already.`);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // The field that puts a tag in a group: Enter keeps it (empty: in no group), Escape leaves it.
  groupField(tag) {
    const done = (keep, value) => {
      this.regrouping = null;
      if (keep && setTagGroup(this.world, tag, value, this.ontologies)) this.save();
      this.drawTags();
    };
    const list = el('datalist', { id: 'rooms-group-list' }, ...groupNames(this.world).slice(1).map((g) => el('option', { value: g })));
    const field = el('input', {
      class: 'rooms-tag-field rooms-group-field', value: tagGroup(this.world, tag, this.ontologies) || '', placeholder: `${tag} in…`,
      'aria-label': `The group ${tag} is in`, list: 'rooms-group-list', maxlength: 30, autocomplete: 'off', spellcheck: 'false',
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); done(true, e.target.value); }
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
      },
      onblur: (e) => { if (this.regrouping) done(true, e.target.value); },
    });
    requestAnimationFrame(() => { field.focus({ preventScroll: true }); field.select(); });
    return el('div', { class: 'rooms-group-edit', role: 'listitem' }, field, list);
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
    if (!this.inRoom && !this.root.hidden) this.drawRooms();
  }

  // The room the lights found most in, on the page that shows.
  bestLit() {
    const ids = new Set((this.shelf ? archived(this.world) : roomsOn(this.world, this.page)).map((r) => r.id));
    const hits = this.hitsOn(ids);
    return Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  // A click on a square chooses it (an outline); the properties wait for a right-click.
  pickRoom(id) {
    // While a room's properties show in the dock, a click on another room switches them there.
    if (this.panel && this.roomSel && this.propsDock && this.roomSel !== id) { this.chooseRoom(id, true); return; }
    if (this.roomSel && this.roomSel !== id) this.roomSel = null;
    this.making = null;
    this.roomPick = id;
    this.drawRooms();
    this.grid.querySelector(`.rooms-tile[data-room="${id}"]`)?.focus({ preventScroll: true });
  }

  // Opens (or, with open false, toggles) a room's properties beside its square.
  chooseRoom(id, open = false) {
    this.roomSel = open || this.roomSel !== id ? id : null;
    this.roomPick = id;
    this.making = null;
    this.renaming = null;
    this.drawRooms();
  }

  // A room's properties in a pop-up beside its square (without docks).
  roomOptions(r, cell, cols) { return el('div', this.beside(r, cell, cols), ...this.roomRows(r)); }

  // A room's properties: its name and description, Go in, its mode (one, or all of them for a big
  // room), its tags, its colour, lightness and opacity (the only place its colour is set), its
  // size, Back to the tint, Lock, Archive and Delete (not for Messy).
  // The pieces of a room's properties, laid out two ways: down the pop-up beside its square
  // (roomRows) or in folding sections in the dock (roomDockRows).
  roomParts(r) {
    const set = (fields) => { update(this.world, r.id, fields); this.save(); this.drawRoomsSoon(); };
    const look = this.lookOf(r);
    const lightness = el('input', { type: 'range', min: 0.05, max: 0.98, step: 0.01, value: look.light, 'aria-label': 'Lightness', oninput: (e) => set({ light: +e.target.value }) });
    const p = {};
    p.name = el('input', {
      class: 'pop-name', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
      onchange: (e) => { name(this.world, r.id, e.target.value); this.save(); this.drawRooms(); },
    });
    // A line or two about the room: shown under its name inside, and in its square's peek.
    p.desc = el('textarea', {
      class: 'pop-desc', rows: 2, maxlength: DESC, placeholder: 'A line about this room', 'aria-label': 'Description',
      onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); e.target.blur(); } },
      onchange: (e) => { update(this.world, r.id, { desc: e.target.value }); this.save(); this.drawRooms(); },
    }, r.desc || '');
    p.go = () => this.openRoom(r.id);
    // Its kind: a small room keeps its one mode; a big one switches inside (its tags name the modes).
    p.kind = isBig(r) ? 'Every mode · switched inside' : 'One mode';
    p.tags = this.tagsRow(r);
    // A colour picked is what the room is inside: its hue and chroma, and its lightness too.
    p.colour = el('input', { type: 'color', value: look.colour, 'aria-label': 'Colour', oninput: (e) => {
      const L = toOklch(rgb(e.target.value))[0];
      set({ tint: e.target.value, light: Math.round(L * 1000) / 1000 });
      lightness.value = L;
    } });
    p.lightness = lightness;
    p.opacity = el('input', { type: 'range', min: 0.3, max: 1, step: 0.01, value: look.opacity, 'aria-label': 'Opacity', oninput: (e) => set({ opacity: +e.target.value }) });
    p.sizes = r.locked ? null : [1, 2].map((n) => el('button', {
      type: 'button', class: 'word', 'aria-pressed': String((r.size || 1) === n),
      onclick: () => {
        if (this.floors.resize(r.id, n)) { this.save(); this.drawRooms(); }
        else this.toast('There isn\'t room for it to grow here. Move it first.');
      },
    }, n === 1 ? '1 × 1' : '2 × 2'));
    p.untint = r.tint || r.light != null || r.opacity != null ? () => { delete r.tint; delete r.light; delete r.opacity; this.save(); this.drawRooms(); } : null;
    // Locked: nothing inside can change, and the square stays where it is.
    p.lock = () => { lock(this.world, r.id, !r.locked); this.save(); this.drawRooms(); };
    p.archive = r.id !== MESSY && !r.locked ? () => {
      archive(this.world, r.id);
      this.roomSel = null;
      this.save();
      this.drawRooms();
      this.toast(`${r.name} is in the Archive.`);
    } : null;
    // Taken out as room Markdown (the roomfile feature); a locked room too.
    p.export = this.files ? () => this.exportRoomFile(r.id) : null;
    p.remove = r.id !== MESSY && !r.locked ? () => {
      remove(this.world, r.id);
      this.roomSel = this.roomPick = null;
      this.save();
      this.drawRooms();
      this.toast(`Deleted ${r.name}. Ctrl+Z brings it back.`);
    } : null;
    return p;
  }

  roomRows(r) {
    const p = this.roomParts(r);
    const word = (label, fn, extra = '') => (fn ? el('button', { type: 'button', class: 'word ' + extra, onclick: fn }, label) : null);
    return [
      p.name,
      p.desc,
      word('Go in', p.go, 'rooms-options-go'),
      el('p', { class: 'pop-note' }, p.kind),
      p.tags,
      el('label', { class: 'rooms-slider' }, el('span', {}, 'Colour'), p.colour),
      el('label', { class: 'rooms-slider' }, el('span', {}, 'Lightness'), p.lightness),
      el('label', { class: 'rooms-slider' }, el('span', {}, 'Opacity'), p.opacity),
      p.sizes ? el('div', { class: 'pop-row' }, el('span', { class: 'label' }, 'Size'), ...p.sizes) : null,
      el('div', { class: 'pop-row' },
        word('Back to the tint', p.untint),
        word(r.locked ? 'Unlock' : 'Lock', p.lock),
        word('Archive', p.archive),
        word('Export as Markdown', p.export),
        word('Delete', p.remove, 'pop-delete')),
    ];
  }

  // In the dock: one editable title, then folding sections of label/value rows (Folio's .sec, .kv)
  // and real buttons that name their keys (.box-btn).
  roomDockRows(r) {
    const p = this.roomParts(r);
    p.name.classList.add('title-field');
    const key = (k) => el('span', { class: 'key' }, k);
    const btn = (label, fn, k = '', extra = '') => (fn ? el('button', { type: 'button', class: 'box-btn ' + extra, onclick: fn }, label, k ? key(k) : '') : null);
    const kv = (label, value) => el('div', { class: 'kv' }, el('span', {}, label), value);
    const sec = (title, ...body) => el('details', { class: 'sec', open: '' }, el('summary', {}, title), el('div', { class: 'sec-body' }, ...body.filter(Boolean)));
    return [
      p.name,
      p.desc,
      sec('Room',
        kv('Modes', el('span', {}, p.kind)),
        kv('Tags', p.tags)),
      sec('Look',
        kv('Colour', p.colour),
        kv('Lightness', p.lightness),
        kv('Opacity', p.opacity),
        p.sizes ? kv('Size', el('div', { class: 'seg' }, ...p.sizes)) : null,
        p.untint ? el('div', { class: 'box-btns' }, btn('Back to the tint', p.untint)) : null),
      sec('Actions', el('div', { class: 'box-btns' },
        btn('Go in', p.go, 'Enter', 'rooms-options-go'),
        btn(r.locked ? 'Unlock' : 'Lock', p.lock),
        btn('Archive', p.archive),
        btn('Export', p.export),
        btn('Delete', p.remove, 'Delete', 'danger pop-delete'))),
    ];
  }

  // A room's tags in its properties: a chip each (its ontology's can't be taken off; the rest have
  // a ×), and a "+ tag" field that suggests the tags other rooms have. Enter adds what is typed.
  tagsRow(r) {
    const onts = this.ontologies;
    const mine = roomTags(this.world, r.id, onts);
    const had = new Set(mine.map((o) => o.tag.toLowerCase()));
    const after = (fn) => { if (fn()) { this.save(); this.tagFocus = r.id; this.drawRooms(); } };
    const list = el('datalist', { id: 'rooms-tag-list' },
      ...allTags(this.world, onts, true).filter((t) => !had.has(t.tag.toLowerCase())).map((t) => el('option', { value: t.tag })));
    const field = el('input', {
      class: 'rooms-tag-field', placeholder: '+ tag', title: 'A tag, or Group: tag', 'aria-label': 'Add a tag', list: 'rooms-tag-list', maxlength: 61, autocomplete: 'off', spellcheck: 'false',
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); const v = e.target.value; after(() => addTag(this.world, r.id, v, onts)); }
        if (e.key === 'Escape') e.target.blur();
        if (e.key === 'Backspace' && !e.target.value) { const last = mine.filter((o) => !o.auto).pop(); if (last) after(() => removeTag(this.world, r.id, last.tag)); }
      },
    });
    if (this.tagFocus === r.id) { this.tagFocus = null; requestAnimationFrame(() => field.focus({ preventScroll: true })); }
    return el('div', { class: 'rooms-tags', role: 'group', 'aria-label': 'Tags' },
      ...mine.map((o) => el('span', { class: 'rooms-chip' + (o.auto ? ' auto' : ''), title: o.auto ? 'Its mode: always a tag' : '' },
        o.tag,
        o.auto ? null : el('button', { type: 'button', class: 'rooms-chip-x', 'aria-label': `Take off ${o.tag}`, onclick: () => after(() => removeTag(this.world, r.id, o.tag)) }, '×'))),
      field, list);
  }

  // Redraws the squares on the next frame (sliders move many times a frame).
  drawRoomsSoon() {
    if (this.roomsFrame) return;
    this.roomsFrame = requestAnimationFrame(() => {
      this.roomsFrame = 0;
      for (const tile of this.grid.querySelectorAll('.rooms-tile')) {
        const r = room(this.world, tile.dataset.room);
        if (r) tile.style.setProperty('--square', squareLook(r, r.id === MESSY, this.prefs, this.palette).fill);
      }
    });
  }

  // The grid cell under a point (on `grid`: this floor's, or a copy in the strip), or null.
  cellAt(x, y, grid = this.grid) {
    const box = grid.getBoundingClientRect();
    const step = parseFloat(grid.style.getPropertyValue('--cell')) + GRID.gap;
    const col = Math.floor((x - box.left) / step), row = Math.floor((y - box.top) / step);
    return col >= 0 && row >= 0 && col < this.cols && row < this.floors.size.rows ? { col, row } : null;
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
  // back), or onto a page number or Archive. Held at the top or bottom edge of the canvas, the
  // strip slides to the floor above or below, so it can be dropped there.
  onTileDown(e, r, tile) {
    if (e.button || e.target.closest('input, textarea, select')) return;
    if (e.ctrlKey && MAC) return; // a Mac's Ctrl+click is a right-click (oncontextmenu)
    const start = { x: e.clientX, y: e.clientY };
    const grab = this.cellAt(e.clientX, e.clientY);
    const offset = grab ? { col: grab.col - r.col, row: grab.row - r.row } : { col: 0, row: 0 };
    const top0 = this.grid.getBoundingClientRect().top; // the strip moves this floor's grid as it slides
    let dragging = false, target = null, over = null, last = null;
    let floor = this.page;                 // the floor the strip shows: where the room would land
    let edge = 0, edgeTimer = 0, frame = 0;
    this.held = null;
    // A long press (touch, or a pen) opens the properties, as a right-click does.
    const hold = e.pointerType !== 'mouse' && setTimeout(() => { this.held = r.id; finish(); this.chooseRoom(r.id, true); }, HOLD);
    const gridOf = (page) => (page === this.page ? this.grid : this.strip.floor(page)?.querySelector('.rooms-grid'));
    const spot = (ev) => {
      const g = gridOf(floor);
      const at = g && this.cellAt(ev.clientX, ev.clientY, g);
      return at && { col: at.col - offset.col, row: at.row - offset.row };
    };
    // Where it would land: a shadow the room's own size (2 × 2 for a big room), faint if taken.
    const drop = el('div', { class: 'rooms-drop', hidden: true });
    this.grid.append(drop);
    const mark = (c) => {
      if (!c) { drop.hidden = true; return; }
      const size = r.size || 1;
      const free = c.col >= 0 && c.row >= 0 && c.col + size <= this.cols && c.row + size <= this.floors.size.rows &&
        cells({ ...r, col: c.col, row: c.row }).every(([cc, rr]) => !roomAt(this.world, cc, rr, r.id, floor));
      const g = gridOf(floor);
      if (g && drop.parentElement !== g) g.append(drop);
      drop.hidden = false;
      drop.classList.toggle('taken', !free);
      drop.style.gridColumn = `${c.col + 1} / span ${size}`;
      drop.style.gridRow = `${c.row + 1} / span ${size}`;
    };
    const lit = (n) => {
      for (const x of this.root.querySelectorAll('.drop-on')) if (x !== n) x.classList.remove('drop-on');
      n?.classList.add('drop-on');
    };
    // The square stays under the pointer, however far the strip has slid.
    const follow = () => {
      if (!last) return;
      const shift = this.grid.getBoundingClientRect().top - top0;
      tile.style.transform = `translate(${last.clientX - start.x}px, ${last.clientY - start.y - shift}px)`;
    };
    const following = () => { follow(); frame = this.strip.sliding ? requestAnimationFrame(following) : 0; };
    // Held at an edge: the floor above or below, and again while it stays held there.
    const slide = () => {
      const next = floor + edge;
      if (!edge || next < 0 || next >= pageCount(this.world)) return;
      floor = next;
      this.strip.slideTo(floor);
      for (const b of this.pagesBar.querySelectorAll('[data-page]')) { if (+b.dataset.page === floor) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
      cancelAnimationFrame(frame);
      following();
      edgeTimer = setTimeout(() => { slide(); if (last) moveFn(last); }, 900);
    };
    const atEdge = (ev) => {
      if (r.id === MESSY) return; // Messy thoughts stays on Floor 1
      const box = this.strip.el.getBoundingClientRect();
      const now = ev.clientY < box.top + 36 ? -1 : ev.clientY > box.bottom - 36 ? 1 : 0;
      if (now === edge) return;
      edge = now;
      clearTimeout(edgeTimer);
      if (edge) edgeTimer = setTimeout(slide, 450);
    };
    const moveFn = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 5) return;
      clearTimeout(hold);
      if (r.locked || r.archived) return; // a locked room keeps its place; an archived one has none
      if (!dragging) { dragging = true; tile.classList.add('dragging'); this.grid.classList.add('dragging'); this.roomSel = null; }
      last = ev;
      follow();
      atEdge(ev);
      over = this.dropAt(ev.clientX, ev.clientY);
      if (over?.page === (r.page || 0)) over = null; // already on that page
      if ((over?.archive || over?.page != null) && r.id === MESSY) over = null; // Messy stays where it is
      lit(over?.el);
      target = over ? null : spot(ev);
      mark(target);
    };
    const finish = () => {
      clearTimeout(hold);
      clearTimeout(edgeTimer);
      cancelAnimationFrame(frame);
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
      const home = r.page || 0;
      if (over?.page != null) {
        const moved = this.floors.toFloor(r.id, over.page);
        if (moved === 'full') this.toast(`Floor ${over.page + 1} is full.`);
        else if (moved) { this.save(); this.toast(`${r.name} is on Floor ${over.page + 1}.`); }
      } else if (over?.archive) {
        if (archive(this.world, r.id)) { this.save(); this.toast(`${r.name} is in the Archive.`); }
      } else if (target && floor !== home) {
        // Slid to another floor at the edge: dropped on one of its cells.
        if (this.floors.toFloor(r.id, floor, target) === true) this.save();
      } else if (target && this.floors.move(r.id, target.col, target.row)) this.save();
      this.page = floor; // the floor the strip rests on
      this.drawRooms();
    };
    window.addEventListener('pointermove', moveFn);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  // A new room of a kind (its mode), in the cell asked for (or the first free one), with
  // its name ready to write.
  newRoom(cell = null, kind = DEFAULT_MODE) {
    const r = addRoom(this.world, 'Untitled', Date.now(), { page: this.page }, kind);
    if (r) {
      seedRoomSettings(this.world, r.id, this.ontPrefs);
      const out = this.floors.place(r.id, cell); // in that cell, else its floor's first free one, else a new floor
      if (out) this.page = out.page;
    }
    this.making = null;
    if (!r) { this.toast('A room can\'t be made here.'); this.drawRooms(); return; }
    this.save();
    this.renaming = r.id;
    this.roomPick = r.id;
    this.drawRooms();
    this.grid.querySelector('.rooms-name-field')?.select();
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
      class: 'rooms-name-field', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      },
      onblur: () => finish(true),
    });
    return field;
  }
}
