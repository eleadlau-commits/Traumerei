# Room files

A room in and out as one plain Markdown file ("room Markdown"). The rooms page and the room say
where (a cell and floor, a room, a spot in it) and put the choices in their menus; this feature reads the file, shows
the card, changes the world and downloads. The world itself is the world feature's.

## The roomfile service

`this.use('roomfile')` gives everything it offers:

| Member | What it does |
|---|---|
| `isRoomFile(file)` | Whether a dropped file is room Markdown (`.md`, `.markdown`, `.txt`). |
| `importRoom({ file, cell, page, ok })` | A new room from `file` (picked, if none) on floor `page`, placed by the floors feature: in `cell` if it is free, else that floor's first free one, else a new floor (the room's `page` says which). `ok()` says whether it is still wanted, before the card and on Import. Resolves with the new room once it is in the world, or `null`. The caller saves. |
| `importInto(roomId, { file, at, ok, before })` | The file's groups and thoughts into a room (not a locked one). `at()` is where new trains start; `before()` runs just before the world changes. Resolves `true` once they are in, else `false`. The caller saves. |
| `exportRoom(id)` | Downloads the room as `<its name>.md` (a locked room too). |
| `canEdit` | Whether editing as Markdown is there (it needs the source editor feature). |
| `editGroup(roomId, groupId, { before, ok })` | The group as room Markdown in the source editor (read only in a locked room). `before()` runs just before Apply changes the world; `ok()` says whether it is still wanted. Resolves `true` once Apply has changed the world, else `false` when it closes. The caller saves (one step). |
| `editRoom(roomId, { before, ok })` | The same for the whole room. |
| `cancel()` | Closes the card, if it shows. |

It uses the `source` service (the source editor) when it is there. It sends no events and has
no slots.

## What it does


A room can come in and go out as one plain Markdown file ("room Markdown"), so its contents can be
written somewhere else (by hand, or by Claude) and brought in in one step.

- **In.** On the rooms page: *Import a room…* in an empty cell's choices (the room goes in that
  cell) or in the menu, or drop a `.md` file on the page (the floor's first free cell, else a new floor). Inside a room:
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
> closed
- a line thought
  an indented line under it stays in the same thought
### Why arrays
A passage: this title and the paragraphs under it, with $x_i$ and

$$\sum_i x_i$$

until the next thing.
###
A passage with no title.
![A caption](data:image/jpeg;base64,...)

## Matrices
> forgets [[Arrays]]: the individual equations
> ⊂ [[Vectors]]
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
  `> closed` right under it closes it (`> folded` is read the same); `> closed: A title` also names a bare heading. A heading
  with nothing under it is left out and reported.
- **Russell's arrows** are lines right under a chapter's heading (before or after `> closed`), one
  per arrow into it: `> relation [[Parent]]: label`. The relation is any words or signs
  (`forgets`, `is a case of`, `⊂`) or nothing (`> [[Parent]]` is an unnamed arrow); the parent is
  a chapter's heading; `: label` is optional, with maths if it has any. A chapter has as many as
  it needs. Arrows are drawn after every chapter exists, through Russell's own rules (no loops),
  so what it refuses (a loop, an unknown or twice-used heading) is reported and the rest still
  arrive. Importing into a room, a parent can also be a chapter already there. The room's list
  of relations is `russell.relations: [forgets, "less, or equal", ⊂]` in the front matter (a
  name with a comma in quotes). Older files' `{parent="…"}` is no longer read: it is reported
  with the line to write instead.
- **`- words`** is a line thought; indented lines under it stay in it. **`### Title`** and the
  paragraphs under it (blank lines between them) are a passage; a bare `###` has no title, and a
  paragraph with no `###` above it is a passage of its own. **`![caption](address)`** is a
  picture: a `data:image/…` address always works; an `https://` one is fetched if the other site
  allows it (many don't), and otherwise arrives as a line saying it couldn't be fetched. Pictures
  are shrunk as pasted ones are.
- **Everything else** is kept exactly as written, LaTeX included: `$…$`, and `$$…$$` blocks over
  several lines. A line inside a passage that would read as structure (`## …`, `- …`, `> closed`,
  `> … [[…]]`, `![…`) is written with a backslash in front and read back without it.
- **Order.** The thoughts are stamped in the file's order, a millisecond apart, so trains and the
  Timeline read in the file's order. Where things sit is left to the mode: new trains start side
  by side in clear space, Pessoa places loose thoughts on its spiral, Russell lays out its tree.
- **Attributes** go in braces at the end of a heading, `key="value"`, with `\"` for a quote.
  Each is kept with the group and written back out.

## Editing as Markdown

A chapter (or a train, or any group) can be taken out as room Markdown, changed, and put straight
back, so it can be handed to Claude and Claude's rewrite pasted in without making a second copy.
*Edit as Markdown* in a group's pop-up, or *Edit room as Markdown* in a room's Add, opens it in the
source editor, in the panel on the right: the text exactly as Export would write it, with a line
above it on what the text holds and what Apply would change, checked as you type (see the source
feature's README for its words). Pictures show as short references (`![A caption](picture:3)`) that
read back as the same pictures; Download writes them out in full.

**Apply, for one group,** replaces it in place: it keeps its id, its place, its fold, its children
and every arrow from it. Thoughts whose words are unchanged are kept as they are (their time and
glow, and any other mode's groups they are in); new and changed ones are made, in the text's order,
and the ones gone are deleted (one another mode's group holds only leaves this one). The heading
wins: a new title renames it, `> closed` closes or opens it, its other attributes are kept as
written, and Russell's `parent` and `forgets` move its arrows through Russell's own rules. Each
change is listed before Apply ("A1 Vector spaces: parent Ch 2 Matrices → Ch 1 Arrays"); an arrow
Russell refuses (a loop, a third parent) is listed and left as it was, and the rest applies. More
`##` headings are added as new groups, and thoughts above the first one as loose ones, and the
editor says so first. Text with no `##` at all is the group's thoughts, its heading left alone. A
heading with nothing under it leaves the group as it is.

**Apply, for the whole room,** matches each `##` to a group of the room's mode by its title
(trimmed, any case; untitled ones in order). Matched groups are replaced as above, new headings are
added, and groups not in the text are listed and left alone unless *Remove groups not in the text*
is ticked. A heading that matches two groups is reported and added as new. The loose thoughts are
replaced like a group's, and changes to the front matter (name, description, tags, colour, mode
settings) are listed and made; the mode itself doesn't change here, and Ctrl+Z doesn't take mode
settings back.

**Importing into a room** uses the same replace: when a heading in the file matches a group
already there, the card offers *Replace matching groups* or *Add all as new* (or Cancel).

Apply is one step: one Ctrl+Z takes all of it back. A locked room opens read only (Copy and
Download).

`format.js` reads and writes the format with no screen (`parse`, `importRoom`, `importInto`,
`exportRoom`, and for editing `exportGroup`, `plan` and `apply`, tested in `tests/roomfile.test.js`); each kind of item says how it reads and writes
itself next to its `tidy()` and `text()` (`md` in the world feature's `items/`). `Roomfile.js` is
the screen side: the card, fetching pictures, downloading files, and what it hands the source editor. `world.js` lists the world's
rules it uses.
