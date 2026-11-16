# Changelog

Each release with the versions of the contracts it carries: the plugin API (`app/core/API.md`),
the AI tasks (`app/core/AI.md`) and the room file (`app/plugins/roomfile/FORMAT.md`). Set a new
version with `python build.py release <version>`.

| App | Plugin API | AI tasks | .traum file |
|---|---|---|---|
| 1.1.1 | 3 | 1 | traum/3 |
| 1.1.0 | 3 | 1 | traum/3 |
| 1.0.3 | 2 | 1 | traum/3 |
| 1.0.2 | 2 | 1 | traum/3 |
| 1.0.1 | 2 | 1 | traum/3 |
| 1.0.0 | 2 | — | traum/3 |

## 1.1.1

Two additions to plugin API 3, so a plugin can write a book (the Book editor, `book.traumplug`):

- A rule's `land` and `drop` may propose `{ join: group, at? }`: the mark becomes a part of a group
  of its room at a place in its order, in the same step as the gesture (one Ctrl+Z).
- `t.ui.text.edit(mark, at?)` opens a kept line to write in with the caret at `at`, so a caret can
  run on from one paragraph into the next.
- `land` is heard when a thought was written after a mark (the one chosen, or the one kept just
  before with Enter), and the thought being written is drawn under that mark at its width.
- Fixed: a thin rule's `land` was never heard in a room (the Calendar's "a thought written on a
  chosen day is due that day" worked only in tests).

The rest of the gaps found in the open core's audit (G1 to G11), all additions:

- `{ join, at?, from? }`: with `from`, the mark leaves that group in the same step, so a drop from
  one chapter into another moves it rather than copying it.
- `reads.marks.draft(context)`: the thought being written, `{ text, at?, after?, height? }`, for a
  rule's `arrange` to leave room for it; the room lays out again when its box grows or shrinks.
- `slots.groups` takes `fields` and `tidy`: a chapter keeps its own fields (a target, a break)
  through edits, .traum files and copies; with its plugin off they stay as they are.
- `together(async fn)`: one step until the promise settles; a rejection takes it back.
- `ui.chosen()` gains `marks`; `ui.chosen.on(fn)`, `ui.choose(ids)`, `ui.repaint(ids?)`.
- A span may carry `ref` (a mark or link); a span kind's `click(span, mark)` hears its words clicked.
- A thin rule's settings may be `{ kind: 'choice' }` or `{ kind: 'toggle' }`; `arrange`, `draw`,
  `drop` and `land` get the room's values as their last argument.
- Moment rows carry `before` and `after`; `slots.commands.list()` and `run(id)`; `peers.on(fn)`.
- API.md: surfaces draw what they must to be a tool, never the app's own words; chapters within
  chapters stay links, never folders.
- Corpus: `manuscript`, chapters within chapters as headings in reading order, proving the above.
- Word document export keeps six levels of heading (it flattened past three).

## 1.1.0

One release for everything since 1.0.3 (1.0.4 was never tagged): the open core, step by step.

### The house in order (step 0)

- Only corpus plugins are built in (the room types). Everything else ships as a plugin file beside
  each Release: the home page, Search, the desk, gaps and returns, Time, Export, room files, Book,
  pictures, the picture behind, templates, the account and the source editor.
  `starter-set.traumplug` brings them all back in one import (Settings → Plugins → Import
  plugin…). The app alone opens on the rooms page.
- Plugin API 2 widened by additions: `t.peers` (what plugins offer each other), and `slots.menu`,
  `slots.views` and `slots.account`.
- A book's card shows its title and counts, not every thought's words.
- The first letter of a new thought puts in only that thought, not the whole room (about 80 ms
  in a room of 1,500, was 240 ms).
- `python build.py new-plugin` makes a plugin that ships as a file; `--corpus` for a corpus plugin.

### Step 1: a rule may say how big a unit is and draw it in pieces

- A thin rule's `arrange` row may give `width` and `height` (the room wraps the thought to them)
  and `align: 'start'`; a mark may have several rows, each a fragment with `lines: [from, to]`
  (a paragraph that runs on to the next page). `t.rules.layout` reads them back.
- `t.ui.measure(text, width)`: how words wrap at a width as the room draws them.
- A rule may claim families (`claims: [family ids]`): it lays their groups out, and their cards
  don't show in it.
- `links.link(part, group, 'part of', null, { at })` joins at a position in the order (the kit's
  `join(w, group, id, at)` too).
- Corpus plugin **Page flow**: a room as fixed pages, a paragraph running on in fragments.

### Step 2: the look of words inside a thought, and the caret

- Spans: a thought keeps `spans: [{ from, to, kind }]` as material of the mark (Law 1), carried
  in .traum files and following its words as they change. Kinds of span come from plugins
  (`slots.spans`); decorators (`slots.decorators`) only draw. Both use the room's span classes.
- `t.ui.text`: the caret in the thought being written, select, replace (one step on a kept
  mark), style, spans, on. Commands with `zone: 'editing'` run while a thought is written.
- `marks.markdown(id)`: a thought's words with their spans as Markdown.
- Corpus plugins **First letters**, **Spell marks**, **Bold and italic**.

### Step 3: places beside the canvas, and the zoom

