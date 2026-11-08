// Items: the single things on a canvas. The kinds built in are one small file each here; a plugin
// adds more through the slot 'world.items' (the plugin API's t.items.add), and World keeps ITEMS
// up to date with it (setKinds). A kind is shaped:
//
//   kind               'line': lowercase words joined by dashes, never 'group' or 'room'
//   name               what it is called in menus: 'Thought'
//   tidy(fields, h)    its own fields, tidied, or null when it would be empty. h: { oneLine, lines }
//   text(th)           its words as plain text (what search, peeks and closed groups read)
//   node(th, el)       how it shows on a canvas (el is Folio's ui.el); words go through
//                      maths(text) from ../maths.js, so $…$ and $$…$$ show as mathematics
//
// and, optionally, how the room makes and edits one (a kind without these is shown and kept, but
// is made only by a plugin's own means, or by a file):
//
//   fields             what it is written in, in order: [{ key, type, label }]. type: 'line' (one
//                      line), 'text' (several lines: Enter keeps, Ctrl+Enter a new line) or 'image'
//                      (a picture at the key, shown, not written in). The room's sheet and Editor
//                      show these, and keep them with update().
//   add                how Add (right-click, the loose tray's +) offers a new one:
//                      { note, keys?: ['Alt+I'], file?: 'image/*' }. With file, a file is picked
//                      first and fromFile makes the fields from it.
//   takes(file)        whether a file pasted or dropped on the room becomes one of these
//   fromFile(file)     → Promise of its fields from a file (a picture, shrunk)
//   step               how far down a Joyce train goes after one (px; a passage's 190)
//   label(th)          what the Editor calls it when it can't be written in (default: text(th))
//
// Ontologies never look at an item's kind: they place items, and ask these for the rest.
//
// A thought whose kind is not here (its plugin is switched off) is never lost: kindFor() gives
// a stand-in (missing.js) that keeps every field as it is, reads its words as well as it can,
// shows it as a quiet box naming the kind, and a .traum file carries it as it is (Law 8: rows need no plugin).

import line from './line.js';
import passage from './passage.js';
import { missing } from './missing.js';

// A line and a passage are the core's: folding writes passages, and a closed group reads as one.
// Every other kind (a picture, a PDF page) is a plugin's.
export const BUILT_IN = [line, passage];
const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const NEEDS = ['kind', 'name', 'tidy', 'text', 'node'];

// The kinds there are now, by kind. One object, changed in place, so every module that imported
// it sees the kinds a plugin adds or takes away.
export const ITEMS = Object.fromEntries(BUILT_IN.map((k) => [k.kind, k]));

// What a kind lacks to be one ([] when it is whole).
export function lacks(k) {
  if (!k || typeof k !== 'object') return ['kind'];
  const out = NEEDS.filter((n) => (n === 'kind' || n === 'name' ? typeof k[n] !== 'string' || !k[n] : typeof k[n] !== 'function'));
  if (!out.includes('kind') && (!NAME.test(k.kind) || k.kind === 'group' || k.kind === 'room')) out.unshift('kind');
  return out;
}

// The built-in kinds and these (the slot's items), in that order. A kind that lacks something,
// or tries to take a built-in kind's name, is skipped (warn says why). Returns the kinds now.
export function setKinds(extra = [], warn = () => {}) {
  for (const k of Object.keys(ITEMS)) delete ITEMS[k];
  for (const k of BUILT_IN) ITEMS[k.kind] = k;
  for (const k of extra) {
    const no = lacks(k);
    if (no.length) { warn(k, `it lacks ${no.join(', ')}`); continue; }
    if (ITEMS[k.kind]) { warn(k, `the kind "${k.kind}" is already there`); continue; }
    ITEMS[k.kind] = k;
  }
  return Object.keys(ITEMS);
}

// The kind for a thought's kind: its own, or the stand-in for a kind that is switched off.
export const kindFor = (kind) => ITEMS[kind] || missing(kind);
export const isKnown = (kind) => !!ITEMS[kind];
