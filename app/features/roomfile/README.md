# Room files

A room in and out as one plain-text `.traum` file, and edited as one in the source editor.
`FORMAT.md` (this folder) is the spec of the format, for whoever writes a file by hand or by
machine. The rooms page and the room say where (a cell and floor, a room, a spot in it) and put the
choices in their menus; this feature reads the file, shows the card, changes the world and
downloads. The world itself is the world feature's.

## The roomfile service

`this.use('roomfile')` gives everything it offers:

| Member | What it does |
|---|---|
| `isRoomFile(file)` | Whether a dropped file can come in: a `.traum` room file, or plain Markdown or text (`.md`, `.markdown`, `.txt`), which comes in as loose thoughts. |
| `importRoom({ file, cell, page, ok })` | A new room from `file` (picked, if none) on floor `page`, placed by the floors feature: in `cell` if it is free, else that floor's first free one, else a new floor (the room's `page` says which). `ok()` says whether it is still wanted, before the card and on Import. Resolves with the new room once it is in the world, or `null`. The caller saves. |
| `importInto(roomId, { file, at, ok, before })` | The file's objects (groups and thoughts, with their places) into a room as new ones (not a locked one). `at()` is where new trains start; `before()` runs just before the world changes. Resolves `true` once they are in, else `false`. The caller saves. |
| `exportRoom(id)` | Downloads the room as `<its name>.traum` (a locked room too). |
| `canEdit` | Whether editing as text is there (it needs the source editor feature). |
| `editGroup(roomId, groupId, { before, ok })` | The group as `.traum` text in the source editor (read only in a locked room). `before()` runs just before Apply changes the world; `ok()` says whether it is still wanted. Resolves `true` once Apply has changed the world, else `false` when it closes. The caller saves (one step). |
| `editRoom(roomId, { before, ok })` | The same for the whole room. |
| `cancel()` | Closes the card, if it shows. |

It uses the `source` service (the source editor) when it is there. It sends no events and has
no slots.

## What it does

- **In.** On the rooms page: *Import a room…* in the top bar or on an empty cell's right-click, or
  drop a file on the page. Inside a room: *Import into this room…* in Add, or drop a file on the
  canvas; the file's objects join the room as new ones, with their places, and its front matter is
  not used. First a quiet card says what will arrive ("12 groups, 85 thoughts, 2 pictures") and
  what couldn't be read; *Import* (Enter) or *Cancel* (Escape). The whole import is one step: one
  Ctrl+Z takes it back. A locked room can't be imported into. A plain `.md` file comes in as loose
  thoughts (`plain.js`: a list item or a one-line paragraph is a line, a heading and its
  paragraph a passage, `![…](…)` a picture). Pictures at an `https://` address are fetched if the
  other site allows it, and shrunk as pasted ones are; one that can't be becomes a line saying so.
- **Out.** *Export room file* in a room's properties on the rooms page, or in Add inside it,
  downloads `<room name>.traum` (a locked room too): every mode's section (a big room's all; a
  Twin's two sides), exact positions, and anything kept from a file that wasn't understood.
  Taking a room out and bringing it back gives the same file.
- **Editing.** *Edit room source* in Add, or *Source* at the foot of a group's editor, opens the
  room or the group as `.traum` text in the source editor, with a line above it on what Apply would
  change, checked as you type. A group's text holds its objects and the section lines about them,
  with the room's own ids, so it can be handed to Claude and the rewrite pasted straight back.
  Apply changes things in place by their ids: a thought keeps its id, time, glow, groups and place
  when only its words change; a new id is a new thing; `holds:` is what a group holds now; a
  heading's title and `closed` win; an arrow taken out of the text is taken away. What was in a
  group's text and is gone is deleted (a thought another group still holds only leaves this one);
  for the whole room, only with *Delete what isn't in the text* ticked. Front matter changes
  (name, description, tags, colour, settings) are listed and made; the modes don't change here.
  Pictures show as short references (`picture:3`) that read back as the same pictures; Download
  writes them out in full. Apply is one step: one Ctrl+Z takes it back (settings excepted). A
  locked room opens read only.

## The parts

- `grammar.js`: the text in and out with no world: front matter, `## ^id kind: title` objects,
  `# …` sections, `key: values` lines, typed values (`^a`, `^a#2`, `^a@"words"`, numbers, dates,
  `"text"`, `[lists]`, `->`, `|`), escaping, the `arrow:` line.
- `traum.js`: parts into a room and a room into parts (`importRoom`, `importInto`, `exportRoom`,
  Twins too). It names no mode: each kind of item reads and writes itself (`traum` in the world
  feature's `items/`), and so does each ontology for its own `# In <mode>` section (`traum` in
  `ontologies/`; the `arrow:` line comes from the shared arrows part, `relations.js`). Anything not
  understood (a kind, a key, a section, a front matter line) is reported and kept with the room
  (`own(w, room, 'traum')`), and written back out next time.
- `edit.js`: a room or a group as text in the source editor, and Apply (`open`, `apply`).
- `plain.js`: plain Markdown as loose thoughts.
- `Roomfile.js`: the screen side: the card, fetching pictures, downloads, and what it hands the
  source editor. `world.js` lists the world's rules it uses.

Tests: `tests/grammar.test.js`, `tests/traum.test.js`, `tests/edit.test.js`, `tests/plain.test.js`.
