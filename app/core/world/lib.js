// The world's rules, by module, for other features: they can't import this folder's files, so
// they get these through the world service (`lib`). None of them touches the screen, except
// an ontology's drawing and lines.js, which make the canvas's nodes when a room asks.

export * as model from './model.js';          // the world: rooms, items, groups, tags, pages
export * as links from './links.js';          // the links table: part of, stands for, relation (Law 4)
export * as places from './places.js';        // the places table: the context each thought is in (Laws 1, 2)
export * as gaps from './gaps.js';            // the gaps table: what a mark was made to close, derived up the links (Law 5)
export * as distance from './distance.js';    // the distance table: who a context is written for (Law 7)
export * as tables from './tables.js';        // the six tables read off the world and written back: what carriers move (Law 8)
export * as traum from './traum.js';          // the .traum carrier: the six tables as text (Law 8)
export * as rules from './rules.js';          // rules: an ontology as the kernel sees it (layout, admit, moves, draws)
export * as groups from './groups.js';        // groups as shared objects: outermost, foreign, trays
export * as twin from './twin.js';            // a Twin: two sides, each a room, side by side
export * as items from './items/index.js';    // ITEMS: the kinds of item (line, passage, picture)
export * as maths from './maths.js';          // split, maths: LaTeX in a thought's words
export * as look from './look.js';            // colours: a room's, a square's, the rooms page's
export * as attention from './attention.js';  // a room's light from your visits
export * as moments from './moments.js';      // the moments log: every change and visit, undo, replay
export * as picture from './picture.js';      // shrinkPicture, keepOrShrink
export * as ontologies from './ontologies/index.js'; // BUILT_IN, gather, FALLBACK
export * as joyce from './ontologies/joyce.js';
export * as pessoa from './ontologies/pessoa.js';
export * as relations from './ontologies/relations.js'; // arrows and their relations, for any ontology
export * as lines from './ontologies/lines.js';         // lines on a canvas: strands, arrows and their ends
export * as arrowview from './ontologies/arrowview.js'; // arrows on the screen: drawn, edited, drawn anew, in a pop-up
export * as relationsview from './ontologies/relationsview.js'; // the relations editor in a mode's ⚙
