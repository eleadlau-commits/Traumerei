// Part of the rooms feature: choosing many rooms on a floor (or the Archive). Shift+click or
// Ctrl+click adds a square to the choice or takes it out; Ctrl+A chooses every room shown; Escape
// lets go. What is done to them is verbs.js's (duplicate, move, tag) and Delete's (Rooms.js). Its
// methods join the Rooms class (end of Rooms.js), so `this` is the feature; `this.picks` holds the
// ids while more than one is chosen ([] otherwise; `roomPick` is the last one pressed).
//
// With many chosen, the dock's Editor tab shows "N rooms" (`manyShown`) with Lock, Archive and
// Delete (in the Archive: Restore and Delete): on a right-click on one of them, or when the Editor
// was already open as the choice grew.

import { MESSY, room, remove, shut } from './world.js';
import { el } from './shared.js';

export class RoomsMany {
  // The chosen rooms' ids: many, or the one picked (or whose properties show).
  chosenIds() {
    if (this.picks?.length > 1) return this.picks.filter((id) => room(this.world, id));
    const id = this.roomSel || this.roomPick;
    return id && room(this.world, id) ? [id] : [];
  }

  // Shift+click or Ctrl+click: the square joins the choice, or leaves it.
  addPick(id) {
    const before = this.pickBefore !== undefined ? this.pickBefore : this.roomPick;
    this.pickBefore = undefined;
    const now = this.picks?.length ? [...this.picks] : (before && before !== id ? [before] : []);
    const i = now.indexOf(id);
    if (i >= 0) now.splice(i, 1); else now.push(id);
    this.picks = now.length > 1 ? now : [];
    if (this.propsDock && this.picks.length) this.manyShown = true; // the Editor follows the choice
    this.roomPick = now.includes(id) ? id : now[now.length - 1] || null;
    this.roomSel = null;
    this.making = null;
    this.drawRooms();
  }

  // Ctrl+A: every room shown (this floor, or the Archive).
  pickAll() {
    const ids = [...this.grid.querySelectorAll('.rooms-tile[data-room]')].map((t) => t.dataset.room);
    if (!ids.length) return;
    this.picks = ids.length > 1 ? ids : [];
    if (this.propsDock && this.picks.length) this.manyShown = true;
    this.roomPick = ids[ids.length - 1];
    this.roomSel = null;
    this.making = null;
    this.drawRooms();
  }

  clearPicks() {
    if (!this.picks?.length) return false;
    this.picks = [];
    this.manyShown = false;
    this.drawRooms();
    return true;
  }

  // A right-click (or the ContextMenu key) on a room: with it among many chosen, the Editor shows
  // them all; otherwise its own properties.
  askRoom(id) {
    if (this.panel && this.picks?.length > 1 && this.picks.includes(id)) {
      this.manyShown = true;
      this.roomSel = null;
      this.making = null;
      this.drawRooms();
      return;
    }
    this.chooseRoom(id, true);
  }

  // The Editor tab for many rooms: "N rooms", then what can be done to them all. shelf: archived.
  dockMany(ids, shelf = false) {
    const rs = ids.map((id) => room(this.world, id)).filter(Boolean);
    const key = (id) => el('span', { class: 'key' }, this.keyMap?.label?.(id) || '');
    const btn = (label, fn, id = null, extra = '') => el('button', { type: 'button', class: 'box-btn ' + extra, onclick: fn }, label, id ? key(id) : '');
    const all = () => rs.map((r) => r.id);
    const locked = rs.every((r) => shut(this.world, r.id));
    const rows = [
      el('div', { class: 'title-field' }, `${rs.length} rooms`),
      el('p', { class: 'pop-note' }, rs.map((r) => r.name).join(', ')),
      el('details', { class: 'sec', open: '' }, el('summary', {}, 'Actions'), el('div', { class: 'sec-body' }, el('div', { class: 'box-btns' },
        shelf ? btn('Restore', () => this.restoreRooms(all()), 'rooms.archive')
          : btn(locked ? 'Unlock' : 'Lock', () => this.lockRooms(all()), 'rooms.lock'),
        shelf ? null : btn('Archive', () => this.archiveRooms(all()), 'rooms.archive'),
        btn('Delete', () => this.deleteMany(), 'rooms.delete', 'danger pop-delete')))),
    ].filter(Boolean);
    this.fillDock('many', shelf ? 'Archived rooms' : 'Rooms', rows, () => {
      if (!this.manyShown) return;
      this.manyShown = false;
      if (!this.inRoom && !this.root.hidden) this.drawRooms();
    });
  }

  // Delete with many chosen: every one that can go (not Messy thoughts, not a locked room), one step.
  deleteMany() {
    const ids = this.chosenIds().filter((id) => id !== MESSY && !shut(this.world, id));
    if (!ids.length) { this.toast('Messy thoughts and locked rooms stay.'); return; }
    for (const id of ids) remove(this.world, id);
    this.picks = [];
    this.roomSel = this.roomPick = null;
    this.save();
    this.drawRooms();
    this.toast(`Deleted ${ids.length} room${ids.length === 1 ? '' : 's'}. Ctrl+Z brings them back.`);
  }
}
