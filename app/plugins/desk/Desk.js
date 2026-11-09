// Desk: where the day starts. Every open gap and everything that came back, across all rooms, in
// one tab of the left dock (the left is for finding): grouped by room, or by floor and then room.
// One click, or Enter on a row, goes into the mark's room with the view on it and it chosen.
// Ctrl+Alt+D shows the desk with the first row ready for the arrow keys, or hides it. Work from the
// desk once a day; done is no open gaps.
//
// A plugin. It reaches the app only through the plugin API, the `traumerei` service
// (app/core/API.md: t.gaps.opened, t.moments.returns, t.places.home, t.marks.get/text,
// t.ui.docks.left, t.ui.open.mark), never another feature's files. It only reads: answering a
// gap or a return is the Gaps and Returns plugins' (and the Editor's) work.
//
// Saved data: none.

import { Feature, ui } from 'folio';
import { BY, items, byRoom, byFloor, summary, label, why, firstLine, step } from './rules.js';

const { el } = ui;
const KEY = 'desk';

export default class Desk extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    this.by = 'room';
    t.slots.commands.add({ id: 'desk.show', keys: ['Ctrl+Alt+D'], zone: 'everywhere', order: 61,
      words: 'Desk: show or hide every open gap and return, across all rooms', run: () => this.toggle() });
    t.slots.more.add({ id: 'desk', label: 'Desk', order: 29, run: () => this.toggle(), on: () => !!this.dock?.isShowing(KEY),
      icon: '<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M8 20h8M12 16v4"/>', title: () => 'Show or hide the desk: what waits on you, across all rooms' });
    const later = () => this.later();
    t.gaps.on(later); t.moments.on(later); t.marks.on(later); t.places.on(later);
  }

  get dock() { return this.t.ui.docks?.left || null; }

  // A change landed: drawn again once, after the step, and only while the tab is open.
  later() {
    if (this.pending || !this.body) return;
    this.pending = true;
    setTimeout(() => { this.pending = false; this.render(); }, 0);
  }

  toggle() {
    if (!this.dock) return;
    if (!this.dock.isShowing(KEY)) { this.show(); return; }
    if (this.body?.contains(document.activeElement)) this.dock.close(KEY, true);
    else this.focusRow(0);
  }

  async show() {
    if (!this.dock.isOpen(KEY)) {
      this.body = el('div', { class: 'desk' });
      this.body.addEventListener('keydown', (e) => this.onKey(e));
      this.handle = await this.dock.open({ key: KEY, tab: 'Desk', kind: '', title: '', label: label(0), body: this.body,
        onClose: () => { this.handle = null; this.body = null; } });
      if (!this.handle) return;
    } else this.dock.show(KEY);
    this.render();
    this.focusRow(0);
  }

  // Where a mark sits: its room (a room is its own), and the floor (or Archive) that room is on.
  place(mark) {
    const t = this.t, m = t.marks.get(mark);
    if (!m) return null;
    const room = m.kind === 'room' ? mark : t.places.home(mark);
    const r = room && t.marks.get(room);
    if (!r || r.kind !== 'room') return null;
    let up = t.places.home(room);
    for (let i = 0; i < 4 && up && t.marks.get(up)?.kind === 'room'; i++) up = t.places.home(up); // a Twin's side: its Twin's floor
    const f = up && t.marks.get(up);
    return { room, roomName: r.name || 'Untitled room', floor: up || '', floorName: f?.name || 'Rooms', floorOrder: Number.isFinite(f?.n) ? f.n : Infinity };
  }

  render() {
    if (!this.body) return;
    const t = this.t, now = Date.now();
    const list = items(t.gaps.opened(), t.moments.returns(), (m) => this.place(m));
    this.handle?.setLabel?.(label(list.length));
    this.handle?.setTitle?.(summary(list) || 'Nothing open');
    const had = this.rows?.indexOf(document.activeElement) ?? -1;
    this.rows = [];
    const row = (it) => {
      const b = el('button', { type: 'button', class: 'desk-row' + (it.back ? ' back' : ''), title: 'Go to it', onclick: () => this.go(it.mark) },
        el('span', { class: 'desk-what' }, firstLine(t.marks.text(it.mark) || (it.mark === it.room ? it.roomName : ''))),
        el('span', { class: 'desk-why' }, why(it, now), it.note ? ` · ${it.note}` : ''));
      this.rows.push(b);
      return el('li', {}, b);
    };
    const room = (r) => el('section', { class: 'desk-room' },
      el('div', { class: 'label' }, r.name, el('span', { class: 'desk-count' }, ` ${r.items.length}`)),
      el('ul', { class: 'desk-list' }, ...r.items.map(row)));
    const choose = el('div', { class: 'desk-by' }, ...BY.map((b) => el('button', { type: 'button', class: 'word' + (this.by === b ? ' on' : ''),
      'aria-pressed': String(this.by === b), onclick: () => { this.by = b; this.render(); } }, b === 'room' ? 'By room' : 'By floor')));
    const parts = [el('div', { class: 'desk-head' }, el('span', { class: 'desk-sum' }, summary(list) || 'Nothing open'), choose)];
    if (!list.length) parts.push(el('p', { class: 'hint' }, 'No gap is open and nothing has come back. Done is no open gaps: mark what is missing with Ctrl+Alt+G, ask a thought to come back from the Editor.'));
    else if (this.by === 'floor') for (const f of byFloor(list)) parts.push(el('section', { class: 'desk-floor' }, el('div', { class: 'desk-floor-name' }, f.name), ...f.rooms.map(room)));
    else parts.push(...byRoom(list).map(room));
    this.body.replaceChildren(...parts);
    if (had >= 0) this.focusRow(Math.min(had, this.rows.length - 1));
  }

  focusRow(i) { this.rows?.[i]?.focus(); }

  // Arrows, Home and End move between rows; Enter (a button's own) goes.
  onKey(e) {
    const i = this.rows?.indexOf(document.activeElement) ?? -1;
    if (i < 0 || e.ctrlKey || e.altKey || e.metaKey) return;
    const j = step(i, this.rows.length, e.key);
    if (j !== i) { e.preventDefault(); this.focusRow(j); }
  }

  go(mark) { if (!this.t.ui.open.mark(mark)) this.t.ui.toast('It is in no room'); }
}
