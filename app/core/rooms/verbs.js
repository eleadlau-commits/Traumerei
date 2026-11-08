// Part of the rooms feature. What is done to the chosen rooms (one, or many: many.js): duplicating
// them, moving them to another floor, and giving them a shared tag (Ctrl+G) or taking it off
// (Ctrl+Shift+G). The copy is the world's one rule (copyRoom: everything inside copied, nothing
// shared); where it goes is the floors feature's (beside the original, else a new floor). Each is
// one undo step. Its methods join the Rooms class (end of Rooms.js), so `this` is the feature.
//
// Duplicate: Ctrl+D, or Alt+drag a square (grid.js) to where the copy should go. Move: Ctrl+M
// (a short list of floors), or drag a square onto a floor in the rail (grid.js). Lock: Ctrl+L, or
// Lock in its properties (locks them all, or unlocks them all when every one is locked). Archive:
// Ctrl+Backspace, or Archive in its properties; in the Archive the same key restores.



import { MESSY, room, floorOf, isArchived, copyRoom, pageCount, addPage, roomTags, addTag, removeTag, allTags, tidyTag, lock, archive, restore } from './world.js';
import { el, MAC } from './shared.js';

export class RoomsVerbs {
  // A copy of room `id`, beside it (`cell`: where it was dropped, on floor `page`, or else its
  // original's cell), with no saving: the world changes only. Returns { copy, page } or null.
  copyBeside(id, { cell = null, page = null } = {}) {
    const r = room(this.world, id);
    if (!r || isArchived(this.world, r.id)) return null;
    const c = copyRoom(this.world, id);
    if (!c) return null;
    if (page != null && page !== floorOf(this.world, c.id) && this.floors.toFloor(c.id, page, cell) === true) return { copy: c, page };
    const out = this.floors.place(c.id, cell || (r.col != null ? { col: r.col, row: r.row } : null), { near: true });
    return { copy: c, page: out ? out.page : floorOf(this.world, c.id) };
  }

  // Duplicates rooms (one step for them all) and chooses the copies. `at`: where one was dropped.
  duplicateRooms(ids, at = {}) {
    const made = ids.map((id) => this.copyBeside(id, ids.length === 1 ? at : {})).filter(Boolean);
    if (!made.length) return [];
    this.save();
    const last = made[made.length - 1];
    this.page = last.page;
    this.shelf = false;
    this.making = null;
    this.picks = made.length > 1 ? made.map((m) => m.copy.id) : [];
    this.roomPick = last.copy.id;
    this.roomSel = made.length === 1 && this.panel && this.propsDock ? last.copy.id : null; // the dock follows the copy
    this.drawRooms();
    this.toast(made.length === 1 ? `${last.copy.name} is on Floor ${last.page + 1}. Ctrl+Z takes it back.` : `Duplicated ${made.length} rooms. Ctrl+Z takes them back.`);
    return made.map((m) => m.copy);
  }

  duplicateRoom(id, at = {}) { return this.duplicateRooms([id], at)[0] || null; }

  // Moves rooms to floor `page` ('new': a new floor at the end), each at its first free spot: one
  // step. Says which could not go (Messy thoughts, a locked room, a full floor).
  moveRoomsTo(ids, page) {
    if (page === 'new') page = addPage(this.world);
    let moved = 0, full = false, stuck = 0;
    for (const id of ids) {
      const out = this.floors.toFloor(id, page);
      if (out === true) moved++;
      else if (out === 'full') full = true;
      else stuck++;
    }
    if (moved) { this.save(); this.page = page; this.shelf = false; }
    this.drawRooms();
    const one = ids.length === 1 && room(this.world, ids[0]);
    if (moved) this.toast(one ? `${one.name} is on Floor ${page + 1}.` : `Moved ${moved} to Floor ${page + 1}${full || stuck ? `; ${ids.length - moved} stayed` : ''}.`);
    else if (full) this.toast(`Floor ${page + 1} is full.`);
    else this.toast(one?.locked ? `${one.name} is locked, so it keeps its place.` : 'Nothing could move there.');
    return moved > 0;
  }

  moveRoomTo(id, page) { return this.moveRoomsTo([id], page); }

  // The chosen rooms, for the keys (not while typing in a field): many, or the one.
  chosenFor(e) {
    if (e?.target?.matches?.('input, textarea, select, [contenteditable]')) return [];
    if (this.root.hidden || this.inRoom) return [];
    return this.chosenIds().map((id) => room(this.world, id)).filter(Boolean);
  }

