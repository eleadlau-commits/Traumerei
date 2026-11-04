// Part of the room feature. A room: its look and settings (Settings → Rooms, a room's ⚙), its rail and modes, laying out
// its canvas, clearing space between thoughts, and the Timeline.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  room, addRoom, view, create, fold, kindOf, thoughtText, roomThoughts, peek, isBig,
  rooms, roomSetting, setRoomSetting, resetRoomSettings, seedRoomSettings, applySettingsToAll,
  hash, light,
} from './world.js';
import { clearSpace, OVERLAP } from './clear.js';
import { ui } from 'folio';
import { el } from './shared.js';

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

  // One setting as a row: a slider, or an on/off switch (type: 'switch').
  settingRow(st, value, onChange) {
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
    const r = addRoom(this.world, 'Untitled', Date.now(), null, this.rooms.cols || 6);
    seedRoomSettings(this.world, r.id, this.ontPrefs);
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
        ? el('button', { type: 'button', class: 'room-rail-item', role: 'radio', 'aria-checked': String(on), 'aria-current': String(on),
          onclick: () => { if (on) this.toggleGear(m.id); else this.setMode(m.id); } }, m.name)
        : el('span', { class: 'room-rail-item room-rail-fixed', 'aria-current': 'true', title: 'A small room keeps one mode. Make it 2 × 2 to switch.',
          onclick: () => this.toggleGear(m.id) }, m.name);
      const gear = this.settingsOf(m).length ? el('button', {
        type: 'button', class: 'room-gear', 'aria-label': `${m.name} settings for this room`, title: 'Settings for this room',
        'aria-expanded': String(this.settingsFor === m.id), onclick: () => this.openRoomSettings(m.id),
      }, '⚙') : null;
      items.push(el('div', { class: 'room-rail-row' + (this.gearFor === m.id || this.settingsFor === m.id ? ' show' : '') }, word, gear));
    }
    items.push(el('div', { class: 'room-rail-rule', 'aria-hidden': 'true' }));
    items.push(el('button', {
      type: 'button', class: 'room-rail-item room-rail-view', 'aria-pressed': String(this.historyOpen),
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
    return el('div', { class: 'room-options room-mode-settings', role: 'dialog', 'aria-label': `${o.name} settings for this room`,
      onpointerdown: (e) => e.stopPropagation(), onkeydown: (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } } },
      el('div', { class: 'room-mode-settings-head' },
        el('span', {}, o.name),
        el('button', { type: 'button', class: 'room-history-close', 'aria-label': 'Close', onclick: close }, '×')),
      el('p', { class: 'room-mode-settings-note' }, 'For this room only'),
      ...this.settingsOf(o).map((st) => this.settingRow(st, this.setting(st.key, o), (v) => {
        setRoomSetting(this.world, this.roomId, o.id, st.key, v);
        this.w.write();
        this.drawWorld();
      })),
      el('button', { type: 'button', class: 'room-word room-mode-settings-reset', onclick: () => {
        resetRoomSettings(this.world, this.roomId, o.id);
        this.w.write();
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

  // The Timeline down the right: everything written in the room, in the order it was last changed
  // (latest at the bottom), each with its time and, where the mode groups thoughts, its group as a
  // tag (Joyce: its train). A click takes the view to it.
  drawHistory() {
    if (!this.historyOpen) { this.history.hidden = true; return; }
    const w = this.world, ont = this.ont;
    const changed = (th) => Math.max(th.at ?? 0, th.edited ?? 0);
    const items = roomThoughts(w, this.roomId).slice().sort((a, b) => changed(a) - changed(b) || a.at - b.at);
    const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const list = items.length ? el('ol', { class: 'room-history-list' }, items.map((th) => {
      const tag = ont.tag?.(w, th.id) || null;
      return el('li', {}, el('button', {
        type: 'button', class: 'room-history-item' + (this.sel?.id === th.id || (tag && this.sel?.id === tag.id) ? ' on' : ''),
        style: tag ? `--tag:hsl(${hash(tag.id) % 360} 32% 46%)` : '',
        onclick: () => this.goTo({ id: th.id, kind: kindOf(th), room: this.roomId }),
      },
        el('span', { class: 'room-history-meta' },
          el('span', { class: 'room-history-time' }, when(changed(th))),
          tag ? el('span', { class: 'room-tag' }, tag.name) : null),
        el('span', { class: 'room-history-text' }, thoughtText(w, th))));
    })) : null;
    this.history.hidden = false;
    this.history.replaceChildren(
      el('div', { class: 'room-history-head' },
        el('span', {}, 'Timeline'),
        el('button', { type: 'button', class: 'room-history-close', 'aria-label': 'Close Timeline', onclick: () => this.togglePanel() }, '×')),
      list || el('p', { class: 'room-history-none' }, 'Nothing written here yet'));
    list?.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }
}
