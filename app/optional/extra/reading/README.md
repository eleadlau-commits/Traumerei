# Reading notes

A Zotero-like library in a room. One room is one library, seen as **Library**: each source (a
book, an article, a chapter, a web page) has its metadata, a citation key and a stream of notes.
The sources are in the left dock, the open source's details in the right dock, and on the canvas
each source's notes are a column, the open source's in view. Choose a source, type, Enter: the
note lands at the end of its stream, or right after the chosen note.

A plugin, shipped as `reading.traumplug` on plugins-latest (never built in, never in the starter
set). It reaches the app only through the plugin API (`app/core/API.md`), and needs app 1.1.4. No
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
- A **collection** is a group of the family `reading-collection` (membership many), its title its
  name. A source is `part of` each collection it is in (any number); a collection `part of` the
  one it sits in (one at most, three levels deep at most). Deleting a collection never deletes
  its sources.
- **Blocks** are the same library seen as a board, Library's own setting (`across` in the room's
  `rules`: 0 for columns, or 2, 3, 4 or 6 blocks across). Only that setting changes.

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

## What it adds (0.4)

- **Linked files**, as Zotero keeps a PDF: the file stays where it is. **Attach file…** (Details,
  File) picks it; its size and SHA-256 are worked out here and nothing else of it is read or
  kept. Then its whole path is pasted once (a browser is never told it; in Explorer, Shift+right-
  click, Copy as path). The source keeps `file: { rel, name, bytes, sha256, pageOffset }`: the
  path relative to the **library folder**, which is this computer's (kept in the plugin's store,
  one per library, never in the `.traum`); the first file attached sets it to its own folder, and
  Details shows it to change. A file outside the folder is kept by its whole path.
- **Page offset**: file page minus printed page (PDF page 130 for p. 112 is 18), set once per
  file. A quote's anchor is always the printed page; front matter (p. xiv) has no file page.
- **Verify…** picks the file again: the same file, changed since it was attached, or another.
  **Copy path** copies its whole path; **Alt+Shift+P** on a quote copies its path, its page and
  the file's page (`…\origin.pdf, p. 112 (file page 130)`). **Detach** takes the link off.
- **DOI or URL**: Details has Open the DOI (or URL), and **Alt+Shift+O** opens it in the browser.
- Opening the file at a quote's page waits on desktop file handles (core-gaps.md, gap 3): the
  helper (`compat.js` `fileHandles`) uses them once the app has them, and **Open** appears then.

## What it adds (0.5)

In the left dock's **In and out** (and as commands):
- **Import BibTeX…**: a `.bib` file's entries (BibTeX or BibLaTeX, as Zotero's Export → BibTeX
  writes them) become sources: type, key, authors ("Family, Given"; an organisation in braces
  stays whole), title, year, edition, journal or book, volume, issue, pages, publisher, DOI, URL,
  ISBN. LaTeX accents come in as letters; an abstract or a note never comes in. A source already
  here by key (or by title and year) is left as it is; an entry with no key is given one. One
  step. From app 1.1.4 a `.bib` file opened or dropped makes a new library of its sources, or
  dropped into a library adds them (a format with `asks: false`, core-gaps.md gap 10).
- **Import Zotero notes…**: Zotero's annotations (Add Note from Annotations, then the note
  exported as Markdown) into the open source: each highlight a quote with its page, its comment a
  comment under it, any other paragraph a note. Zotero's links, headings and images stay out.
- **BibTeX**: the library's sources as a `.bib` file, each under its key.
- **Markdown**: the notes by source, each source a heading with its key, its quotes as block
  quotes cited with Pandoc keys (`[@darwin1859origin, p. 490]`), its comments as paragraphs.
- **Word**: the notes by source as a `.docx`, quotes cited in Chicago author-date in the text
  (`(Darwin 1859, 490)`, pages shortened as Chicago does), comments on a quote set in under it,
  and a **References** list in Chicago author-date at the end (hanging indent; a book's title in
  italic, a first edition not named).

