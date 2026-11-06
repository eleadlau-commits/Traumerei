// Part of the room feature. Pointer and keys in a room: dragging, pinching, keyboard shortcuts, choosing several things,
// copy and paste of thoughts, double-click, the Add menu, Search (Ctrl+K) and the wheel.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  room, view, startTrain, create, remove, move, kindOf, isLeaf, isGroup, thoughtText,
  trainThoughts, rooms,
} from './world.js';
import { el, ZOOM, MAC, KEY, HOLD } from './shared.js';
import * as verbs from './verbs.js';
import { fitAll, centreChosen } from './centre.js';

export class Gestures {
  onDown(e) {
    const middle = e.button === 1;
    if (e.button !== 0 && !middle && e.pointerType === 'mouse') return;
    const pointers = (this.pointers ||= new Map());
    if (e.pointerType === 'mouse') pointers.clear(); // a mouse is one pointer: forget one whose release was lost (a Mac's Ctrl+click menu)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelAnimationFrame(this.glideFrame); // a glide (centre.js) gives way
    this.stage.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { this.gesture = { kind: 'pinch', ...this.pinchState() }; return; }
    // In the thought being written: a click places the caret, a drag chooses letters, Shift extends.
    if (this.draftEl?.isConnected && e.target.closest?.('.room-draft') && !(e.ctrlKey || e.metaKey) && !middle && !this.spaceDown) {
      e.preventDefault();
      const at = this.offsetAt(e.clientX, e.clientY);
      const box = this.input;
      // Presses close together count up, as a word processor's do: two choose the word, three the thought.
      const now = Date.now(), last = this.lastPress;
      const count = last && now - last.at < 500 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 6 ? (last.count % 3) + 1 : 1;
      this.lastPress = { at: now, x: e.clientX, y: e.clientY, count };
      this.gesture = { kind: 'text', x0: e.clientX, y0: e.clientY, moved: false };
      this.listen(e);
      if (count === 2) { const [a, b] = this.wordAround(box.value, at); this.gesture.anchor = a; this.selectText(a, b); return; }
      if (count === 3) { this.gesture.anchor = 0; this.selectText(0, box.value.length); return; }
      const anchor = e.shiftKey ? (box.selectionDirection === 'backward' ? box.selectionEnd : box.selectionStart) : at;
      this.gesture.anchor = anchor;
      this.selectText(anchor, at);
      return;
    }

    // The ontology's own presses (ontologies/index.js: press), such as Russell's arrows.
    if (!middle && !this.spaceDown && !(e.ctrlKey || e.metaKey) && this.ont.press?.(this, e)) {
      pointers.delete(e.pointerId);
      if (this.stage.hasPointerCapture?.(e.pointerId)) this.stage.releasePointerCapture(e.pointerId);
      return;
    }

    const v = view(this.world, this.roomId);
    const { groupEl, thoughtEl, hit: hitId } = this.hitAt(e.target);
    let thing = null;
    const pan = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
    if (e.ctrlKey || e.metaKey || middle || this.spaceDown) { // Ctrl+drag (or Space+drag, or the middle button) moves the canvas; a Ctrl+click toggles one
      e.preventDefault();
      this.gesture = { kind: 'pan', ...pan, ...((e.ctrlKey || e.metaKey) && !middle ? { toggle: true, pick: this.picked(groupEl, thoughtEl) } : {}) };
    }
    // Shift+drag, from anywhere, draws a selection box that adds to the choice (a Shift+click,
    // without moving, still adds the one clicked).
    else if (e.shiftKey && e.pointerType === 'mouse') this.gesture = { kind: 'box', ...pan, add: true, pick: this.picked(groupEl, thoughtEl) };
    else if (this.sel?.kind === 'many' && hitId && this.isSel(hitId)) this.gesture = { kind: 'group', ...pan, from: this.groupSpots() };
    // Otherwise a drag on a thing moves it, and a drag on the empty canvas moves the canvas (below).
    if (this.gesture) { this.listen(e); return; }
    const pick = this.picked(groupEl, thoughtEl);
    if (pick) {
      const p = this.ont.point(this.world, this.roomId, pick.id) || { x: 0, y: 0 };
      thing = { ...pick, x: p.x, y: p.y, ...(this.ont.live ? { live: true } : { placed: true }) };
    }
    if (this.locked && thing) thing.still = true; // a locked room: a tap still chooses it, a drag moves the view
    this.gesture = { kind: thing ? 'drag' : 'pan', thing, el: groupEl || thoughtEl, at: thoughtEl?.dataset.thought, add: e.shiftKey, x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, moved: false };
    // A long press (touch, or a pen) opens the properties, or Add on the empty canvas.
    if (e.pointerType !== 'mouse') {
      const g = this.gesture, at = { x: e.clientX, y: e.clientY, target: e.target };
      clearTimeout(this.ctxTimer);
      this.ctxTimer = setTimeout(() => { if (this.gesture === g && !g.moved && this.pointers.size === 1) { this.heldAt = Date.now(); this.contextAt(at); } }, HOLD);
    }
    this.listen(e);
  }

