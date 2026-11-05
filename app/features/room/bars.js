// Part of the room feature. The pop-ups in a room: a thing's properties, the loose-thought tray, the bar for several
// chosen things, closing groups, pictures, the Passage / Picture sheet, and moving thoughts to another room.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  MESSY, room, name, view, create, update, remove, move, closeGroup, openGroup, kindOf, groupOf, isGroup,
  thoughtText, trainThoughts, roomTrains, randomSpot, shut, isBig, rooms, shrinkPicture, ITEMS,
} from './world.js';
import { el, enterKeeps } from './shared.js';
import { openEditor } from './editor.js';
import * as verbs from './verbs.js';

export class Bars {
  // Chooses something and opens its properties (a right-click, a long press, Enter): in the side
  // (Resolves once they show.)
  // panel's content editor (editor.js) when there is a panel, else in the pop-up beside it. Many
  // things chosen together always get the pop-up.
  openProps(sel) {
    this.sel = sel;
    if (this.draft) this.stopWriting();
    if (this.panel && sel?.kind !== 'many') {
      this.barFor = null;
      return openEditor(this, sel.id).then(() => this.drawWorld());
    }
    this.barFor = this.selKey(sel);
    this.drawWorld();
    this.bar.querySelector('textarea, input')?.focus({ preventScroll: true });
    return Promise.resolve();
  }

  // While the content editor shows, it follows what is chosen: a click on another thought, group
  // or train switches it there. Then it shows what changed.
  followEditor() {
    const ed = this.editor;
    if (!ed || !this.panel?.isOpen('content')) return;
    const id = this.sel && this.sel.kind !== 'many' ? this.sel.id : null;
    if (id && id !== ed.id && this.world.things[id]) {
      ed.keep();
      // Choosing something brings the Editor to the front, unless it was chosen in Time.
      const behind = this.fromTimeline && this.time?.showing;
      openEditor(this, id).then(() => { if (behind) this.time.show(); });
      return;
    }
    ed.refresh();
  }

  drawBar() {
    this.followEditor();
    if (!this.sel || this.barFor !== this.selKey()) { this.barFor = null; this.bar.hidden = true; this.drawHistorySoon(); return; }
    if (this.sel?.kind === 'many') { this.drawManyBar(); return; }
    const th = this.sel && this.world.things[this.sel.id];
    if (!th) { this.bar.hidden = true; this.drawHistorySoon(); return; }
    this.bar.hidden = false;
    this.bar.replaceChildren(...this.propRows(th));
    this.positionEdit();
    this.drawHistorySoon();
  }

  kindName(th) { return ITEMS[kindOf(th)]?.name || 'Thought'; }

