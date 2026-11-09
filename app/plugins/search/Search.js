// Search (Ctrl+K, ⌘K on a Mac, or the Search bar in a room): a quiet panel near the top that looks
// through every room for a thought, a group or a room whose words hold what is typed. The finds
// are listed latest first; arrows move through them, Enter or a click opens one, Escape closes.
//
// The link hand: with a mark chosen in a room, Ctrl+K opens it linking: Enter links the chosen mark
// and the find (a `link`, both ways, across rooms; one undo step, through the moments log) and the
// room draws it. Tab switches between linking and only finding.
//
// It only finds: what a find opens is the room's to do. Opening one sends 'search:found' with
// { id, kind, text, room, roomName } (as the world's search gives it), and the room feature goes
// there. Other features open and close the panel through the `search` service (README.md lists
// it). It reaches the world through the plugin API.

import { Feature, ui } from 'folio';

const { el } = ui;

// The link hand's own kind: these two belong together, read either way.
export const KIND = { kind: 'link', name: 'Link', note: 'these two belong together', both: true };
const short = (s) => (s.length > 40 ? `${s.slice(0, 39)}…` : s) || '(empty)';

// Links the chosen mark to a find. { ok, words }: what to say.
export function linkTo(t, from, f) {
  if (!f || f.id === from) return { ok: false, words: 'A mark does not link to itself' };
  const r = t.links.link(from, f.id, KIND.kind);
  return r.ok ? { ok: true, words: `Linked to ${short(f.text || t.marks.text(f.id))}` } : { ok: false, words: r.reason };
}

export default class Search extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Search needs the plugin API');
    this.t = t;
    t.slots.linkKinds.add(KIND);
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
    const field = el('input', { class: 'search-field', placeholder: 'Search every room', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'search-list', role: 'listbox' });
    const from = this.t.ui.chosen()?.mark ?? null; // a mark chosen in a room: the link hand
    let linking = from != null;
    const head = el('div', { class: 'search-link' });
    const sayHead = () => {
      head.hidden = from == null;
      head.replaceChildren(linking ? `Link “${short(this.t.marks.text(from))}” to…` : 'Find', el('span', { class: 'search-link-key' }, linking ? 'Tab: only find' : 'Tab: link instead'));
      field.placeholder = linking ? 'Link to a thought in any room' : 'Search every room';
    };
    let found = [], at = 0;
    const show = () => {
      found = this.t.marks.search(field.value).filter((f) => !linking || f.id !== from);
      at = Math.min(at, Math.max(0, found.length - 1));
      list.replaceChildren(...found.map((f, i) => el('button', {
        type: 'button', class: 'pick search-item' + (i === at ? ' on' : ''), role: 'option', 'aria-selected': String(i === at),
        onclick: () => (linking ? this.link(from, f) : this.pick(f)),
      }, el('span', { class: 'search-text' }, f.text), el('span', { class: 'search-room' }, f.kind === 'room' ? 'Room' : f.roomName))),
      field.value.trim() && !found.length ? el('p', { class: 'search-none' }, 'Nothing yet with those words') : '');
    };
    field.addEventListener('input', () => { at = 0; show(); });
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); at = Math.min(found.length - 1, at + 1); show(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); at = Math.max(0, at - 1); show(); }
      if (e.key === 'Enter' && found[at]) { e.preventDefault(); if (linking) this.link(from, found[at]); else this.pick(found[at]); }
      if (e.key === 'Tab' && from != null) { e.preventDefault(); linking = !linking; sayHead(); show(); }
    });
    sayHead();
    this.box.replaceChildren(el('div', { class: 'panel top-sheet search-panel' }, head, field, list));
    this.box.hidden = false;
    field.focus();
  }

  close() {
    if (this.box.hidden) return;
    this.box.hidden = true;
    this.box.replaceChildren();
  }

  // The link hand: the chosen mark and the find are linked; the panel closes, the room stays.
  link(from, f) {
    const r = linkTo(this.t, from, f);
    this.t.ui.toast(r.words);
    if (r.ok) this.close();
  }

  // A find is opened: the panel closes, and whoever shows rooms goes there.
  pick(f) {
    this.close();
    this.emit('search:found', f);
  }
}
