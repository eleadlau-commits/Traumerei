# Reading notes

A Zotero-like library in a room. One room is one library, seen as **Library**: each source (a
book, an article, a chapter, a web page) has its metadata, a citation key and a stream of notes.
The sources are in the left dock, the open source's details in the right dock, and on the canvas
each source's notes are a column, the open source's in view. Choose a source, type, Enter: the
note lands at the end of its stream, or right after the chosen note.

A plugin, shipped as `reading.traumplug` on plugins-latest (never built in, never in the starter
set). It reaches the app only through the plugin API (`app/core/API.md`), and needs app 1.1.2. No
source text is ever kept, in the room or anywhere else: only notes and metadata (and, from 0.4,
a source file's path and hash).

## The shape (all in the tables, Law 8)

- A **library** is the room, seen as Library (rule `reading-library`).
- A **source** is a group of the family `reading-source` (membership one). Its title is the
  group's title; its own fields: `type`, `citekey`, `authors` (a list, "Family, Given"), `year`,
  `edition`, `container`, `volume`, `issue`, `pages`, `publisher`, `doi`, `url`, `isbn`, `file`.
- A **note** is a line thought, `part of` its source, in stream order.

## What it adds (0.1)

- **Mode Library** (order 32). Each source a column of its notes, side by side, in citation-key
  order, its title, author and year, and key above it; a source with no notes says so. The thought
  being written after a note opens room under it. Loose thoughts (in no source) are laid by the
  room under the columns.
- **Writing** (the rule's `land`): a note written after the chosen note lands right after it, in
  its source; with no note chosen, at the end of the open source's stream. One step with Enter.
- **Left dock, Sources**: each source's citation key, author and year, title and number of notes,
  the open one lit. A click or Enter opens one (the view slides to its column and its last note
  is chosen); ArrowUp / ArrowDown walk the list. **New source** (Alt+Shift+N) makes one, opened
  with its Title ready to write.
- **Right dock, Details**: the open source's Title, Authors (one a line), Year, Type, Citation
  key, Journal or book, Edition, Volume, Issue, Pages, Publisher, DOI, URL and ISBN, written in
  place. Enter keeps a field (one step); Ctrl+Enter is a new line in Title and Authors; Escape
  puts it back. A citation key is made from the first author's family name, the year and the
  first title word that is not an article (`darwin1859origin`), unique in the library (`…a`, `…b`);
  while it is still the one it was given it follows the authors, year and title; one typed stays.
- **Keys** in a room seen as Library: Alt+↓ / Alt+↑ the next or previous source; Alt+Shift+N a new
  source. A note chosen in another column opens its source.
- **New library** (☰ menu, or the command): a room already seen as Library, from a small `.traum`
  (a plugin can't set a room's mode; the file carries it), gone into.

## How it is made

- `rules.js`: plain functions (sources, keys, the layout, where a note lands, the new library).
- `docks.js`: the two docks; `editFor` is what a field's words do to a source.
- `compat.js`: the fallback helpers for the core gaps (`app/core/core-gaps.md`):
  `onModeChange`, `viewGet` / `viewGo`, `fileHandles`. Each uses the new API when the app has it,
  else the workaround, so the plugin works on 1.1.2 and switches over with no rewrite.
- `view.js`: the arithmetic of a smooth jump, copied from Book 0.4.6 (`zoom.js`).
- The source open in a library is the session's (which one you are reading is not content), so
  the rule can't read it: each source is its own column and the view goes to the open one
  (core-gaps.md).

## What it needs

- **Plugin API:** 3 · **oldest app:** 1.1.2 · **needs:** nothing

## What it saves

- Nothing outside the tables.

## Check it

1. `python build.py check reading` (its tests in `tests/rules.test.js` and
   `app/core/api/tests/reading.test.js`, the conformance suite, the budgets), then `node
   tests/speed.mjs --plugin packed/reading.traumplug --world app/optional/extra/reading/tests/sample.js`.
2. Import `packed/reading.traumplug` in Settings → Plugins and open the sample `.traum`
   (`node app/optional/extra/reading/tests/write-sample.mjs > reading-sample.traum`): it opens on
   a room seen as Library, the sources in the left dock, Darwin open.
3. Type, Enter: the note lands at the end of Darwin's stream. Alt+↓: Mill. Alt+Shift+N: a new
   source, its Title ready to write.
