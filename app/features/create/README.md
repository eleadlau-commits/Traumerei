# Create

What the home page's **Create** opens: rooms of thoughts.

- **The rooms page** slides up from the bottom, leaving a strip of the home page at the top with a
  back arrow (top right) home. It is a light opacity mask (`look.js`) over the home picture
  itself, which is held still underneath: its spontaneity layer is off while the rooms page
  shows (the Renderer's `backdrop` service). The page is a grid of square cells. Each room
  is an opacity square on it: a deeper version of the room's own colour inside, (L_r − 0.35,
  C_r, h_r) in OKLCh, at α = strength × (1.1 − L_r) × opacity, so a darker room is a deeper
  square; a room written in during the last day glows. **Messy thoughts** is always there,
  four cells at the top left, the deepest square. Click an empty cell to make a room there; drag
  a room to any free cell (it snaps back if the cells are taken). **Settings → Rooms** has two folds: *The rooms page* (mask
  opacity, square strength, glow, size, columns and rows at least) and *Inside a room* (lightness,
  Messy's lightness, Joyce's line tension). Every colour comes from the app's palette (Settings →
  Colour, the Renderer's one tint): the mask is its ink, and a room with no colour of its own
  takes its paper. While the rooms page shows, the home picture's
  spontaneity layer is turned off. *Rooms*,
  *New room* and *Settings* (the app's Settings) are along the bottom; double-click a room's name
  to rename it. **Typing anything here opens Messy thoughts and starts writing there, at a random
  place.**
- **A room** fills the screen as one gradient of its own colour, with the back arrow to the rooms.
  Its colour, lightness and opacity are set only in its pop-up on the rooms page (by default the
  tint's paper colour at the default lightness; Messy is a little darker). It is a canvas. Drag to move around; the mouse wheel, Ctrl+wheel or a pinch zooms;
  a trackpad's two-finger scroll moves around. Type anywhere to write a thought; Enter ends it.
  On a phone, *Write* opens the keyboard. Escape goes back to the rooms (and from there, home).
- **Ontological modes**, in a rail on the left of a room, where *Rooms* and *Archive* sit on the
  rooms page; the current one is marked. A small room (1 × 1) keeps the one mode it was made with,
  and the rail only names it. A big room (Messy thoughts, or any 2 × 2 room) lists them all and
  switches with a click; a big room made small again keeps the mode it has then. Under *Joyce*,
  *Timeline* opens the list of its thoughts by time.
  - **Joyce** (the default). Thoughts are joined by time into *trains*, each read like a
    paragraph. Enter goes on with the same train; **Ctrl+Enter** starts a new train at a random
    place. A train can't be broken: it is dragged, and moved, whole.
  - **Pessoa**. Every thought floats on its own, laid on a loose spiral outwards in the order
    they were written, and can be dragged anywhere (Pessoa keeps its own places; Joyce is not
    changed by them).
- **Moving.** Tap a train (Joyce) or a thought (Pessoa) to select it, then *Move to* a room, or
  *A new room*. A thought moved on its own leaves its train; the rest of the train stays joined.
- **Bigger thoughts.** *Passage* (Alt+P): a title and a paragraph or small article. *Picture*
  (Alt+I, or paste one): a picture, shrunk to a small JPEG, with a caption. Double-click either to
  edit it.
- **Folding.** Select a train and *Fold into one thought*, then name it. It shows as one thought
  (in Pessoa it floats as one); *Unfold* opens it again.

**Everything is a thought.** `model.js` has three sorts: *items* (line, passage, picture; each
kind is one small file in `items/`, so a new kind such as a PDF page is one new file), *groups*
and *rooms*. Items and groups sit in a room. A group belongs to the ontology that made it (Joyce
makes trains) and lists its items, so one item can be in groups of several ontologies. Each
ontology says whether an item can be in **one** of its groups (a train) or in **many**. Every
group can be folded, named, moved and deleted, and is always the same group, never a copy.

**Ontologies** are in `ontologies/`, one file each (Joyce, Pessoa), or come from another feature
through the slot `create.ontologies`. `ontologies/index.js` describes their shape: name, groups,
units, where each sits, what a drag does, and optional tray, settings and moves. Each keeps its
own data per room (`own()` in model.js: Pessoa's dragged places). An ontology can draw its own
canvas (Joyce's line and trains) and have a panel down the left (Joyce's Timeline); Create keeps
no mode of its own. A room whose ontology is missing is seen through Pessoa.

The rules (no screen) are in `model.js`, tested in `tests/model.test.js`. Everything is saved under
the key `world3` (a world saved in an older shape is not kept) and follows the account like the settings. Other features reach it through the
`create` service (`open()`).

## Editing, the line, the timeline

- **Rooms page:** hovering over a square outlines it; a click chooses it (a fine outline); a
  right-click (or a long press, the ContextMenu key, Shift+F10) shows its properties beside it
  (name, description, Go in, its kind, colour, lightness, opacity, size 1 × 1 or 2 × 2, Back
  to the tint, Lock, Archive, Delete); a double click or Enter goes in. A colour picked there is the room's colour inside, its
  lightness included; the square shows a deeper version of it.
  There are no words along the bottom: empty squares make rooms, and Settings is in the menu.
- **Joyce's line:** each thought stands on its own, joined to the next by a line. Its tension
  comes from time: thoughts written close together are joined taut, a pause leaves slack, and
  pulling a thought far away makes it straight again (Settings → Rooms → Line tension). Drag a
  thought to move it alone; double-click a train to choose it whole, then drag it.
- **Timeline:** hover over Joyce and Timeline drops down below it. It opens a list down the
  left of everything written in the room, in the order it was last changed (latest at the
  bottom), each with its time and its train as a tag (Joyce's tags only). Scroll it to see
  everything; a click takes the view to that thought.
- **Editing:** a click on a thought (or a double click on a train) only chooses it. A right-click
  (or a long press, or Enter) opens its properties beside it, in the rooms page's style: edit its words (a passage's title and body, a picture's caption, a
  train's name), fold or unfold a train, move it to another room, or delete it. In a thought's
  box Enter keeps it and **Ctrl+Enter** (Cmd+Enter) starts a new line inside the thought; the
  thought below makes room. Writing keeps its own keys: there Ctrl+Enter still starts a new train.
- **Add** (bottom left) unfolds to Thought, Passage, Picture and Keys. A right-click on the empty
  canvas opens Add at the pointer, and what is made goes just there.
- **Search** (top right, beside the back arrow, or Ctrl+K / ⌘K) searches every room; **Ctrl+Z** undoes and **Ctrl+Shift+Z** (or Ctrl+Y) redoes. A
  quiet *Saved* shows in the corner, and a line of help the first time each page is seen.
- **Choosing many:** drag on the empty canvas to draw a selection box; the chosen thoughts move
  together when one is dragged, and can be moved to a room or deleted together. **Ctrl+drag**
  (or two fingers on a phone) moves the canvas. Names keep with Enter.
- Every pop-up and panel (Add, the sheet, the timeline, a thing's edit pop-up)
  shares one pale, blurred style: the palette's veil.
- **The grid grows:** there is always a spare column and row past the furthest room, and the
  page scrolls; Settings → Rooms sets columns and rows at least.
- **Lights:** a room's glow follows your attention lately: going in and writing there light it,
  and the light fades over a day or two (`attention.js`, saved as 'attention').
- **Keys:** Ctrl+A chooses everything in a room; Delete deletes what is chosen (or the chosen
  room on the rooms page); arrows nudge it (Shift for bigger steps); Enter opens the chosen room;
  ? (or Add → Keys) lists them all. Ctrl+drag, Space+drag or the middle button move the canvas.

## The rooms page, step 1

- **Peek:** a square shows the last thing written in its room (Messy thoughts, the last three),
  and its description, in small faint words: when hovered over by default, or always (Settings →
  Rooms → Peek).
- **The last room** gone into has a soft outline of light. **A dot** (top right) marks a room where
  a thought was left half written: leaving a room keeps the unfinished thought (saved as
  'drafts'), and going back in puts it back where it was.
- **Search lights:** Ctrl+K on the rooms page opens a field at the top; the rooms without the
  words dim, and the others show how many things in them hold the words. Enter goes into the
  room with the most; Escape puts the lights out. (Inside a room, Ctrl+K still searches every
  room in a list.)
- **Lock** (in a room's pop-up): nothing in a locked room can be written, moved or deleted, and its
  square keeps its place on the grid (no dragging, no resizing, no Delete). A thin bar runs along
  its top. Inside, a click shows a thought's words, read only. Unlock from the same pop-up.
- **Description:** a line or two about a room, written in its pop-up; it shows under the room's
  name inside, and in its peek.
- **Archive** (in a room's pop-up, or drop a square on *Archive* in the rail): the room leaves the
  grid for the Archive, a page of its own reached from *Archive* in the rail on the left (Escape,
  back or *Rooms* goes back). It has the same grid lines as the rooms page, with the rooms in the
  order they were archived, but its empty cells make no rooms. A click on a room shows Go in,
  Restore (to the first free cell) and Delete. Archived rooms are still found by search.
- **Colour:** a square shows its room's colour more vividly than before: (L − 0.25, vivid × C, h)
  at α = strength × (1.2 − L) × opacity (Settings → Rooms → Colour strength, 1.6 by default).
- **Going in:** the square grows to fill the screen in the room's own colour, then fades into the
  room (skipped when the system asks for less motion). The room takes typing at once.

## Step 2: kinds of room, pages, the rail

- **Kinds.** A click (or a right-click) on an empty cell asks which kind the new room is:
  *Joyce · Pessoa*. Rooms sit only on the rooms page; nothing nests. A square dropped on another
  square goes back to its place.
- **Pages.** The rooms page has pages, *1 2 3 +* along the bottom. *+* makes a new one; a square
  dropped on a number moves there. Messy thoughts stays on page 1.
- **The rail and the menu.** The menu (☰, with Settings) sits at the top left of the top bar on
  every page: home, the rooms page and inside a room. Under it, on the rooms page, a thin rail
  holds *Rooms* and *Archive* (no count).
- **Moving thoughts** (*Move to…*) lists every room, Messy thoughts first. Search and the timeline
  choose what they find without opening its properties.
- On a Mac, Ctrl+click is a right-click; Ctrl+drag still moves the canvas.

In `model.js`: a room's `page` and `archived` (when); `world.pages`. `addRoom` takes the page and
the kind; `toPage`, `addPage`, `archive` and `restore` do the rest. A train sits in any room, a room
only on the rooms page.
