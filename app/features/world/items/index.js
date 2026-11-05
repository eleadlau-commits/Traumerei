// Items: the single things on a canvas. Each kind is one small file here, shaped:
//
//   kind               'line'
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
// A new kind (a page of a PDF, say) is one new file, added to ITEMS below.

import line from './line.js';
import passage from './passage.js';
import picture from './picture.js';

export const ITEMS = Object.fromEntries([line, passage, picture].map((k) => [k.kind, k]));
