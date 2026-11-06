# The .traum format

A `.traum` file is one Träumerei room as plain text (UTF-8): everything in the room, written once,
and then where each thing sits in each of the room's ontologies (modes). This file is the spec.
It is for anyone who writes a room file, a person by hand or a machine (Claude, a script), and for
anyone who adds an ontology or a kind of thought to Träumerei.

Every file Träumerei writes says `format: room/2` and points here with `guide:`.

## At a glance

A Russell room with one Joyce train also in it (a big room, so it has both modes):

```
---
format: room/2
guide: https://github.com/eleadlau-commits/traumerei/blob/main/app/features/roomfile/FORMAT.md
room: Linear algebra
modes: [russell, joyce]
description: A book where each chapter abstracts the last
tags: [maths, book]
tint: "#7a5c3e"
russell.relations: [forgets, "is a case of", ⊂]
---

# Objects

## ^1 line
A vector is a list of numbers.

## ^2 passage: Why arrays
A passage keeps its paragraphs, with $x_i$ and

$$\sum_i x_i$$

## ^3 picture: A grid
data:image/jpeg;base64,/9j/4AAQ...

## ^4 group: Arrays
made in: russell
holds: ^1 ^2 ^3
closed
shared

## ^5 line
A matrix is a grid of numbers.

## ^6 group: Matrices
made in: russell
holds: ^5

## ^7 group: Reading order
made in: joyce
holds: ^1 ^5

# In russell
on canvas: ^4 ^6
arrow: ^4 -> ^6 | forgets | the individual equations

# In joyce
at: ^7 120 40
tray: ^4 ^6
```

The file has three parts: the **front matter**, the **`# Objects`** list, and one **`# In <mode>`
section** per ontology. Only `# Objects` is needed.

## A minimal file

Five loose thoughts and nothing else. This is a whole, valid file:

```
# Objects

## ^1 line: The first thought
## ^2 line: The second thought
## ^3 line
A third, written under its header,
over two lines.
## ^4 passage: A title
And the paragraph under it.
## ^5 line: The last thought
```

It becomes a Joyce room named after the file, with the five thoughts in its tray.

## The grammar

### Lines

- The file is read line by line. Line endings may be `\n` or `\r\n`.
- `# Objects`, `# In <mode>`, `# Left: <mode>`, `# Right: <mode>`: a **section** header (one `#`,
  a space, its name). Any other `# Name` is a section Träumerei doesn't know: it is reported and
  kept.
- `## ^id kind` or `## ^id kind: title`: an **object** header, inside `# Objects` (or before any
  section). Everything up to the next header is that object's body.
- `key: value value …` or a bare `key`: a **key line**. This one shape is used everywhere outside
  an item's body: in the front matter, in groups and relations, and in every mode's section. A key
  is one to four words (`made in`, `on canvas`); a bare key is one word and is a flag (`closed`).
- Blank lines between things don't matter.

### Front matter

Optional, between `---` lines at the very top. Values with odd characters (a leading `#`, a comma
in a list item, leading or trailing spaces) go in `"quotes"`; lists go in `[ ]`.

| Key | Meaning |
|---|---|
| `format` | Always `room/2`. |
| `guide` | A link to this file. |
| `room` | The room's name. Without it, the file's name. |
| `modes` | The ontologies the room is seen through, its own first: `[joyce]`. One mode makes a small room; more than one makes a big room, which holds every ontology. |
| `twin` | Instead of `modes`, for a Twin (two rooms side by side): `[left, right]`, e.g. `[joyce, russell]`. |
| `description` | A line or two about the room. |
| `tags` | Words the rooms page sorts it by: `[maths, book]`. |
| `tint`, `light`, `opacity` | Its colour: `"#7a5c3e"`, and two numbers from 0 to 1. |
| `<mode>.<key>` | One of the room's settings for a mode: `russell.relations: [forgets, ⊂]`, `joyce.tension: 0.4`. |
| `left.<mode>.<key>`, `right.<mode>.<key>` | A Twin side's settings. |

Any other key is reported, kept, and written back out.

### Objects

```
## ^id kind: title
body
```

- **The id** is any word after `^` (no spaces): `^7`, `^arrays`, `^ch-2`. It only has to be
  unique in the file. Träumerei writes short numbers; a person may write names.
- **The kind** says what the object is (below). Kinds are open: an object of a kind Träumerei
  doesn't know (`region`, `pdf-page` before it exists) is reported, kept exactly as written, and
  written back out.
- **The title** is everything after the colon, on one line.
- **The body** is the lines under the header. For a thought it is its words, kept exactly as
  written, LaTeX included; for a group or a relation it is key lines.
