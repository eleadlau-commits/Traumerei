// Part of the room feature. A room: its look and settings (Settings → Rooms, a room's ⚙), its rail and modes, laying out
// its canvas, clearing space between thoughts, and the Timeline.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  room, addRoom, view, create, kindOf, thoughtText, roomThoughts, peek, isBig,
  rooms, roomSetting, setRoomSetting, resetRoomSettings, seedRoomSettings, applySettingsToAll,
  hash, light, twinOf,
} from './world.js';
import { clearSpace, OVERLAP } from './clear.js';
import { ui } from 'folio';
import { el, railIcon, railWord } from './shared.js';

export class RoomView {
  // ---- Settings → Rooms ----

  setPref(key, value) {
    this.w.setLook(key, value); // the rooms page and the open room repaint ('world:look')
  }

  // ---- Ontology settings: global ones here, each room's own in its rail ----

  // An ontology's settings, and the one every ontology has (clear space's overlap).
  settingsOf(o) { return [...(o?.settings || []), OVERLAP]; }

  globalSetting(of, st) { const v = this.ontPrefs[of]?.[st.key]; return v !== undefined ? v : st.default; }

  setOntPref(of, key, value) {
    this.w.setGlobal(of, key, value);
  }

  // Every room takes the global settings.
  applyToAllRooms() {
    applySettingsToAll(this.world, this.ontPrefs);
    this.w.write();
    this.toast('Every room now has the global settings.');
    this.repaint();
  }

  // The open room's value of one of its ontology's settings (an ontology reads it as c.setting(key)).
  setting(key, ont = this.ont) {
    const st = this.settingsOf(ont).find((x) => x.key === key);
    return st ? roomSetting(this.world, this.roomId, ont.id, st, this.ontPrefs) : undefined;
  }

