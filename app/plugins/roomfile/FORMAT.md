# The .traum format

A `.traum` file is the kernel's six tables written as plain text (UTF-8): the marks of a room (or
of the whole world) and the places, links, readers, gaps and moments that are about them. This is
Law 8 of `app/core/KERNEL.md`, **the file is the tables**: nothing in a file is a mode's private
section, and nothing a mode keeps outside the tables is saved. A file reads and writes with no
plugin switched on, so a thought of a kind whose plugin is off goes out and comes back exactly as
it was.

This file is the spec, for anyone who writes a file by hand or by machine (Claude, a script). The
reader and writer are `app/core/world/traum.js`; the tables are `app/core/world/tables.js`. Every
file Träumerei writes says `format: traum/3` and points here with `guide:`. Files of the older
`room/2` format are no longer read (saved data is disposable: export again).

## At a glance

```traum
---
format: traum/3
context: ^1
---

# Marks

## ^1 room: Linear algebra
mode: russell
tags: [maths, book]
rules: {"russell": {"relations": ["forgets", "is a case of"]}}
material.tint: "#7a5c3e"

## ^2 line
A vector is a list of numbers.

## ^3 passage: Why arrays
A passage keeps its paragraphs, with $x_i$ and

$$\sum_i x_i$$

## ^4 group: Arrays
of: russell

## ^5 line
A matrix is a grid of numbers.

## ^6 group: Matrices
of: russell

# Places
^2 in ^1
^3 in ^1
^4 in ^1
^4 in ^1 | rule: russell | at: {x: 0, y: 0}
^5 in ^1
^6 in ^1

# Links
^2 part of ^4 | order: 0
^3 part of ^4 | order: 1
^5 part of ^6 | order: 0
^4 relation ^6 | rule: russell | label: forgets | note: the individual equations

# Gaps
^5 open to world | opened: 2026-11-08T09:00:00.000Z
```

## The grammar

**Front matter**, between two `---` lines at the top: `format: traum/3` (required), `guide:` (a
link here; optional) and `context: ^id`, the mark the file is about (a room; without it, the first
mark). Any other key is reported and left out.

**Sections** are `# ` headings, one per table: `# Marks`, `# Places`, `# Links`, `# Distance`,
`# Gaps`, `# Moments`, in any order, each optional. Anything else is reported and left out.

**Ids** are written `^` and letters, digits, `_`, `.`, `:` or `-`: `^1`, `^arrays`, `^ch-1`. They
are the file's own: brought in, every mark gets a fresh id of the world's. Träumerei writes short
numbers (`^1` is the context, then in the order the marks were made); editing in the app shows the
world's own ids.

**Values** after `key:` are JSON (`12`, `true`, `"quoted words"`, `[maths, book]` needs quotes:
`["maths", "book"]`; objects may leave their keys bare: `{x: 120, y: 40}`), or else plain words,
read as they are: `label: forgets`. Words that would read as something else (`true`, `12`, words
with ` | ` or a line break) are quoted.

**Times** are ISO 8601 (`2026-11-08T09:00:00.000Z`), or milliseconds since 1970.

## # Marks

```
## ^id kind: its name
key: value
…

Its words, as many lines and paragraphs as it has.
```