  // Locks rooms, or unlocks them when every one is locked already: one step.
  lockRooms(ids) {
    const rs = ids.map((id) => room(this.world, id)).filter(Boolean);
    if (!rs.length) return;
    const on = rs.some((r) => !r.locked);
    for (const r of rs) lock(this.world, r.id, on);
    this.save();
    this.drawRooms();
    const key = this.keyMap?.label?.('rooms.lock');
    this.toast(rs.length === 1 ? `${rs[0].name} is ${on ? 'locked' : 'unlocked'}.${key ? ` ${key} ${on ? 'unlocks' : 'locks'} it.` : ''}`
      : `${on ? 'Locked' : 'Unlocked'} ${rs.length} rooms.`);
  }

  // Takes rooms to the Archive (not Messy thoughts, nor a locked room): one step.
  archiveRooms(ids) {
    const rs = ids.map((id) => room(this.world, id)).filter((r) => r && !isArchived(this.world, r.id));
    const ok = rs.filter((r) => r.id !== MESSY && !r.locked);
    if (!ok.length) { if (rs.length) this.toast('Messy thoughts and locked rooms stay.'); return; }
    for (const r of ok) archive(this.world, r.id);
    this.picks = [];
    this.roomSel = this.roomPick = null;
    this.save();
    this.drawRooms();
    const stayed = rs.length - ok.length;
    this.toast(ok.length === 1 && !stayed ? `${ok[0].name} is in the Archive.` : `Archived ${ok.length} room${ok.length === 1 ? '' : 's'}${stayed ? `; ${stayed} stayed` : ''}.`);
  }

  // Brings archived rooms back, each to its old floor (else a new one): one step.
  restoreRooms(ids) {
    const rs = ids.map((id) => room(this.world, id)).filter((r) => r && isArchived(this.world, r.id));
    if (!rs.length) return;
    let spilled = false;
    for (const r of rs) {
      restore(this.world, r.id);
      if (this.floors.place(r.id)?.spilled) spilled = true; // the floors feature says where it went
    }
    this.picks = [];
    this.roomSel = this.roomPick = null;
    this.save();
    this.drawRooms();
    if (!spilled) this.toast(rs.length === 1 ? `${rs[0].name} is back among the rooms.` : `${rs.length} rooms are back among the rooms.`);
  }

  // Ctrl+L: lock or unlock the chosen rooms.
  lockChosen(e) {
    const rs = this.chosenFor(e);
    if (rs.length) this.lockRooms(rs.map((r) => r.id));
  }

  // Ctrl+Backspace: archive the chosen rooms; in the Archive, restore them. (On a Mac, Cmd+Backspace
  // still deletes; the Control key archives.)
  archiveChosen(e) {
    if (MAC && e?.metaKey && !e.ctrlKey) { this.shortcut(e, true); return; }
    const rs = this.chosenFor(e);
    if (!rs.length) return;
    if (this.shelf) this.restoreRooms(rs.map((r) => r.id));
    else this.archiveRooms(rs.map((r) => r.id));
  }

  duplicateChosen(e) {
    const rs = this.chosenFor(e).filter((r) => !isArchived(this.world, r.id));
    if (rs.length) this.duplicateRooms(rs.map((r) => r.id));
  }

  // Ctrl+M: a short list of the floors to move the chosen rooms to, and a new floor.
  moveChosen(e) {
    const rs = this.chosenFor(e);
    if (!rs.length) return;
    const movable = rs.filter((r) => r.id !== MESSY && !r.locked && !isArchived(this.world, r.id));
    if (!movable.length) { this.toast(rs.length === 1 && rs[0].id === MESSY ? 'Messy thoughts stays on Floor 1.' : 'A locked room keeps its place.'); return; }
    this.floorPicker(movable);
  }

