// Items: the single things on a canvas. The kinds built in are one small file each here; a plugin
// adds more through the slot 'world.items' (the plugin API's t.items.add), and World keeps ITEMS
// up to date with it (setKinds). A kind is shaped:
//
//   kind               'line': lowercase words joined by dashes, never 'group' or 'room'
//   name               what it is called in menus: 'Thought'
//   tidy(fields, h)    its own fields, tidied, or null when it would be empty. h: { oneLine, lines }
//   text(th)           its words as plain text (what search, peeks and closed groups read)
//   traum              (optional) how it reads and writes a .traum file (the roomfile feature's traum.js):
//                      { read({ title, body }) → fields for tidy(), write(th) → { title?, body } }.
//                      title: the words after the colon on its ## ^id kind: line; body: the lines
//                      under it, as written. Without traum, a thought of this kind is written as
//                      its text() and read back as a line.
//   node(th, el)       how it shows on a canvas (el is Folio's ui.el); words go through
//                      maths(text) from ../maths.js, so $…$ and $$…$$ show as mathematics
//
// Ontologies never look at an item's kind: they place items, and ask these for the rest.
//
// A thought whose kind is not here (its plugin is switched off) is never lost: kindFor() gives
// a stand-in (missing.js) that keeps every field as it is, reads its words as well as it can,
// shows it as a quiet box naming the kind, and writes it to a .traum file under its own kind.

import line from './line.js';
import passage from './passage.js';
import picture from './picture.js';
import { missing } from './missing.js';

export const BUILT_IN = [line, passage, picture];
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