Typing a quote or a comment under a quote is done just after Enter, as its own step (no proposal
links a note, Book's way): the first Ctrl+Z takes back the quote or the nesting, the second the
note.

## What it adds (0.6)

- **Collections**, as Zotero has them, in the left dock above Find: All sources, then each
  collection by name with the sources in it (and in the collections inside it). A click (or
  Enter) shows only its sources; New source then makes one in it. **New collection**
  (Alt+Shift+C) makes one inside the collection shown, its name ready to write. Alt+Shift+L goes
  to the tree: ↑ / ↓ walk it, F2 renames, Delete deletes (its sources stay; the collections
  inside it move up), Alt+→ puts it inside the collection above it, Alt+← takes it up a level.
- **Drag a source onto a collection** to put it in (it stays in the others). Drag a collection
  onto another: the middle of its line puts it inside, its top or bottom third beside it
  (Book's treedrop). The keyboard way for sources: Details → **In collections**, a box to tick
  for each.
- **Blocks** (0.6 had them as a second mode, Library · blocks; 0.6.1 made them Library's own
  setting): each source a block in a thin frame, holding its notes (quotes with their pages,
  comments set in under them), the blocks a board 2, 3, 4 or 6 across, each going under the
  shortest column so far. A note dragged into another block moves
  there, between the notes it is let go between (or under a quote, as a comment), one step;
  typing after a note lands right after it, as in Library. The docks, Find and the keys are the
  same; going to a source shows the board around it, as far out as half size.
- Notes already move between sources by dragging (0.2), in both modes.
- The canvas shows every source whichever collection is shown: a rule can't read what the person
  has chosen in a dock (core-gaps.md, gap 4).

## What changed in 0.6.1 (lighter and faster)

- **Blocks are a setting, not a mode**, as core asked (core-gaps.md, gap 11): ⚙ → Sources as
  (Columns, Blocks 2, 3, 4 or 6 across), or **Alt+B** to go between columns and blocks, in any
  library, small or 2 × 2. It is kept in the room (one step, Ctrl+Z takes it back). A room 0.6
  saw as Library · blocks is moved over when opened (from 1.1.4). New library is no longer 2 × 2.
- **.bib as a file format** again (from 1.1.4, `asks: false`): open or drop one.
- **Attach** takes the path of a file picked in the desktop app (1.1.4), with no path to paste.
- **Faster:** the docks redraw once per change, not once per table (a kept note changed marks
  and links, and Enter is two steps, so four redraws became two); Enter's landing reuses the
  layout just drawn instead of making another.
- The plugin's own surface: `install` returns only what the host tests reach.

## What changed in 0.6.2 (needs app 1.1.4)

- The fallback helpers are gone: `compat.js` keeps only core's own words (mode on `ui.chosen`,
  `ui.zoom.get` / `go`, `ui.files` path, show and hash), and `view.js` (the smooth jump's
  arithmetic) went with them.
- New library is a room made seen as Library (`marks.make` with `at.mode`), no .traum in between;
  a .bib opened makes one the same way.

## What changed in 0.6.3

- **Delete source**: Details › Actions, or Delete on a source in the list. The source goes with
  its notes (quotes, comments, the rest) as one step, and the one after it opens; Ctrl+Z brings it
  all back. Its collections stay (even one it leaves empty), its editions stay as sources of their
  own, and a tag left holding nothing goes (`deleteSource` in notes.js).

## What it adds (0.7): the text reader

- **Book**, a tab in the right dock beside Details: the open source's book, a page at a time.
  Alt+Shift+R (or Details › File › Read here) opens it; ← / → or Page Up / Down turn the page,
  Home and End go to the ends. A plain text file, an HTML file (as Project Gutenberg makes it) or
  an EPUB reads here; a PDF still opens in its own app (Details › Open).
- **Printed pages** where the file marks them: Gutenberg's page numbers (`[49]`, `[Pg 49]`) and an
  EPUB's page breaks. A file with none is read in screens of about 2,400 letters.
- **A quote's page**: Alt+Shift+P on a quote (or a comment under it) turns the Book tab to the page
  its anchor names, with the quote lit; with no page in the anchor, its words are found in the book
  (letters only: quotation marks, spacing, case and ß/ss don't count). While the tab shows,
  choosing a quote on the canvas turns to it. With no book that reads here, Alt+Shift+P copies the
  file's path and page as before.
- **No text kept** (E's rule): the book is read from its file into this session's memory only,
  never into the tables or the plugin's store. So it is picked once a session (Open the book…;
  a file whose fingerprint differs from the one attached is shown with a warning). Core's
  `ui.files.read(path)` (core-gaps.md, gap 12) would reopen it with the room; `compat.js` uses it
  as soon as it is there.
- Fast: a 460,000-letter book reads in about 20 ms, a quote is found in about 20 ms the first time
  (then a few), a page turns in under 5 ms. `reader.js` (the words and pages, no DOM of its own
  but a parser) and `book.js` (the tab).

## How it is made

- `rules.js`: plain functions (sources, keys, anchors, the stream with its comments, the layout,
  where a note lands or is let go, the new library).
- `notes.js`: the gestures on notes and editions, each one step (`asQuote`, `toggleQuote`, `move`,
  `nest`, `unnest`, `step`, `syncTags`, `newEdition`, `setEditionOf`).
- `find.js`: tags read from words, the library's tags, and Find.
- `files.js`: paths relative to the library folder, a quote's file page, Verify, Copy path.
- `bibtex.js`, `zotero.js`, `io.js`: BibTeX in and out, Zotero's annotations in, as one step each.
- `cite.js`, `word.js`: Chicago author-date and Pandoc citations, the Markdown and Word exports;
  `zip.js` is copied from Book 0.4.7.
- `collections.js`: the collection tree, and its gestures, each one step (`newCollection`,
  `renameCollection`, `putIn`, `takeOut`, `moveCollection`, `removeCollection`).
- `docks.js`: the two docks; `editFor` is what a field's words do to a source.
- `compat.js`: the app's words for the room's mode, the view and files, in one place
  (`onModeChange`, `viewGet` / `viewGo`, `stageBox`, `fileHandles`; core-gaps.md gaps 1 to 3).
- The source open in a library is the session's (which one you are reading is not content), so
  the rule can't read it: each source is its own column and the view goes to the open one
  (core-gaps.md).

## What it needs

- **Plugin API:** 3 · **oldest app:** 1.1.4 · **needs:** `files` (picking a file to attach or
  verify), `store` (the library folder, this computer's)

## What it saves

- In the tables: everything of the library, and of a linked file only its path, name, size,
  SHA-256 and page offset.
- In the plugin's store, on this computer: the library folder of each library.

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
6. Click Liberty in Collections: Mill and Wollstonecraft. Drag Walden onto Natural history.
   Alt+B: each source a block; drag a note into another block. Alt+B again: columns.
