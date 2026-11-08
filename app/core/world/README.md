# World

The saved world of rooms and thoughts, and everything true of it without a screen: its rules,
saving and undo, the ontologies, the rooms' look and the moments log. The rooms page (the rooms
feature) and an open room (the room feature) draw it; this feature never touches the screen, except that
an ontology draws its own canvas when the room asks it to.

## The world service

Other features reach the world only through the `world` service (`this.use('world')`). This
list is everything it offers:

| Member | What it is |
|---|---|
| `lib` | The rules, by module (`lib.js`): `model`, `twin`, `items`, `maths`, `look`, `attention`, `picture`, `ontologies`, `joyce`, `pessoa`, `groups` (groups as shared objects, `groups.js`), `relations` (named arrows between groups, shared by any ontology that joins its groups), `lines` (lines on a canvas, shared by any ontology that draws them: below), `arrowview` (named arrows on the screen, for any ontology that joins its groups: below), `relationsview` (the relations editor in a mode's ⚙: below). Plain functions of a world; none touches the screen. |
| `world` | The world itself (`model.js` says its shape). Change it with `lib.model`, then `save()`. |
| `lib.links` | The links table (`links.js`, `w.links`): every *part of*, *stands for* and *relation* row, read from either end or by rule off an index the writes keep true. Groups hold their members only as part-of rows (`model.members`, `memberIds`, `groupsOf`, `join`, `leave`, `setOrder`, `replaceIn` read and write them); a fold stands for the thoughts it folded (they stay, shown nowhere, and go with it); arrows are relation rows under their `store`. `lib.model.reading(w, fn)` and `changed()` remain as no-ops for older callers. |
| `lib.gaps` | The gaps table (`gaps.js`, `w.gaps`): what a mark was made to close. One row per mark at most, `gap:<mark>` (Law 5), with a `direction` (`to world`: check, `from world`: do, `to maker`: judge), a `state` (open or resolved), `openedAt`, and once resolved `resolvedAt` and `resolvedBy` (a link id, or `judgement`). `open`, `resolve`, `reopen` write it (a locked context is the caller's check); `get`, `isOpen`, `opened(context?)`, `oldest(context?)` read the stored rows. A mark whose parts carry gaps (what is *part of* it, or in a *relation* up to it, however deep) reads a DERIVED gap, never stored: `of(w, mark)` gives `{ …, derived: true, open, resolved, of }`, open while any part's is open; `progress(w, mark)` the tally; a derived mark's own row lends its direction and counts for nothing above it. Tallies are a memo over the whole world, dropped when the gaps or links change (`touched` after a write behind its back; a 1,500-thought room reads in a few ms). Removing a mark removes its gap (`model.remove`); a copied room copies its gaps (`tests/gaps.test.js`). |
| `lib.places` | The places table (`places.js`, `w.places`): where every thought is, read off an index by mark and by context. Each thought has one home row: an item's and a group's room, a room's floor (`floor:<n>`, a mark of kind context), the Archive (`archive`, likewise) or a Twin. No thought keeps `parent`, `page` or `archived`: read them with `model.parentOf` (the room a thought is in, null for a room on a floor), `contextOf`, `floorOf`, `archivedAt`, `isArchived`; move them with `move`, `toPage`, `archive`, `restore`; floors come and go with `addPage`, `dropPage` (the last, when empty). Removing a place never removes a thought (Law 2: `tests/places.test.js`). Where a rule puts a thing is a rule row (`spot`, `putSpot`, `dropSpot`, `spots`): `model.cellOf`/`setCell` (a room's cell), `sideOf` (a Twin's side), `spotOf`/`setSpot`/`unsetSpot`/`isLooseGroup` (a group under its own rule), `offsetOf`/`setOffset` (a train's thought dragged off its line); `groups.spot`/`putAt`/`unput`/`spotsOf` for Pessoa, Proust and other modes' groups. No thought keeps `x`, `y`, `col`, `row`, `side`, `dx`, `dy`, `hand` or `loose`, and no rule keeps positions in `own()`. |
| `load()` | Reads the world again from storage (it may have come from the account meanwhile). |
| `begin()` | A fresh undo history. |
| `save()` | After a change: a change to the thoughts or rooms (not just a view) is a step Ctrl+Z can take back, and its rows land in the moments log (`world:moments`). Written down soon, then `world:saved` is sent. True when it was a step. |
| `settled()`, `fold()` | Nothing waits to become its own step; the change since the last step becomes part of it (so a push from clear space goes with what caused it). |
| `writeSoon(say)`, `write()` | Written down in a moment (one timer; `say`: then `world:saved`), or now. |
| `undo(back)` | A step back (`true`) or forward (`false`), read off the moments log (it reaches 30 days back, across reloads). False when there is none; otherwise sends `world:changed` and `world:moments`. |
| `ontologies`, `ontology(id)` | Every ontology a room can be seen through, in order, and one by id (a missing one is Pessoa). The rooms page's own is never among them. |
| `roomsPage` | The rooms page's own ontology (Borges, from the floors feature), or `null`: rooms on the floors' cells. |
| `prefs`, `setLook(key, value)`, `resetLook()` | Settings → Rooms' look (`look.js`: `LOOK`), saved as 'look'. |
| `globals`, `setGlobal(of, key, value)`, `resetGlobals()` | The global ontology settings, `{ [ontology]: { key: value } }`: what a new room starts with. Saved as 'ontologies'. |
| `palette`, `refreshPalette()` | The app's colours (Renderer's `backdrop`, Settings → Colour), or `look.js`'s `PALETTE`. |
| `attention`, `visit(roomId)` | The attention log `{ [roomId]: [times] }`, read off the moments log's visits (`attention.js` says how it lights a room), and going into a room (a *visited* moment). |
| `moments` | The moments log read (`moments.js`): `log`, `of(mark)`, `changed(mark)`, `since(time)`, `day(date)`, `changedOn(date)`, `at(time)` (the things, relations and floor count as they were then), `first()`, `keep`, `setKeep(days)`; for a carrier, `outbox(seq)` (the rows since a seq, as another copy can take them) and `absorb(rows)` (rows from another copy, the latest word on a thing winning). Saved as 'moments'; every change to the world is a row in it (Law 6 of `../KERNEL.md`), and it is compacted on start. |

