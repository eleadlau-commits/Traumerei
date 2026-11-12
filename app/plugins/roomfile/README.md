# Room files

A room in and out as one plain-text `.traum` file, and edited as one in the source editor. A
`.traum` file is the kernel's six tables as text (Law 8: the file is the tables); `FORMAT.md` (this
folder) is the spec, for whoever writes a file by hand or by machine. Reading and writing it is the
world's own carrier (`app/core/world/traum.js`, reached as `t.carriers`), which needs no plugin, so
a file goes out and comes back the same whatever is switched on. This plugin says where, shows the
card and downloads. It reaches the world only through the plugin API (`app/core/API.md`).

## What it does

It adds itself to the slot `formats` (shape in `app/core/world/formats.js`), so the rooms page and
a room find it there: `accepts(file)` (a `.traum` file, or plain `.md`, `.markdown`, `.txt`),
`importRoom({ file, cell, page, ok })` (a new room on floor `page`, in `cell` if it is free),
`importInto(roomId, { file, ok, before })` (the file's marks into a room as new ones, not a locked
one), `exportRoom(id)` (saves `<its name>.traum` through `t.ui.files.save`, a locked room too), `canEdit()` (whether the
source editor is there), `editGroup(roomId, groupId, o)` and `editRoom(roomId, o)` (as text in the
source editor, read only in a locked room) and `cancel()` (closes the card).

- **In.** A quiet card says what will arrive ("2 groups, 12 thoughts, 1 picture") and every line
  that couldn't be read; *Import* (Enter) or *Cancel* (Escape). Landing is one step. A plain `.md`
  file comes in as loose thoughts (`plain.js`). Pictures at an `https://` address are fetched and
  shrunk if the other site allows it; one that can't be comes in as a line with its address. A file
  of the older `room/2` format is refused with a word saying so.
- **Out.** *Export room file* saves `<room name>.traum` (a download, or the Save dialog in the desktop app): the room's tables with short ids, and
  each thought's history (`# Moments`). Taking a room out and bringing it back gives the same file.
- **As text.** The room, or a group with its parts, with the world's own ids (pictures as
  `picture:1`); what Apply would do (kept, changed, new, deleted) is checked as it is typed, and
  Apply writes it back over what it was (`t.carriers.replace`): one step.

It uses the `source` service (the source editor plugin) when it is there. It offers no service and
sends no events. Tests: `tests/plain.test.js`; the carrier's own in `app/core/world/tests/traum.test.js`;
`tests/guide.mjs` checks FORMAT.md's examples land with no plugin on.
