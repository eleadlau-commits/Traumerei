# Create

What the home page's **Create** opens: rooms of thoughts.

- **The rooms page** slides up from the bottom, leaving a strip of the home page at the top with a
  back arrow (top right) home. It is a light opacity mask (`look.js`) over the home picture
  itself, which is held still underneath: its spontaneity layer is off while the rooms page
  shows (the Renderer's `backdrop` service). The page is a grid of square cells. Each room
  is an opacity square on it (its tint, black by default, at an alpha that deepens as the room
  darkens); a room written in during the last day glows. **Messy thoughts** is always there,
  four cells at the top left, the deepest square. Click an empty cell to make a room there; drag
  a room to any free cell (it snaps back if the cells are taken). **Settings → Rooms** sets the page's mask (opacity and colour), the squares (strength, colour,
  glow, size) and the default look inside rooms (tint, colour strength, lightness, Messy's
  lightness); a room's own Tint wins. While the rooms page shows, the home picture's
  spontaneity layer is turned off. *Rooms*,
  *New room* and *Settings* (the app's Settings) are along the bottom; double-click a room's name
  to rename it. **Typing anything here opens Messy thoughts and starts writing there, at a random
  place.**
- **A room** fills the screen as one gradient of its own colour, with the back arrow to the rooms.
  *Tint* sets its tint, lightness and opacity (by default the picture's colour, quietened; Messy
  is a little darker). It is a canvas. Drag to move around; the mouse wheel, Ctrl+wheel or a pinch zooms;
  a trackpad's two-finger scroll moves around. Type anywhere to write a thought; Enter ends it.
  On a phone, *Write* opens the keyboard. Escape goes back to the rooms (and from there, home).
- **Ontological modes**, top right, chosen per room:
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

- **Rooms page:** hovering over a square outlines it; a click chooses it and shows its options
  beside it (name, Go in, tint, lightness, size 1 × 1 or 2 × 2, Delete); a double click goes in.
  There are no words along the bottom: empty squares make rooms, and Settings is in the menu.
- **Joyce's line:** each thought stands on its own, joined to the next by a line. Its tension
  comes from time: thoughts written close together are joined taut, a pause leaves slack, and
  pulling a thought far away makes it straight again (Settings → Rooms → Line tension). Drag a
  thought to move it alone; double-click a train to choose it whole, then drag it.
- **Timeline:** hover over Joyce and Timeline drops down below it. It opens a list down the
  left of everything written in the room, in the order it was last changed (latest at the
  bottom), each with its time and its train as a tag (Joyce's tags only). Scroll it to see
  everything; a click takes the view to that thought.
- **Editing:** a click on a thought (or a double click on a train) opens a pop-up beside it, in
  the rooms page's style: edit its words (a passage's title and body, a picture's caption, a
  train's name), fold or unfold a train, move it to another room, or delete it. In a thought's
  box Enter keeps it and **Ctrl+Enter** (Cmd+Enter) starts a new line inside the thought; the
  thought below makes room. Writing keeps its own keys: there Ctrl+Enter still starts a new train.
- **Add** (bottom left) unfolds to Thought, Passage, Picture and the room's settings.
- **Ctrl+K** searches every room; **Ctrl+Z** undoes and **Ctrl+Shift+Z** (or Ctrl+Y) redoes. A
  quiet *Saved* shows in the corner, and a line of help the first time each page is seen.
- **Choosing many:** drag on the empty canvas to draw a selection box; the chosen thoughts move
  together when one is dragged, and can be moved to a room or deleted together. **Ctrl+drag**
  (or two fingers on a phone) moves the canvas. Names keep with Enter.
- Every pop-up and panel (Add, room settings, the sheet, the timeline, a thing's edit pop-up)
  shares one pale, blurred white style.
- **The grid grows:** there is always a spare column and row past the furthest room, and the
  page scrolls; Settings → Rooms sets columns and rows at least.
- **Lights:** a room's glow follows your attention lately: going in and writing there light it,
  and the light fades over a day or two (`attention.js`, saved as 'attention').
- **Keys:** Ctrl+A chooses everything in a room; Delete deletes what is chosen (or the chosen
  room on the rooms page); arrows nudge it (Shift for bigger steps); Enter opens the chosen room;
  ? (or Add → Keys) lists them all. Ctrl+drag, Space+drag or the middle button move the canvas.
