// Part of the room feature. Writing in a room: drawing thoughts and the draft, the caret and selection in a thought, typing,
// Enter / Ctrl+Enter, editing a thought again, right-click and Add.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  DEFAULT_MODE, room, view, startTrain, create, update, remove, move, kindOf, isLeaf,
  groupOf, thoughtText, trainThoughts, ITEMS, maths,
} from './world.js';
import { clearSpot } from './clear.js';
import { el } from './shared.js';

export class Writing {
  // One thought, drawn by its kind.
  thoughtNode(th) {
    if (this.draft?.edit === th.id) return this.draftNode(); // a thought opened again to write in
    const kind = kindOf(th);
    if (kind === 'group') { // a folded group reads as one passage
      const body = thoughtText(this.world, th);
      return el('div', { class: 'room-passage folded', 'data-id': th.id },
        th.title ? el('div', { class: 'room-passage-title' }, maths(th.title)) : null,
        body ? el('div', { class: 'room-passage-body' }, maths(body)) : null);
    }
    return (ITEMS[kind] || ITEMS.line).node(th, el);
  }

  draftNode() {
    this.draftEl = el('span', { class: 'room-thought room-draft' });
    this.paintDraft();
    return this.draftEl;
  }

  // Draws the thought being written from the hidden box: its words, the selection, and the caret
  // where the selection's moving end is.
  paintDraft() {
    const d = this.draftEl;
    if (!d) return;
    const v = this.input.value;
    const a = this.input.selectionStart ?? v.length, b = this.input.selectionEnd ?? v.length;
    const back = this.input.selectionDirection === 'backward';
    const caret = document.activeElement === this.input || !d.isConnected ? el('span', { class: 'room-caret', 'aria-hidden': 'true' }) : null;
    const parts = a === b
      ? [v.slice(0, a), caret, v.slice(a)]
      : [v.slice(0, a), back ? caret : null, el('span', { class: 'room-chosen' }, v.slice(a, b)), back ? null : caret, v.slice(b)];
    // An empty thought, or one ending in a new line, still has a line for the caret to stand on.
    if (!v || v.endsWith('\n')) parts.push(el('span', { class: 'room-pad', 'aria-hidden': 'true' }, '\u200b'));
    d.replaceChildren(...parts.filter((p) => p != null && p !== '').map((p) => (p instanceof Node ? p : document.createTextNode(p))));
  }

  // Where each letter of the thought being written is on the screen (measured, not guessed).
  letterBoxes() {
    const out = [];
    let i = 0;
    const range = document.createRange();
    for (const n of this.draftEl?.childNodes || []) {
      if (n.classList?.contains('room-pad')) { out.push({ i, r: n.getBoundingClientRect(), end: true }); continue; }
      const t = n.nodeType === 3 ? n : n.classList?.contains('room-chosen') ? n.firstChild : null;
      if (!t) continue;
      for (let k = 0; k < t.length; k++) {
        range.setStart(t, k);
        range.setEnd(t, k + 1);
        const rs = range.getClientRects();
        const r = rs[rs.length - 1];
        if (r && (r.width || r.height)) out.push({ i: i + k, r, nl: t.data[k] === '\n' });
      }
      i += t.length;
    }
    return out;
  }

  // The place in the thought being written nearest a point on the screen.
  offsetAt(x, y) {
    const len = this.input.value.length;
    const boxes = this.letterBoxes();
    if (!boxes.length) return len;
    const gap = (r) => (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0);
    const near = boxes.reduce((m, b) => (gap(b.r) < gap(m.r) ? b : m));
    const mid = (near.r.top + near.r.bottom) / 2, half = (near.r.bottom - near.r.top) / 2 || 8;
    const line = boxes.filter((b) => Math.abs((b.r.top + b.r.bottom) / 2 - mid) < half);
    for (const b of line) if (b.end || b.nl || x < (b.r.left + b.r.right) / 2) return b.i;
    return line[line.length - 1].i + 1;
  }

  // Chooses letters in the thought being written: from `anchor` to `focus` (the caret's end).
  selectText(anchor, focus = anchor) {
    this.input.setSelectionRange(Math.min(anchor, focus), Math.max(anchor, focus), focus < anchor ? 'backward' : 'forward');
    this.input.focus({ preventScroll: true });
    this.paintDraft();
  }