  listen() {
    const pointers = this.pointers;
    const move = (ev) => this.onMove(ev);
    const up = (ev) => {
      pointers.delete(ev.pointerId);
      if (pointers.size) { if (pointers.size === 1) this.gesture = null; return; }
      this.stage.removeEventListener('pointermove', move);
      this.stage.removeEventListener('pointerup', up);
      this.stage.removeEventListener('pointercancel', up);
      this.onUp();
    };
    if (pointers.size === 1) {
      this.stage.addEventListener('pointermove', move);
      this.stage.addEventListener('pointerup', up);
      this.stage.addEventListener('pointercancel', up);
    }
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    const v = view(this.world, this.roomId);
    return { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: v.zoom, mid: this.toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
  }

  onMove(e) {
    if (!this.pointers?.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (!g) return;
    const v = view(this.world, this.roomId);
    if (g.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (g.z0 * d) / g.d0, g.mid);
      return;
    }
    if (g.kind === 'text') { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) >= 3) this.selectText(g.anchor, this.offsetAt(e.clientX, e.clientY)); return; }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    g.last = { x: e.clientX, y: e.clientY }; // where it is let go (a Twin: over the other side?)
    if (!g.moved && Math.hypot(dx, dy) < 4) return;
    g.moved = true;
    if (g.kind === 'box') { this.drawBox(g, e); return; }
    if (g.kind === 'drag' && g.thing?.still) { g.kind = 'pan'; }
    if (g.kind === 'group') {
      if (this.locked) return;
      for (const [id, p] of Object.entries(g.from)) this.putAt(id, Math.round(p.x + dx / v.zoom), Math.round(p.y + dy / v.zoom));
      if (!this.liveFrame) this.liveFrame = requestAnimationFrame(() => { this.liveFrame = 0; this.drawWorld(); });
      return;
    }
    if (g.kind === 'pan') {
      v.x = g.vx - dx / v.zoom;
      v.y = g.vy - dy / v.zoom;
      this.place();
    } else if (g.thing.live) {
      // A live ontology (Joyce): the thought (or its whole group) moves, and its line follows it.
      const x = Math.round(g.thing.x + dx / v.zoom), y = Math.round(g.thing.y + dy / v.zoom);
      this.ont.drop(this.world, this.roomId, g.thing.id, x, y);
      if (!this.liveFrame) this.liveFrame = requestAnimationFrame(() => { this.liveFrame = 0; this.drawWorld(); });
    } else {
      const x = g.thing.x + dx / v.zoom, y = g.thing.y + dy / v.zoom;
      // A whole group (a Russell chapter) moves as one: each of its pieces follows the pointer.
      g.els ??= this.dragEls(g);
      for (const { el, left, top } of g.els) { el.style.left = `${left + dx / v.zoom}px`; el.style.top = `${top + dy / v.zoom}px`; }
      g.to = { x: Math.round(x), y: Math.round(y) };
    }
  }

  onUp() {
    const g = this.gesture;
    this.gesture = null;
    clearTimeout(this.ctxTimer);
    if (!g || g.kind === 'pinch') { this.save(); return; }
    if (g.ctx && !g.moved) { this.contextAt(g.ctx); return; } // a Mac's Ctrl+click
    if (g.toggle && !g.moved) { if (g.pick) this.chooseMore(g.pick, true); return; } // Ctrl+click (Cmd+click on a Mac): in or out of the choice
    if (g.add && g.thing && !g.moved) { this.chooseMore(g.thing); return; } // Shift+click: added to the choice
    if (g.kind === 'text') { this.input.focus({ preventScroll: true }); return; }
    if (g.kind === 'box') { this.endBox(g); return; }
    if (g.kind === 'group') {
      if (!g.moved) { this.sel = null; this.drawWorld(); return; }
      if (g.last && this.overTray(g.last.x, g.last.y) && verbs.throwBack(this, null, Object.keys(g.from))) return;
      this.drawWorld();
      this.save();
      return;
    }
    if (!g.moved) {
      // A tap: on a thought (or a closed train, or a line) selects it; on empty space clears the
      // selection. Double-click selects a whole train (onDouble).
      // With the right dock, a tap only chooses: a closed chapter or another mode's group is chosen
      // like anything else, and opens in the editor only on a right-click (or when the editor is
      // already open, which follows what is chosen). Without the dock, they open as a document.
      const tapped = g.thing && this.world.things[g.thing.id];
      if (!this.panel) {
        // The ontology's own tap (Russell: a closed chapter opens as a document).
        if (g.thing && this.ont.open?.(this, g.thing.id)) return;
        // Another mode's group (a chapter seen in Joyce, say) opens, as a closed chapter does.
        if (isGroup(tapped) && tapped.of !== this.mode && !g.toggle && !g.add) { this.openDocument(tapped.id); return; }
      }
      const keep = this.sel?.kind === 'train' && g.thing?.kind === 'train' && this.sel.id === g.thing.id;
      this.sel = keep ? this.sel : isGroup(tapped) ? { kind: 'train', id: tapped.id } : g.thing ? { kind: g.thing.kind, id: g.thing.id } : null;
      // Two taps on the same group (the page is redrawn between them, so no dblclick comes).
      const train = g.el?.dataset.group;
      const now = Date.now();
      if (train && this.lastTap?.train === train && now - this.lastTap.at < 400) this.sel = { kind: 'train', id: train };
      // Three taps on the same thought open it to write in, just where it is.
      const n = g.at && this.lastTap?.thought === g.at && now - this.lastTap.at < 400 ? this.lastTap.n + 1 : 1;
      this.lastTap = train || g.at ? { train, thought: g.at, n, at: now } : null;
      if (n === 3 && this.editThought(g.at)) return;
      if (!g.thing && this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    // Let go over the loose tray: it is thrown back (verbs.js).
    if (g.thing && g.last && this.overTray(g.last.x, g.last.y) && verbs.throwBack(this, null, [g.thing.id])) return;
    // Let go over a Twin's other side: it goes across (twin.js).
    if (g.thing && g.last && this.dropAcross(g.thing.id, g.last.x, g.last.y)) return;
    if (g.thing?.live) { this.drawWorld(); this.save(); return; }
    if (g.thing && g.to) {
      if (g.thing.placed) this.ont.drop(this.world, this.roomId, g.thing.id, g.to.x, g.to.y);
      else Object.assign(this.world.things[g.thing.id], g.to);
    }
    this.drawWorld(); // where the ontology put it (or back where it was, when it took nothing)
    this.save();
  }

  // Whether a point on the screen is over the loose tray (the left dock's list, or the row at the
  // foot of the room).
  overTray(x, y) {
    const at = document.elementFromPoint(x, y);
    return !!at?.closest?.('.room-loose, .room-tray-row, .room-tray-btn');
  }

  // What a drag moves on the screen, with where each piece started: the one thought, or every piece
  // drawn for a group (its thoughts, its name, its foot) when the group is dragged.
  dragEls(g) {
    const id = g.thing.kind === 'train' && g.el?.dataset.group;
    const els = id ? [...this.stage.querySelectorAll(`[data-group="${CSS.escape(id)}"], [data-foot="${CSS.escape(id)}"]`)].filter((n) => !n.dataset.arrow) : [g.el];
    return els.filter(Boolean).map((el) => ({ el, left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0 }));
  }

  // ---- Keys: delete, choose all, nudge (the key map lists them: keys.js) ----

  // The key that deletes what is chosen: Delete (on a Mac, which has none, Cmd+Backspace too).
  // A plain Backspace never does: it is for letters.
  deletes(e) { return e.key === 'Delete' || (MAC && e.metaKey && !e.shiftKey && e.key === 'Backspace'); }

  // Returns true when the key was one of these, and was used.
  shortcut(e, mod) {
    const k = e.key;
    if ((k === 'Enter' && !mod && !e.shiftKey) || k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
      // In a room: Enter (or the ContextMenu key) opens the properties of what is chosen.
      if (!this.sel) return false;
      e.preventDefault();
      this.openProps(this.sel);
      return true;
    }
    if (k === 'Home' && !mod && !e.altKey && !e.shiftKey) { e.preventDefault(); fitAll(this); return true; } // the view fits everything
    if (mod && e.shiftKey && !e.altKey && e.code === 'KeyC') { e.preventDefault(); centreChosen(this); return true; } // the view glides to what is chosen
    if (mod && !e.altKey && k.toLowerCase() === 'a') { // choose everything in the room
      e.preventDefault();
      const ids = this.ont.units(this.world, this.roomId).map((th) => th.id);
      this.sel = ids.length > 1 ? { kind: 'many', ids } : ids.length ? { kind: 'thought', id: ids[0] } : null;
      this.drawWorld();
      return true;
    }
    if (!this.sel) return false;
    if (this.locked && (this.deletes(e) || k.startsWith('Arrow'))) { e.preventDefault(); this.toast('This room is locked.'); return true; }
    if (this.deletes(e)) {
      e.preventDefault();
      const ids = this.sel.ids || [this.sel.id];
      ids.forEach((id) => remove(this.world, id));
      this.sel = null;
      this.save();
      this.drawWorld();
      this.toast(`Deleted${ids.length > 1 ? ` ${ids.length}` : ''}. Ctrl+Z brings it back.`);
      return true;
    }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[k] && !mod) { // nudge what is chosen; Shift for bigger steps
      e.preventDefault();
      const step = e.shiftKey ? 60 : 10;
      const ids = this.sel.ids || [this.sel.id];
      const from = this.groupSpots(ids);
      for (const [id, p] of Object.entries(from)) this.putAt(id, p.x + arrows[k][0] * step, p.y + arrows[k][1] * step);
      this.save();
      this.drawWorld();
      return true;
    }
    return false;
  }

  // The list of keys (the key map's ?), when the keys feature is there.
  showKeys() { this.keyMap?.show(); }

  // ---- Choosing many: a box drawn with Shift+drag ----

  isSel(id) { return this.sel?.id === id || !!this.sel?.ids?.includes(id); }

  drawBox(g, e) {
    const b = this.stage.getBoundingClientRect();
    if (!this.box) { this.box = el('div', { class: 'room-box' }); this.stage.append(this.box); }
    const x = Math.min(g.x0, e.clientX) - b.left, y = Math.min(g.y0, e.clientY) - b.top;
    Object.assign(this.box.style, { left: `${x}px`, top: `${y}px`, width: `${Math.abs(e.clientX - g.x0)}px`, height: `${Math.abs(e.clientY - g.y0)}px` });
    g.rect = { left: Math.min(g.x0, e.clientX), top: Math.min(g.y0, e.clientY), right: Math.max(g.x0, e.clientX), bottom: Math.max(g.y0, e.clientY) };
  }

  endBox(g) {
    this.box?.remove();
    this.box = null;
    if (g.add && (!g.moved || !g.rect)) { if (g.pick) this.chooseMore(g.pick); return; } // a Shift+click
    if (!g.moved || !g.rect) { // a plain click on the canvas: nothing chosen
      this.sel = null;
      if (this.draft) this.stopWriting();
      this.drawWorld();
      return;
    }
    const r = g.rect;
    const ids = new Set();
    for (const n of this.world$.querySelectorAll('[data-thought], .room-closed[data-group]')) {
      const q = n.getBoundingClientRect();
      if (q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom) continue;
      ids.add(n.dataset.thought || n.dataset.group);
    }
    if (g.add && this.sel) for (const id of this.sel.ids || [this.sel.id]) ids.add(id); // Shift: added to what was chosen
    this.sel = this.selOf([...ids]);
    this.drawWorld();
  }

  // The choice for a list of ids: nothing, one thought or train, or many.
  selOf(ids) {
    if (!ids.length) return null;
    if (ids.length > 1) return { kind: 'many', ids };
    return { kind: isGroup(this.world.things[ids[0]]) ? 'train' : 'thought', id: ids[0] };
  }

  // Adds a thought (or a train) to what is chosen; `toggle` takes it out again if it is in.
  chooseMore(pick, toggle = false) {
    const ids = this.sel ? [...(this.sel.ids || [this.sel.id])] : [];
    const i = ids.indexOf(pick.id);
    if (i < 0) ids.push(pick.id);
    else if (toggle) ids.splice(i, 1);
    this.sel = this.selOf(ids);
    this.barFor = null;
    this.drawWorld();
  }

  // ---- Copying thoughts: Ctrl+C keeps what is chosen, Ctrl+V puts copies in this room (or another) ----

  // The chosen thoughts and trains, as copies to make: their fields, and where each sat.
  copyOf(ids) {
    const w = this.world, out = [];
    const fields = (th) => { const { id, parent, at, edited, members, ...f } = th; return f; };
    for (const id of ids) {
      const th = w.things[id];
      if (!th) continue;
      const train = isGroup(th) ? th : null;
      if (!train && ids.some((o) => o !== id && isGroup(w.things[o]) && w.things[o].members?.includes(id))) continue; // its train is copied whole
      if (train && train.of !== 'joyce') continue;
      if (!train && !isLeaf(th)) continue;
      const p = this.ont.point(w, this.roomId, id) || { x: train?.x ?? 0, y: train?.y ?? 0 };
      out.push(train
        ? { x: p.x, y: p.y, title: train.title || '', closed: !!train.closed, items: trainThoughts(w, id).filter(isLeaf).map(fields) }
        : { x: p.x, y: p.y, items: [fields(th)] });
    }
    return out;
  }

  onCopy(e) {
    if (this.root.hidden || !this.roomId || !this.sel || this.editing) return;
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    const units = this.copyOf(this.sel.ids || [this.sel.id]);
    if (!units.length) return;
    const text = units.map((u) => u.items.map((f) => thoughtText(this.world, f)).join('\n')).join('\n\n');
    this.clip = { units, text };
    e.clipboardData?.setData('text/plain', text);
    e.preventDefault();
    this.toast(`Copied${units.length > 1 ? ` ${units.length}` : ''}. Ctrl+V puts a copy in any room.`);
  }

  // Puts copies of the copied thoughts in the open room, around a free spot, as they sat, and chooses them.
  pasteThoughts() { this.pasteUnits(this.clip.units); }

  // Puts copies of `units` (copyOf) in the open room, around a free spot, and chooses them.
  pasteUnits(units) {
    if (this.locked) { this.toast('This room is locked.'); return; }
    if (this.draft) this.stopWriting();
    const w = this.world;
    const cx = units.reduce((a, u) => a + u.x, 0) / units.length, cy = units.reduce((a, u) => a + u.y, 0) / units.length;
    const spot = this.freeSpot();
    let now = Date.now();
    const made = [];
    for (const u of units) {
      const train = startTrain(w, this.roomId, Math.round(spot.x + u.x - cx), Math.round(spot.y + u.y - cy), now);
      if (!train) continue;
      const items = u.items.map((f) => create(w, train.id, f, now++)).filter(Boolean);
      if (!items.length) { remove(w, train.id); continue; }
      if (u.title) train.title = u.title;
      if (u.closed) train.closed = true;
      made.push(u.items.length === 1 && !u.title ? items[0].id : train.id);
    }
    if (!made.length) return;
    this.sel = this.selOf(made);
    this.save();
    this.drawWorld();
  }

  // Where each chosen thing is now (world units), to move them together.
  groupSpots(ids = this.sel.ids) {
    const out = {};
    for (const id of ids) {
      if (!this.world.things[id]) continue;
      const p = this.ont.point(this.world, this.roomId, id);
      if (p) out[id] = p;
    }
    return out;
  }

  putAt(id, x, y) {
    if (this.world.things[id]) this.ont.drop(this.world, this.roomId, id, x, y);
  }

  // Double-click: where an ontology draws its groups (Joyce's trains), chooses the whole group
  // (then drag it from any of its thoughts or its line); on a passage, picture or closed group
  // floating on its own, opens it to edit.
  onDouble(e) {
    if (this.lastPress && Date.now() - this.lastPress.at < 600) return; // a double-click in the thought being written (onDown)
    window.getSelection?.()?.removeAllRanges();
    const groupEl = e.target.closest('[data-group]');
    if (groupEl) {
      this.sel = { kind: 'train', id: groupEl.dataset.group };
      this.drawWorld();
      return;
    }
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id && kindOf(this.world.things[id]) !== 'line') this.openSheet(null, id);
  }

  // ---- Add: the menu a right-click on the empty canvas opens there, with the templates ----

  addItem(label, note, fn, keep = true) {
    return el('button', { type: 'button', class: 'pick room-add-item', role: 'menuitem', onclick: () => { this.closeAdd(keep); fn(); } },
      el('span', {}, label), el('span', { class: 'pick-note' }, note));
  }

  // Closes Add; what was asked for at a point (keep) still goes there.
  closeAdd(keep = false) {
    if (!keep) this.addAt = null;
    if (!this.addMenu || this.addMenu.hidden) return;
    this.addMenu.hidden = true;
    this.addMenu.classList.remove('at');
    this.addMenu.style.left = this.addMenu.style.top = '';
  }

  // ---- Search (Ctrl+K): the search feature's panel; a find it opens comes back as 'search:found' ----

  openSearch() {
    if (!this.finder) return;
    if (this.draft) this.commit();
    this.finder.open();
  }

  // Closes the list of keys, and the search panel if it shows.
  closeSearch() {
    this.finder?.close();
    this.keyMap?.hide();
  }

  // Opens what was found: a room, or the room a thought is in, with the view on the thought.
  goTo(f) {
    if (f.kind === 'room') { this.openRoom(f.id); return; }
    if (!f.room) return;
    if (this.roomId !== f.room) this.openRoom(f.room);
    const th = this.world.things[f.id];
    const v = view(this.world, f.room);
    const p = this.ont.point(this.world, f.room, f.id);
    if (p) { v.x = p.x + 120; v.y = p.y + 20; this.place(); }
    this.found = isGroup(th) ? null : f.id;
    this.sel = { kind: isGroup(th) ? 'train' : 'thought', id: th.id }; // and its edit pop-up opens
    this.drawWorld();
    clearTimeout(this.foundTimer);
    this.foundTimer = setTimeout(() => { this.found = null; this.drawWorld(); }, 2400);
  }

  onWheel(e) {
    e.preventDefault();
    cancelAnimationFrame(this.glideFrame); // a glide (centre.js) gives way
    const v = view(this.world, this.roomId);
    // A mouse wheel (big steps, or lines) and Ctrl+wheel / pinch on a trackpad zoom;
    // a trackpad's two-finger scroll moves around.
    const mouse = e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    if (e.ctrlKey || mouse) {
      const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015) * (e.deltaMode === 1 ? 30 : 1));
      this.zoomAt(e.clientX, e.clientY, v.zoom * k);
    } else {
      v.x += e.deltaX / v.zoom;
      v.y += e.deltaY / v.zoom;
      this.place();
    }
    clearTimeout(this.wheelSave);
    this.wheelSave = setTimeout(() => this.save(), 300);
  }

  // Zooms to `zoom`, keeping the world point `at` (default: the one under the screen point) still.
  zoomAt(clientX, clientY, zoom, at = this.toWorld(clientX, clientY)) {
    const v = view(this.world, this.roomId);
    v.zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
    const b = this.stage.getBoundingClientRect();
    v.x = at.x - (clientX - b.left - b.width / 2) / v.zoom;
    v.y = at.y - (clientY - b.top - b.height / 2) / v.zoom;
    this.place();
  }

  // ---- Editing what is chosen: a pop-up beside it, like a room's options on the rooms page ----

  // What is chosen, as a word: the properties pop-up shows only while it is open for this.
  selKey(sel = this.sel) { return sel ? `${sel.kind}:${sel.ids ? sel.ids.join(',') : sel.id}` : null; }
}
