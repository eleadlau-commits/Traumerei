// Part of the room feature: a Twin, two rooms bundled in one, side by side (the world's twin.js).
// The side you work in is the room's live canvas; the other side shows beside it, drawn as it is
// (its own mode, its own thoughts, where its own view looks), quieter, and a click on it makes it
// the one you work in. A thought or a whole group dragged from the live side and let go over the
// other goes across (twin.js: across), to where it was let go, and belongs to that side alone.
// The two sides share one loose tray: the left dock lists both sides' loose thoughts, and one
// dragged onto either canvas goes to that side. Its methods join the Room class (mixIn in
// Room.js), so `this` is the feature; it keeps only `this.otherEl` (the other side's panel) and
// `this.otherWorld` (what is drawn there).

import { el } from './shared.js';
import { room, view, twinOf, otherSide, across } from './world.js';

export class Twin {
  // The other side of the Twin this room is a side of, or null.
  get otherSide() { return this.roomId ? otherSide(this.world, this.roomId) : null; }

  // The other side's panel, made once (build()); a click on it works there.
  twinPanel() {
    this.otherWorld = el('div', { class: 'room-world' });
    this.otherEl = el('div', { class: 'room-twin-other', hidden: true, role: 'button', tabindex: '-1',
      onclick: () => { const o = this.otherSide; if (o) this.switchSide(o.id); } },
    this.otherWorld,
    this.otherLabel = el('div', { class: 'label room-twin-label' }));
    return this.otherEl;
  }

  // Lays the room out as one side of a Twin (or as a room of its own), and draws the other side.
  drawTwin() {
    const other = this.otherSide;
    const me = this.roomId && room(this.world, this.roomId);
    this.roomPage.classList.toggle('twin', !!other);
    this.roomPage.classList.toggle('twin-right', !!other && me?.side === 1);
    this.otherEl.hidden = !other;
    if (!other) { this.otherWorld.replaceChildren(); return; }
    const o = this.ontology(view(this.world, other.id).mode);
    this.otherLabel.textContent = `${other.name} · ${o.name} · click to work here`;
    this.otherWorld.replaceChildren(...this.sideNodes(other.id));
    this.placeOther();
  }

  // The other side's view, centred in its half (after a resize, or the docks moving the room).
  placeOther() {
    const other = this.otherSide;
    if (!other || this.otherEl.hidden) return;
    const v = view(this.world, other.id);
    const { width, height } = this.otherEl.getBoundingClientRect();
    this.otherWorld.style.transform = `translate(${width / 2 - v.x * v.zoom}px, ${height / 2 - v.y * v.zoom}px) scale(${v.zoom})`;
  }

  // What the canvas of side `id` shows, drawn as the live canvas would draw it (its ontology's own
  // drawing, or its units where they sit), with nothing chosen and nothing being written. The
  // nodes are only to look at.
  sideNodes(id) {
    const keep = { roomId: this.roomId, sel: this.sel, draft: this.draft, found: this.found, draftEl: this.draftEl };
    Object.assign(this, { roomId: id, sel: null, draft: null, found: null });
    try { return this.canvasNodes(); } catch { return []; } finally { Object.assign(this, keep); }
  }

  // In the rail, under Sides: each side with its mode; the one you work in is current, a click on
  // the other works there. Nothing for a room of its own.
  twinRail() {
    const t = this.roomId && twinOf(this.world, this.roomId);
    if (!t) return [];
    const all = [this.roomId, this.otherSide?.id].map((id) => room(this.world, id)).filter(Boolean).sort((a, b) => (a.side || 0) - (b.side || 0));
    return [el('div', { class: 'rail-head', 'aria-hidden': 'true' }, 'Sides'),
      ...all.map((s) => {
        const on = s.id === this.roomId;
        const o = this.ontology(view(this.world, s.id).mode);
        return el('button', { type: 'button', class: 'rail-item', 'aria-current': String(on), title: on ? 'You are working here' : 'Work on this side',
          onclick: () => { if (!on) this.switchSide(s.id); } },
        el('span', { class: 'rail-icon rail-num', 'aria-hidden': 'true' }, s.side ? 'R' : 'L'), el('span', { class: 'rail-word' }, `${s.name} · ${o.name}`));
      })];
  }

  // Works on the other side: the live canvas becomes that side, the side left shows beside it.
  switchSide(id) {
    if (!twinOf(this.world, id) || id === this.roomId) return;
    this.shelveDraft();
    this.stopWriting();
    this.roomId = id;
    this.sel = null;
    this.gearFor = this.settingsFor = null;
    this.drawRoom();
    this.takeDraft();
  }

  // Where a point on the screen is in the other side's world, or null when it isn't over it.
  overOther(x, y) {
    const other = this.otherSide;
    if (!other || this.otherEl.hidden) return null;
    const b = this.otherEl.getBoundingClientRect();
    if (x < b.left || x > b.right || y < b.top || y > b.bottom) return null;
    const v = view(this.world, other.id);
    return { id: other.id, x: Math.round(v.x + (x - b.left - b.width / 2) / v.zoom), y: Math.round(v.y + (y - b.top - b.height / 2) / v.zoom) };
  }

  // A thought or group let go over the other side goes across, to that spot there. True when it went.
  dropAcross(id, x, y) {
    const at = this.overOther(x, y);
    if (!at || !id || this.locked) return false;
    const th = this.world.things[id];
    if (!th) return false;
    if (!across(this.world, id, at.x, at.y)) return false;
    // Placed there by the other side's own ontology, where it was let go.
    const o = this.ontology(view(this.world, at.id).mode);
    try { o.drop(this.world, at.id, id, at.x, at.y); } catch { /* its own place, then */ }
    this.sel = null;
    this.save();
    this.drawWorld();
    this.drawTwin();
    this.toast(`Moved to ${room(this.world, at.id).name}.`);
    return true;
  }

  // The loose thoughts of both sides (one tray for the Twin): this side's, then the other's.
  twinTrayItems(own) {
    const other = this.otherSide;
    if (!other) return own;
    const o = this.ontology(view(this.world, other.id).mode);
    let theirs = [];
    try { theirs = o.tray?.(this.world, other.id) || []; } catch { theirs = []; }
    return [...own, ...theirs];
  }

  // A loose card from the other side dropped on this canvas: it comes across first.
  fromOtherSide(id) {
    const th = this.world.things[id];
    const other = this.otherSide;
    if (!th || !other || th.parent !== other.id) return true;
    return across(this.world, id);
  }
}
