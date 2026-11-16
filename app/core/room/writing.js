// Part of the room feature. Writing in a room: drawing thoughts and the draft, the caret and selection in a thought, typing,
// Enter / Ctrl+Enter, editing a thought again, right-click and Add.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import {
  room, view, create, update, remove, move, kindOf, isLeaf,
  groupOf, thoughtText, trainThoughts, kindFor, maths, resize, spotOf, members,
  gapState, gapOf, openGap, linksFrom, UP_LINKS, isCard, within, isGroup, familyOf, groupsFor, spans,
} from './world.js';
import { clearSpot, nearSpot } from './clear.js';
import { el } from './shared.js';
import { countsLine } from './cards.js';

export class Writing {
  // One thought, drawn by its kind.
  thoughtNode(th) {
    if (this.draft?.edit === th.id) return this.draftNode(); // a thought opened again to write in
    const kind = kindOf(th);
    let node;
    if (kind === 'group' && isCard(th)) { // a card (a plugin's book) shows its title and what it holds, not every thought's words
      node = el('div', { class: 'room-passage closed room-card', 'data-id': th.id },
        el('div', { class: 'label room-passage-kind' }, this.groupName(th)),
        el('div', { class: 'room-passage-title' }, th.title ? maths(th.title) : 'Untitled'),
        el('div', { class: 'label room-card-counts' }, this.cardCounts(th)));
    } else if (kind === 'group') { // a closed group reads as one passage; another mode's says what kind it is
      const body = thoughtText(this.world, th);
      node = el('div', { class: 'room-passage closed', 'data-id': th.id },
        th.of !== this.mode ? el('div', { class: 'label room-passage-kind' }, this.groupName(th)) : null,
        th.title ? el('div', { class: 'room-passage-title' }, maths(th.title)) : null,
        body ? el('div', { class: 'room-passage-body' }, maths(body)) : null);
    } else if (kind === 'line' && (th.spans || spans.decorating())) { // words with a look of their own (spans.js): kept spans, decorators
      node = el('span', { class: 'room-thought', 'data-id': th.id }, ...this.styledWords(th.text || '', spans.ranges(th)));
    } else node = kindFor(kind).node(th, el); // a kind whose plugin is off shows as a quiet stand-in
    // The gap's edge: a mark with an open gap (its own, or derived from its parts: the gaps
    // table, world/gaps.js) shows an open edge at its start, until it is resolved.
    if (gapState(this.world, th.id) === 'open') node.classList?.add('room-gap');
    return node;
  }

  // Words cut where their look changes, each piece in the room's span classes (span-bold, …).
  styledWords(text, list) {
    if (!list.length) return [maths(text)];
    return spans.segments(text.length, list).map((g) => {
      const words = text.slice(g.from, g.to);
      return g.classes.length ? el('span', { class: g.classes.map((c) => `span-${c}`).join(' ') }, maths(words)) : maths(words);
    });
  }

  // What a card holds, as a line: "2 chapters · 14 thoughts".
  cardCounts(th) {
    return countsLine(within(this.world, th.id), (x) => (isGroup(x) ? familyOf(x.of)?.name || this.groupName(x) : null));
  }

  draftNode() {
    this.draftEl = el('span', { class: 'room-thought room-draft' + (this.draft?.fresh ? ' fresh' : '') });
    this.paintDraft();
    this.watchDraft(this.draftEl);
    return this.draftEl;
  }

  // The thought being written as a rule's reads see it (reads.marks.draft, since 1.1.1): its words,
  // where Add was asked, the mark it is written after, and its box's height. A thought opened
  // again is a mark already: no draft.
  draftFor(context) {
    const d = this.draft;
    if (!d || d.edit || context !== this.roomId || this.root.hidden) return null;
    return { text: this.input.value, ...(d.at ? { at: { x: d.x, y: d.y } } : {}), ...(d.near ? { after: d.near } : {}), ...(this.draftHeight ? { height: this.draftHeight } : {}) };
  }