- **Order.** Objects are listed in the order they were written: that order is the Timeline. Each
  group comes after everything it holds. A reader may also meet a reference to an object further
  down; it is found all the same.
- **Escaping.** A body line that starts with `## ^` or `# ` is written with a backslash in front
  (`\# Not a section`) and read back without it. A line that already starts with a backslash
  before one of those gets one more.

### Values

The values after `key:` are typed:

| Value | Example | Meaning |
|---|---|---|
| reference | `^a` | an object |
| occurrence | `^a#2` | the second time an object appears (for modes that place one thing more than once) |
| span | `^a@"the cruellest month"` | some words inside an object |
| number | `120`, `-3.5` | |
| date | `2026-11-05`, `2026-11-05T14:30` | |
| text | `"quoted text"` | `\"` is a quote, `\\` a backslash |
| list | `[a, "b, c", 3]` | |
| sign | `->`, `\|` | used by `arrow:` |
| word | `hand`, `auto` | anything else, up to a space |

A mode uses what it needs; a mode that doesn't use occurrences or spans reads `^a#2` as `^a` and
says so.

### Sections

Each ontology of the room has one `# In <mode>` section (a Twin: `# Left: <mode>` and
`# Right: <mode>`). It says where objects sit in that mode, and nothing else. Its lines are key
lines; which keys a mode reads is in its part below.

- **Missing lines are fine.** An object with no line in a mode sits where that mode puts new things
  (its tray, its spiral, its own layout). So a file may have no sections at all.
- **The mode keeps its own rules.** Russell refuses a loop and reports it; the rest still arrives.
- **Exact positions.** Träumerei writes every position it has, so a room taken out and brought back
  is the same. Positions are never needed on the way in.
- **Repeated placement** (the same object placed twice) is allowed where a mode supports it; one
  that doesn't reports the second line.
- **Unknown lines and sections** are reported and kept, and written back into the same section next
  time. A section for a mode the room doesn't have is kept too.

### What isn't understood

Nothing is dropped silently. Anything Träumerei doesn't understand (a front matter key, a kind, a
group's key, a mode's line, a section) is listed in the card before Import, kept with the room, and
written back out on the next export, so a file passes through an older Träumerei without loss.
(References inside kept parts are written as they were; if the room changes meanwhile, they may
point at the wrong thing.)

## Kinds of object

Each kind of thought reads and writes its own body (the `traum` member in
`app/features/world/items/`).

### Kind: line

A passing thought. Its words are the body; a title on the header is read as its first line, so a
one-line thought can be written on one line.

```
## ^1 line
A vector is a list of numbers.

## ^2 line: A vector is a list of numbers.
```

### Kind: passage

A title and a body (paragraphs, display maths, blank lines inside it).

```
## ^2 passage: Why arrays
A passage keeps its paragraphs, with $x_i$ and

$$\sum_i x_i$$
```

### Kind: picture

