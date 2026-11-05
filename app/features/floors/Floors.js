// The rooms page's floors: one fixed size for every floor, chosen from a preset (Settings →
// Floors: Small 6 × 4, Medium 8 × 5, Large 10 × 6), and the one rule for where a room goes when
// it is placed for you: its own floor if there is a free spot of its size, or else a new floor at
// the end, with a short note. Choosing a smaller size while any room sits outside it shows an
// error and keeps the old size. The rule itself is rule.js (no screen); other features use only
// the `floors` service (README.md lists it). Saved data: 'size' (the preset's id).

import { Feature, ui } from 'folio';
import { bind, room } from './world.js';
import { borges } from './borges.js';
import { PRESETS, DEFAULT, preset, sizeName, place, settle, move, resize, toFloor, outside, removeFloor } from './rule.js';

const { el } = ui;

export default class Floors extends Feature {
  start() {
    this.w = this.use('world');
    bind(this.w.lib);
    this.size = preset(this.storage.get('size', DEFAULT));
    const f = this;
    const board = () => ({ cols: f.size.cols, rows: f.size.rows });
    this.provide('floors', {
      get size() { return board(); },                           // { cols, rows }: every floor's size
      place: (id, cell = null, o = {}) => this.place(id, cell, o), // its floor, else a new one (with a note)
      settle: (page) => this.settle(page),                      // places a floor's rooms that have no cell
      move: (id, col, row) => move(this.world, id, col, row, board()),
      resize: (id, size) => resize(this.world, id, size, board()),
      toFloor: (id, page, cell = null) => toFloor(this.world, id, page, board(), cell),
      fits: (size) => !outside(this.world, size).length,        // whether every room fits floors of `size`
      removeFloor: (page) => removeFloor(this.world, page),     // a floor goes: its rooms to the Archive, the rest up one
    });
    // The rooms page's own ontology (borges.js), by the same rule: never a room's mode.
    this.add('world.ontologies', borges(board));
    this.add('settings', { id: 'floors-size', title: 'Floors', order: 31, render: () => this.settingsPane() });
  }

  get world() { return this.w.world; }

  place(id, cell, o = {}) {
    const out = place(this.world, id, this.size, cell, o);
    if (out?.spilled) this.say(room(this.world, id), out);
    return out;
  }

  settle(page) {
    const spilled = settle(this.world, page, this.size);
    for (const s of spilled) this.say(s.room, s);
    return spilled;
  }

  // "Floor 2 was full, so Algebra is on a new Floor 4."
  say(r, { page, from }) {
    this.toast(`Floor ${from + 1} was full, so ${r?.name || 'the room'} is on a new Floor ${page + 1}.`);
  }

  // Chooses a preset for every floor. A smaller one with rooms outside it is refused: the old size
  // stays and the message says which floor. Returns '' when it changed, or the message.
  choose(id) {
    const next = preset(id);
    if (next.id === this.size.id) return '';
    const over = outside(this.world, next);
    if (over.length) {
      const floors = over.map((p) => p + 1);
      const which = floors.length === 1 ? `Floor ${floors[0]} has` : `Floors ${floors.slice(0, -1).join(', ')} and ${floors.at(-1)} have`;
      return `${which} rooms outside ${sizeName(next)}. Move them first.`;
    }
    this.size = next;
    this.storage.set('size', next.id);
    this.emit('floors:size', { cols: next.cols, rows: next.rows });
    return '';
  }

  settingsPane() {
    const error = el('p', { class: 'error', role: 'alert', hidden: true });
    const select = el('select', { 'aria-label': 'Floor size', onchange: (e) => {
      const why = this.choose(e.target.value);
      error.hidden = !why;
      error.textContent = why;
      e.target.value = this.size.id;
    } }, ...PRESETS.map((p) => el('option', { value: p.id, ...(p.id === this.size.id ? { selected: '' } : {}) }, `${p.name}, ${sizeName(p)}`)));
    return el('div', { class: 'stack' },
      el('label', { class: 'row' }, el('span', {}, 'Floor size'), select),
      error,
      ui.hint('Every floor of the rooms page is this many columns × rows.', { small: true }));
  }
}
