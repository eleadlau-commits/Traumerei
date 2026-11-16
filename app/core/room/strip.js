// Part of the room feature. The strip: one quiet line along the foot of a room's canvas, above the
// status bar, where plugins say a tool's status (a word count, a timer). It never floats and is
// never a dock: one line of words, each item's own, laid side by side at the right (the Add button
// keeps the left), hidden while no item has anything to say. An item may be pressed (onClick).
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.
//
// The slot `room.strip` (t.slots.strip, since 1.1.0): { id, text(context) → words, title?(context),
// onClick?(context), visible?(context), order? }. context is the open room's id. The strip asks
// each item again when the room is still for a moment after it was drawn or a key was let go
// (stripSoon: never inside a keystroke or Enter), when the zoom's band changes, after an item or
// a bar word is pressed, and when the slot changes.

import { el } from './shared.js';

const STILL_MS = 150; // how long the room is still before the strip asks its items again
const MOST = 120;     // the longest an item's words may be: one line

export class Strip {
  // The strip's element, put at the foot of the room page (build()).
  stripNode() {
    this.stripEl = el('div', { class: 'room-strip', role: 'status', 'aria-live': 'polite', hidden: true, onpointerdown: (e) => e.stopPropagation() });
    return this.stripEl;
  }

  // Asks the strip's items and the bar's words again once the room has been still for a moment
  // (after it was drawn, or a key: a plugin's command may have changed what they say).
  stripSoon() {
    clearTimeout(this.stripTimer);
    this.stripTimer = setTimeout(() => this.drawPlaces(), STILL_MS);
  }

  // The strip and the bar's words, now.
  drawPlaces() {
    this.drawStrip();
    this.drawBarWords();
  }

  // Draws the strip now: each visible item's words, in the slot's order.
  drawStrip() {
    clearTimeout(this.stripTimer);
    const strip = this.stripEl;
    if (!strip) return;
    const context = this.roomId;
    if (!context || this.root.hidden) { strip.hidden = true; strip.replaceChildren(); return; }
    const slot = this.slot('room.strip');
    const ask = (item, fn, fallback) => slot.run(item, fn, fallback);
    const parts = [];
    for (const item of slot.items) {
      if (item.visible && !ask(item, (i) => !!i.visible(context), false)) continue;
      const words = String(ask(item, (i) => i.text?.(context) ?? '', '') ?? '').replace(/\s+/g, ' ').trim().slice(0, MOST);
      if (!words) continue;
      const title = item.title ? String(ask(item, (i) => i.title(context) ?? '', '') || '') : '';
      parts.push(item.onClick
        ? el('button', { type: 'button', class: 'word room-strip-item', 'data-strip': item.id, ...(title ? { title } : {}),
          onclick: () => { ask(item, (i) => i.onClick(context)); if (this.roomId) this.drawPlaces(); } }, words)
        : el('span', { class: 'room-strip-item', 'data-strip': item.id, ...(title ? { title } : {}) }, words));
    }
    strip.hidden = !parts.length;
    strip.replaceChildren(...parts);
  }
}
