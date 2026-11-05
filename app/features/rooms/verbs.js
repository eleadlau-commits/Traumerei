// Part of the rooms feature. Duplicating a room and moving it to another floor. The copy is the
// world's one rule (copyRoom: everything inside copied, nothing shared); where it goes is the
// floors feature's (beside the original, else a new floor). Each is one undo step. Its methods
// join the Rooms class (end of Rooms.js), so `this` is the feature.
//
// Duplicate: Ctrl+D, Duplicate in a room's properties, or Alt+drag a square (grid.js) to where the
// copy should go. Move: Ctrl+M, Move to floor… in its properties (a short list of floors), or drag
// a square onto a floor in the rail (grid.js).

import { MESSY, room, copyRoom, pageCount, addPage } from './world.js';
import { el } from './shared.js';

export class RoomsVerbs {
  // A copy of room `id`, beside it (`cell`: where it was dropped, on floor `page`, or else its
  // original's cell), chosen. Returns the copy, or null.
  duplicateRoom(id, { cell = null, page = null } = {}) {
    const r = room(this.world, id);
    if (!r || r.archived) return null;
    const c = copyRoom(this.world, id);
    if (!c) return null;
    let out;
    if (page != null && page !== (c.page || 0) && this.floors.toFloor(c.id, page, cell) === true) out = { page };
    else out = this.floors.place(c.id, cell || (r.col != null ? { col: r.col, row: r.row } : null), { near: true });
    this.save();
    if (out) this.page = out.page;
    this.shelf = false;
    this.roomSel = this.panel && this.propsDock ? c.id : null; // the dock follows the copy
    this.roomPick = c.id;
    this.making = null;
    this.drawRooms();
    this.toast(`${c.name} is on Floor ${(c.page || 0) + 1}. Ctrl+Z takes it back.`);
    return c;
  }

  // Moves room `id` to floor `page` (its first free spot): one step. False when it can't go.
  moveRoomTo(id, page) {
    const r = room(this.world, id);
    if (!r) return false;
    if (page === 'new') page = addPage(this.world);
    const moved = this.floors.toFloor(id, page);
    if (moved === 'full') { this.toast(`Floor ${page + 1} is full.`); return false; }
    if (!moved) { this.toast(r.locked ? `${r.name} is locked, so it keeps its place.` : `${r.name} stays where it is.`); return false; }
    this.save();
    this.page = page;
    this.roomPick = id;
    this.drawRooms();
    this.toast(`${r.name} is on Floor ${page + 1}.`);
    return true;
  }

  // The chosen room, for Ctrl+D and Ctrl+M (not while typing in a field).
  chosenFor(e) {
    if (e?.target?.matches?.('input, textarea, select, [contenteditable]')) return null;
    if (this.root.hidden || this.inRoom) return null;
    return room(this.world, this.roomSel || this.roomPick);
  }

  duplicateChosen(e) {
    const r = this.chosenFor(e);
    if (r) this.duplicateRoom(r.id);
  }

  // Ctrl+M: a short list of the floors to move the chosen room to (its own is not one), and
  // + New floor. A number key or a click picks; Escape or a click elsewhere lets go.
  moveChosen(e) {
    const r = this.chosenFor(e);
    if (!r) return;
    if (r.id === MESSY) { this.toast('Messy thoughts stays on Floor 1.'); return; }
    if (r.locked) { this.toast(`${r.name} is locked, so it keeps its place.`); return; }
    this.floorPicker(r);
  }

  floorPicker(r) {
    this.closeFloorPicker();
    const here = r.page || 0;
    const pick = (page) => { this.closeFloorPicker(); this.moveRoomTo(r.id, page); };
    const rows = Array.from({ length: pageCount(this.world) }, (_, i) => el('button', {
      type: 'button', class: 'pick', disabled: i === here, onclick: () => pick(i),
    }, `Floor ${i + 1}`, el('span', { class: 'pick-note' }, i === here ? 'here' : String(i + 1))));
    rows.push(el('button', { type: 'button', class: 'pick', onclick: () => pick('new') }, 'New floor', el('span', { class: 'pick-note' }, 'N')));
    const box = el('div', { class: 'panel top-sheet rooms-floor-pick', role: 'dialog', 'aria-label': `Move ${r.name} to a floor`,
      onpointerdown: (ev) => ev.stopPropagation(),
      onkeydown: (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); this.closeFloorPicker(); return; }
        const n = ev.key.toLowerCase() === 'n' ? 'new' : /^[1-9]$/.test(ev.key) ? +ev.key - 1 : null;
        if (n === 'new' || (n != null && n < pageCount(this.world) && n !== here)) { ev.preventDefault(); pick(n); }
      } },
    el('p', { class: 'label' }, `Move ${r.name} to`), ...rows);
    this.floorPick = box;
    this.root.append(box);
    box.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    this.floorPickAway = (ev) => { if (!box.contains(ev.target)) this.closeFloorPicker(); };
    document.addEventListener('pointerdown', this.floorPickAway, true);
  }

  closeFloorPicker() {
    if (!this.floorPick) return;
    this.floorPick.remove();
    this.floorPick = null;
    document.removeEventListener('pointerdown', this.floorPickAway, true);
  }
}
