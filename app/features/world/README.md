# World

The saved world of rooms and thoughts, and everything true of it without a screen: its rules,
saving and undo, the ontologies, the rooms' look and the attention log. The rooms page (the rooms
feature) and an open room (the room feature) draw it; this feature never touches the screen, except that
an ontology draws its own canvas when the room asks it to.

## The world service

Other features reach the world only through the `world` service (`this.use('world')`). This
list is everything it offers:

| Member | What it is |
|---|---|
| `lib` | The rules, by module (`lib.js`): `model`, `twin`, `items`, `maths`, `look`, `attention`, `picture`, `ontologies`, `joyce`, `pessoa`, `russell`, `groups` (groups as shared objects, `groups.js`), `relations` (named arrows between groups, shared by any ontology that joins its groups), `lines` (lines on a canvas, shared by any ontology that draws them: below), `arrowview` (named arrows on the screen, for any ontology that joins its groups: below). Plain functions of a world; none touches the screen. |
| `world` | The world itself (`model.js` says its shape). Change it with `lib.model`, then `save()`. |
| `load()` | Reads the world again from storage (it may have come from the account meanwhile). |
| `begin()` | A fresh undo history. |
| `save()` | After a change: a change to the thoughts or rooms (not just a view) is a step Ctrl+Z can take back. Written down soon, then `world:saved` is sent. True when it was a step. |
| `settled()`, `fold()` | Nothing waits to become its own step; the change since the last step becomes part of it (so a push from clear space goes with what caused it). |
| `writeSoon(say)`, `write()` | Written down in a moment (one timer; `say`: then `world:saved`), or now. |
| `undo(back)` | A step back (`true`) or forward (`false`). False when there is none; otherwise sends `world:changed`. |
| `ontologies`, `ontology(id)` | Every ontology a room can be seen through, in order, and one by id (a missing one is Pessoa). The rooms page's own is never among them. |
| `roomsPage` | The rooms page's own ontology (Borges, from the floors feature), or `null`: rooms on the floors' cells. |
| `prefs`, `setLook(key, value)`, `resetLook()` | Settings → Rooms' look (`look.js`: `LOOK`), saved as 'look'. |
| `globals`, `setGlobal(of, key, value)`, `resetGlobals()` | The global ontology settings, `{ [ontology]: { key: value } }`: what a new room starts with. Saved as 'ontologies'. |
| `palette`, `refreshPalette()` | The app's colours (Renderer's `backdrop`, Settings → Colour), or `look.js`'s `PALETTE`. |
| `attention`, `visit(roomId)` | The attention log (`attention.js`), and going into a room. Saved as 'attention'. |

