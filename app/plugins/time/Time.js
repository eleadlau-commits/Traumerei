// Time: a tab of the right dock, Time (Ctrl+Alt+T), the same everywhere Create shows. In a room it
// is the room's Timeline: everything written there, in the order it last changed (latest at the
// bottom), each with its time and, where the mode groups thoughts, its group as a tag (Joyce: its
// train). On the rooms page it lists the days something was written, newest first, and the rooms
// written in each, under a slider of days: going back shows the rooms page as it was that day
// (the rooms page draws it, from what Time gives it). A click takes you to what it names.
//
// Time draws only the dock. Where it is, and what a click does, is the place's: the room and the
// rooms page each add one item to the slot `time.place` (README.md). Whether Time is on is one
// choice for everywhere, saved here: leaving a room keeps it on, and the rooms page shows its own.
//
// It also keeps a daily record of the rooms page (record.js): at the end of each day, where each
// room sat and what it was called, and which rooms were written in. Settings → History says how
// long it is kept (1 month, 1 year, or forever).
//
// Saved data: 'open' (whether Time is on), 'record' (the daily record), 'keep' (days kept, 0 for
// forever).

import { Feature, ui } from 'folio';
import { timeline, days, changed, dayOf, roomBoard, roomFirst } from './days.js';
import { snapshot, note, prune, emptyRecord, earliest, pastBoard, KEEP, KEEP_DEFAULT, DAY } from './record.js';
import { TIME_KEYS } from './keys.js';

const { el } = ui;
const KEY = 'time'; // what it holds in the right dock

