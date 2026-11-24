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
- A **quote** is a note with a quiet `reading quote` link to its source; the link's label is its
  anchor, the printed page of that edition (`p. 112`, `pp. 112–113`, `p. xiv`).
- A **comment** is a note with no quote link. A comment on a quote has a quiet `reading comment`
  link to it and sits under it, right after it in the stream.
- A **tag** is a group of the family `reading-tag` (membership many), its title the word, typed
  as `#word` in a note.
- An **edition** is a source of its own (its own key, its own pages) with a quiet `reading
  edition` link to the source it is an edition of. A quote belongs to exactly one edition.

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

## What it adds (0.2)

- **Quotes**: a note begun with a quotation mark (or with `> `) is a quote; a page typed at its
  end (`"…" p. 112`, `"…" (pp. 112-13)`, `"…" @xiv`) is taken off its words into the quote's
  anchor, shown in the column's gutter at its left, and quotes are drawn in italic. Edit the page
  at the end of its words the same way. A note that only ends in a page ("compare p. 40") stays
  a comment. **Alt+Q** makes the chosen note a quote, or a quote a note again (its page put back
  at the end of its words, so nothing is lost).
- **Comments under quotes**: a note written after a quote, or after a comment under it, is a
  comment under that quote, indented. **Alt+←** takes a comment out from under its quote (right
  after the quote's comments); **Alt+→** puts a note under the quote before it.
- **Reordering**: **Alt+Shift+↑ / ↓** moves the chosen note one place up or down (a quote carries
  its comments; a comment moves among its quote's comments). **Drag** a note: between two notes
  it stands there; among a quote's comments it goes under that quote; into another column it goes
  to that source (a quote takes its page and comments along); onto Unfiled it leaves its source.
  Each is one step.
- **Editions**: **New edition** (left dock, or Alt+Shift+E) makes an edition of the open source:
  its title, authors and the rest copied, no year or edition yet (the Edition field is ready to
  write), its own key. Details has **Edition of** to link a source to another, or unlink it.
  Editions come right after their source, in the list and on the canvas, and fold into its line
  in the left dock ("▸ 1 edition"; → shows them, ← folds them).

## What it adds (0.3)

- **Tags**: `#word` typed in a note puts it in that tag (made when the library has none), and
  taken out of the words takes it out; a tag left holding nothing goes. Tags are drawn quiet in
  the words, and they are claimed by the Library rule (never loose on the canvas).
- **Find** (Alt+F, or the field at the top of the left dock): words and `#tags` across the
  library. A note is found when it holds every word (in its words, its page or its source's key)
  and is in every tag; a source when its key, title, authors or year hold every word. The
  results replace the list of sources while there is a query: the source's key and the page,
  then a piece of the note around the word. ArrowDown walks them, Enter goes to one, Escape
  clears. Under the field, the library's **tags** with their counts: a click adds the tag to the
  query (or takes it out).
- **Going to a note**: a result opens its source, slides the view to the note (smoothly, unless
  the system asks for less motion) and chooses it.
- The canvas shows every note while you find: which notes match is this session's view, which a
  rule can't read on API 3 (core-gaps.md, gap 4).

Typing a quote or a comment under a quote is done just after Enter, as its own step (no proposal
links a note, Book's way): the first Ctrl+Z takes back the quote or the nesting, the second the
note.

## How it is made

- `rules.js`: plain functions (sources, keys, anchors, the stream with its comments, the layout,
  where a note lands or is let go, the new library).
- `notes.js`: the gestures on notes and editions, each one step (`asQuote`, `toggleQuote`, `move`,
  `nest`, `unnest`, `step`, `syncTags`, `newEdition`, `setEditionOf`).
- `find.js`: tags read from words, the library's tags, and Find.
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
4. Type `"…" p. 95`, Enter: a quote, its page in the gutter. Type again, Enter: a comment under
   it. Alt+Shift+↑ moves the quote and its comment up. In the left dock, → on Darwin shows its
   6th edition.
5. Alt+F, type `grandeur`: both editions' quotes, with their pages; Enter on one goes to it. A
   click on `#liberty` finds Mill and Wollstonecraft.