  // A click on words of a kept span whose kind hears clicks (slots.spans' click, since 1.1.1): a
  // footnote's mark, a comment on words. In the thought being written it takes Ctrl+click (a
  // plain click places the caret). A drag is not a click.
  onSpanClick(e) {
    const down = this.spanDown;
    if (!this.roomId || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    let th = null, list = null, at = null;
    const hit = document.elementFromPoint?.(e.clientX, e.clientY);
    if (this.draftEl?.isConnected && hit?.closest?.('.room-draft')) {
      if (!(e.ctrlKey || e.metaKey)) return;
      list = this.draftSpans;
      at = this.offsetAt(e.clientX, e.clientY);
      th = this.draft?.edit ? this.world.things[this.draft.edit] : null;
    } else {
      const node = hit?.closest?.('.room-thought[data-id]');
      th = node && this.world.things[node.dataset.id];
      if (!th?.spans) return;
      list = th.spans;
      at = textOffsetAt(node, e.clientX, e.clientY);
    }
    const got = spans.clickable(list, at)[0];
    if (!got) return;
    const mark = th ? Object.freeze({ ...th }) : Object.freeze({ id: null, kind: 'line', text: this.input.value });
    try { got.click(got.span, mark); } catch (err) { console.warn(`Room: the span kind ${got.span.kind}'s click failed`, err); }
  }

  // When the draft's box grows or shrinks (the words wrap onto another line), a rule that read the
  // draft lays the room out again, on the next frame.
  watchDraft(node) {
    if (typeof ResizeObserver !== 'function') return;
    this.draftWatch ||= new ResizeObserver((entries) => {
      const h = Math.round(entries[entries.length - 1]?.contentRect?.height || 0);
      if (!h || h === this.draftHeight) return;
      this.draftHeight = h;
      if (this.draftFrame || !this.ont?.readsDraft?.(this.world, this.roomId)) return;
      this.draftFrame = requestAnimationFrame(() => { this.draftFrame = 0; if (this.draft && !this.draft.edit) this.drawWorld(true); });
    });
    this.draftWatch.disconnect();
    this.draftWatch.observe(node);
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
    const look = this.draftSpans?.length || spans.decorating() ? spans.ranges({ id: this.draft?.edit ?? null, text: v, spans: this.draftSpans }, v) : [];
    // The words, cut where the selection, the caret or their look changes; the caret where the
    // selection's moving end is.
    const focus = back ? a : b;
    const parts = [];
    for (const g of spans.segments(v.length, look, [a, b])) {
      if (g.from === focus && caret && !parts.includes(caret)) parts.push(caret);
      const cls = [...(g.from >= a && g.to <= b && a !== b ? ['room-chosen'] : []), ...g.classes.map((c) => `span-${c}`)];
      parts.push(cls.length ? el('span', { class: cls.join(' ') }, v.slice(g.from, g.to)) : v.slice(g.from, g.to));
    }
    if (caret && !parts.includes(caret)) parts.push(caret);
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
      const t = n.nodeType === 3 ? n : n.classList?.contains('room-caret') ? null : n.firstChild?.nodeType === 3 ? n.firstChild : null;
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
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); this.openSearch(); return; }
    if (mod && !e.altKey && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y') && !this.editing) {
      e.preventDefault();
      this.undo(e.key.toLowerCase() === 'z' && !e.shiftKey);
      return;
    }
    if (e.key === 'Escape') {
      if (this.editing?.close) this.editing.close(); // a chapter open as a document
      else if (this.panel?.shown) this.panel.close(); // the right dock (the content editor, the source), if not hidden
      else if (!this.addMenu.hidden) this.closeAdd();
      else if (this.roomId && this.ont.escape?.(this)) { /* the mode's own (Proust: back from Centre) */ }
      else if (this.roomId && this.sel && this.barFor) { this.barFor = null; this.drawBar(); }
      else if (this.sel) { this.sel = null; this.drawWorld(); }
      else this.back();
      return;
    }
    if (this.editing) return;
    if (e.altKey && !mod && !e.shiftKey && e.code === 'KeyL' && this.roomId && this.sel && this.sel.kind !== 'many') { e.preventDefault(); this.followLink(this.sel.id); return; }
    if (this.shortcut(e, mod)) return;
    const kind = this.roomId && this.kindForKey(e); // a kind's own key: a passage's Alt+P (kinds.js)
    if (kind) {
      e.preventDefault();
      this.addKind(kind);
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && this.roomId) { this.freshStart(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    if (e.target.closest?.('button') && e.key === ' ') return; // Space on a word presses it
    if (e.key === ' ' && !this.draft) return; // a lone Space is held to move around (Space+drag)
    e.preventDefault();
    this.beginWriting(e.key);
  }

  // Ctrl+Enter: the next thought starts afresh (Joyce: a new train). It shows at once: an empty
  // thought waits at its new place with the caret in it, marked for a moment, and a note says what
  // was made. Typing goes on there; Escape lets it go.
  freshStart() {
    if (!this.roomId || this.locked) return;
    this.fresh = true;
    this.draft = { ...this.target(), fresh: true };
    this.sel = null;
    this.input.focus({ preventScroll: true });
    this.drawWorld();
    this.showDraft();
    const wr = this.writer;
    this.toast(wr.fresh || (wr.begin ? `New ${(groupsFor(wr)?.name || 'group').toLowerCase()}: type to start it.` : 'New thought: type to start it (it waits in the tray).'));
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
    this.drawWorld(true); // only the new thought (and what it changes) is put in: the room is not laid out again
    if (seed) this.typeIn(seed);
    this.showDraft();
  }

  // Where a new train starts: at the mouse, while the pointer is on the canvas, or the nearest clear
  // spot around it when thoughts are already there; with the pointer off the canvas, a clear space
  // on the screen, away from everything already drawn (measured as drawn, so a long train counts
  // all the way down). size: the room it needs ({ w, h }), a new thought's first line or two.
  freeSpot(size = { w: 340, h: 64 }) {
    const rects = [...this.drawnRects().values()].map((r) => ({ ...r, x: r.x + 20 }));
    const at = this.mouseSpot();
    const p = at ? nearSpot(at, rects, size) : clearSpot(this.visibleBox(), rects, size);
    return { x: Math.round(p.x + 20), y: Math.round(p.y) }; // the thought's words start right of its knot
  }

  // The pointer's place on the canvas in world units (the words start just left of and a little
  // above it, so they sit under the pointer), or null when it is off the canvas.
  mouseSpot() {
    const m = this.mouse;
    if (!m || !this.stage) return null;
    const b = this.stage.getBoundingClientRect();
    if (m.x < b.left || m.x > b.right || m.y < b.top || m.y > b.bottom) return null;
    const p = this.toWorld(m.x, m.y);
    return { x: p.x - 20, y: p.y - 16 };
  }

  // Each drawn thought's box in world units (Map id → { x, y, w, h }): data-thought nodes, and a
  // group drawn as one (a closed train, or a thought being written in a train). A node marked
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
    this.carrySpans();
    if (!this.draft) { this.beginWriting(); return; }
    this.paintDraft();
    this.showDraft();
  }

