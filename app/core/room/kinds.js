// Part of the room feature: making and editing things of every kind of item (world/items/index.js),
// from what each kind says of itself, so a kind a plugin adds (a picture, a PDF page) is offered
// like the built-in ones and none is named here.
//
// - Add (right-click the canvas) and the loose tray's + list every kind with `add`.
// - Its keys (a passage's Alt+P, a picture's Alt+I) start one, and the ? list shows them.
// - A file pasted or dropped on the room becomes the kind that `takes` it.
// - The sheet (a new one, or one opened large) and the Editor show its `fields`.
//
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import { ITEMS, kindFor, kindOf } from './world.js';
import { el } from './shared.js';
import { ui } from 'folio';

export class Kinds {
  // The kinds Add offers, in the order they came (the built-in ones first).
  addable() { return Object.values(ITEMS).filter((k) => k.add && k.fields?.length); }

  // The kind a pasted or dropped file becomes, or null.
  kindForFile(file) {
    return Object.values(ITEMS).find((k) => { try { return !!k.takes?.(file) && !!k.fromFile; } catch { return false; } }) || null;
  }

  // The kind an Alt+letter starts (its add.keys), or null.
  kindForKey(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || !/^Key[A-Z]$/.test(e.code)) return null;
    const key = `Alt+${e.code.slice(3)}`;
    return this.addable().find((k) => (k.add.keys || []).includes(key)) || null;
  }

  // The ? list's lines for each kind's keys ("Alt+P  a passage"), drawn again when kinds come or go.
  drawKindKeys(live) {
    for (const off of this.kindKeyOffs || []) off();
    this.kindKeyOffs = this.addable().filter((k) => k.add.keys?.length).map((k) => this.add('keys', {
      id: `room.add.${k.kind}`, keys: [...k.add.keys], words: `a ${k.name.toLowerCase()}`, zone: 'room', when: live,
    }));
  }

  // A new thing of kind k, from Add, its keys or the loose tray's + (loose: kept in the tray).
  // A kind made from a file asks for one first.
  async addKind(k, loose = false) {
    if (this.locked) { this.toast('This room is locked.'); return; }
    if (!k.add.file) { this.openSheet(k.kind, null, null, loose); return; }
    this.pickers ||= {};
    this.pickers[k.add.file] ||= ui.filePicker(k.add.file);
    const file = await this.pickers[k.add.file].pick();
    if (file) this.takeFile(file, loose, k); else this.addAt = null;
  }

  // A file made into a thing of kind k (the kind that takes it, when none is given), then shown
  // in the sheet to finish (a caption). True when a kind took it.
  async takeFile(file, loose = false, k = this.kindForFile(file)) {
    if (!k) return false;
    if (this.locked) { this.toast('This room is locked.'); return true; }
    try {
      const fields = await k.fromFile(file);
      this.openSheet(k.kind, null, fields, loose);
    } catch {
      this.toast(`That file couldn't be read as a ${k.name.toLowerCase()}.`);
    }
    return true;
  }

  // The sheet's fields for kind k: { nodes, values(), first }. th: the thing (when it exists);
  // preset: fields made from a file. keys: their keydown.
  sheetFields(k, th, preset, keys) {
    const at = (f) => preset?.[f.key] ?? th?.[f.key] ?? '';
    const parts = [];
    const editable = [];
    let lines = 0;
    for (const f of k.fields || []) {
      if (f.type === 'image') { parts.push({ f, node: el('img', { class: 'room-sheet-image', src: at(f), alt: '' }) }); continue; }
      const node = f.type === 'text'
        ? el('textarea', { class: 'room-sheet-body', placeholder: f.label, 'aria-label': f.label, rows: 9, onkeydown: keys })
        : el('input', { class: lines++ ? 'room-sheet-title room-sheet-line' : 'room-sheet-title', placeholder: f.label, 'aria-label': f.label, onkeydown: keys });
      node.value = at(f);
      parts.push({ f, node });
      editable.push(node);
    }
    return {
      nodes: parts.map((p) => p.node),
      // Its fields as they are now: what is written, and what came with it (a picture).
      values: () => Object.fromEntries(parts.map(({ f, node }) => [f.key, f.type === 'image' ? at(f) : node.value])),
      // A new one starts at the first field to write in; one opened again at the last (a
      // passage's body, a picture's caption).
      first: (th ? editable.at(-1) : editable[0]) || null,
      multiline: parts.some((p) => p.f.type === 'text'),
    };
  }

  // The Editor's rows for a thing's fields (not a line's: the room writes those itself). done():
  // after a change. field(value, label, onchange, cls): one line, as the Editor's other names.
  fieldRows(th, inPanel, field, update, done) {
    const k = kindFor(kindOf(th));
    const rows = [];
    let lines = 0;
    for (const f of k.fields || []) {
      if (f.type === 'image') continue;
      if (f.type === 'text') {
        const body = el('textarea', { class: 'room-edit-body', rows: 5, 'aria-label': f.label, placeholder: f.label, onkeydown: (e) => e.stopPropagation(),
          onchange: (e) => { update(th.id, { [f.key]: e.target.value }); done(); } });
        body.value = th[f.key] || '';
        rows.push(body);
        continue;
      }
      const cls = lines++ || !inPanel ? 'pop-name' : 'pop-name title-field';
      rows.push(field(th[f.key], f.label, (e) => { update(th.id, { [f.key]: e.target.value }); done(); }, cls));
    }
    if ((k.fields || []).some((f) => f.type === 'text')) {
      rows.push(el('button', { type: 'button', class: 'word', onclick: () => this.openSheet(null, th.id) }, 'Open it large'));
    }
    return rows;
  }

  // What the Editor calls a thing it can't write in (a locked room's): a picture's caption, or its words.
  kindLabel(th, words) {
    const k = kindFor(kindOf(th));
    try { return k.label?.(th) || words; } catch { return words; }
  }
}