The caption is the title; the body is its address on one line: a `data:image/…` URL (always
works), or an `https://` address, which Träumerei fetches when the other site allows it (many
don't; then it arrives as a line saying so). Pictures are shrunk as pasted ones are. In the source
editor a picture shows as a short reference, `picture:3`, that reads back as the same picture.

```
## ^3 picture: A grid
data:image/jpeg;base64,/9j/4AAQ...
```

### Kind: group

Thoughts held together by an ontology: a Joyce train, a Russell chapter. Its title is the header's;
its body is key lines:

| Line | Meaning |
|---|---|
| `made in: <mode>` | The ontology that made it, so it shows as a train or a chapter. Without it, the room's first mode that makes groups. |
| `holds: ^a ^b` | What it holds, in order: thoughts, and other groups (a group of groups; nesting has no limit). Where its mode keeps an order (Russell), this is it; where its mode reads by time (Joyce), the thoughts are in the order they were written, and a group it holds sits where `holds:` puts it among them. |
| `closed` | It shows as one thought (its title). |
| `shared` | Made on purpose (Ctrl+G): every other mode of the room sees it as one object, and its thoughts are not loose there as well. |

One thought can sit in several groups of different modes; nothing is copied, since groups point at
ids. A mode that holds a thought in only one of its groups (Joyce) keeps it in the last. A group
that holds nothing is left out. A folded thought is just one new thought: folds need nothing.

```
## ^4 group: Arrays
made in: russell
holds: ^1 ^2 ^3
closed
```

### Kind: relation

A relation between objects, as an object of its own (so it can be named, labelled, grouped or
pointed at). The title is the relation's name.

| Line | Meaning |
|---|---|
| `from: ^a` | Where it starts. |
| `to: ^b` | Where it ends. |
| `label: "…"` | A short label. |
| `made in: <mode>` | The mode it belongs to; without it, the room's first mode with groups. |
| `ends: arrow` | Its ends, where the mode draws ends (Proust): `none`, `arrow` or `both` (or `--`, `->`, `<->`). |

A relation with one `from:` and one `to:` is an arrow in that mode, the same as an `arrow:` line.
One joining more (`from: ^a ^b` and `to: ^c`: "A and B, therefore C") is kept as written until a mode
reads it.

```
## ^r relation: is a case of
from: ^arrays
to: ^matrices
label: "the square ones"
```

## Ontologies

Each ontology reads and writes its own section (the `traum` member in
`app/features/world/ontologies/`).

### Ontology: joyce

Thoughts joined by time into trains. Its section is `# In joyce`.

| Line | Meaning |
|---|---|
| `at: ^t x y` | A train starts at x, y (`hand` after it: placed by hand). Also another mode's group placed in Joyce, or a thought in no train, which then starts a train of its own there. |
| `offset: ^a dx dy` | A thought dragged within its train, this far from where the train would put it. |
| `tray: ^a ^b` | Waiting in the tray. A train named here was made in the tray; thoughts in no train and other modes' groups not placed wait there anyway. |

A train with no `at:` starts beside the others, in rows of four, below what is there. Joyce places a
thing once.

### Ontology: pessoa

Every thought on its own, on a spiral, staying where it is dragged. Pessoa makes no groups. Its
section is `# In pessoa`.

| Line | Meaning |
|---|---|
| `at: ^a x y` | Placed at x, y (`auto` after it: pushed there to keep clear, not dragged). Another mode's group is on Pessoa's canvas only with an `at:`. |
| `on canvas: ^a ^b` | On the spiral, where Pessoa lays it (the same as no line). |
| `tray: ^g ^n` | Another mode's group not placed yet (the same as no line), or a thought added away from the canvas (the tray's box), waiting there until it is dragged out. |

### Ontology: russell

Chapters joined into a tree by arrows, each an abstraction of the one above it. Its section is
`# In russell`.

| Line | Meaning |
|---|---|
| `on canvas: ^a ^b` | Chapters in the tree, laid out by Russell. |
| `at: ^c x y` | A chapter placed by hand at x, y; its children still hang under it. |
| `tray: ^d` | Waiting in the tray. A chapter named here was made in the tray; thoughts in no chapter wait there anyway. |
| `arrow: ^from -> ^to \| relation \| label` | An arrow from a parent chapter to a child. The relation (`forgets`, `is a case of`, `⊂`, or nothing) and the label may be left out or empty: `arrow: ^a -> ^b`, `arrow: ^a -> ^b \| \| a label`. Either may be in quotes. |

A chapter has any number of parents. A loop is refused and reported, and the other arrows are
still drawn. The room's list of relations is the setting `russell.relations`. The `arrow:` line
belongs to the shared arrows part (`relations.js`); Proust reads it too.

**A relation's look.** In the list, a relation may end with its look after a `|`: its line
(`solid`, `dashed` or `dotted`) and its colour (`ink`, `amber`, `rust`, `moss`, `slate` or `plum`),
in either order: `russell.relations: [forgets | rust, is a case of | dashed slate]`. Solid ink is
the plain look and is left out. Proust's relations take a look the same way, after their ends:
`calls up -> | dashed amber`. A word Träumerei doesn't know there is left out. That is why a
relation's name can't hold a `|`.

### Ontology: proust

Every thought free on the canvas, joined by named links that may run in loops, and gathered into
clusters (its groups, `made in: proust`). Its section is `# In proust`.

| Line | Meaning |
|---|---|
| `at: ^a x y` | A thought placed at x, y (`auto` after it: pushed there to keep clear, not dragged). Also another mode's group placed in Proust, or a cluster moved whole so its corner is there. |
| `on canvas: ^a ^b` | Thoughts on the spiral, where Proust lays them (the same as no line). A cluster named here comes out of the tray. |
| `tray: ^g ^n` | A cluster waiting in the tray, another mode's group not placed yet (the same as no line), or a thought added away from the canvas (the tray's box), waiting there until it is dragged out. |
| `link: ^a -> ^b \| relation \| label` | A link. Between its ends: `--` a plain line, `->` an arrow, `<->` an arrow both ways. Relation and label are written as in an `arrow:` line, and may be left out. |
| `arrow: ^a -> ^b \| relation \| label` | Russell's line, read as a link with an arrow. |

Links join any two things on the canvas: thoughts, clusters, other modes' groups. Loops are fine;
two things have at most one link each way; a link from a thing to itself is refused and reported.

