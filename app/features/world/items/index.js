// Items: the single things on a canvas. Each kind is one small file here, shaped:
//
//   kind               'line'
//   name               what it is called in menus: 'Thought'
//   tidy(fields, h)    its own fields, tidied, or null when it would be empty. h: { oneLine, lines }
//   text(th)           its words as plain text (what search, peeks and folded groups read)
//   md                 (optional) how it reads and writes room Markdown (../roomfile.js):
//                      { order, read(lines, i, h) → { fields, end } | null, write(th, h) → text }.
//                      read looks at lines[i] and, if it is this kind, returns the fields for
//                      tidy() and the line after it; kinds are asked in order. Without md, a
//                      thought of this kind is written as a line of its text().
//   node(th, el)       how it shows on a canvas (el is Folio's ui.el); words go through
//                      maths(text) from ../maths.js, so $…$ and $$…$$ show as mathematics
//
// Ontologies never look at an item's kind: they place items, and ask these for the rest.
// A new kind (a page of a PDF, say) is one new file, added to ITEMS below.

import line from './line.js';
import passage from './passage.js';
import picture from './picture.js';

export const ITEMS = Object.fromEntries([line, passage, picture].map((k) => [k.kind, k]));