  // One setting as a row: a slider, an on/off switch (type: 'switch'), a row of words to pick
  // one from (type: 'choice', options [[value, word]]), or a list of words written with commas
  // (type: 'list'; word: what each must match, or clean(v): its own reading of what was written, and
  // text(list): its own way of writing it back; note: a line under it).
  settingRow(st, value, onChange) {
    if (st.type === 'list') {
      const plain = (v) => (Array.isArray(v) ? v : String(v ?? '').replace(/^\s*\[(.*)\]\s*$/s, '$1').split(','))
        .map((x) => String(x).trim()).filter((x, i, all) => x && (!st.word || st.word.test(x)) && all.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
      const words = st.clean || plain;
      const write = st.text || ((list) => list.join(', '));
      const shown = () => write(words(value).length ? words(value) : st.default);
      return el('label', { class: 'renderer-slider room-list-row' }, el('span', {}, st.label), el('span'),
        el('input', {
          type: 'text', class: 'room-edit-text', value: shown(), 'aria-label': st.label, spellcheck: 'false',
          onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = shown(); e.target.blur(); } },
          onchange: (e) => {
            const next = words(e.target.value);
            if (!next.length) { e.target.value = shown(); return; }
            value = next;
            e.target.value = write(next);
            onChange(next);
          },
        }),
        st.note ? el('span', { class: 'room-list-note' }, st.note) : null);
    }
    if (st.type === 'choice') {
      const words = st.options.map(([v, word]) => el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(v === value),
        onclick: (e) => { for (const b of words) b.setAttribute('aria-checked', String(b === e.currentTarget)); onChange(v); },
      }, word));
      return el('div', { class: 'renderer-slider room-choice-row' }, el('span', {}, st.label),
        el('div', { class: 'seg', role: 'radiogroup', 'aria-label': st.label }, ...words));
    }
    if (st.type === 'switch') {
      return el('label', { class: 'renderer-slider room-switch-row' }, el('span', {}, st.label), el('span'),
        ui.toggle({ checked: !!value, label: st.label, onChange }));
    }
    const out = el('output', { class: 'renderer-value' }, String(value));
    return el('label', { class: 'renderer-slider' }, el('span', {}, st.label), out,
      el('input', { type: 'range', min: st.min, max: st.max, step: st.step ?? 0.01, value, 'aria-label': st.label,
        oninput: (e) => { out.textContent = e.target.value; onChange(+e.target.value); } }));
  }

  // A plain new room (Move to… → a new room), starting from the global settings.
  addPlainRoom() {
    const r = addRoom(this.world, 'Untitled', Date.now());
    seedRoomSettings(this.world, r.id, this.ontPrefs);
    this.floors?.place(r.id); // Floor 1's first free cell, else a new floor
    return r.id;
  }

  // Shows a change straight away, in the open room.
  repaint() {
    if (this.roomId) this.paintRoom();
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
    return el('div', { class: 'room-settings' },
      fold('The rooms page',
        slider('Mask opacity', 'mask', 0, 0.6),
        slider('Square strength', 'square', 0, 1.5),
        slider('Colour strength', 'vivid', 0.5, 3),
        slider('Glow', 'glow', 0, 1),
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
          el('p', { class: 'room-settings-ont' }, o.name),
          ...this.settingsOf(o).map((st) => this.settingRow(st, this.globalSetting(o.id, st), (v) => this.setOntPref(o.id, st.key, v)))]),
        el('button', { type: 'button', class: 'btn small', onclick: () => this.applyToAllRooms() }, 'Apply to all rooms')),
      ui.hint('A room\'s own colour is in its pop-up on the rooms page: click its square.', { small: true }),
      el('button', { type: 'button', class: 'btn small', onclick: () => {
        this.w.resetLook();
        this.w.resetGlobals();
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
    document.documentElement.classList.toggle('room-dark', look.dark);
    this.frame?.update(this, { ink: look.ink }); // the frame's words take the room's ink
    return look;
  }

  drawRoom() {
    const r = room(this.world, this.roomId);
    this.paintRoom();
    const twin = twinOf(this.world, r.id); // a Twin's side: the Twin's name, then the side's
    if (this.renaming === r.id) {
      this.crumbName.replaceChildren(this.nameField(twin || r, () => { this.renaming = null; this.drawRoom(); }));
      this.crumbName.querySelector('input').focus();
    } else this.crumbName.replaceChildren(twin ? `${twin.name} · ${r.name}` : r.name);
    this.crumbDesc.textContent = r.desc || '';
    this.crumbDesc.hidden = !r.desc;
    this.roomPage.classList.toggle('locked', !!this.locked);
    const v = view(this.world, this.roomId);
    // The rail (Folio's column of veil, its width the frame's): under Modes, a big room (Messy, or
    // 2 × 2) lists the ontologies and switches between them; a small one shows its one. Each has
    // its icon (the ontology's own). Hovering over a mode shows a small ⚙ beside it, which opens
    // this room's settings for it. Under Views, Timeline.
    const big = isBig(r);
    const items = [el('div', { class: 'rail-head', 'aria-hidden': 'true' }, big ? 'Modes' : 'Mode')];
    const mark = (m) => (m.icon ? railIcon(m.icon) : el('span', { class: 'rail-icon rail-num', 'aria-hidden': 'true' }, m.name.slice(0, 1)));
    // With the rail narrow the ⚙ is hidden, so clicking the current mode opens its settings.
    const gearOrSettings = (id) => (this.frame?.railNarrow ? this.openRoomSettings(id) : this.toggleGear(id));
    for (const m of big ? this.ontologies : [this.ont]) {
      const on = m.id === this.mode;
      const word = big
        ? el('button', { type: 'button', class: 'rail-item', role: 'radio', 'aria-checked': String(on), 'aria-current': String(on), title: m.name,
          onclick: () => { if (on) gearOrSettings(m.id); else this.setMode(m.id); } }, mark(m), railWord(m.name))
        : el('span', { class: 'rail-item room-rail-fixed', 'aria-current': 'true', title: `${m.name}: a small room keeps one mode. Make it 2 × 2 to switch.`,
          onclick: () => gearOrSettings(m.id) }, mark(m), railWord(m.name));
      const gear = this.settingsOf(m).length ? el('button', {
        type: 'button', class: 'room-gear rail-wide', 'aria-label': `${m.name} settings for this room`, title: 'Settings for this room',
        'aria-expanded': String(this.settingsFor === m.id), onclick: () => this.openRoomSettings(m.id),
      }, '⚙') : null;
      items.push(el('div', { class: 'room-rail-row' + (this.gearFor === m.id || this.settingsFor === m.id ? ' show' : '') }, word, gear));
    }
    items.push(...this.twinRail()); // a Twin: its two sides (twin.js)
    items.push(el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Views'));
    items.push(el('button', {
      type: 'button', class: 'rail-item room-rail-view', 'aria-pressed': String(this.historyOpen),
      title: this.keyMap ? `Timeline · ${this.keyMap.label('room.timeline')}` : 'Timeline',
      onclick: () => this.toggleTimeline(),
    }, railIcon('clock'), railWord('Timeline')));
    const card = !this.panel && this.settingsFor && this.roomSettingsCard();
    if (card) items.push(card);
    this.drawModeSettings();
    this.modes.setAttribute('role', 'group');
    this.modes.replaceChildren(...items);
    this.root.dataset.mode = this.mode;
    this.root.classList.toggle('history-open', this.historyOpen);
    this.drawHistory();
    this.place();
    this.drawWorld();
  }

  // An input for the room's name: Enter or leaving it keeps the name, Escape keeps the old one.
  nameField(r, done) {
    let finished = false;
    const finish = (keep) => {
      if (finished) return;
      finished = true;
      if (keep) { name(this.world, r.id, field.value); this.save(); }
      done();
    };
    const field = el('input', {
      class: 'room-name-field', value: r.name, 'aria-label': 'Room name', maxlength: 60,
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      },
      onblur: () => finish(true),
    });
    return field;
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

  // The ⚙ beside a mode: this room's settings for it, in the right dock's Editor tab (without
  // docks, a card beside the rail). The same ⚙ again closes them (or brings them to the front).
  openRoomSettings(id) {
    if (this.panel && this.settingsFor === id && this.modeSettings && !this.panel.isShowing('mode-settings')) {
      this.panel.show('mode-settings');
      return;
    }
    this.settingsFor = this.settingsFor === id ? null : id;
    this.gearFor = null;
    this.drawRoom();
  }

  // This room's settings for one ontology, and Reset to global (redraw(): after a reset).
  modeSettingsRows(o, redraw) {
    return [
      el('p', { class: 'room-mode-settings-note' }, 'For this room only'),
      ...this.settingsOf(o).map((st) => this.settingRow(st, this.setting(st.key, o), (v) => {
        const before = this.setting(st.key, o);
        setRoomSetting(this.world, this.roomId, o.id, st.key, v);
        o.settingChanged?.(this.world, this.roomId, st.key, before, v);
        this.w.write();
        this.drawWorld();
      })),
      el('button', { type: 'button', class: 'word room-mode-settings-reset', onclick: () => {
        resetRoomSettings(this.world, this.roomId, o.id);
        this.w.write();
        redraw();
      } }, 'Reset to global'),
    ];
  }

  // The settings in the Editor tab: opened while settingsFor names a mode, switched when it
  // changes, closed when it is cleared; the dock's × or Escape clears it.
  drawModeSettings() {
    if (!this.panel) return;
    const open = this.modeSettings;
    if (!this.settingsFor) {
      if (open) { this.modeSettings = null; this.panel.close('mode-settings', true); }
      return;
    }
    if (open && open.id === this.settingsFor && this.panel.isOpen('mode-settings')) return;
    const o = this.ontologies.find((x) => x.id === this.settingsFor);
    if (!o) { this.settingsFor = null; return; }
    const body = el('div', { class: 'room-mode-settings room-mode-settings-docked' });
    const fill = () => { body.replaceChildren(...this.modeSettingsRows(o, () => { fill(); this.drawWorld(); })); };
    fill();
    const now = (this.modeSettings = { id: o.id });
    this.panel.open({ key: 'mode-settings', kind: 'Settings for this room', title: o.name, body,
      onClose: () => {
        if (this.modeSettings !== now) return; // switched to another mode, or the room was left
        this.modeSettings = null;
        this.settingsFor = null;
        if (this.roomId) this.drawRoom();
      } })
      .then((h) => { if (this.modeSettings === now && !h) { this.modeSettings = null; this.settingsFor = null; } });
  }

  // This room's settings for one ontology, in a card beside the rail (without docks).
  roomSettingsCard() {
    const o = this.ontologies.find((x) => x.id === this.settingsFor);
    if (!o) return null;
    const close = () => { this.settingsFor = null; this.drawRoom(); };
    return el('div', { class: 'panel pop room-options room-mode-settings', role: 'dialog', 'aria-label': `${o.name} settings for this room`,
      onpointerdown: (e) => e.stopPropagation(), onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } } },
      el('div', { class: 'room-mode-settings-head' },
        el('span', {}, o.name),
        el('button', { type: 'button', class: 'close-x room-history-close', 'aria-label': 'Close', onclick: close })),
      ...this.modeSettingsRows(o, () => this.drawRoom()));
  }

  // Whether Tab swaps modes now: a big room, nothing being written or edited, and the focus on
  // nothing (or on the canvas).
  tabSwaps() {
    if (this.draft || this.editing || !isBig(room(this.world, this.roomId))) return false;
    const a = document.activeElement;
    return !a || a === document.body || (this.stage.contains(a) && a !== this.input);
  }

  // Tab / Shift+Tab: the next mode of a big room, or the one before (round the list).
  nextMode(step = 1) {
    const list = this.ontologies;
    const at = list.findIndex((m) => m.id === this.mode);
    const next = list[(at + step + list.length) % list.length];
    if (next && next.id !== this.mode) this.setMode(next.id);
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
    this.placeOther?.(); // a Twin's other side fits its half again (twin.js)
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
    this.world$.replaceChildren(...this.canvasNodes());
    this.showStatus();
    this.drawBar();
    this.drawTray();
    this.drawTwin(); // a Twin's other side, beside (twin.js)
    this.clearSoon();
  }

  // What the canvas shows: the ontology's own drawing, or each of its units where it says.
  canvasNodes() {
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
          class: 'room-float' + (this.isSel(th.id) ? ' selected' : '') + (this.found === th.id ? ' found' : ''),
          'data-thought': th.id,
          style: `left:${p.x}px;top:${p.y}px`,
        }, this.thoughtNode(th)));
      }
      if (this.draft && !this.draft.edit) {
        const p = ont.draftPoint?.(w, this.roomId) || (this.draft.train ? null : this.draft) || this.freeSpot();
        nodes.push(el('div', { class: 'room-float', style: `left:${p.x}px;top:${p.y}px` }, this.draftNode()));
      }
    }
    return nodes;
  }

  // The frame's status bar: what is chosen, and the mode.
  showStatus() {
    const s = this.sel;
    const n = !s ? 0 : s.kind === 'many' ? s.ids.length : 1;
    const what = !s ? '' : s.kind === 'many' ? `${n} chosen` : s.kind === 'train' ? `1 ${this.groupName(this.world.things[s.id]).toLowerCase()} chosen` : '1 chosen';
    this.frame?.update(this, { selection: what, mode: this.locked ? `${this.ont.name} · locked` : this.ont.name });
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
    const saved = this.w.settled(); // nothing waiting to be saved as its own step
    for (const id of ids) {
      const { dx, dy } = moves[id];
      if (ont.shift) ont.shift(w, roomId, id, dx, dy);
      else {
        const p = ont.point(w, roomId, id);
        if (p) ont.drop(w, roomId, id, p.x + dx, p.y + dy);
      }
    }
    // The push belongs to the change that caused it: Ctrl+Z takes both back together.
    if (saved) this.w.fold();
    this.w.writeSoon(false);
    // Redrawn at once (a second pass may find what the first push made overlap).
    this.drawWorld();
    cancelAnimationFrame(this.clearFrame);
    this.clearFrame = 0;
    if (depth < 2) this.clearRoom(depth + 1);
  }

  // The Timeline: everything written in the room, in the order it was last changed (latest at the
  // bottom), each with its time and, where the mode groups thoughts, its group as a tag (Joyce: its
  // train). A click takes the view to it. It is a tab of the right dock (the docks feature), beside
  // the Editor; without docks, a list down the right of the room.
  drawHistory() {
    if (this.docks) { this.dockTimeline(); return; }
    if (!this.historyOpen) { this.history.hidden = true; return; }
    const list = this.timelineList();
    this.history.hidden = false;
    this.history.replaceChildren(
      el('div', { class: 'room-history-head' },
        el('span', {}, 'Timeline'),
        el('button', { type: 'button', class: 'close-x room-history-close', 'aria-label': 'Close Timeline', onclick: () => this.togglePanel() })),
      list);
    list.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  // The Timeline's list (or a line saying there is nothing yet).
  timelineList() {
    const w = this.world, ont = this.ont;
    const changed = (th) => Math.max(th.at ?? 0, th.edited ?? 0);
    const items = roomThoughts(w, this.roomId).slice().sort((a, b) => changed(a) - changed(b) || a.at - b.at);
    if (!items.length) return el('p', { class: 'room-history-none' }, 'Nothing written here yet');
    const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return el('ol', { class: 'room-history-list' }, items.map((th) => {
      const tag = ont.tag?.(w, th.id) || null;
      return el('li', {}, el('button', {
        type: 'button', class: 'pick room-history-item' + (this.sel?.id === th.id || (tag && this.sel?.id === tag.id) ? ' on' : ''),
        style: tag ? `--tag:hsl(${hash(tag.id) % 360} 32% 46%)` : '',
        onclick: () => {
          this.fromTimeline = true; // the Editor follows, but the Timeline stays in front
          try { this.goTo({ id: th.id, kind: kindOf(th), room: this.roomId }); } finally { this.fromTimeline = false; }
        },
      },
        el('span', { class: 'room-history-meta' },
          el('span', { class: 'room-history-time' }, when(changed(th))),
          tag ? el('span', { class: 'room-tag' }, tag.name) : null),
        el('span', { class: 'room-history-text' }, thoughtText(w, th))));
    }));
  }

  // The Timeline tab of the right dock: opened while the room's Timeline is on, kept up to date,
  // and closed with the dock's × (which turns it off for this room).
  dockTimeline() {
    const dock = this.docks.right;
    const tl = this.timeline;
    if (!this.historyOpen) {
      if (tl) { this.timeline = null; dock.close('timeline', true); }
      return;
    }
    const r = room(this.world, this.roomId);
    const list = this.timelineList();
    if (tl && dock.isOpen('timeline')) {
      tl.body.replaceChildren(list);
      tl.handle?.setTitle(r.name);
    } else {
      const body = el('div', { class: 'room-timeline' }, list);
      const now = (this.timeline = { body, handle: null });
      // (open() fills the tab at once; its handle comes after)
      dock.open({ key: 'timeline', tab: 'Timeline', kind: 'Timeline', title: r.name, body,
        onClose: () => {
          if (this.timeline !== now) return; // the room was left, or it was turned off
          this.timeline = null;
          if (!this.roomId) return;
          view(this.world, this.roomId).timeline = false;
          this.save();
          this.drawRoom();
        } })
        .then((h) => { if (this.timeline === now) { if (h) now.handle = h; else this.timeline = null; } });
    }
    list.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  // Ctrl+Alt+T, or Timeline in the rail: turns the Timeline on, brings its tab to the front when
  // it is behind the Editor, or turns it off.
  toggleTimeline() {
    if (this.docks && this.historyOpen && this.timeline && !this.docks.right.isShowing('timeline')) {
      this.docks.right.show('timeline');
      return;
    }
    this.togglePanel();
  }
}