**Events:** `world:saved` (the world was written down after a `save()`), `world:changed`
(`{ undone }`, after `undo()`), `world:moments` (`{ rows, undone }`: rows landed in the log), `world:palette` (the app's colours changed), `world:look`
(Settings → Rooms' look changed).

**Slots:** `world.ontologies`, for a whole ontology from another feature (shape in
`ontologies/index.js`), and `world.items`, for a kind of item from a plugin (shape in
`items/index.js`). `world:kinds` is sent when a kind comes or goes, and `world:modes` when a mode
does (a plugin switched on or off).

A feature can't import this folder's files (Folio's rule), so a feature that uses many of the
rules binds them once from `lib` into a file of its own that lists what it needs (the room's
`world.js`).

## The world

**Everything is a thought.** `model.js` has three sorts: *items* (line, passage, picture built in,
each one small file in `items/`; a plugin adds more through `world.items`, and a thought of a kind
whose plugin is switched off is kept exactly as it is, shown as a quiet stand-in: `items/missing.js`), *groups*
and *rooms*. Items and groups sit in a room. A group belongs to the ontology that made it (Joyce
makes trains) and lists what it holds: items, and other groups (a train of trains; never itself
or a group holding it). One item can be in groups of several ontologies. `itemsIn` gives every item
inside a group however deep, `within` everything inside it, `holds` whether it holds a thing. Each
ontology says whether an item can be in **one** of its groups (a train) or in **many**. Every
group can be closed, named, moved and deleted, and is always the same group, never a copy.

**Ontologies** built into the core are in `ontologies/`, one file each (Joyce: trains, the way thoughts
are written in order; Pessoa: each thought on its own, the view a room falls back to). Every other
mode is a plugin (Russell, Proust) and comes
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
box from its own key (`edit`: Proust's Ctrl+J), take an arrow away (`remove`: one undo step, as the edit
box's Remove and Delete and a pop-up row's × do), keep its relations in
its own setting (`setting`), and leave its first relation unnamed beside its links (`quiet`). Its
look is the room's `.room-arrow-*` classes.

**Relations and their ends** (`relations.js`): `arrowsOf` may keep an ontology's arrows apart from
its other data (`store`: Proust keeps its places under its id, its links under `proust-links`),
read its relations from its own setting (`setting`, with its own default) and say why an arrow is
refused in its words (`words`). In a room's list a relation may end with a mark for its ends:
`leads to ->` (an arrow), `is equivalent to <->` (both ways), `related to --` (a plain line).
`cleanRelations` gives the names without their marks, `cleanRelationList` the tidy list with them,
`relationEnds` each name's ends. After its ends an entry may carry its **look** after a `|`: its
line (`solid`, `dashed`, `dotted`) and colour (`ink`, `amber`, `rust`, `moss`, `slate`, `plum`):
`calls up -> | dashed amber` (`relationEntry`, `entryText`, `relationLooks`; so no name holds a `|`).
The colours and dashes are Folio's base.css (`.rel-line-*`, `.rel-colour-*`); `arrowview.js` draws
each line in its relation's look, and a legend over the web when the room's ⚙ *Legend on the
canvas* is on. `arrowsOf` also gives `uses` (how many arrows have a relation) and `retag` (move them
to another); a list put in another order renames nothing.

**The relations editor** (`ontologies/relationsview.js`, `lib.relationsview`) is the screen half
for a room's list: a setting of type `'relations'` shows in the room's ⚙ as a row for each relation
(its name, renamed where it is; its ends when the setting says `ends: true`; its line; its colour as
swatches), a row at the foot to add one, drag or Alt+↑/↓ to reorder (the first is what a new link
gets), and × to delete, asking what its links become when it has any (the setting's `uses` and
`retag`). Keyboard first: ↑/↓ between rows, Enter writes in the name, Delete deletes. Russell and
Proust both use it. Its layout is the room's `.room-rel-*` classes.

**Groups are shared objects** (`groups.js`, `lib.groups`): every other ontology of the room sees
a group as one thought, in its tray until it places it (`foreign`, `trayForeign`, `placedForeign`;
Joyce and Pessoa keep where they placed one in their own data, `spot` / `putAt`). Only the
outermost groups show this way: a train of trains is one Train. A group made from thoughts in an
ontology's tray is `loose` and stays in the tray until dragged out (`place`).

**Moving to another room** (`groups.js`: `moveLoose`, for Move to… and Ctrl+M) puts the thing in
that room's loose tray in every mode: a thought gets no train, a group waits in its own mode's
tray (loose), and every thought it carries waits in Pessoa's and Proust's trays until dragged out.
A Twin's drag across its sides (`twin.js`) still places it where it is dropped.

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

