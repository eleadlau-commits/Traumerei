// Part of the rooms feature: a floor's properties and deleting a floor. A right-click on a floor
// in the rail chooses it and shows its properties in the right dock's Editor tab (Floor n, how
// many rooms, Delete floor); while they show, a click on another floor switches them. Delete floor
// (or the Delete key) first warns, in the dock itself: what will happen, with Delete floor and
// Cancel (Enter and Escape). Deleted, its rooms go to the Archive and the floors below move up
// one; Ctrl+Z brings it all back. Floor 1 stays (Messy thoughts lives there). The rule itself is
// the floors feature's (`removeFloor`). Its methods join the Rooms class (end of Rooms.js), so
// `this` is the feature; `this.floorSel` is the chosen floor, `this.floorAsk` the one being warned
// about.

import { el } from './shared.js';
import { roomsOn } from './world.js';

export class RoomsFloor {
  // Chooses floor `i` (it slides into view) and shows its properties.
  chooseFloor(i) {
    if (this.shelf) this.toggleShelf();
    this.showPage(i);
    this.floorSel = i;
    this.floorAsk = null;
    this.drawRooms();
  }

  // The warning before a floor goes, in its properties (they open if they weren't showing). Without
  // the docks feature there is nowhere to warn, so it goes at once (Ctrl+Z still brings it back).
  askFloor(i) {
    if (i === 0) { this.toast('Floor 1 stays: Messy thoughts lives there.'); return; }
    if (!this.panel) { this.deleteFloor(i); return; }
    if (this.floorSel !== i) this.chooseFloor(i);
    this.floorAsk = i;
    this.drawRooms();
    this.propsDock?.body.querySelector('.floor-yes')?.focus({ preventScroll: true });
  }

  // Cancel: the floor stays, and its properties go back to how they were.
  cancelFloor() {
    this.floorAsk = null;
    this.drawRooms();
    document.querySelector(`.rooms-page[data-page="${this.floorSel}"]`)?.focus({ preventScroll: true });
  }

  // What a floor's properties hold: its name, how many rooms, and Delete floor (not for Floor 1).
  floorRows(i) {
    const n = roomsOn(this.world, i).length;
    const key = (k) => el('span', { class: 'key' }, k);
    const kv = (label, value) => el('div', { class: 'kv' }, el('span', {}, label), el('span', {}, value));
    return [
      el('div', { class: 'title-field' }, `Floor ${i + 1}`),
      el('details', { class: 'sec', open: '' }, el('summary', {}, 'Floor'), el('div', { class: 'sec-body' },
        kv('Rooms', n ? String(n) : 'None'),
        i === 0 ? el('p', { class: 'pop-note' }, 'Messy thoughts lives here, so Floor 1 stays.') : null,
        i > 0 && n ? el('p', { class: 'pop-note' }, 'Deleting it puts its rooms in the Archive.') : null)),
      i > 0 ? el('details', { class: 'sec', open: '' }, el('summary', {}, 'Actions'), el('div', { class: 'sec-body' },
        this.floorAsk === i
          ? el('div', { class: 'stack', role: 'alert',
            // Escape here cancels the warning, before the dock takes it to close itself.
            onkeydown: (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancelFloor(); } } },
            el('p', { class: 'error' }, n
              ? `Delete Floor ${i + 1}? ${n === 1 ? 'Its room goes' : `Its ${n} rooms go`} to the Archive, and the floors below move up one.`
              : `Delete Floor ${i + 1}? The floors below move up one.`),
            el('div', { class: 'box-btns' },
              el('button', { type: 'button', class: 'box-btn danger pop-delete floor-yes', onclick: () => this.deleteFloor(i) }, 'Delete floor', key('Enter')),
              el('button', { type: 'button', class: 'box-btn', onclick: () => this.cancelFloor() }, 'Cancel', key('Esc'))))
          : el('div', { class: 'box-btns' },
            el('button', { type: 'button', class: 'box-btn danger pop-delete', onclick: () => this.askFloor(i) }, 'Delete floor', key('Delete'))))) : null,
    ].filter(Boolean);
  }

  // The chosen floor's properties in the right dock (the same place, and the same dock entry, as
  // a room's), switched in place when they show already.
  dockFloor(i) {
    const rows = this.floorRows(i);
    const open = this.propsDock;
    if (open && this.panel.isOpen('room')) {
      open.id = 'floor';
      open.body.replaceChildren(...rows);
      open.handle?.setKind('Floor');
      return;
    }
    const body = el('div', { class: 'rooms-props' }, ...rows);
    const now = (this.propsDock = { id: 'floor', body, handle: null });
    this.panel.open({ key: 'room', kind: 'Floor', title: '', body,
      onClose: () => {
        if (this.propsDock !== now) return;
        this.propsDock = null;
        if (this.floorSel == null) return;
        this.floorSel = this.floorAsk = null;
        if (!this.inRoom && !this.root.hidden) this.drawRooms();
      } })
      .then((h) => { if (this.propsDock === now) { if (h) now.handle = h; else this.propsDock = null; } });
  }

  // Deletes floor `i`: its rooms to the Archive, the floors below up one. One undo step.
  deleteFloor(i) {
    const out = this.floors.removeFloor(i);
    if (out.error) {
      if (out.error === 'first') this.toast('Floor 1 stays: Messy thoughts lives there.');
      if (out.error === 'locked') this.toast(`Floor ${i + 1} has a locked room. Unlock it or move it first.`);
      return false;
    }
    this.floorSel = this.floorAsk = null;
    this.roomSel = this.roomPick = this.making = null;
    this.picks = [];
    this.save();
    const n = out.archived.length;
    this.page = Math.max(0, i - 1);
    this.drawRooms();
    this.toast(`Deleted Floor ${i + 1}${n ? `; ${n === 1 ? 'its room is' : `its ${n} rooms are`} in the Archive` : ''}. Ctrl+Z brings it back.`);
    return true;
  }
}
