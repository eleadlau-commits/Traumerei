# Reading notes: core gaps

Plan of record: E's edited plan of 23 Nov 2026. No core changes from the plugin. Every stage works
on plugin API 3 as it is (app 1.1.2), and none of these blocks anything.

**This is the batch (24 Nov 2026).** E asked for every gap found so far in one list, to hand to the
Träumerei core session together with Book's list, so core fixes them all at once. Each fix is
additive only, as the freeze allows (`v2.js`, `API.md` and `tests/api.test.js` together). Where
Book's list names the same gap, its number is given, so the core session fixes it once.

| # | Gap | Found by | Today's workaround |
|---|-----|----------|--------------------|
| 1 | No event when a room's mode changes | Book (B-a) and Reading | Watch the canvas's `data-mode` |
| 2 | `ui.zoom` gives no view position, no eased move | Book (B-d) and Reading | Read the canvas's CSS transform |
| 3 | Desktop file handles: path, show at a page, hash | Reading | Paste the path, pick the file again |
| 4 | A rule can't read what the person has open | Reading, stage 1 | Columns side by side, view slides |
| 5 | Clear-space pushes marks a `hand: false` rule places | Book 0.4.7 | Rows at least 20 units apart |
| 6 | A plugin's dock has no hide | Book (B-b) | Run the docks' own command |
| 7 | `rules.layout` lags the thought being written | Book (B-c) | Book works around it in `zoom.js` |
| 8 | A chosen slot has no API word | Book (B-e, its gap 11) | Choose the mark above the slot |
| 9 | The packer puts every file of a plugin in one scope | Reading, stage 1 | No top-level name in two files |

1 to 5 matter most: 1 and 2 because two plugins scrape the same markup and break together, 3
because it is the jump readers feel most, 4 because it is the plan's canvas, 5 because it costs
seconds in any rule with close rows.

## Fallback helpers from day one

Each gap sits behind one small helper in the plugin. The helper uses the new API if the app has it
and falls back to the workaround if it doesn't, so the plugin works on 1.1.2 and switches over with
no rewrite when core ships.