- `t.slots.bar`: a word on a room's bar, beside Search (pressed while `on()`).
- `t.slots.strip`: a tool's status in one quiet line along the foot of a room's canvas; never
  floating, asked again only when the room is still.
- `t.slots.pages`: a page of the plugin's own in the frame, with its row in the ☰ menu; Escape
  goes back. `t.ui.open.page(id)` opens it.
- `t.ui.zoom`: `get()`, `set(zoom, at?)`, `on(fn)` and fixed `bands` (far below 0.5, near from
  1.75, mid between). A thin rule's row may give words for a band (`far: 'Chapter 2'`), shown in
  place of the thought under it; the stage carries `room-band-far`, `-mid` or `-near`.
- Corpus plugin **Word count strip**: the room's words in the strip, **Words** on the bar and
  Ctrl+Alt+W to hide it, a page of every room's count, and the room's name as its label from far off.

### Step 4: the pointer and surfaces

- `slots.surfaces`: a kind of mark (`surface` on its kind) or a thin rule's box (`surface` on a
  `draw` box) asks for a surface by id, and the room gives its plugin an element sized by the
  layout to draw in. Clicked into, it hears the pointer, the wheel and the keys until Esc or a
  click outside; the app's keys wait meanwhile.
- Pointer down to pointer up is one gesture, and the plugin's proposes in it land as one step: a
  stroke is one Ctrl+Z. What a surface keeps goes through proposes (a kind's fields), so nothing
  is kept outside the tables, and a surface kind whose plugin is off shows the quiet stand-in.
- A new `needs` word, `surface`, shown on the import card; `slots.surfaces.add` refuses a plugin
  that doesn't say it.
- Corpus plugins **Sketch** (a drawing made with the pen, its strokes a field) and **Chart** (a
  rule whose box draws a bar chart of the words in each group).

### Step 5: rich kinds in a flow, and more ways out

- A kind of mark may flow among paragraphs (`inline: true`, `height(mark, width)`); `t.ui.size`
  says how tall a mark draws at a width. Page flow sets such a mark between paragraphs as a block.
- Several formats may take a room out: then each shows as "Export: its name" in the room's
  ⋯ More.
- The corpus Table flows; corpus plugins **Figure** (a picture with a caption) and **Word
  document** (a room as a .docx: headings, bold and italic, tables, figures).

### Step 6: the plugin API, version 3, frozen

- Version 3 is version 2 with the open core's additions, and frozen: it changes only by adding.
  A plugin written for version 2 connects as it is; new plugins say `"api": 3`.
- A mark row is frozen all the way down (its nested fields are copies), so no plugin can change
  the world through a row.
- Checked by the corpus (the thirty of version 2 and one plugin per seam) and by a plugin written
  from `API.md` alone by an author who had read nothing else.

## 1.0.3 (15 Nov 2026)

- Room settings: a Settings item in the room's rail opens the room's own settings in the right dock
  (name, colour, categories, what is inside it, and the mode's settings for this room).
- Floors have names: "Floor 2 – Thesis" in the rail, crumbs and status bar. Name one in its settings.
- Categories (the tag groups on the rooms page): opening one draws a dotted outline around its rooms.
- Entering a room no longer opens the loose tray; the rail stays as you left it. Leaving the rooms
  page for the menu can be cancelled.
- Plugins can do more (plugin API 2, widened by additions only): their own families of groups
  (cards that open by themselves), buttons under Tools in the rail, their own link kinds, dock pages
  that take marks dropped on them, and every mode and part of the room. Room types gain box styles
  (title, heading, line, shelf, quiet; levels, right side, a box that opens a mark) and can propose
  where a thought is placed.
- The Book plugin: a book in any room, chapters of thoughts, a contents page, a reading view, export
  to Markdown and print (Ctrl+Alt+J).

## 1.0.2 (14 Nov 2026)

- Settings → Room types: every room type listed, and new ones from one Markdown file (name, note,
  arrangement in words or code), edited in place, exported as `.traumplug`. `docs/ROOM-TYPES.md` is
  the format, written for a model to follow; Copy guide puts it on the clipboard with a worked
  calendar (`docs/room-types/month-calendar.md`).
- A simple rule may `draw` boxes behind the marks, and propose through the tables on `drop` and
  `land` (due, revisit, clear, gap, resolve): a calendar with day cells, where a thought dropped on
  a day, or written onto a tapped day, is due that day. Plugin API 2, widened by additions only.

## 1.0.1 (13 Nov 2026)

- The AI framework: tasks, providers and engines (`app/core/AI.md`), Settings → AI, and Provoke's
  reader as the first provider.
- First run opens on a chooser with four templates and a sample room.
- `python build.py release <version>` and one app identifier, `app.traumerei.desktop`.
- Plugins can be packed into one `.traumplug` file and imported in Settings → Plugins.
- The stress corpus of test plugins is no longer in the app (pack and import one to try it).
- Provoke is no longer built in: it ships beside the installer as `provoke.traumplug`, to import.

## 1.0.0 (12 Nov 2026)

- First Windows release: Tauri 2 shell, NSIS installer, `.traum` files open the app, a daily
  check for a newer Release.
- Room files of the older `room/2` format are no longer read; 1.0.0 reads `traum/3` only.
