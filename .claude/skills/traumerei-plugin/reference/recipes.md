# Recipes: the closest plugin for each kind of idea

Start from the closest one, copy its shape, change what differs. Each is in the repo at
`app/plugins/<id>/`; the ones marked ★ are also bundled in this skill's `examples/` folder, whole.
All of them are corpus plugins written against the API alone and held by the same checks you run.

| You want… | Slot(s) | Start from | What it shows |
|---|---|---|---|
| A new way to lay out a room (grid, columns, a list) | `slots.rules` `arrange` | ★ `grid` (15 lines) | the smallest rule; `hand: false` |
| A layout that reads groups or gaps | `slots.rules` | `kanban` (columns by group, open gaps first), `outline` (indented tree) | `links.members`, `gaps.of` inside `arrange` |
| A layout with its own background form (days, lanes, shelves) where dropping means something | `rules` + `draw`, `drop`, `land` | ★ `calendar` | boxes, proposals `{ due }`, `{ clear }` |
| A layout by time | `rules` | `timeline` (by day made), `random` (scatter) | `m.at`, moments |
| Pages, a document, a column you write in | `rules` with `width`, `height`, `lines` fragments, `ui.measure` | `page-flow`, `manuscript` (chapters as headings, `join`), `book` (whole editor; not corpus) | fragments, `claims`, `join` proposals |
| A new kind of thought (a to-do, a quote, a table, a file) | `slots.kinds` | ★ `checkbox` (gap as tick), `quote`, `table`, `code-block` | `tidy`, `text`, `node`, `fields`, `add` |
| A kind made from a picked or dropped file | `slots.kinds` with `add.file`, `takes`, `fromFile` | `audio-note`, `pdf-page`, `figure` (inline in a flow) | data URLs as fields |
| A thing you draw in or click into (pen, canvas, chart) | `slots.kinds` + `slots.surfaces`, need `surface` | ★ `sketch` (kind with a pen), `chart` (rule box with a surface) | one gesture = one step; strokes as fields |
| A new kind of link between thoughts | `slots.linkKinds` | ★ `cites` (13 lines), `contradicts` (`both`), `example-of`/`translates` (`admit` refusing in words) | `admit(from, to, reads)` |
| Showing and editing links | `slots.editor` | `links` | Editor section listing links both ways |
| A look on words that is kept (bold, highlight) | `slots.spans` + commands in zone `editing` | ★ `bold-italic`, ★ `highlighter` | `ui.text.caret`, `ui.text.style`, `md` |
| A look on words that is never kept (first letters, misspellings) | `slots.decorators` | ★ `first-letters` (19 lines), `spell-marks` (with a fix command) | fast `decorate(text)` |
| A section in the Editor about the chosen thought | `slots.editor` | `word-count` | `render(x)` with `ui.el` |
| A status line, a bar word, a page of its own | `slots.strip`, `slots.bar`, `slots.pages` | ★ `word-count-strip` | cache by `moments.seq()`, `ui.zoom` |
| A key or ⋯ More entry that goes somewhere or does one thing | `slots.commands`, `slots.more` | ★ `oldest-gap`, `focus-mode` (docks, frame hint), `export-room` | `zone`, `when`, `ui.open` |
| A panel in a dock | `ui.docks.right.open` from a command | `link-graph` (SVG in the right dock), `room-outline` (left dock), `room-stats` | redraw on `links.on` |
| Export a room as a file | `slots.formats` `exportRoom`, or a command with `ui.files.save` | ★ `plain-text`, `docx` (Word), `csv-marks`, `json-tables`, `anki-deck` | `marks.markdown`, `ui.files.save` |
| Import a file as a room | `slots.formats` `accepts`, `importRoom` | ★ `plain-text`, `markdown-vault` (zip, wikilinks as links), `csv-marks` | make it all inside `together()` |
| A reader that proposes changes by rule | commands + proposes in `together` | `due-finder` (dates in words → due), `word-linker` (shared words → links) | one step for the whole read |
| AI suggestions | `slots.providers`, `t.ai.call` | `provoke` (not corpus; read `app/core/AI.md`) | suggestions as marks with a gap to judge |
| Printing / a read-only view | command opening a window or page | `print-view` | — |

Names in the table that are not corpus (`book`, `provoke`, `search`, `desk`, `gaps`, `returns`,
`time`, `export`, `templates`, `roomfile`, `source`) are real shipped plugins: larger, good for
seeing a whole product, not for copying first.
