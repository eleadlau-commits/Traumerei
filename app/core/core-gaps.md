# Reading notes: core gaps

Plan of record: E's edited plan of 23 Nov 2026. No core changes. Every stage works on plugin API
3 as it is (app 1.1.2); none of these blocks anything. They are the three core asks, in the order
worth fixing, brought to E as one batch, never one at a time. Each would be additive only, as the
freeze allows (`v2.js`, `API.md` and `tests/api.test.js` together), as its own small PR, and only
once E says so.

## Fallback helpers from day one

Each gap sits behind one small helper in the plugin. The helper uses the new API if the app has it
and falls back to the workaround if it doesn't, so the plugin works on 1.1.2 and switches over with
no rewrite when core ships.

- `onModeChange()`: `ui.chosen.on` if present, else watch the canvas's `data-mode` (Book's `docks.js`).
- `viewGet()` / `viewGo()`: `ui.zoom.get` / `go` if present, else read the canvas transform (Book's `zoom.js`).
- File handles: `ui.files` `path` / `show` / `hash` if present, else paste the path and pick the
  file again to verify.

## The asks

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

## Not core: stage 0

- **Speed harness flag.** `tests/speed.mjs` times the bare app; `build.py check` times a rule's
  layout and draw, not the room in the browser. Adding `--plugin <file> --world <sample.traum>`
  times room open (0.8 s), Enter (0.35 s) and keydown (20 ms) with a plugin imported and its room
  open. Tests only, no API. Book's in-browser timings get proven per PR too.

## Carried from Book: workarounds hold, not asked now

- **B-b.** A plugin's dock has no hide (Book runs the docks' own command).
- **B-c.** `rules.layout` lags the thought being written.
- **B-e.** The chosen box (slot) has no API word (Book's gap 11).
- Book's Twin gap (15) doesn't touch Reading notes.

## Not gaps (checked)

- **Making a tag group as a note is kept:** Book's "just after the gesture" pattern, one step.
- **Editing a link's label** (a quote's page): unlink and link inside `together()`, one step.
- **Setting a room's mode:** a plugin can read it, not set it (`marks.edit` doesn't reach the
  room's view). But a `.traum` carries `mode:`, so New library lands a template through
  `carriers.land`. To confirm in stage 1.
- Source metadata in `slots.groups` `fields`; quotes, comments and tags as lines, a quiet link
  kind and a group family; the hash computed by the plugin from the picked file's bytes; Word
  export from Book's `word.js` and `zip.js`, copied in; BibTeX through `slots.formats`; Enter
  keeps and Ctrl+Enter is a new line by the room's default.

## Out of this plan

- **Text reader** (explored 23 Nov): a per-computer copy of every text in `t.store.files` is the
  big storage problem again, and a second product. Moved to later; before planning it, check the
  store's limits, failure when a copy is missing or a write fails, and its cost to the 0.8 s open.
  Importing a text as thoughts was rejected outright: it would put the full text in the `.traum`.
