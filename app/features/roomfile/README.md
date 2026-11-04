# Room files

A room in and out as one plain Markdown file ("room Markdown"). Create says where (a cell and
floor, a room, a spot in it) and puts the choices in its menus; this feature reads the file, shows
the card, changes the world and downloads. The world itself is the world feature's.

## The roomfile service

`this.use('roomfile')` gives everything it offers:

| Member | What it does |
|---|---|
| `isRoomFile(file)` | Whether a dropped file is room Markdown (`.md`, `.markdown`, `.txt`). |
| `importRoom({ file, cell, page, cols, ok })` | A new room from `file` (picked, if none) in `cell` (or the first free one) of floor `page`. `ok()` says whether it is still wanted, before the card and on Import. Resolves with the new room once it is in the world, or `null`. The caller saves. |
| `importInto(roomId, { file, at, ok, before })` | The file's groups and thoughts into a room (not a locked one). `at()` is where new trains start; `before()` runs just before the world changes. Resolves `true` once they are in, else `false`. The caller saves. |
| `exportRoom(id)` | Downloads the room as `<its name>.md` (a locked room too). |
| `cancel()` | Closes the card, if it shows. |

It sends no events and has no slots.

## What it does


A room can come in and go out as one plain Markdown file ("room Markdown"), so its contents can be
written somewhere else (by hand, or by Claude) and brought in in one step.

- **In.** On the rooms page: *Import a room…* in an empty cell's choices (the room goes in that
  cell) or in the menu, or drop a `.md` file on the page (the first free cell). Inside a room:
  *Import into this room…* in Add, or drop a file on the canvas; the file's groups and thoughts
  join the room as its own mode sees them, and its front matter is not used. First a quiet card
  says what will arrive ("12 groups, 85 thoughts, 2 pictures") and anything that couldn't be
  read; *Import* (Enter) or *Cancel* (Escape). The whole import is one step: one Ctrl+Z takes it
  back. A locked room can't be imported into.
- **Out.** *Export as Markdown* in a room's properties on the rooms page, or in Add inside it,
  downloads `<room name>.md` (a locked room too). A big room writes the groups of the mode it
  shows. Taking a room out and bringing it back gives the same thoughts, groups, order, folds,
  attributes and room settings.

The format, to hand to whoever writes the file:

```
---
room: Linear algebra
kind: russell
description: A book where each chapter abstracts the last
tags: [maths, book]
tint: "#7a5c3e"
russell.overlap: false
---
- a thought in no group (Pessoa places it; another mode keeps it in its tray)

## Arrays
> folded
- a line thought
  an indented line under it stays in the same thought
### Why arrays
A passage: this title and the paragraphs under it, with $x_i$ and

$$\sum_i x_i$$

until the next thing.
###
A passage with no title.
![A caption](data:image/jpeg;base64,...)

## Matrices {parent="Arrays" forgets="the individual equations"}
\- a paragraph that starts with a dash, kept as words
##
- a thought in a group with no title
```

- **Front matter** (optional, between `---` lines): `room` (its name), `kind` (its mode: `joyce`,
  `pessoa`, `russell`, or any mode there is), `description`, `tags`, its colour (`tint`, `light`,
  `opacity`) and its settings for each mode as `mode.key`. Where it sits, its size, page and lock
  stay out. Values with odd characters go in "quotes".
- **`## Heading`** starts a group: a Joyce train, a Russell chapter (in a Pessoa room, a Joyce
  train). Everything until the next `##` is in it, in order. A bare `##` is a group with no title.
  `> folded` right under it folds it; `> folded: A title` also names a bare heading. A heading
  with nothing under it is left out and reported.
- **`- words`** is a line thought; indented lines under it stay in it. **`### Title`** and the
  paragraphs under it (blank lines between them) are a passage; a bare `###` has no title, and a
  paragraph with no `###` above it is a passage of its own. **`![caption](address)`** is a
  picture: a `data:image/…` address always works; an `https://` one is fetched if the other site
  allows it (many don't), and otherwise arrives as a line saying it couldn't be fetched. Pictures
  are shrunk as pasted ones are.
- **Everything else** is kept exactly as written, LaTeX included: `$…$`, and `$$…$$` blocks over
  several lines. A line inside a passage that would read as structure (`## …`, `- …`, `> folded`,
  `![…`) is written with a backslash in front and read back without it.
- **Order.** The thoughts are stamped in the file's order, a millisecond apart, so trains and the
  Timeline read in the file's order. Where things sit is left to the mode: new trains start side
  by side in clear space, Pessoa places loose thoughts on its spiral, Russell lays out its tree.
- **Attributes** go in braces at the end of a heading, `key="value"`, with `\"` for a quote.
  Russell reads `parent="…"` (a chapter, by its heading) each followed by an optional
  `forgets="…"` (the arrow's label); a junction has two. Arrows are drawn after every chapter
  exists, through Russell's own rules (at most two parents, no loops), so what it refuses (a
  loop, a third parent, an unknown or twice-used heading) is reported and the rest still arrive.
  Importing into a room, a parent can also be a chapter already there. Any other attribute (and
  in Joyce and Pessoa, every one) is kept with the group and written back out.

`roomfile.js` reads and writes the format with no screen (`parse`, `importRoom`, `importInto`,
`exportRoom`, tested in `tests/roomfile.test.js`); each kind of item says how it reads and writes
itself next to its `tidy()` and `text()` (`md` in the world feature's `items/`). `Roomfile.js` is
the screen side: the card, fetching pictures, downloading files. `world.js` lists the world's
rules it uses.
