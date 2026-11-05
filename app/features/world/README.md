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
| `lib` | The rules, by module (`lib.js`): `model`, `items`, `maths`, `look`, `attention`, `picture`, `ontologies`, `joyce`, `pessoa`, `russell`. Plain functions of a world; none touches the screen. |
| `world` | The world itself (`model.js` says its shape). Change it with `lib.model`, then `save()`. |
| `load()` | Reads the world again from storage (it may have come from the account meanwhile). |
| `begin()` | A fresh undo history. |
| `save()` | After a change: a change to the thoughts or rooms (not just a view) is a step Ctrl+Z can take back. Written down soon, then `world:saved` is sent. True when it was a step. |
| `settled()`, `fold()` | Nothing waits to become its own step; the change since the last step becomes part of it (so a push from clear space goes with what caused it). |
| `writeSoon(say)`, `write()` | Written down in a moment (one timer; `say`: then `world:saved`), or now. |
| `undo(back)` | A step back (`true`) or forward (`false`). False when there is none; otherwise sends `world:changed`. |
| `ontologies`, `ontology(id)` | Every ontology there is, in order, and one by id (a missing one is Pessoa). |
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
through the slot `world.ontologies`. `ontologies/index.js` describes their shape: name, groups,
units, where each sits, what a drag does, and optional tray, settings, moves (shown in the pop-up
of what is chosen), its own presses and pop-up rows, and `begin` (which group a new thought joins,
or none, so it waits in the tray). Each keeps its own data per room (`own()` in model.js: Pessoa's
dragged places, Russell's arrows and their labels). An ontology can draw its own
canvas (Joyce's line and trains) and tag thoughts in the Timeline (Joyce: their train; Russell: their chapter); the room keeps
no mode of its own. A room whose ontology is missing is seen through Pessoa.

**Grouping what is chosen** (Ctrl+G, Ctrl+Shift+G in a room) is each ontology's own rule:
`ontologies/index.js`'s `groupChosen` and `ungroupChosen` use an ontology's `group` / `ungroup`
when it has them, or else make one group of its own where the first thing is (and take things
out of their groups). Joyce's `ungroup` gives each thought a train of its own; Pessoa has no groups.

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