**Each relation has its own ends**, kept in the room's list of relations, the setting
`proust.relations`: a relation's name, then its mark (`leads to ->`, `is equivalent to <->`; no mark,
or `--`, is a plain line). Without the setting a room has `[related to, "leads to ->", "is equivalent
to <->"]`. A `link:` line writes its relation's ends too, so the file reads on its own: a relation
the room doesn't have yet joins its list with the ends the line gives; one it has keeps its own
ends, and a line that says otherwise is drawn the relation's way and reported. A link with no
relation is a plain line. After its ends a relation may carry its look, as Russell's do:
`"calls up -> | dashed amber"`.

```
---
format: room/2
room: Combray
modes: [proust]
proust.relations: [related to, "calls up ->", "is the same as <->"]
---

# Objects

## ^1 line: the madeleine
## ^2 line: Combray
## ^3 line: the church at Combray
## ^4 line: Swann's way
## ^5 group: Combray
made in: proust
holds: ^2 ^3

# In proust
at: ^1 0 0
at: ^2 320 0
at: ^3 320 120
at: ^4 0 240
link: ^1 -> ^2 | calls up | in the tea
link: ^2 -- ^3
link: ^3 -> ^4 | calls up
link: ^4 -> ^1 | calls up
link: ^5 <-> ^4 | is the same as
```

## Twins

A Twin is two rooms side by side, each with its own mode. Its file says `twin: [left, right]`
instead of `modes`, lists both sides' objects in one `# Objects`, and has `# Left: <mode>` and
`# Right: <mode>`:

```
---
format: room/2
room: Pair
twin: [joyce, russell]
left.joyce.tension: 0.3
---

# Objects

## ^1 line
On the left.

## ^2 line
On the right.

## ^3 group: Train
made in: joyce
holds: ^1

## ^4 group: Chapter
made in: russell
holds: ^2

# Left: joyce
at: ^3 10 20

# Right: russell
on canvas: ^4
```

Each object is on the side whose section names it, and a group takes everything it holds with it
(and a relation its ends). An object no section names is on the left, in the shared tray. A Twin
side's section brought into an ordinary room is read as that mode's own.

## Writing by hand

- Start with `# Objects` only. Add front matter when you want a name, modes or a colour.
- Use named ids (`^arrays`, `^ch-1`): easier to read and to refer to.
- Leave out positions and let the modes place things. Add `# In russell` with `arrow:` lines for a
  tree.
- A one-line thought fits on its header: `## ^1 line: A vector is a list of numbers.`
- Drop the file on the rooms page (a new room) or on a room (its objects join it).

A plain `.md` file needs none of this: it comes in as loose thoughts (a list item or a one-line
paragraph is a line, a heading and its paragraph a passage, `![caption](address)` a picture).

## Writing as a machine (Claude or a script)

- Always write `format: room/2` and `modes:` (or `twin:`).
- Write every object once, in the order it should read; list each group after what it holds.
- Ids: short numbers or words, unique in the file.
- Use only the keys and lines in this file. Never invent keys: Träumerei keeps unknown ones, but no
  mode will act on them.
- Put each `arrow:` or `link:` in the section of the mode it belongs to.
- Positions are optional; leave them out unless you mean them.
- Check the card before Import: it lists every line that couldn't be read.

## Editing in the app

*Edit room source* (in a room's Add) or *Source* (at the foot of a group's editor) opens the room or
one group as this text in the source editor. The ids are the room's own for as long as the editor is
open: an id it wrote is that thing, changed in place when its words change (keeping its time, its
groups and its place); a new id is a new thing; an object taken out is deleted (for the whole room,
only when *Delete what isn't in the text* is ticked). A group's text holds its objects and the
section lines about them, and may refer to other things in the room by their ids (an arrow to
another chapter). Apply is one step: one Ctrl+Z takes it back.

## Adding an ontology or a kind of thought

1. **Code.** A kind of thought: `traum: { read({ title, body }) → fields, write(th) → { title, body } }`
   in its file in `app/features/world/items/`. An ontology: `traum: { write(w, room, c) → lines,
   read(w, room, lines, c) }` in its file (or its feature's slot entry); `index.js` in
   `app/features/world/ontologies/` lists what `c` gives (references, reports, keeping lines it
   doesn't know, its arrows). An ontology that joins its groups with arrows uses `relations.js`'s
   `traumLines` and `traumArrows` for the `arrow:` line.
2. **This file.** A section `### Kind: <kind>` or `### Ontology: <id>`, with its lines and an
   example. A check (`node app/features/roomfile/tests/guide.mjs`, run on every pull request) fails
   when one is missing.
3. **A test.** A round trip in `app/features/roomfile/tests/traum.test.js`: a file in, the room out,
   the same file again.

The grammar never changes for a new ontology: it only adds its own lines here and its own code.