**Events:** `world:saved` (the world was written down after a `save()`), `world:changed`
(`{ undone }`, after `undo()`), `world:palette` (the app's colours changed), `world:look`
(Settings → Rooms' look changed).

**Slot:** `world.ontologies`, for a whole ontology from another feature (shape in
`ontologies/index.js`).

A feature can't import this folder's files (Folio's rule), so a feature that uses many of the
rules binds them once from `lib` into a file of its own that lists what it needs (the room's
`world.js`).

## The world

**Everything is a thought.** `model.js` has three sorts: *items* (line, passage, picture; each
kind is one small file in `items/`, so a new kind such as a PDF page is one new file), *groups*
and *rooms*. Items and groups sit in a room. A group belongs to the ontology that made it (Joyce
makes trains) and lists what it holds: items, and other groups (a train of trains; never itself
or a group holding it). One item can be in groups of several ontologies. `itemsIn` gives every item
inside a group however deep, `within` everything inside it, `holds` whether it holds a thing. Each
ontology says whether an item can be in **one** of its groups (a train) or in **many**. Every
group can be closed, named, moved and deleted, and is always the same group, never a copy.

**Ontologies** are in `ontologies/`, one file each (Joyce, Pessoa, Russell), or come from another feature
through the slot `world.ontologies`. One is special: the rooms page's own, **Borges** (the floors feature's),
marked `roomsPage`. Its "room" is a floor, its units the rooms on it, its points their cells. It is
never a room's mode and shows in no list inside a room (`forRooms`); the rooms page finds it
through `roomsPage`. `ontologies/index.js` describes their shape: name, groups,
units, where each sits, what a drag does, and optional tray, settings, moves (shown in the pop-up
of what is chosen), its own presses and pop-up rows, and `begin` (which group a new thought joins,
or none, so it waits in the tray). Each keeps its own data per room (`own()` in model.js: Pessoa's
dragged places, Russell's arrows and their labels). An ontology can draw its own
canvas (Joyce's line and trains) and tag thoughts in the Timeline (Joyce: their train; Russell: their chapter); the room keeps
no mode of its own. A room whose ontology is missing is seen through Pessoa.

**Lines** (`ontologies/lines.js`, `lib.lines`) are one part shared by every ontology that joins
things with a line: Joyce's strands, Russell's arrows, and any mode after them. It makes a line's
shape (straight, a soft curve square to its sides, or a strand that sags with the pause between
two thoughts: `slack`, `strand`) and draws it (`layer`, `line`, `knot`) with its **ends**: none (a
plain line), an arrowhead where it ends, or one at both (`ENDS`). Where a line between two boxes
starts and ends is `arrows.js`. Its look is the room's `.room-line` classes; each mode adds its own
class for how strong its lines are.

**Arrows on the screen** (`ontologies/arrowview.js`, `lib.arrowview`) are the screen half of
`relations.js`, for any ontology that joins its groups with named arrows (Russell now; Proust
next). `arrowView({ of, net, boxes, pads, nodeAt, name, ends })` draws each arrow through the
lines part with its relation and label beside it, edits an arrow where it is (a double-click: its
relation and its label), draws a new one dragged from a point onto another node, and gives a
node's pop-up rows (each arrow into it). `ends(rel)` gives a relation's ends (Russell: always an
arrow). An ontology may route the line itself (`route`: Proust's strands), say which node a drawn element
stands for (`onNode`), shape the line drawn while dragging (`drag`'s `shape`), open a link's edit
box from its own key (`edit`: Proust's Ctrl+J), keep its relations in
its own setting (`setting`), and leave its first relation unnamed beside its links (`quiet`). Its
look is the room's `.room-arrow-*` classes.

**Relations and their ends** (`relations.js`): `arrowsOf` may keep an ontology's arrows apart from
its other data (`store`: Proust keeps its places under its id, its links under `proust-links`),
read its relations from its own setting (`setting`, with its own default) and say why an arrow is
refused in its words (`words`). In a room's list a relation may end with a mark for its ends:
`leads to ->` (an arrow), `is equivalent to <->` (both ways), `related to --` (a plain line).
`cleanRelations` gives the names without their marks, `cleanRelationList` the tidy list with them,
`relationEnds` each name's ends.

**Groups are shared objects** (`groups.js`, `lib.groups`): every other ontology of the room sees
a group as one thought, in its tray until it places it (`foreign`, `trayForeign`, `placedForeign`;
Joyce and Pessoa keep where they placed one in their own data, `spot` / `putAt`). Only the
outermost groups show this way: a train of trains is one Train. A group made from thoughts in an
ontology's tray is `loose` and stays in the tray until dragged out (`place`).

**Folding** (`groups.js`: `fold`, `foldPlan`) is not grouping: the chosen thoughts (and everything
inside chosen groups) become one new thought, which takes their place in every group of every
ontology that held them and in each ontology's own data; the old ones are deleted.

**Grouping what is chosen** (Ctrl+G, Ctrl+Shift+G in a room) is each ontology's own rule:
`ontologies/index.js`'s `groupChosen` and `ungroupChosen` use an ontology's `group` / `ungroup`
when it has them, or else make one group of its own where the first thing is (and take things
out of their groups). Joyce's `ungroup` gives each thought a train of its own; Pessoa has no groups.

**A Twin** (`twin.js`, `lib.twin`) is a room two cells wide and one high on the rooms page whose two
sides are rooms of their own (children of the Twin, `side` 0 and 1), each with its own mode, thoughts
and data: two rooms bundled in one. Nothing is shared; `across(w, id, x, y)` moves a thought or a
whole group to the other side, where it belongs alone. The sides are the only rooms inside a room
(`canHold`), and a Twin holds nothing else. Its square counts both sides' thoughts (`roomThoughts`)
and its tags are its sides' modes. As a place to move to, a side is named "Pair · Left" /
"Pair · Right" (`placeName`); `moveTargets(w, from)` lists every room a thought can go to, a Twin as
its two sides, the other side first when moving from a side.

**Copying a room** is one rule, `copyRoom(w, id)`: a new room with everything in it copied (items,
groups and their members, each ontology's own data, its view and settings), every copied thought
a new id and every mention of an old id changed, so the copy shares nothing with the original.
It is named "… copy", unlocked, on the same floor with no cell (the floors feature places it).

The rules (no screen) are in `model.js`, tested in `tests/model.test.js`. Everything is saved under
the key `world3` (a world saved in an older shape is not kept) and follows the account like the settings.

## Mathematics

Any thought's words can hold LaTeX: `$…$` is inline maths and `$$…$$` is display maths, on a line
of its own; `\$` is a dollar sign. This is for every kind of words: a line, a passage's title
and body, a picture's caption, a closed group's title. The words are kept exactly as typed, so
search, peeks, the Timeline and `text(th)` read the source, and the draft, edit in place and the
sheet show the source too. Once a thought is kept, it shows drawn, in the thought's own colour and
size. A formula that doesn't parse shows its source in a quiet rust and never breaks the canvas.

A `$` opens only when something other than a space follows it, and closes only when something
other than a space comes before it and no digit after it (Pandoc's rule), so "$5 and $6" stays
words. Inline maths stays on one line; display maths may span lines. A `$` that never closes,
and an empty `$$ $$`, stay as words.

`maths.js` has `split(text)` (words into text, inline and display pieces, tested in
`tests/maths.test.js`) and `maths(text)`, which every item's `node()` and the closed group call,
so a new kind of item gets mathematics for free, and `broken(text)`, the formulas in some words that KaTeX can't draw (with their line), for whoever wants to warn before they are kept. The drawing is KaTeX 0.19.1 (`vendor/`, MIT,
see `LICENSE-KaTeX.txt`): `katex.js` is its ESM build, minified with esbuild, and `katex.css`
holds its 20 fonts as base64 woff2, so it works offline and in the one-file page (about 640 KB
of the standalone file). KaTeX draws at once, so Joyce and clear.js measure each thought with
its maths in it; when the fonts finish loading, the room is measured again.