- `onModeChange()`: `ui.chosen.on` if present, else watch the canvas's `data-mode` (Book's `docks.js`).
- `viewGet()` / `viewGo()`: `ui.zoom.get` / `go` if present, else read the canvas transform (Book's `zoom.js`).
- File handles: `ui.files` `path` / `show` / `hash` if present, else paste the path and pick the
  file again to verify.

## The gaps

### 1. Mode change event (Book's B-a, now two plugins)
- **Missing:** no event when a room's mode changes. Book watches `data-mode` on the canvas with a
  MutationObserver (`book/docks.js`); Reading would do the same to open its docks when a room
  turns to Library.
- **Why now:** two plugins scraping the app's markup means one markup change breaks both at once.
- **Addition:** `ui.chosen()` also carries `mode` (the open room's), and `ui.chosen.on` fires when
  it changes.

### 2. View position (Book's B-d, now two plugins)
- **Missing:** `ui.zoom` tells the zoom, not where the view is. Book reads the world layer's CSS
  transform off the canvas for its smooth jumps (`book/zoom.js` `viewNow`); Reading's jump to a
  note or source would too.
- **Why now:** same as 1: both break together on a markup change.
- **Addition:** `ui.zoom.get()` also gives the view's centre `{ x, y }` in world units, and
  `ui.zoom.go({ x, y, zoom }, { ms? })` moves there eased (at once when the system asks for less
  motion).

### 3. Desktop file handles (R1, R2, R3 as one)
- **Missing:** a picked or dropped file has no path (only name, size, bytes); `ui.link` opens
  `https://` only; nothing re-reads a file later.
- **Why:** open the PDF at the quote's page is the jump readers will feel most.
- **Addition (desktop app only; only paths the app itself handed out, any other refused):**
  `ui.files.open` and dropped files also give `path`; `ui.files.show(path, { page? })` opens it in
  its own app (a PDF at a page where the viewer takes one) or reveals it in Explorer;
  `ui.files.hash(path)` gives `{ sha256, bytes }`, never the contents. `null` / refused in a
  browser.
- **Without it (the plan as written):** paste the path once on attach (kept relative to a
  per-computer library folder); Verify by picking the file again; Copy path and page on a quote.

### 4. A rule can't read what the person has open (found building stage 1)
- **Missing:** a rule's `arrange` and `draw` are handed only the tables and the room's settings.
  Which source is open is the session's choice, not content, so it is in neither; writing it into
  the room (`marks.edit` of the room's `rules`) would make every switch of source an undo step and
  a moment in the log.
- **Why it matters:** the plan's canvas shows the open source's stream only.
- **Meanwhile (0.1):** every source is its own column side by side, and opening one slides the view
  to it (`viewGo`), so the open source's stream is what the canvas shows; the others sit off to
  the side. Helper: the open source is kept by the plugin per room, for the session.
- **Addition:** a rule's hooks also handed a per-room view value the plugin sets without a step
  (for example `t.rules.view(room, value)` read as `reads.view`), never saved in the tables.

### 5. Clear-space pushes what a rule lays out itself (found speeding up Book, 23 Nov)
- **Missing:** the room's clear-space (`room/view.js` `clearNow`) treats every thought as a block
  and keeps 18 units between them, even in a room whose rule places every mark itself
  (`hand: false`). It pushes through the rule's `drop`, which such a rule refuses, so the same push
  comes back after every redraw, with up to three redraws a change.
- **Why it matters:** Book 0.4.6 laid paragraphs 15 units apart; at 1,500 thoughts a room took
  12 s to open and 12 s to keep a thought.
- **Meanwhile (Book 0.4.7):** nothing a rule lays out sits closer than 20 units under another
  thought, and a drop inside a mark's own row is refused from the layout last drawn. Reading
  already spaces its rows 22 apart. Any rule with close rows meets this.
- **Addition:** clear-space leaves out the marks of a rule with `hand: false` (it places them; a
  push can't stick), or a rule may say `clear: false`.

Gaps 6 to 8 are Book's; Book's own list has the detail and is the one to fix them from. They are
here so the batch is whole.

### 6. A plugin's dock has no hide (Book's B-b)
- **Missing:** a plugin opens and closes its own tab in `ui.docks.left/right`, but can't tuck the
  dock away again; Book runs the docks' own command (`docks.left`) to do it.
- **Addition:** `ui.docks.left/right` also hide and show the dock.

### 7. `rules.layout` lags the thought being written (Book's B-c)
- **Missing:** `rules.layout` is remembered by table versions only, so while a thought is being
  written (which changes no table) it gives the layout from before the draft moved.
- **Addition:** the draft is part of what `rules.layout` remembers by.

### 8. A chosen slot has no API word (Book's B-e, its core gap 11)
- **Missing:** a rule can draw an invisible box (a slot) that is chosen as any box is, but there is
  no word for "a thought begun here goes in this slot"; Book chooses the mark above the slot, the
  moment a key begins a paragraph, so the room draws the words under it.
- **Addition:** a box a rule draws can say where a thought begun in it lands.

### 9. The packer puts every file of a plugin in one scope (found building stage 1)
- **Missing:** `build.py pack-plugin` joins a plugin's files into one script, so a top-level name
  declared in two files (`const { el } = ui` in each) fails only once packed, not in the tests.
- **Meanwhile:** Reading uses `ui.el` and keeps every top-level name in one file.
- **Addition (tooling, no API):** pack each file in its own scope, or `build.py check` names the
  clash before packing.

## Not core: stage 0

- **Speed harness flag.** `tests/speed.mjs` times the bare app; `build.py check` times a rule's
  layout and draw, not the room in the browser. Adding `--plugin <file> --world <sample.traum>`
  times room open (0.8 s), Enter (0.35 s) and keydown (20 ms) with a plugin imported and its room
  open. Tests only, no API. Book's in-browser timings get proven per PR too.

## Not gaps (checked)

- **Making a tag group as a note is kept:** Book's "just after the gesture" pattern, one step.
- **Editing a link's label** (a quote's page): unlink and link inside `together()`, one step.
- **Setting a room's mode:** a plugin can read it, not set it (`marks.edit` doesn't reach the
  room's view). But a `.traum` carries `mode:`, so New library lands a template through
  `carriers.land`, then `ui.open.room`. Confirmed in stage 1.
- Source metadata in `slots.groups` `fields`; quotes, comments and tags as lines, a quiet link
  kind and a group family; the hash computed by the plugin from the picked file's bytes; Word
  export from Book's `word.js` and `zip.js`, copied in; BibTeX through `slots.formats`; Enter
  keeps and Ctrl+Enter is a new line by the room's default.

## Out of this plan

- **Text reader** (explored 23 Nov): a per-computer copy of every text in `t.store.files` is the
  big storage problem again, and a second product. Moved to later; before planning it, check the
  store's limits, failure when a copy is missing or a write fails, and its cost to the 0.8 s open.
  Importing a text as thoughts was rejected outright: it would put the full text in the `.traum`.
