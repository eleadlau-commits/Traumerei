// The key map: one list of every key in the app, that each feature adds its keys to (the slot
// 'keys'). The ? list is drawn from it, showing the keys of wherever you are, and a key whose entry
// has run() is pressed through it. keymap.js holds the rules (reading, matching, writing a key,
// clashes); this file is the slot, the one listener and the list on the screen. Other features
// use it through the `keys` slot and service (README.md lists both).

import { Feature, ui } from 'folio';
import { label, matches, clashes } from './keymap.js';

const { el } = ui;
const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const FIELD = 'input, textarea, select, [contenteditable], [contenteditable] *';
// Chrome's own keys that would leave or break what is being written (reload, bookmark, the address
// bar, find): swallowed while a field has focus, so a thought can't be lost mid-sentence.
const BROWSER = new Set(['r', 'd', 'l', 'f']);

export default class Keys extends Feature {
  start() {
    this.defineSlot('keys', '{ id, keys: ["Ctrl+K", …], shows?, words, zone, order, when?(), run?(e), typing? }: a key and what it does. keys are written as in keymap.js; shows is what the list says instead of the keys (for a click, or "Type anywhere"); zone is "everywhere", "rooms", "room" or another place; when() is true while the key is live (default always); run(e), when given, is called on that key and the key is taken; no key runs while a field has focus (writing a thought, search, the tray, the Editor): there only the field\'s own keys work.');
    this.add('keys', { id: 'keys.list', keys: ['?'], words: 'these keys', zone: 'everywhere', order: 99,
      when: () => this.live().some((k) => k.id !== 'keys.list'), run: () => this.show() });
    this.provide('keys', {
      show: () => this.show(),
      hide: () => this.hide(),
      label: (id) => this.labelOf(id),
      live: () => this.live().map(({ id, keys, words, zone }) => ({ id, keys: [...(keys || [])], words, zone })),
      clashes: () => clashes(this.slot('keys').items),
    });
    window.addEventListener('keydown', (e) => this.onKey(e), true);
    this.build();
    // Once every feature has added its keys: say so if two share one.
    setTimeout(() => { for (const c of clashes(this.slot('keys').items)) console.warn(`Keys: ${c.key} is both ${c.a} and ${c.b}`); }, 0);
  }

  // The entries live where you are now, in order.
  live() {
    return this.slot('keys').items.filter((k) => { try { return k.when ? k.when() : true; } catch { return false; } });
  }

  // The keys of one entry as the screen shows them ("Ctrl+K"), or '' when there is none.
  labelOf(id) {
    const k = this.slot('keys').items.find((x) => x.id === id);
    if (!k) return '';
    return k.shows || (k.keys || []).map((c) => label(c, MAC)).join(' · ');
  }

  // While a field has focus (a thought being written, search, the tray, the Editor) no app key
  // runs: the field keeps Enter, Ctrl+Enter, Escape and its own text keys, and Chrome's
  // Ctrl+R/D/L/F do nothing. Elsewhere the key is matched first, and only the entries it matches
  // are asked whether they are live (asking every entry on each key was slow).
  onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    if (!this.box.hidden) { e.preventDefault(); e.stopPropagation(); this.hide(); return; }
    if (e.target?.matches?.(FIELD)) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && BROWSER.has((e.key || '').toLowerCase())) e.preventDefault();
      return;
    }
    if (document.querySelector('dialog[open]')) return;
    for (const k of this.slot('keys').items) {
      if (!k.run || !(k.keys || []).some((c) => matches(c, e))) continue;
      try { if (k.when && !k.when()) continue; } catch { continue; }
      e.preventDefault();
      e.stopPropagation();
      try { k.run(e); } catch (err) { console.warn(`Keys: ${k.id}`, err); }
      return;
    }
  }

  build() {
    this.box = el('div', { class: 'shade', hidden: true, role: 'dialog', 'aria-label': 'Keys', onpointerdown: () => this.hide() });
    (document.getElementById('folio-root') || document.body).append(this.box);
  }

  // The ? list: every key live here, from the map.
  show() {
    const rows = this.live().map((k) => [k.shows || (k.keys || []).map((c) => label(c, MAC)).join(' · '), k.words]).filter(([a]) => a);
    this.box.replaceChildren(el('div', { class: 'panel top-sheet keys-sheet' },
      el('div', { class: 'label' }, 'Keys'),
      el('dl', { class: 'keys-list' }, rows.flatMap(([a, b]) => [el('dt', {}, a), el('dd', {}, b)]))));
    this.box.hidden = false;
  }

  hide() {
    if (this.box.hidden) return;
    this.box.hidden = true;
    this.box.replaceChildren();
  }
}
