# The stress corpus (kernel phase 8)

Thirty small plugins, each covering a slot or a mix no earlier plugin touched, written against
[`API.md`](../app/core/API.md) alone. They are the pressure that found the API's gaps before version 2 was
frozen, and now the **conformance suite** every later change must pass
(`app/core/api/tests/corpus.test.js`, run by `python build.py test`). They all start off
(`"starts": "off"`). They are **not in the product**: `standalone.py` leaves every id in
`tools/corpus.py` out of the web copy and the Windows app (`--corpus` keeps them in, for a look).
Anyone who wants one packs it with `python build.py pack-plugin <id>` and imports the file in
Settings → Plugins.

| Slot | Plugins |
|---|---|
| rules | `kanban` (groups as columns), `calendar` (each on its day ahead), `outline` (indented tree), `grid` (fixed cells), `timeline` (by the day made), `random` (a new sky each visit) |
| kinds | `checkbox` (its tick is its gap), `quote`, `code-block`, `audio-note`, `pdf-page`, `table` |
| link kinds | `cites`, `contradicts`, `example-of`, `translates`, `duplicates`; `links` is their hands (an Editor section) |
| views | `word-count`, `oldest-gap`, `link-graph`, `print-view`, `room-outline` |
| carriers | `markdown-vault` (Obsidian in and out, a zip either way), `csv-marks`, `json-tables`, `anki-deck`, `plain-text` |
| readers | `word-linker` (shared uncommon words become "echoes"), `due-finder` (dates in words become due), `nonsense-reader` (proposes only nonsense: every proposal must be refused) |
| commands | `focus-mode`, `room-stats`, `export-room` |
| open core | `page-flow` (fixed pages, a paragraph runs on in fragments: step 1), `first-letters` (a decorator), `spell-marks` (a decorator and the caret), `bold-italic` (spans kept on the mark, keys while writing, Markdown out: step 2), `figure` (a kind that flows among paragraphs), `docx` (a second format taking a room out, as a Word document: step 5), `word-count-strip` (the strip, a bar word, a page of its own and the zoom's bands: step 3), `sketch` (a kind drawn with the pen in a surface, a stroke one step: step 4), `chart` (a rule whose box asks for a surface: a bar chart of the words in each group: step 4), `highlighter` (a span, a decorator, the strip and a bar word, written from `API.md` alone: step 6) |

Each exports `install(t)`; its Feature's `start()` is one line that calls it. That is what lets one
host (`tests/host.js`: a world, its moments log, the slots and `connect()`, no screen) run every
plugin through the suite:

- the eight laws hold with it on, after everything it adds has been used (each rule laid out on
  a live and a frozen world, each command run, each Editor section drawn, each link kind and kind
  made through the API, each format sent out);
- every propose lands as a step or refuses in words, and never throws;
- switching it off takes away all it added and loses no row; on again it adds the same;
- a .traum round-trip of the room is stable with it on;
- each rule lays out a 1,500-thought room in under 50 ms;
- it reaches nothing past the API (the compiler leaves out a plugin that does).

## Defects the corpus found

Every point where a plugin needed the kernel's code was an API defect, fixed in the API:

| # | What a plugin author could not do from API.md | Fixed by |
|---|---|---|
| 1 | Write a rule: its shape was only in `world/ontologies/index.js`, a 60-line contract over the raw world | A **simple rule**: `{ id, name, arrange(reads, context) → [{ mark, x, y }], admit?, hand? }`; the kernel makes the rest (units, drag kept as a rule row, memo per table version) |
| 2 | Read the tables from inside a rule or a check without the world | The **read half** (`READS`), handed to `arrange`, a link kind's `admit` and views; over a frozen world too |
| 3 | Add a kind of link; rows of an unknown kind were dropped on load and refused in files | `slots.linkKinds`; any lowercase kind is kept (Law 2) and travels in .traum; `links.named(kind)` |
| 4 | Add a kind of mark: its shape was only in `world/items/index.js` | The shape in API.md, with the field names a kind may not use |
| 5 | Make a mark of a plugin's kind: `make` wrote the fields into `text`; make a group | `make({ kind, content: fields })`; `kind: 'group'`, and a mark made in a group joins it |
| 6 | Keep a field named `page`: every load took it for an old room's floor and deleted it | Only a room's `page` is the old field |
| 7 | Import a file as one step: each mark made was a step of its own | `together(fn)` |
| 8 | Hand a file out | `ui.download(name, content, type)` |
| 9 | Round-trip a room with a group: `carriers.check` counted fields written back in another order as changed | Compared with keys in order |
| 10 | Know an Editor section's `x`, a command's zones, a format's shape: only in core READMEs | Written into API.md |
| 11 | Know what `importRoom` returns | `{ id }` of the room, said in API.md |
| 12 | Hide the docks (focus) | `ui.docks.canvasOnly()` |
| 13 | Add a second way to export a room: only the first format's `exportRoom` serves Export | Said in API.md; a second way out is a command or a ⋯ More entry (a chooser is later work) |

**The last check.** A fresh author (another model, never shown the kernel), given only API.md and
`app/plugins/README.md`, wrote a new plugin (a command that sets stale thoughts to revisit in one
step, and an Editor line) that compiled first time. It logged one defect, no whole `feature.json`
in the guide (it read the one `new-plugin` made), and a few guesses: the unit of times, what
`changed` gives for a mark never edited, where `ui.el` comes from, whether `order` is needed. All
are now said in the two docs.


**Phase 9.** Provoke (`app/plugins/provoke/`), the reader the corpus prepared for, is held to the
same suite (it is in `CORPUS` in `corpus.test.js`) and has its own gate, `tests/provoke.test.js`.
It needed nothing new from v2. Writing that gate found a fault in the test host: it kept the
tables it had last written down by reference, so the log heard no moment in any corpus test; it
now keeps a copy, as `World.js` does.

## API 3: the open core, checked

The open core (1.1.0) set out to make the plugin API wide enough that any application can be built
as a plugin while the six tables stay the only material. Each of its test applications now has the
API it needs, and a corpus plugin that uses it:

| Test application | What it needs from the API | Proved by |
| --- | --- | --- |
| First-letter highlight | a decorator (read-only, on every thought) | `first-letters` |
| Spell checker | a decorator, the caret, a fix as one step | `spell-marks` |
| Calendar, Kanban | a rule's draw, drop and land | `calendar`, `kanban` |
| Book editor | units of a size, a paragraph in fragments across pages, a part's position, the zoom | `page-flow`, `word-count-strip` (the Book itself is a plugin file, built after E's review) |
| Word document | spans kept on the mark, rich kinds in a flow, a second way out | `bold-italic`, `table`, `figure`, `docx` |
| Image editor | a surface and the pen, a stroke one step | `sketch` |
| Spreadsheet chart | a box that asks for a surface | `chart` |

Defect 13 (a second way to export a room) is fixed: when several formats can take a room out, ⋯ More
offers each by name.

The last check for the freeze was a fresh author again: given only `API.md`, they wrote `highlighter`
in one go, and every place the page left them guessing (sixteen, none a missing feature) was put right
in `API.md` before the freeze: what `ui.text.caret().text` holds, that a bare caret styles nothing,
what `style` returns, what a mark row and `marks.in` carry, how `marks.markdown` writes a plugin's span,
which items' `order` is optional, and what a decorator is given.