  // The rows of a thing's properties: its words (a passage's title and body, a picture's caption, a
  // group's name), the ontology's own rows and moves, Move to and Delete. inPanel: for the
  // content editor, which shows a group's thoughts itself and has Source at its foot.
  propRows(th, inPanel = false) {
    const kind = kindOf(th);
    if (this.locked) { // read only: the words, and nothing to change
      return [
        el('div', { class: 'label' }, 'Locked'),
        kind === 'group' && inPanel ? null : el('p', { class: 'room-edit-read' }, kind === 'picture' ? th.text || 'A picture' : thoughtText(this.world, th)),
        kind === 'group' && !inPanel && this.files?.canEdit ? el('button', { type: 'button', class: 'word', onclick: () => this.editAsMarkdown(th.id) }, 'Read as Markdown') : null,
      ].filter(Boolean);
    }
    const stop = (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && e.target.tagName === 'INPUT')) e.target.blur(); };
    const field = (value, label, onchange, cls = 'pop-name') => el('input', { class: cls, value: value || '', placeholder: label, 'aria-label': label, onkeydown: stop, onchange });
    const word = (label, fn, extra = '') => el('button', { type: 'button', class: 'word ' + extra, onclick: fn }, label);
    const grow = (t) => { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; };
    const done = () => { this.save(); this.drawWorld(); };
    const rows = [];
    const gname = kind === 'group' ? this.groupName(th) : 'Train';
    const title = kind === 'group' ? (th.closed ? `A closed ${gname.toLowerCase()}` : gname) : (ITEMS[kind]?.name || 'Thought');
    if (!inPanel) rows.push(el('div', { class: 'label' }, title));
    if (kind === 'line') {
      // Enter keeps it; Ctrl+Enter (or Cmd+Enter) starts a new line inside the thought.
      const text = el('textarea', { class: `room-edit-text room-edit-lines${inPanel ? ' title-field' : ''}`, rows: 1, placeholder: 'The thought', 'aria-label': 'The thought',
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
      rows.push(field(th.title, 'Title', (e) => { update(this.world, th.id, { title: e.target.value }); done(); }, inPanel ? 'pop-name title-field' : 'pop-name'));
      const body = el('textarea', { class: 'room-edit-body', rows: 5, 'aria-label': 'Passage', onkeydown: (e) => e.stopPropagation(),
        onchange: (e) => { update(this.world, th.id, { body: e.target.value }); done(); } });
      body.value = th.body || '';
      rows.push(body, word('Open it large', () => this.openSheet(null, th.id)));
    }
    if (kind === 'picture') rows.push(field(th.text, 'A caption', (e) => { update(this.world, th.id, { text: e.target.value }); done(); }, inPanel ? 'room-edit-text title-field' : 'room-edit-text'));
    if (kind === 'group' && inPanel) rows.push(field(th.title, `Name this ${gname.toLowerCase()}`, (e) => { name(this.world, th.id, e.target.value); done(); }, 'pop-name title-field'));
    if (inPanel) return [...rows, ...this.dockSections(th, kind, gname, done)];
    if (kind === 'group') {
      const n = trainThoughts(this.world, th.id).length;
      rows.push(field(th.title, `Name this ${gname.toLowerCase()}`, (e) => { name(this.world, th.id, e.target.value); done(); }),
        el('div', { class: 'pop-row' },
          el('span', { class: 'pop-note' }, `${n} thought${n === 1 ? '' : 's'}`),
          this.files?.canEdit && !inPanel ? word('Edit as Markdown', () => this.editAsMarkdown(th.id)) : null));
    }
    // The ontology's own rows for what is chosen (ontologies/index.js: props), then its moves,
    // those that fit.
    try { rows.push(...(this.ont.props?.(this, th) || [])); } catch (err) { console.warn('Room: props', err); }
    const moves = (this.ont.moves || []).filter((m) => { try { return !m.when || m.when(this); } catch { return false; } });
    if (moves.length) rows.push(el('div', { class: 'pop-row room-moves' }, ...moves.map((m) => word(m.label, () => this.runMove(m)))));
    const others = this.moveRooms();
    const pick = el('select', { class: 'room-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? this.addPlainRoom() : e.target.value;
        if (to) this.moveTo(to);
      } },
      el('option', { value: '' }, 'Move to…'),
      ...others.map((r) => el('option', { value: r.id }, r.name)),
      el('option', { value: '+' }, 'A new room'));
    rows.push(el('div', { class: 'pop-row' }, pick),
      el('div', { class: 'pop-row' },
        kind !== 'group' && this.ont.groups && groupOf(this.world, th.id, this.mode)
          ? word(`The whole ${this.ont.groups.name.toLowerCase()}`, () => { const g = groupOf(this.world, th.id, this.mode).id; this.sel = { kind: 'train', id: g }; this.openProps(this.sel); }) : null,
        word('Delete', () => {
          remove(this.world, th.id);
          this.sel = null;
          done();
          this.toast(`Deleted. Ctrl+Z brings it back.`);
        }, 'pop-delete')));
    return rows;
  }

  // What is chosen, in the dock (the content editor): under its one title, folding sections of
  // label/value rows (Folio's .sec and .kv) and real buttons that name their keys (.box-btn).
  dockSections(th, kind, gname, done) {
    const key = (id) => el('span', { class: 'key' }, this.keyMap?.label?.(id) || '');
    const btn = (label, fn, id = null, extra = '') => el('button', { type: 'button', class: 'box-btn ' + extra, onclick: fn }, label, id ? key(id) : '');
    const kv = (label, value) => el('div', { class: 'kv' }, el('span', {}, label), value);
    const sec = (title, ...body) => el('details', { class: 'sec', open: '' }, el('summary', {}, title), el('div', { class: 'sec-body' }, ...body.filter(Boolean)));
    const out = [];
    // Place: the room it is in (choosing another moves it there), and its group in this mode.
    const others = this.moveRooms();
    const here = room(this.world, this.roomId);
    const pick = el('select', { class: 'room-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? this.addPlainRoom() : e.target.value;
        if (to && to !== this.roomId) this.moveTo(to);
      } },
      el('option', { value: this.roomId }, here?.name || 'This room'),
      ...others.map((r) => el('option', { value: r.id }, r.name)),
      el('option', { value: '+' }, 'A new room'));
    const g = kind !== 'group' && this.ont.groups ? groupOf(this.world, th.id, this.mode) : null;
    const gn = this.ont.groups?.name || 'Group';
    let inGroup = null;
    if (g) {
      const all = trainThoughts(this.world, g.id);
      const at = all.findIndex((x) => x.id === th.id);
      inGroup = el('button', { type: 'button', class: 'value-btn room-edit-group', title: `Choose the whole ${gn.toLowerCase()}`,
        onclick: () => { this.sel = { kind: 'train', id: g.id }; this.openProps(this.sel); } },
      `${g.title || 'Untitled'}${at >= 0 ? ` · ${at + 1} of ${all.length}` : ''}`);
    }
    const n = kind === 'group' ? trainThoughts(this.world, th.id).length : 0;
    out.push(sec('Place',
      kv('Room', pick),
      inGroup ? kv(gn, inGroup) : null,
      kind === 'group' ? kv('Thoughts', el('span', {}, String(n))) : null));
    // The mode's own rows for what is chosen (ontologies/index.js: props), and its moves.
    let own = [];
    try { own = this.ont.props?.(this, th) || []; } catch (err) { console.warn('Room: props', err); }
    const moves = (this.ont.moves || []).filter((m) => { try { return !m.when || m.when(this); } catch { return false; } });
    if (own.length || moves.length) {
      out.push(sec(this.ont.name || 'Mode', ...own,
        moves.length ? el('div', { class: 'box-btns room-moves' }, ...moves.map((m) => btn(m.label, () => this.runMove(m)))) : null));
    }
    // Actions: only Delete. Duplicate, Move, Open/Close and Fold are keys alone (the ? list).
    out.push(sec('Actions', el('div', { class: 'box-btns' },
      btn('Delete', () => {
        remove(this.world, th.id);
        this.sel = null;
        done();
        this.toast('Deleted. Ctrl+Z brings it back.');
      }, 'room.delete', 'danger pop-delete'))));
    return out;
  }

  // One of the ontology's moves: it changes the world (or starts writing), then the room is drawn
  // again and the change saved as one step.
  runMove(m) {
    if (this.locked) return;
    m.run(this);
    this.save();
    if (!this.draft) this.drawWorld();
  }

  // ---- Loose thoughts: those the ontology hasn't placed yet, in the left dock ----
  // They fill the left dock (the docks feature) as a list, which shows whenever the room has any;
  // one dragged onto the canvas goes where it is let go (the ontology's drop()). × or Ctrl+Alt+L
  // only hides the dock, leaving its strip ("Loose · 3"), and the strip or Ctrl+Alt+L brings it back. Without the docks feature they are a tray
  // at the foot of the room instead: a quiet word ("Loose · 3") opens a row of them. Only an
  // ontology with a tray has loose thoughts.

  trayItems() {
    let own = [];
    try { own = this.ont.tray?.(this.world, this.roomId) || []; } catch { own = []; }
    // A Twin: one tray for both sides (twin.js). Newest first: when it came loose (thrown back),
    // else when it was made.
    const when = (th) => th.looseAt ?? th.at ?? 0;
    return this.twinTrayItems(own).slice().sort((a, b) => when(b) - when(a));
  }

  // The words a loose card shows, which the tray's search box looks in.
  looseWords(th) {
    if (isGroup(th)) return th.title || thoughtText(this.world, th);
    return kindOf(th) === 'picture' ? th.text || 'A picture' : thoughtText(this.world, th);
  }

  // The loose cards the search box lets through: every word typed must be in the card (any case).
  looseFilter(items) {
    const words = (this.looseQuery || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return items;
    return items.filter((th) => {
      const text = `${this.looseWords(th)} ${isGroup(th) ? this.groupName(th) : ''}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }

  // A loose card: a group shows the kind of its outermost group ("Train", "Chapter") and its name
  // or first words. Click opens it (a group's thoughts in the editor); Ctrl+click or Shift+click
  // adds it to what is chosen (so Ctrl+G makes a group of them here, in the tray); drag places it.
  looseCard(th) {
    const group = isGroup(th);
    const words = this.looseWords(th);
    return el('div', {
      class: 'room-tray-item' + (this.isSel(th.id) ? ' st-sel' : ''), role: 'listitem', 'data-tray': th.id,
      title: 'Click to choose · right-click to open · drag onto the room',
      onpointerdown: (e) => this.trayDrag(e, th.id),
      oncontextmenu: (e) => { e.preventDefault(); this.trayOpenCard(th.id); },
    }, group ? el('span', { class: 'label room-tray-kind' }, this.groupName(th)) : null,
    el('span', { class: 'room-tray-text' }, words));
  }

  // A loose card clicked: Ctrl/Shift adds it to (or takes it from) what is chosen; otherwise it is
  // chosen (and the editor, when open, follows it). Without the right dock it opens at once.
  trayClick(e, id) {
    if (e.ctrlKey || e.metaKey || e.shiftKey) { this.chooseMore({ id }, true); return; }
    const th = this.world.things[id];
    if (!th) return;
    if (!this.panel) { this.trayOpenCard(id); return; }
    if (this.draft) this.stopWriting();
    this.sel = { kind: isGroup(th) ? 'train' : 'thought', id };
    this.drawWorld();
  }

  // A loose card right-clicked: opened in the editor.
  trayOpenCard(id) {
    const th = this.world.things[id];
    if (!th) return;
    if (isGroup(th)) this.openDocument(id);
    else this.openProps({ kind: 'thought', id });
  }

  drawTray() {
    const items = this.roomId ? this.trayItems() : [];
    if (this.docks) { this.drawLoose(items); return; }
    if (!items.length) { this.trayEl.hidden = true; this.trayEl.replaceChildren(); return; }
    const open = !!this.trayOpen;
    const word = el('button', { type: 'button', class: 'word room-tray-btn', 'aria-expanded': String(open),
      title: 'Thoughts not placed in this mode yet. Drag one onto the room.',
      onclick: () => { this.trayOpen = !open; this.drawTray(); } }, `Loose · ${items.length}`);
    const row = open ? el('div', { class: 'panel room-tray-row', role: 'list' }, items.map((th) => this.looseCard(th))) : null;
    this.trayEl.hidden = false;
    this.trayEl.replaceChildren(...(row ? [row] : []), word);
  }

  // The loose thoughts in the left dock: always there in a room, empty or not ("Loose · 0"), and
  // kept up to date while it shows (or is hidden), so switching mode (Tab) changes what it lists
  // without shutting and opening it again; leaving the room shuts it.
  drawLoose(items) {
    const dock = this.docks.left;
    const open = this.loose && dock.isOpen('loose');
    if (!this.roomId && !open) { this.loose = null; this.looseQuery = ''; return; }
    const title = items.length ? `${items.length} not placed` : 'Nothing loose';
    const shown = this.looseFilter(items);
    const list = shown.length ? shown.map((th) => this.looseCard(th))
      : [el('p', { class: 'room-loose-hint' }, items.length ? 'Nothing loose has those words.' : `Every thought is placed in ${this.ont.name}.`)];
    if (open) { // (open() fills the dock at once; its handle comes after)
      this.loose.list.replaceChildren(...list);
      this.loose.handle?.setTitle(title);
      this.loose.handle?.setLabel(`Loose · ${items.length}`);
      return;
    }
    this.looseQuery = '';
    const listEl = el('div', { class: 'room-loose-list', role: 'list' }, list);
    // The search box: the list follows what is typed; Escape clears it (and, when empty, leaves it).
    const search = el('input', { type: 'search', class: 'room-loose-search', placeholder: 'Search loose thoughts',
      'aria-label': 'Search loose thoughts', spellcheck: 'false',
      oninput: (e) => { this.looseQuery = e.target.value; this.drawTray(); },
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (e.target.value) { e.target.value = ''; this.looseQuery = ''; this.drawTray(); } else e.target.blur();
      } });
    const body = el('div', { class: 'room-loose' },
      search,
      el('p', { class: 'room-loose-hint' }, 'Thoughts not placed in this mode yet, newest first. Drag one onto the room.'),
      listEl);
    const loose = (this.loose = { list: listEl, search, handle: null });
    // × and Escape only hide it, as Ctrl+Alt+L does; leaving the room shuts it.
    dock.open({ key: 'loose', kind: 'Loose', title, label: `Loose · ${items.length}`, body, beforeClose: () => { dock.toggle(); return false; },
      onClose: () => { if (this.loose === loose) { this.loose = null; this.looseQuery = ''; } } })
      .then((handle) => { if (this.loose === loose) { if (handle) loose.handle = handle; else this.loose = null; } });
  }

  // A thought dragged out of the tray: a copy of its card follows the pointer; let go over the
  // canvas, the ontology places it there.
  trayDrag(e, id) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const card = e.currentTarget;
    const r = card.getBoundingClientRect();
    const off = { x: e.clientX - r.left, y: e.clientY - r.top };
    const start = { x: e.clientX, y: e.clientY };
    let ghost = null; // made once the pointer has moved a little: until then it is a click
    const move = (ev) => {
      if (!ghost) {
        if (this.locked || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
        ghost = card.cloneNode(true);
        ghost.classList.add('panel', 'room-tray-ghost');
        ghost.classList.remove('st-sel');
        Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
        (document.getElementById('folio-root') || document.body).append(ghost); // fixed to the window, wherever the room sits
      }
      ghost.style.left = `${ev.clientX - off.x}px`; ghost.style.top = `${ev.clientY - off.y}px`;
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (!ghost) { if (ev.type === 'pointerup') this.trayClick(ev, id); return; }
      ghost.remove();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (ev.type !== 'pointerup' || !over || !this.world.things[id]) return;
      // A Twin: let go over its other side, it goes there (or stays there, if it came from there).
      const there = this.overOther(ev.clientX - off.x, ev.clientY - off.y);
      if (there && this.world.things[id].parent === there.id) {
        this.ontology(view(this.world, there.id).mode).drop(this.world, there.id, id, there.x, there.y);
        this.save();
        this.drawWorld();
        return;
      }
      if (there) { this.dropAcross(id, ev.clientX - off.x, ev.clientY - off.y); return; }
      if (!this.stage.contains(over) || !this.fromOtherSide(id)) return;
      const p = this.toWorld(ev.clientX - off.x, ev.clientY - off.y);
      this.ont.drop(this.world, this.roomId, id, Math.round(p.x), Math.round(p.y));
      this.save();
      this.drawWorld();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // Many things chosen with the box: move them to a room together, group them, or delete them.
  drawManyBar() {
    if (this.locked) { this.bar.hidden = true; return; }
    const ids = this.sel.ids.filter((id) => this.world.things[id]);
    const others = this.moveRooms();
    const pick = el('select', { class: 'room-edit-move', 'aria-label': 'Move to a room', onkeydown: (e) => e.stopPropagation(),
      onchange: (e) => {
        const to = e.target.value === '+' ? this.addPlainRoom() : e.target.value;
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
      el('div', { class: 'label' }, `${ids.length} chosen`),
      el('p', { class: 'pop-note' }, 'Drag any of them to move them together.'),
      el('div', { class: 'pop-row' }, pick),
      el('div', { class: 'pop-row' },
        this.ont.groups ? el('button', { type: 'button', class: 'word', title: this.keyMap ? `Group · ${this.keyMap.label('room.group')}` : 'Group',
          onclick: () => verbs.group(this) }, `One ${this.ont.groups.name.toLowerCase()}`) : null,
        el('button', { type: 'button', class: 'word pop-delete', onclick: () => {
          ids.forEach((id) => remove(this.world, id));
          this.sel = null;
          this.save();
          this.drawWorld();
          this.toast(`Deleted ${ids.length}. Ctrl+Z brings them back.`);
        } }, 'Delete')));
    this.positionEdit();
    this.drawHistorySoon();
  }

  // The rooms a thought can be moved to: every room (not this one, nor a locked one).
  moveRooms() {
    return rooms(this.world).filter((r) => r.id !== this.roomId && !shut(this.world, r.id))
      .sort((a, b) => (a.id === MESSY ? -1 : b.id === MESSY ? 1 : a.name.localeCompare(b.name)));
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

  // What is chosen changed: the Time dock lights it (the time feature).
  drawHistorySoon() { this.time?.refresh(); }

  // Closes a group, then asks for its name.
  closeTrain(trainId) {
    if (!closeGroup(this.world, trainId)) return;
    this.sel = null;
    this.save();
    this.drawWorld();
    this.openSheet(null, trainId);
  }

  openTrain(id) {
    openGroup(this.world, id);
    this.sel = null;
    this.save();
    this.drawWorld();
  }

  // ---- Passage and Picture: the two templates for bigger thoughts ----

  // Where a new thought goes: on with the current train, or a new train at a free spot.
  target() {
    if (this.addAt) { // Add, from a right-click on the canvas
      const at = this.addAt;
      this.addAt = null;
      return { train: null, x: Math.round(at.x), y: Math.round(at.y) };
    }
    const cur = this.current[this.roomId];
    const t = this.world.things[cur];
    if (!this.fresh && t?.parent === this.roomId && !t.closed && t.of === this.writer.id) return { train: cur };
    const spot = this.freeSpot();
    this.fresh = false;
    return { train: null, x: Math.round(spot.x), y: Math.round(spot.y) };
  }

  async choosePicture() {
    const file = await this.picker.pick();
    if (file) this.takePicture(file); else this.addAt = null;
  }

  onPaste(e) {
    if (this.root.hidden || !this.roomId || this.editing) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) { e.preventDefault(); this.takePicture(file); return; }
    // Words pasted on the canvas start a thought with them; several lines stay one thought.
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r\n?/g, '\n');
    // Thoughts copied here (Ctrl+C), as long as nothing else was copied since.
    if (this.clip && (!text || text === this.clip.text)) { e.preventDefault(); this.pasteThoughts(); return; }
    if (!text.trim() || this.locked) return;
    e.preventDefault();
    this.beginWriting(text);
  }

  async takePicture(file) {
    try {
      const src = await shrinkPicture(file);
      this.openSheet('picture', null, src);
    } catch {
      this.toast('That file couldn\'t be read as a picture.');
    }
  }

  // The sheet: to write a passage, caption a picture or name a closed group, new (kind) or an
  // existing thought (id), in the right dock's Editor tab (without docks, a quiet panel over the
  // room). Keep (Enter) saves it; Escape or Cancel leaves it.
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
      if (e.key === 'Enter' && !e.isComposing && enterKeeps(e)) keep(); // as everywhere: Enter keeps, Ctrl+Enter a new line
      if (e.key === 'Escape') { e.preventDefault(); this.closeSheet(); }
    };
    const fields = [];
    if (kind === 'group') {
      this.sheetTitle = el('input', { class: 'room-sheet-title', placeholder: `Name this ${this.groupName(th).toLowerCase()}`, 'aria-label': 'Name', value: th.title || '', onkeydown: keys });
      fields.push(this.sheetTitle, el('div', { class: 'room-sheet-preview' }, thoughtText(this.world, th)));
    } else if (kind === 'passage') {
      this.sheetTitle = el('input', { class: 'room-sheet-title', placeholder: 'Title', 'aria-label': 'Title', value: th?.title || '', onkeydown: keys });
      this.sheetBody = el('textarea', { class: 'room-sheet-body', placeholder: 'A paragraph, or a small article', 'aria-label': 'Passage', rows: 9, onkeydown: keys });
      this.sheetBody.value = th?.body || '';
      fields.push(this.sheetTitle, this.sheetBody);
    } else {
      this.sheetCaption = el('input', { class: 'room-sheet-title', placeholder: 'A caption (optional)', 'aria-label': 'Caption', value: th?.text || '', onkeydown: keys });
      fields.push(el('img', { class: 'room-sheet-picture', src: this.editing.src, alt: '' }), this.sheetCaption);
    }
    const label = { passage: 'Passage', picture: 'Picture', group: `A closed ${this.groupName(th).toLowerCase()}` }[kind];
    const words = el('div', { class: 'sheet-words' },
      el('button', { type: 'button', class: 'word', onclick: keep }, 'Keep'),
      el('button', { type: 'button', class: 'word', onclick: () => this.closeSheet() }, 'Cancel'),
      el('span', { class: 'sheet-keys' }, kind === 'passage' ? 'Enter keeps it · Ctrl+Enter a new line · Esc cancels' : 'Enter keeps it · Esc cancels'));
    const first = () => (kind === 'picture' ? this.sheetCaption : kind === 'passage' && th ? this.sheetBody : this.sheetTitle);
    if (this.panel) { this.dockSheet(label, th, [...fields, words], first); return; }
    this.sheet.replaceChildren(el('div', { class: 'label' }, label), ...fields, words);
    this.sheet.hidden = false;
    first().focus();
  }

  // The sheet in the right dock's Editor tab (in place of the content editor, if it showed). The
  // dock's × or Escape is Cancel.
  dockSheet(label, th, parts, first) {
    const ed = this.editing;
    const title = th ? (th.title || th.text || label) : `A new ${label.toLowerCase()}`;
    const body = el('div', { class: 'room-sheet room-sheet-docked' }, ...parts);
    ed.docked = true;
    this.panel.open({ key: 'sheet', kind: label, title, body,
      onClose: () => { if (this.editing === ed) { this.editing = null; this.addAt = null; } } })
      .then((h) => {
        if (this.editing !== ed) return;
        if (!h) { this.editing = null; return; }
        first().focus();
      });
  }

  keepSheet() {
    const ed = this.editing;
    if (!ed) return;
    if (ed.kind === 'group') name(this.world, ed.id, this.sheetTitle.value);
    else {
      const fields = ed.kind === 'passage'
        ? { kind: 'passage', title: this.sheetTitle.value, body: this.sheetBody.value }
        : { kind: 'picture', src: ed.src, text: this.sheetCaption.value };
      if (ed.id) update(this.world, ed.id, fields);
      else {
        this.keepNew(this.target(), fields);
      }
    }
    this.save();
    this.closeSheet();
    this.drawWorld();
  }

  closeSheet() {
    const ed = this.editing;
    this.addAt = null;
    this.editing = null;
    this.sheet.hidden = true;
    this.sheet.replaceChildren();
    if (ed?.docked) this.panel?.close('sheet', true);
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