  // The thought being written keeps only its own keys (no app shortcut runs while typing; see
  // the keys feature): Enter, Ctrl+Enter, Escape, and Backspace / Ctrl+Z at its very start.
  onInputKey(e) {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    // Ctrl+Shift+. / Ctrl+Shift+, : the chosen words bigger or smaller (Varied sizes within a thought).
    if (mod && e.shiftKey && !e.altKey && (e.code === 'Period' || e.code === 'Comma')) {
      e.preventDefault();
      this.resizeWords(e.code === 'Period' ? 1 : -1);
      return;
    }
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
      if (e.ctrlKey || e.metaKey) this.freshStart();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.stopWriting();
    }
  }

  // The words chosen in the thought being written, a step bigger (dir 1) or smaller (-1): kept in
  // its words as [words]{size=big} (the world's maths.js resize), shown at their size once kept.
  resizeWords(dir) {
    if (!this.prefs.sizes) { this.toast('Turn on Varied sizes within a thought in Settings → Rooms.'); return; }
    const box = this.input;
    const r = resize(box.value, box.selectionStart ?? 0, box.selectionEnd ?? 0, dir);
    if (!r) { this.toast('Choose some words on one line first.'); return; }
    box.value = r.text;
    this.carrySpans();
    box.setSelectionRange(r.select[0], r.select[1]);
    this.paintDraft();
    this.showDraft();
  }

  // The look of the words being written follows the words (spans.js shift): typing inside a bold
  // word keeps it bold. this.draftSpans are the spans of the thought being written.
  carrySpans() {
    const v = this.input.value;
    if (this.draftSpans?.length && this.draftText !== v) this.draftSpans = spans.shift(this.draftSpans, this.draftText ?? '', v) || [];
    this.draftText = v;
    this.caretMoved();
  }
  caretMoved() { for (const fn of this.caretFns || []) { try { fn(this.caretNow()); } catch (err) { console.warn('Room: a caret listener failed', err); } } }

  // The words being written, for the plugin API's ui.text (api/v2.js): where the caret is, and
  // what may be done there. Nothing here keeps anything: Enter keeps the thought, as one step.
  caretNow() {
    if (!this.draft || this.root.hidden) return null;
    const v = this.input.value;
    return { mark: this.draft.edit ?? null, from: this.input.selectionStart ?? v.length, to: this.input.selectionEnd ?? v.length, text: v };
  }
  textService() {
    return {
      caret: () => this.caretNow(),
      edit: (id, at = null) => {
        if (!this.editThought(id)) return false;
        const n = this.input.value.length, i = at == null || !Number.isFinite(at) ? n : Math.max(0, Math.min(n, at));
        this.selectText(i);
        this.caretMoved();
        return true;
      },
      select: (from, to = from) => { if (!this.caretNow()) return false; const n = this.input.value.length; this.selectText(Math.max(0, Math.min(n, from)), Math.max(0, Math.min(n, to))); return true; },
      replace: (from, to, words) => {
        if (!this.caretNow()) return false;
        const n = this.input.value.length;
        this.input.setRangeText(String(words ?? ''), Math.max(0, Math.min(n, from)), Math.max(0, Math.min(n, to)), 'end');
        this.onInput();
        return true;
      },
      style: (kind, from = null, to = null) => {
        const c = this.caretNow();
        if (!c) return false;
        const a = from ?? c.from, b = to ?? c.to;
        this.draftSpans = spans.toggle(this.draftSpans, kind, Math.min(a, b), Math.max(a, b), c.text.length) || [];
        this.draftText = c.text;
        this.paintDraft();
        return true;
      },
      spans: () => (this.draftSpans || []).map((x) => ({ ...x })),
      on: (fn) => { (this.caretFns ||= new Set()).add(fn); return () => this.caretFns.delete(fn); },
    };
  }
  // The thought being written starts with these words and spans (none for a new one).
  startDraftWords(text = '', list = null) {
    this.input.value = text;
    this.draftText = text;
    this.draftSpans = list ? list.map((x) => ({ ...x })) : [];
  }

  commit() {
    const text = this.input.value;
    const look = this.draftSpans?.length ? spans.shift(this.draftSpans, this.draftText ?? text, text) : null;
    this.startDraftWords('');
    const d = this.draft;
    this.draft = null;
    if (d?.edit) { // a thought opened again: kept as it is now, or gone if it was emptied
      const th = this.world.things[d.edit];
      if (th && !text.trim()) remove(this.world, d.edit);
      else if (th && (text !== th.text || JSON.stringify(look || null) !== JSON.stringify(th.spans || null))) update(this.world, d.edit, { text, spans: look });
      if (this.writer.goOn && this.world.things[d.edit]) this.current[this.roomId] = d.edit;
      else if (this.world.things[d.train]) this.current[this.roomId] = d.train;
      this.save();
      this.drawWorld();
      return;
    }
    if (!d || !text.trim()) { this.drawWorld(); return; }
    this.keepNew(d, { kind: 'line', text, ...(look ? { spans: look } : {}) });
    this.save();
    this.drawWorld(true); // only what the kept thought changed is put in again (patch.js)
  }

  // The ontology new thoughts are written into: the room's, or the rule it names (writesInto:
  // Pessoa names Joyce's trains) when it makes no groups of its own and that rule is on.
  get writer() {
    const o = this.ont;
    if (groupsFor(o) || !o.writesInto) return o;
    return this.ontologies.find((x) => x.id === o.writesInto) || o;
  }

  // Keeps a new thought (fields) from draft d: into the group it goes on with, or one the writing
  // ontology begins (ontologies/index.js: begin), or loose in the room when it begins none. Returns
  // the thought, or null.
  keepNew(d, fields, now = Date.now()) {
    const w = this.world, wr = this.writer;
    let g = d.train && w.things[d.train];
    const made = !g;
    if (!g) g = wr.begin ? wr.begin(w, this.roomId, { x: d.x ?? 0, y: d.y ?? 0, for: d.for ?? null, fresh: !!d.fresh }, now) : null; // no begin: loose
    const th = create(w, g ? g.id : this.roomId, fields, now);
    if (!th && made && g && w.things[g.id]) remove(w, g.id);
    if (th && wr.kept) wr.kept(w, this.roomId, th, d);
    if (th) this.inheritGap(th, g, now);
    // A simple rule with land() (a calendar, a book) is told where the thought was written: the
    // box chosen, the point Add was asked at, or (since 1.1.1) the centre of the mark it was
    // written after (the one chosen, or the one kept just before); it may propose (a date, a
    // chapter to join) through the tables, in this one step.
    if (th && this.ont.land) {
      const b = this.boxAt?.room === this.roomId ? this.ont.boxes?.(w, this.roomId)?.[this.boxAt.i] : null;
      const near = d.near && w.things[d.near] ? this.ont.point?.(w, this.roomId, d.near) : null;
      const at = b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : d.at ? { x: d.x, y: d.y } : near ? { x: near.x, y: near.y } : null;
      if (at) this.ont.land(w, this.roomId, th.id, at.x, at.y);
    }
    // An ontology that goes on from a thought (goOn) remembers the thought; the others its group.
    if (th && (wr.goOn || this.ont.land)) this.current[this.roomId] = th.id; // a simple rule with land(): the next is written after it
    else if (th && g && w.things[g.id]) this.current[this.roomId] = g.id;
    else if (th) delete this.current[this.roomId];
    return th;
  }

  // Enter under a plan opens a gap: a thought written on from one with an open gap (the one before
  // it in its train, else the mark it is linked up to, else its group's own) opens a gap of the
  // same direction, so a list of things to do grows by writing (KERNEL.md, Law 5).
  inheritGap(th, g, now) {
    const w = this.world;
    const above = [];
    if (g && w.things[g.id]) { const ms = members(w, g.id), i = ms.findIndex((m) => m.id === th.id); if (i > 0) above.push(ms[i - 1].id); }
    for (const r of linksFrom(w, th.id)) if (UP_LINKS.includes(r.kind) && r.to !== g?.id) above.push(r.to);
    if (g && w.things[g.id]) above.push(g.id);
    for (const id of above) {
      const gap = gapOf(w, id);
      if (gap?.state === 'open') { openGap(w, th.id, gap.direction, now); return; }
    }
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
      const was = spotOf(w, t.id), spot = { x: was?.x ?? 0, y: was?.y ?? 0 };
      remove(w, d.edit);
      this.save();
      this.draft = w.things[d.train] ? { train: d.train } : { train: null, ...spot };
    }
    if (prev && kindOf(prev) === 'line') {
      this.draft = { train: d.train, edit: prev.id };
      this.startDraftWords(prev.text || '', prev.spans);
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
    this.startDraftWords(th.text || '', th.spans);
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

  // What a tap there chooses: the whole group (from its line, a closed group, or a group already
  // chosen), or the one thought.
  picked(groupEl, thoughtEl) {
    const g = groupEl && this.world.things[groupEl.dataset.group];
    if (g && (!thoughtEl || g.closed || (this.sel?.kind === 'train' && this.sel.id === g.id))) return { kind: 'train', id: g.id };
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
    this.fillAddMenu();
    this.addMenu.hidden = false;
    this.addMenu.classList.add('at');
    const w = this.addMenu.offsetWidth || 300, h = this.addMenu.offsetHeight || 220;
    this.addMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`;
    this.addMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - h - 8))}px`;
    this.addMenu.querySelector('button')?.focus();
  }
}

// The character of a drawn thought's words under a point on the screen, or null.
function textOffsetAt(node, x, y) {
  let container = null, offset = 0;
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); container = p?.offsetNode; offset = p?.offset ?? 0; }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); container = r?.startContainer; offset = r?.startOffset ?? 0; }
  if (!container || !node.contains(container)) return null;
  let at = 0;
  const walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (t === container) return at + offset;
    at += t.length;
  }
  return null;
}