A mark is `{ id, body: { kind, content }, material?, at, edited? }` (KERNEL.md). The header gives
its id, its **kind** (lowercase words joined by dashes: `line`, `passage`, `picture`, `group`,
`room`, or any kind a plugin adds) and, after a colon, its name: a room's `name`, anything else's
`title`. The lines right under the header that read `key: value` are its fields (a blank line ends
them); everything after is its **words**, `text` in its content, kept exactly (a line of the words
that starts with `#` or `\` is written with a `\` before it).

| Field | What it is |
|---|---|
| `made:`, `edited:` | when it was made and last written (`at`, `edited`) |
| `material.<key>:` | its own look: a room's `tint` (`"#rrggbb"`), `light`, `opacity` (0 to 1), `size` (`1`, `2` or `"twin"`) |
| `content.<key>:` | a field of its content whose name is not a plain word, or is one of the names above |
| any other `key:` | a field of its content, as the kind keeps it |

What the content of each kind holds is the kind's own; the file carries every field whether or not
its plugin is on. The built-in kinds:

| Kind | Content |
|---|---|
| `line` | `text`: its words (a line break is a new line within the thought) |
| `passage` | `title` (on the header), `text`: a paragraph or a small article; `$…$` and `$$…$$` are mathematics |
| `picture` | `src`: a `data:image/…` address, or `https://…` (fetched when it comes in, if the other site allows it; else it comes in as a line with the address); `text`: its caption |
| `group` | `title` (on the header), `of`: the mode that made it (`joyce` makes trains, `russell` chapters); `closed: true`, `shared: true` |
| `room` | `name` (on the header), `mode`: the mode it is seen through; `desc`, `tags`; `rules`: each mode's settings for this room, `{ "<mode>": { "<key>": value } }` |

## # Places

```
^mark in ^context | rule: <mode> | at: {x: 120, y: 40} | pinned
```

Where a mark sits: `{ mark, context, rule?, position?, pinned? }`. A line with no rule is the mark's
**home**: the room an item or group is in (every mark but the file's context needs one; a mark
with none is put in the context). A line with a rule is where that rule (a mode) puts it there,
`at` its position as the rule keeps it: Pessoa's and Proust's `{x, y, auto?}`, a group under its
own mode `{x, y, hand?}`, a Joyce thought dragged off its train `{dx, dy}`, a Twin's side
`{side}`. **No rule line means the mark is loose under that rule** (Law 2): the mode lays it out
itself or keeps it in its tray.

## # Links

```
^member part of ^group | order: 0
^fold stands for ^mark
^child relation ^parent | rule: russell | label: forgets | note: the arrow's words
```

The only structure there is (Law 4): `{ from, to, kind, order?, rule?, label?, note? }`. *Part of*
puts a mark in a group (`order`: its rank, for a mode that keeps its order as given); a group may
be part of a group. *Stands for* is a fold: the folded marks stay in the file, shown nowhere. A
*relation* is an arrow of a mode's (`rule`), `label` the relation's name (one of the room's
`rules.<mode>.relations`), `note` its words. A link whose ends are not marks of the file is left
out; the mode's own checks (Russell refuses a loop) still hold once it is in.

## # Distance

```
^context for others
```

Who a context is written for: `me now` (the same as no line), `me later`, `others`, `machine`
(Law 7). A room for others is locked: nothing in it can change until it is unlocked by hand.

## # Gaps

```
^mark open from world | opened: 2026-11-08T09:00:00Z
^mark resolved to maker | opened: … | resolved: … | by: judgement
```

What a mark was made to close (Law 5): `open` or `resolved`, with a direction, `to world` (check),
`from world` (do) or `to maker` (judge); `by` is the link that resolved it, or `judgement`. One
line per mark at most. A group's gap is derived from its parts and never written.

## # Moments

```
2026-11-08T09:00:00.000Z made ^mark
```

A mark's history: when it was made, edited, moved, visited. It comes in as history only (it
changes nothing), so a room taken out and brought back remembers when its thoughts were written.

## A file written by hand

The least a file needs is its front matter and its marks; each mark with no home sits in the
context, loose, and every mode lays it out its own way.

```traum
---
format: traum/3
---

# Marks

## ^room room: Things to finish

## ^1 line
Fix the bike

## ^2 line
Call the bank
```

A to-do list: a Joyce train of things to do, each with a gap, one done.

```traum
---
format: traum/3
context: ^room
---

# Marks

## ^room room: This week
mode: joyce

## ^list group: To do
of: joyce

## ^1 line
Fix the bike

## ^2 line
Call the bank

# Places
^1 in ^room
^2 in ^room
^list in ^room

# Links
^1 part of ^list | order: 0
^2 part of ^list | order: 1

# Gaps
^1 open from world | opened: 2026-11-08T09:00:00Z
^2 resolved from world | opened: 2026-11-08T09:00:00Z | resolved: 2026-11-08T12:00:00Z
```

## Writing as a machine (Claude or a script)

- Always write `format: traum/3` and `context:`; write the context's mark first.
- Write every mark once; give each a home line in `# Places`, and a rule line only when you mean a
  position.
- Use the kinds and fields in this file; a field Träumerei doesn't know is kept, but nothing acts
  on it.
- Ids: short numbers or words, unique in the file.
- Check the card before Import: it lists every line that couldn't be read.

## Editing in the app

*Edit room source* (in a room's Add) or *Source* (at the foot of a group's editor) opens the room,
or a group with its parts, as this text in the source editor, with the world's own ids (pictures
show as `picture:1`, and go back to what they were). Apply writes the text back over what it was:
a mark whose id is there is changed in place; a new id is a new mark; a mark taken out is deleted,
with its links, places and gap. A group's text names the room its parts sit in (`^item in
^room`), which it does not hold. Apply is one step: one Ctrl+Z takes it back.

## Plain Markdown

A plain `.md` file needs none of this: it comes in as loose thoughts (a list item or a one-line
paragraph is a line, a heading and its paragraph a passage, `![caption](address)` a picture).

## Adding a kind of thought or a mode

Nothing here changes: a kind's content is its own fields, a mode's positions are its rule lines in
`# Places`, its settings `rules.<mode>` on the room, its arrows relation links with `rule:` its id.
A plugin that keeps something no row can say does not have it saved (Law 8). The check
`node app/plugins/roomfile/tests/guide.mjs` (every pull request runs it) reads every ```` ```traum ````
example here and lands it with no plugin on.
