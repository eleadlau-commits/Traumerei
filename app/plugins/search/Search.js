// Search (Ctrl+K, ⌘K on a Mac, or the Search bar in a room): a quiet panel near the top that looks
// through every room for a thought, a group or a room whose words hold what is typed. The finds
// are listed latest first; arrows move through them, Enter or a click opens one, Escape closes.
//
// It only finds: what a find opens is the room's to do. Opening one sends 'search:found' with
// { id, kind, text, room, roomName } (as the world's search gives it), and the room feature goes
// there. Other features open and close the panel through the `search` service (README.md lists
// it). It reaches the world through the plugin API.

import { Feature, ui } from 'folio';

const { el } = ui;

export default class Search extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Search needs the plugin API');
    this.t = t;
    this.provide('search', {
      open: () => this.open(),      // shows the panel, the field ready for typing
      close: () => this.close(),    // hides it, if it shows
      get isOpen() { return !!box && !box.hidden; },
    });
    const box = this.box = el('div', { class: 'shade search', hidden: true, role: 'dialog', 'aria-label': 'Search' });
    box.onpointerdown = (e) => { if (e.target === box) this.close(); };
    this.attach(box);
  }

  open() {
    const { search } = this.t.model;
    const field = el('input', { class: 'search-field', placeholder: 'Search every room', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'search-list', role: 'listbox' });
    let found = [], at = 0;
    const show = () => {
      found = search(this.t.world, field.value);
      at = Math.min(at, Math.max(0, found.length - 1));
      list.replaceChildren(...found.map((f, i) => el('button', {
        type: 'button', class: 'pick search-item' + (i === at ? ' on' : ''), role: 'option', 'aria-selected': String(i === at),
        onclick: () => this.pick(f),
      }, el('span', { class: 'search-text' }, f.text), el('span', { class: 'search-room' }, f.kind === 'room' ? 'Room' : f.roomName))),
      field.value.trim() && !found.length ? el('p', { class: 'search-none' }, 'Nothing yet with those words') : '');
    };
    field.addEventListener('input', () => { at = 0; show(); });
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(found.length - 1, at + 1); show(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); show(); }
      if (e.key === 'Enter' && found[at]) { e.preventDefault(); this.pick(found[at]); }
    });
    this.box.replaceChildren(el('div', { class: 'panel top-sheet search-panel' }, field, list));
    this.box.hidden = false;
    field.focus();
  }

  close() {
    if (this.box.hidden) return;
    this.box.hidden = true;
    this.box.replaceChildren();
  }

  // A find is opened: the panel closes, and whoever shows rooms goes there.
  pick(f) {
    this.close();
    this.emit('search:found', f);
  }
}
