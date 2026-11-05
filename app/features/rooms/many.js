// Part of the rooms feature: choosing many rooms on a floor (or the Archive). Shift+click or
// Ctrl+click adds a square to the choice or takes it out; Ctrl+A chooses every room shown; Escape
// lets go. What is done to them is verbs.js's (duplicate, move, tag) and Delete's (Rooms.js). Its
// methods join the Rooms class (end of Rooms.js), so `this` is the feature; `this.picks` holds the
// ids while more than one is chosen ([] otherwise; `roomPick` is the last one pressed).

import { MESSY, room, remove, shut } from './world.js';

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
    this.roomPick = ids[ids.length - 1];
    this.roomSel = null;
    this.making = null;
    this.drawRooms();
  }

  clearPicks() {
    if (!this.picks?.length) return false;
    this.picks = [];
    this.drawRooms();
    return true;
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