export default class Time extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Time needs the plugin API');
    this.t = t;
    this.panel = t.docks?.right || null; // the right dock, or null: then Time is off
    this.isOn = !!this.storage.get('open', false);
    this.shown = null;   // { body, handle } while it is in the dock
    this.closing = false; // its × or Escape was pressed (not another feature closing the dock)
    this.day = null;      // the day gone back to (its start, ms), or null for now
    this.pastFor = null;  // the place shown that day
    this.defineSlot('time.place', 'Where Create is, for the Time dock: { live() → whether it shows now; room() → the open room\'s id, or null for the rooms page; chosen?() → the id chosen there; go(f) → go to a find { id, kind, room }; redraw?() → Time turned on or off }. The first live one is used.');
    const self = this;
    this.provide('time', {
      toggle: () => this.toggle(),        // Ctrl+Alt+T: on, to the front, or off
      refresh: () => this.refreshSoon(),  // the place changed (drawn again, left, or a choice)
      show: () => this.panel?.show(KEY),  // brings its tab to the front
      now: () => { this.toNow(); this.draw(); }, // back from a past day to now
      get on() { return !!self.panel && self.isOn; },
      get showing() { return !!self.panel?.isShowing(KEY); },
    });
    // The daily record: written a moment after anything is saved, and when Create starts.
    this.keep = this.storage.get('keep', KEEP_DEFAULT);
    this.record = this.storage.get('record', null) || emptyRecord();
    this.written = new Set(); // rooms written in since the record was last written
    this.on('world:saved', () => this.recordSoon());
    this.on('world:changed', () => this.recordSoon());
    this.on('room:changed', (id) => { this.written.add(this.squareId(id)); this.recordSoon(); });
    this.recordSoon();
    this.add('settings', { id: 'time-history', title: 'History', order: 31, render: () => this.settingsPane() });
    if (!this.panel) return;
    // Time under ⋯ More, at the foot of both rails (the frame feature's).
    t.more.add({ id: 'time', label: 'Time', icon: 'clock', order: 10, run: () => this.toggle(),
      on: () => this.isOn, visible: () => !!this.place(),
      title: () => { const keys = t.commands.label('time.toggle'); return keys ? `Time · ${keys}` : 'Time'; } });
    for (const k of TIME_KEYS) t.commands.add({ ...k, zone: 'everywhere', when: () => !!this.place(), run: () => this.toggle() });
    this.on('world:saved', () => this.refreshSoon());
    this.on('world:changed', () => this.refreshSoon());
    this.on('room:open', () => this.refreshSoon());
  }

  get world() { return this.t.world; }
  get m() { return this.t.model; }

  // ---- The daily record ----

  // The square on the rooms page a room is: itself, or its Twin (a side's).
  squareId(id) {
    const r = this.m.room(this.world, id);
    return r?.parent && this.m.room(this.world, r.parent) ? r.parent : id;
  }

  recordSoon() {
    clearTimeout(this.recordTimer);
    this.recordTimer = setTimeout(() => this.writeRecord(), 1500);
  }

  // Today, as it is now, into the record; days older than the history kept are folded away.
  writeRecord() {
    clearTimeout(this.recordTimer);
    note(this.record, snapshot(this.world), [...this.written]);
    this.written.clear();
    prune(this.record, this.keep);
    this.storage.set('record', this.record);
  }

  // Settings → History: how long the record is kept.
  settingsPane() {
    return el('div', { class: 'stack' },
      el('label', { class: 'row' }, el('span', {}, 'Keep the history'),
        el('select', { 'aria-label': 'Keep the rooms\' history', onchange: (e) => this.setKeep(+e.target.value) },
          ...KEEP.map((k) => el('option', { value: k.days, ...(k.days === this.keep ? { selected: '' } : {}) }, k.words)))),
      ui.hint('A day by day record of the rooms page, for going back in Time. A shorter history forgets the older days.', { small: true }));
  }

  setKeep(days) {
    this.keep = days;
    this.storage.set('keep', days);
    this.writeRecord();
  }

  // The place that shows now, or null (the home page).
  place() { return this.slot('time.place').first((p) => (p.live() ? p : null)) || null; }

  setOn(on) {
    this.isOn = !!on;
    this.storage.set('open', this.isOn);
  }

  // Ctrl+Alt+T, or Time in a rail: turns it on, brings its tab to the front when it is behind
  // another, or turns it off.
  toggle() {
    const p = this.place();
    if (!this.panel || !p) return;
    if (this.isOn && this.shown && !this.panel.isShowing(KEY)) { this.panel.show(KEY); return; }
    this.setOn(!this.isOn);
    this.draw();
    p.redraw?.();
  }

  refreshSoon() {
    if (!this.panel) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.draw(), 60);
  }

  // Opens, fills or closes its tab to match where Create is and whether Time is on.
  draw() {
    clearTimeout(this.timer);
    const p = this.place();
    if (!this.isOn || !p) {
      this.toNow();
      if (this.shown) { this.shown = null; this.panel.close(KEY, true); }
      return;
    }
    if (this.pastFor && this.pastFor !== p) this.toNow(); // going back is for the place it was chosen in
    const roomId = p.room?.() || null;
    const r = roomId && this.m.room(this.world, roomId);
    const twin = r && this.t.twins.twinOf(this.world, roomId);
    const title = r ? (twin ? `${twin.name} · ${r.name}` : r.name) : 'Every room';
    const kind = r ? 'Timeline' : 'Days';
    const list = r ? this.roomList(p, roomId) : this.dayList(p);
    // The slider stays the same node while it shows (it may be being dragged); only the list is new.
    const scrub = this.scrubFor(p);
    if (this.shown && this.panel.isOpen(KEY)) {
      if (this.shown.scrub !== scrub) this.shown.top.replaceChildren(...(scrub ? [scrub.el] : []));
      this.shown.scrub = scrub;
      this.shown.list.replaceChildren(list);
      this.shown.handle?.setTitle(title);
      this.shown.handle?.setKind(kind);
    } else {
      const top = el('div', { class: 'time-top' }, ...(scrub ? [scrub.el] : []));
      const box = el('div', { class: 'time-body' }, list);
      const body = el('div', { class: 'time', onkeydown: (e) => this.onKey(e) }, top, box);
      const now = (this.shown = { body, top, list: box, scrub, handle: null });
      // (open() fills the tab at once; its handle comes after)
      this.panel.open({ key: KEY, tab: 'Time', kind, title, body,
        beforeClose: () => { this.closing = true; return true; },
        onClose: () => {
          const asked = this.closing;
          this.closing = false;
          if (this.shown !== now) return; // it was closed here
          this.shown = null;
          if (!asked) return; // another feature cleared the dock: Time stays on, and comes back
          this.toNow();
          this.setOn(false);
          this.place()?.redraw?.();
        } })
        .then((h) => { if (this.shown === now) { if (h) now.handle = h; else this.shown = null; } });
    }
    if (r) list.lastElementChild?.scrollIntoView?.({ block: 'end' });
  }

  // ---- Going back ----

  today() { return dayStart(Date.now()); }

  // Goes back to `day` (a time on it; null, or today or later, is now) and has the place show it.
  setDay(day) {
    const p = this.place();
    if (!p?.showDay || day == null) { this.toNow(); this.draw(); return; }
    day = dayStart(Math.max(this.firstFor(p), Math.min(day, Date.now())));
    if (day >= this.today()) { this.toNow(); this.draw(); return; }
    this.writeRecord(); // (today's changes are in it before anything is read back)
    this.day = day;
    this.pastFor = p;
    const roomId = p.room?.();
    p.showDay(roomId ? roomBoard(this.m, this.world, roomId, day) : pastBoard(this.m, this.world, this.record, day));
    this.draw();
  }

  // Back to now: the place shows the present again.
  toNow() {
    const p = this.pastFor;
    this.day = null;
    this.pastFor = null;
    p?.showDay?.(null);
  }

  // The first day the slider reaches: the room's first, or (on the rooms page) the first known.
  firstFor(p) {
    const roomId = p.room?.();
    return roomId ? roomFirst(this.m, this.world, roomId) : earliest(this.world, this.record);
  }

  // A day earlier (-1) or later (+1), or a week with Shift.
  step(by) { this.setDay((this.day ?? this.today()) + by * DAY + DAY / 2); }

  // In the dock: ↑ a day later, ↓ a day earlier, with Shift a week; Escape (the dock's) closes
  // Time and so comes back to now.
  onKey(e) {
    if (!this.shown?.scrub || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    this.step((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 7 : 1));
  }

  // The slider of days, for a place that can show a past day (the rooms page, a room): oldest at
  // the left, today at the right. Made once while the dock shows and kept up to date.
  scrubFor(p) {
    if (!p.showDay) return null;
    const first = this.firstFor(p);
    const n = Math.max(0, Math.round((this.today() - first) / DAY));
    let s = this.shown?.scrub;
    if (!s) {
      s = { el: null };
      s.label = el('div', { class: 'time-scrub-day' });
      s.slider = el('input', { type: 'range', class: 'time-scrub-slider', min: 0, step: 1, 'aria-label': 'Go back to a day',
        oninput: () => { const at = this.place(); if (at) this.setDay(this.firstFor(at) + (+s.slider.value) * DAY + DAY / 2); } });
      s.from = el('span', { class: 'time-when' });
      s.now = el('button', { type: 'button', class: 'word time-scrub-now', onclick: () => this.setDay(null) }, 'Now');
      s.el = el('div', { class: 'time-scrub' }, s.label, s.slider,
        el('div', { class: 'time-scrub-foot' }, s.from, el('span', { class: 'key' }, '↑ ↓ a day · Shift a week'), s.now));
    }
    s.slider.max = String(n);
    const at = this.day == null ? n : Math.round((this.day - first) / DAY);
    if (document.activeElement !== s.slider || this.day == null) s.slider.value = String(at);
    s.label.textContent = this.day == null ? 'Now' : longDate(this.day);
    s.from.textContent = shortDate(first);
    s.now.hidden = this.day == null;
    s.el.classList.toggle('past', this.day != null);
    return s;
  }

  // In a room: its thoughts in time, latest at the bottom. Gone back to a day, only those made by
  // its end, those written that day lit.
  roomList(p, roomId) {
    const w = this.world, m = this.m;
    const day = this.pastFor === p ? this.day : null;
    const end = day == null ? Infinity : day + DAY - 1;
    const items = timeline(m, w, roomId).filter((th) => (th.at ?? 0) <= end);
    if (!items.length) return el('p', { class: 'time-none' }, day == null ? 'Nothing written here yet' : 'Nothing written here by then');
    const ont = this.t.modes.get(m.view(w, roomId).mode);
    const sel = p.chosen?.() || null;
    const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return el('ol', { class: 'time-list' }, items.map((th) => {
      const tag = ont?.tag?.(w, th.id) || null;
      return el('li', {}, el('button', {
        type: 'button', class: 'pick time-item' + (sel && (sel === th.id || sel === tag?.id) ? ' on' : '')
          + (day != null && (dayOf(th.at) === day || dayOf(changed(th)) === day) ? ' lit' : ''),
        style: tag ? `--tag:hsl(${m.hash(tag.id) % 360} 32% 46%)` : '',
        onclick: () => p.go({ id: th.id, kind: m.kindOf(th), room: roomId }),
      },
        el('span', { class: 'time-meta' },
          el('span', { class: 'time-when' }, when(changed(th))),
          tag ? el('span', { class: 'time-tag' }, tag.name) : null),
        el('span', { class: 'time-text' }, m.thoughtText(w, th))));
    }));
  }

  // On the rooms page: the days something was written, newest first, and where.
  dayList(p) {
    const w = this.world, m = this.m;
    const all = days(m, w);
    if (!all.length) return el('p', { class: 'time-none' }, 'Nothing written yet');
    const sel = p.chosen?.() || null;
    // A day's date goes back to it (the rooms page as it was then); again, back to now.
    return el('ol', { class: 'time-list time-days' }, all.map((d) => el('li', { class: 'time-day' },
      p.showDay
        ? el('button', { type: 'button', class: 'word time-date' + (this.day === d.day ? ' on' : ''), 'aria-pressed': String(this.day === d.day),
          title: 'See the rooms page as it was that day', onclick: () => this.setDay(this.day === d.day ? null : d.day + DAY / 2) }, longDate(d.day))
        : el('div', { class: 'sub-head time-date' }, longDate(d.day)),
      ...d.rooms.map(({ id, n }) => el('button', {
        type: 'button', class: 'pick time-item time-room' + (sel === id ? ' on' : ''),
        onclick: () => p.go({ id, kind: 'room' }),
      },
        el('span', { class: 'time-text' }, m.room(w, id)?.name || 'A room'),
        el('span', { class: 'time-when' }, n === 1 ? '1 thought' : `${n} thoughts`))))));
  }
}

const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const longDate = (ms) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDate = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