  // The floors to move rooms to (`rs`: one room or many). A number key or a click picks, N a new
  // floor; Escape or a click elsewhere lets go.
  floorPicker(rs) {
    rs = [].concat(rs);
    const here = rs.length === 1 ? floorOf(this.world, rs[0].id) : -1;
    const pick = (page) => { this.closeSheet(); this.moveRoomsTo(rs.map((r) => r.id), page); };
    const rows = Array.from({ length: pageCount(this.world) }, (_, i) => el('button', {
      type: 'button', class: 'pick', disabled: i === here, onclick: () => pick(i),
    }, `Floor ${i + 1}`, el('span', { class: 'pick-note' }, i === here ? 'here' : String(i + 1))));
    rows.push(el('button', { type: 'button', class: 'pick', onclick: () => pick('new') }, 'New floor', el('span', { class: 'pick-note' }, 'N')));
    const what = rs.length === 1 ? rs[0].name : `${rs.length} rooms`;
    this.openSheet(`Move ${what} to`, rows, (ev) => {
      const n = ev.key.toLowerCase() === 'n' ? 'new' : /^[1-9]$/.test(ev.key) ? +ev.key - 1 : null;
      if (n === 'new' || (n != null && n < pageCount(this.world) && n !== here)) { ev.preventDefault(); pick(n); }
    });
  }

  // Ctrl+G: a tag for every chosen room (one step), written in a small field (the tags there are
  // offered). It is how rooms are grouped on the rooms page: by a tag they share.
  tagChosen(e) {
    const rs = this.chosenFor(e).filter((r) => !r.locked);
    if (!rs.length) { this.toast(this.chosenFor(e).length ? 'A locked room keeps its tags.' : 'Choose rooms first (Shift+click, or Ctrl+A).'); return; }
    const list = el('datalist', { id: 'rooms-group-tags' }, ...allTags(this.world, this.ontologies).map((t) => el('option', { value: t.tag || t })));
    const field = el('input', { class: 'field rooms-group-tag', placeholder: 'A tag they share (or Group: tag)', 'aria-label': 'A tag for the chosen rooms', list: 'rooms-group-tags', maxlength: 61, autocomplete: 'off', spellcheck: 'false' });
    const keep = () => {
      const text = field.value.trim(), tag = tidyTag(text.split(':').pop()); // "Group: tag" puts it in a group too
      this.closeSheet();
      if (!tag) return;
      let n = 0;
      for (const r of rs) if (addTag(this.world, r.id, text, this.ontologies)) n++;
      if (n) this.save();
      this.drawRooms();
      this.toast(n ? `${n} room${n === 1 ? '' : 's'} tagged ${tag}. Arrange by → Tags shows them together.` : `They all have ${tag} already.`);
    };
    this.openSheet(`Tag ${rs.length === 1 ? rs[0].name : `${rs.length} rooms`}`, [field, list], (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); keep(); }
    });
    field.focus({ preventScroll: true });
  }

  // Ctrl+Shift+G: the tags every chosen room shares (their own, not their mode's) come off: one step.
  untagChosen(e) {
    const rs = this.chosenFor(e).filter((r) => !r.locked);
    if (!rs.length) return;
    const own = (r) => roomTags(this.world, r.id, this.ontologies).filter((t) => !t.auto).map((t) => t.tag.toLowerCase());
    const shared = rs.map(own).reduce((a, b) => a.filter((t) => b.includes(t)));
    if (!shared.length) { this.toast(rs.length === 1 ? 'It has no tags of its own.' : 'They share no tag of their own.'); return; }
    for (const r of rs) for (const t of shared) removeTag(this.world, r.id, t);
    this.save();
    this.drawRooms();
    this.toast(`Took ${shared.join(', ')} off ${rs.length === 1 ? rs[0].name : `${rs.length} rooms`}. Ctrl+Z puts it back.`);
  }

  // A small sheet near the top (Folio's top-sheet): a label, then `nodes`. `onKey(ev)` sees its keys
  // first; Escape or a click elsewhere closes it.
  openSheet(label, nodes, onKey = () => {}) {
    this.closeSheet();
    const box = el('div', { class: 'panel top-sheet rooms-sheet', role: 'dialog', 'aria-label': label,
      onpointerdown: (ev) => ev.stopPropagation(),
      onkeydown: (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); this.closeSheet(); return; }
        onKey(ev);
      } },
    el('p', { class: 'label' }, label), ...nodes);
    this.sheet = box;
    this.root.append(box);
    box.querySelector('button:not([disabled]), input')?.focus({ preventScroll: true });
    this.sheetAway = (ev) => { if (!box.contains(ev.target)) this.closeSheet(); };
    document.addEventListener('pointerdown', this.sheetAway, true);
  }

  closeSheet() {
    if (!this.sheet) return;
    this.sheet.remove();
    this.sheet = null;
    document.removeEventListener('pointerdown', this.sheetAway, true);
  }
}
