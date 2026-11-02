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
- **Ontological modes**, named at the top left of a room. A room's mode is set only in its
  properties, on the grid that holds it (the rooms page, or a Borges room): never from inside.
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

**Everything is a thought.** `model.js` has one object, the thought, of five kinds: line,
passage, picture, train and room. Each sits inside another (`parent`): lines, passages and pictures
in trains, trains in rooms, rooms in rooms or at the top. Moving, folding, naming and removing are
the same operations for every kind. A folded train is the train itself shown as one thought, so
unfolding never loses anything. Older saved data (the first prototype's shape) is converted on load.

The rules (no screen) are in `model.js`, tested in `tests/model.test.js`. Everything is saved under
the key `world` and follows the account like the settings. Other features reach it through the
`create` service (`open()`).

## Editing, the line, the timeline

- **Rooms page:** hovering over a square outlines it; a click chooses it (a fine outline); a
  right-click (or a long press, the ContextMenu key, Shift+F10) shows its properties beside it
  (name, description, Go in, mode, colour, lightness, opacity, size 1 × 1 or 2 × 2, doors, Back to
  the tint, Lock, Archive, Delete); a double click or Enter goes in. A colour picked there is the room's colour inside, its
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
- **Archive** (in a room's pop-up): the room leaves the grid for the Archive, a page of its own
  reached from *Archive* (with its count) in the rail on the left (Escape, back or *Rooms* goes back). There a click shows
  Go in, Restore (to the first free cell) and Delete. Archived rooms are still found by search.
- **Colour:** a square shows its room's colour more vividly than before: (L − 0.25, vivid × C, h)
  at α = strength × (1.2 − L) × opacity (Settings → Rooms → Colour strength, 1.6 by default).
- **Going in:** the square grows to fill the screen in the room's own colour, then fades into the
  room (skipped when the system asks for less motion). The room takes typing at once.

## Step 2: Borges rooms, doors, merging, pages

- **Two kinds of room.** A *mode room* holds thoughts, seen through one mode (Joyce or Pessoa). A
  **Borges room** holds rooms instead, on a grid of its own like the rooms page: discrete sets,
  each room in one place. A click on an empty cell asks which kind the new room is (Joyce ·
  Pessoa · Borges); a right-click there does too. A Borges square carries a small mark of four
  squares, its count is the rooms it holds, and its peek shows their names.
- **Going in and back.** Going into a Borges room shows its grid, veiled in the room's own colour,
  with a path at the top (Rooms › Theory › Ontology) whose words go there. Back (or Escape) goes up
  one level, leaving the room you came out of chosen. Inside a room in a Borges room the path
  shows above its name.
- **Merging.** Drag a square onto another and confirm: the two become a new Borges room in that
  cell (name it), holding both. Dropped on a Borges room, a square is put inside it. Messy thoughts
  and locked rooms don't merge. Dropping a square on a word of the path takes it up there; on
  *Archive*, archives it.
- **Doors.** Drag from near a square's edge (the pointer turns to a cross) to another square to
  make a door between them; or *Door to…* in a room's properties, which reaches any room anywhere
  (doors are links, so they cross Borges rooms). On a grid a door is a slightly slack line between
  the two squares, thicker the more it is gone through. A room lists its doors under its name
  inside; a click goes through (and wears it in). Its properties list them too, each with × to
  take it away.
- **Pages.** The rooms page has pages, *1 2 3 +* along the bottom (a Borges room's grid has none).
  *+* makes a new one; a square dropped on a number moves there. Messy thoughts stays on page 1.
- **The rail.** A thin rail on the left, under the menu (☰, with Settings): *Rooms* and *Archive*
  with its count.
- **Moving thoughts** (*Move to…*) lists every mode room, wherever it is, by its path. Search and
  the timeline choose what they find without opening its properties.
- On a Mac, Ctrl+click is a right-click; Ctrl+drag still moves the canvas.

In `model.js`: a room's `form: 'borges'`, its `page` (top only); `world.doors` and `world.pages`.
`addRoom` takes the grid (`{ parent, page }`) and the kind; `putRoom`, `merge`, `addPage`,
`addDoor`, `removeDoor`, `doorsOf`, `useDoor` and `doorWidth` do the rest. A room sits only at the
top or inside a Borges room; a train only in a mode room (a saved world is repaired on load).