  // The word (or run of spaces, or one sign) at a place in the text.
  wordAround(v, i) {
    const word = (c) => !!c && /[\p{L}\p{N}_'’]/u.test(c);
    const space = (c) => !!c && c !== '\n' && /\s/.test(c);
    let a = i, b = i;
    const kind = word(v[i]) || word(v[i - 1]) ? word : space(v[i]) || space(v[i - 1]) ? space : null;
    if (!kind) return [i, Math.min(v.length, i + 1)];
    while (kind(v[a - 1])) a--;
    while (kind(v[b])) b++;
    return [a, b];
  }

  // Puts letters in the hidden box as if typed, so Ctrl+Z inside the thought can take them back.
  typeIn(text) {
    const box = this.input;
    box.focus({ preventScroll: true });
    if (!document.execCommand?.('insertText', false, text)) {
      box.setRangeText(text, box.selectionStart, box.selectionEnd, 'end');
      this.onInput();
    }
  }

  // ---- Writing ----

  onKey(e) {
    if (e.defaultPrevented || this.root.hidden || document.querySelector('dialog[open]')) return; // (the rooms page took it)
    if (e.target === this.input || e.target.matches?.('input, textarea, select, [contenteditable]')) return;
    this.hintLine.classList.remove('on');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openSearch(); return; }
    if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !this.editing) {
      e.preventDefault();
      this.undo(e.key.toLowerCase() === 'z' && !e.shiftKey);
      return;
    }
    if (e.key === 'Escape') {
      if (this.editing?.close) this.editing.close(); // a chapter open as a document
      else if (this.panel?.isOpen()) this.panel.close(); // the side panel (the content editor, the source)
      else if (!this.addMenu.hidden) this.closeAdd();
      else if (this.roomId && this.sel && this.barFor) { this.barFor = null; this.drawBar(); }
      else if (this.sel) { this.sel = null; this.drawWorld(); }
      else this.back();
      return;
    }
    if (this.editing) return;
    if (this.shortcut(e, mod)) return;
    if (this.roomId && e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && this.roomId) { this.fresh = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.('button') && e.key === ' ') return; // Space on a word presses it
    if (e.key === ' ' && !this.draft) return; // a lone Space is held to move around (Space+drag)
    e.preventDefault();
    this.beginWriting(e.key);
  }

  // Starts a thought (if one isn't started), with `seed` as its first letters.
  beginWriting(seed = '') {
    if (!this.roomId) return;
    if (this.locked) { this.toast('This room is locked. Unlock it from its square to write here.'); return; }
    if (!this.draft) {
      this.draft = this.target();
      this.sel = null;
    }
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    if (seed) this.typeIn(seed);
    this.showDraft();
  }

  // Where a new train starts: a clear space on the screen, away from everything already drawn
  // (measured as drawn, so a long train counts all the way down).
  freeSpot() {
    const rects = [...this.drawnRects().values()];
    const NEW = { w: 340, h: 64 }; // room for a new thought's first line or two
    const p = clearSpot(this.visibleBox(), rects.map((r) => ({ ...r, x: r.x + 20 })), NEW);
    return { x: Math.round(p.x + 20), y: Math.round(p.y) }; // the thought's words start right of its knot
  }

  // Each drawn thought's box in world units (Map id → { x, y, w, h }): data-thought nodes, and a
  // group drawn as one (a folded train, or a thought being written in a train). A node marked
  // data-measure is keyed by that id, so an ontology hears its size (Russell: a chapter's name).
  drawnRects() {
    const out = new Map();
    const origin = this.world$.getBoundingClientRect(), zoom = view(this.world, this.roomId).zoom || 1;
    let k = 0;
    for (const n of this.world$.querySelectorAll('[data-thought], div[data-group]')) {
      const r = n.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      out.set(n.dataset.thought || n.dataset.measure || `g${k++}`, { x: (r.left - origin.left) / zoom, y: (r.top - origin.top) / zoom, w: r.width / zoom, h: r.height / zoom });
    }
    return out;
  }

  onInput() {
    if (!this.draft) { this.beginWriting(); return; }
    this.paintDraft();
    this.showDraft();
  }

  onInputKey(e) {
    if (e.altKey && (e.code === 'KeyP' || e.code === 'KeyI')) {
      e.preventDefault();
      if (e.code === 'KeyP') this.openSheet('passage'); else this.choosePicture();
      return;
    }
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    // Ctrl+Z undoes typing inside the thought; once it is empty, it undoes whole steps again.
    if (mod && !e.altKey && (k === 'z' || k === 'y') && !this.input.value) {
      e.preventDefault();
      if (this.draft?.edit) { this.draft = null; this.drawWorld(); return; } // let go of the thought opened again, unchanged
      this.stopWriting();
      this.undo(k === 'z' && !e.shiftKey);
      return;
    }
    // Backspace in an empty thought goes back into the end of the one before it, as a line joins.
    if (e.key === 'Backspace' && !e.altKey && !this.input.value) {
      const was = this.draft;
      if (!was && !this.fresh && !this.locked) this.draft = this.target(); // just after Enter: the next thought, not yet begun
      if (this.stepBack()) { e.preventDefault(); return; }
      this.draft = was;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commit();
      if (e.ctrlKey || e.metaKey) this.fresh = true;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.stopWriting();
    }
  }

  commit() {
    const text = this.input.value;
    this.input.value = '';
    const d = this.draft;
    this.draft = null;
    if (d?.edit) { // a thought opened again: kept as it is now, or gone if it was emptied
      const th = this.world.things[d.edit];
      if (th && !text.trim()) remove(this.world, d.edit);
      else if (th && text !== th.text) update(this.world, d.edit, { text });
      if (this.world.things[d.train]) this.current[this.roomId] = d.train;
      this.save();
      this.drawWorld();
      return;
    }
    if (!d || !text.trim()) { this.drawWorld(); return; }
    this.keepNew(d, { kind: 'line', text });
    this.save();
    this.drawWorld();
  }

  // The ontology new thoughts are written into: the room's, or Joyce's trains when it makes no
  // groups of its own (Pessoa).
  get writer() { return this.ont.groups ? this.ont : this.ontology(DEFAULT_MODE); }

  // Keeps a new thought (fields) from draft d: into the group it goes on with, or one the writing
  // ontology begins (ontologies/index.js: begin), or loose in the room when it begins none. Returns
  // the thought, or null.
  keepNew(d, fields, now = Date.now()) {
    const w = this.world, wr = this.writer;
    let g = d.train && w.things[d.train];
    const made = !g;
    if (!g) g = wr.begin ? wr.begin(w, this.roomId, { x: d.x ?? 0, y: d.y ?? 0, for: d.for ?? null }, now) : startTrain(w, this.roomId, d.x ?? 0, d.y ?? 0, now);
    const th = create(w, g ? g.id : this.roomId, fields, now);
    if (!th && made && g && w.things[g.id]) remove(w, g.id);
    if (th && g && w.things[g.id]) this.current[this.roomId] = g.id;
    else if (th) delete this.current[this.roomId];
    return th;
  }

  // Starts writing a new thought at x, y (world units), with no group to go on with; for is kept
  // with it and handed to the writing ontology's begin (a move's own note: say, the chapter it is
  // a child of).
  write({ x, y, for: note = null } = {}) {
    if (!this.roomId || this.locked) return;
    if (this.draft) this.commit();
    this.sel = null;
    this.draft = { train: null, x: Math.round(x ?? 0), y: Math.round(y ?? 0), ...(note != null ? { for: note } : {}) };
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    this.showDraft();
  }

  // Backspace in an empty thought: opens the thought before it in its train, the caret at its end.
  // An emptied thought that was opened again goes first. Returns false when there is nothing before.
  stepBack() {
    const d = this.draft, w = this.world;
    if (!d?.train || !w.things[d.train]) return false;
    const list = trainThoughts(w, d.train);
    const at = d.edit ? list.findIndex((th) => th.id === d.edit) : list.length;
    const prev = list[at - 1];
    if (d.edit) {
      const t = w.things[d.train];
      const spot = { x: t.x ?? 0, y: t.y ?? 0 };
      remove(w, d.edit);
      this.save();
      this.draft = w.things[d.train] ? { train: d.train } : { train: null, ...spot };
    }
    if (prev && kindOf(prev) === 'line') {
      this.draft = { train: d.train, edit: prev.id };
      this.input.value = prev.text || '';
      this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    } else if (!d.edit) return false;
    this.drawWorld();
    this.showDraft();
    return true;
  }

  // Opens a thought already written to write in, on the canvas where it is, the caret at its end.
  // Only a line (a passage or a picture has its own sheet); not in a locked room.
  editThought(id) {
    const th = this.world.things[id];
    if (!th || kindOf(th) !== 'line' || this.locked) return false;
    if (this.draft) this.commit();
    this.sel = null;
    this.lastTap = null;
    this.draft = { train: groupOf(this.world, id, this.writer.id)?.id || null, edit: id };
    this.input.value = th.text || '';
    this.input.focus({ preventScroll: true });
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.drawWorld();
    this.showDraft();
    return true;
  }

  stopWriting() {
    if (this.draft) this.commit();
    this.input.blur();
  }

  // Keeps the thought being written on the screen, moving the view if it has gone off it.
  showDraft() {
    if (!this.draftEl?.isConnected) return;
    const r = this.draftEl.getBoundingClientRect();
    const b = this.stage.getBoundingClientRect();
    const pad = 60;
    let dx = 0, dy = 0;
    if (r.right > b.right - pad) dx = r.right - (b.right - pad);
    if (r.left < b.left + pad) dx = r.left - (b.left + pad);
    if (r.bottom > b.bottom - pad * 2) dy = r.bottom - (b.bottom - pad * 2);
    if (r.top < b.top + pad * 1.5) dy = r.top - (b.top + pad * 1.5);
    if (!dx && !dy) return;
    const v = view(this.world, this.roomId);
    v.x += dx / v.zoom;
    v.y += dy / v.zoom;
    this.place();
  }

  // ---- Moving around, and moving things ----

  // A right-click in a room: on a thought (or a train), its properties; on the empty canvas, Add
  // just there. A Mac's Ctrl+click is a right-click too, but Ctrl+drag moves around, so it waits
  // to see whether the pointer moves (onUp, or a moment later).
  onContext(e) {
    e.preventDefault();
    if (Date.now() - (this.heldAt || 0) < 900) return; // a long press opened it already; this is the browser's own
    if (e.ctrlKey && e.button === 0 && this.gesture?.kind === 'pan') {
      const g = this.gesture;
      g.ctx = { x: e.clientX, y: e.clientY, target: e.target };
      clearTimeout(this.ctxTimer);
      this.ctxTimer = setTimeout(() => { if (this.gesture === g && !g.moved) { this.gesture = null; this.contextAt(g.ctx); } }, 450);
      return;
    }
    this.contextAt({ x: e.clientX, y: e.clientY, target: e.target });
  }

  contextAt({ x, y, target }) {
    this.gesture = null;
    clearTimeout(this.ctxTimer);
    if (!this.roomId) return;
    const { groupEl, thoughtEl, hit } = this.hitAt(target);
    if (!hit) { this.openAddAt(x, y); return; }
    if (this.sel?.kind === 'many' && this.isSel(hit)) { this.openProps(this.sel); return; }
    this.openProps(this.picked(groupEl, thoughtEl));
  }

  // What is under the pointer on the canvas: a thought (data-thought) and the group it is drawn in
  // (data-group, when the ontology draws its groups, as Joyce does its trains).
  hitAt(target) {
    const groupEl = target.closest?.('[data-group]') || null;
    const thoughtEl = target.closest?.('[data-thought]') || null;
    return { groupEl, thoughtEl, hit: thoughtEl?.dataset.thought || groupEl?.dataset.group };
  }

  // What a tap there chooses: the whole group (from its line, a folded group, or a group already
  // chosen), or the one thought.
  picked(groupEl, thoughtEl) {
    const g = groupEl && this.world.things[groupEl.dataset.group];
    if (g && (!thoughtEl || g.folded || (this.sel?.kind === 'train' && this.sel.id === g.id))) return { kind: 'train', id: g.id };
    const id = thoughtEl?.dataset.thought;
    return id ? { kind: isLeaf(this.world.things[id]) ? 'thought' : 'train', id } : null;
  }

  // Add, unfolded at a point on the canvas: what is made goes there.
  openAddAt(x, y) {
    if (this.locked) return;
    if (this.draft) this.stopWriting();
    this.sel = null;
    this.drawWorld();
    this.addAt = this.toWorld(x, y);
    this.addMenu.hidden = false;
    this.addMenu.classList.add('at');
    this.addBtn.setAttribute('aria-expanded', 'true');
    const w = this.addMenu.offsetWidth || 300, h = this.addMenu.offsetHeight || 220;
    this.addMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`;
    this.addMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - h - 8))}px`;
    this.addMenu.querySelector('button')?.focus();
  }
}
