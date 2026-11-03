// Items: the single things on a canvas. Each kind is one small file here, shaped:
//
//   kind               'line'
//   name               what it is called in menus: 'Thought'
//   tidy(fields, h)    its own fields, tidied, or null when it would be empty. h: { oneLine, lines }
//   text(th)           its words as plain text (what search, peeks and folded groups read)
//   node(th, el)       how it shows on a canvas (el is Folio's ui.el)
//
// Ontologies never look at an item's kind: they place items, and ask these for the rest.
// A new kind (a page of a PDF, say) is one new file, added to ITEMS below.

import line from './line.js';
import passage from './passage.js';
import picture from './picture.js';

export const ITEMS = Object.fromEntries([line, passage, picture].map((k) => [k.kind, k]));
