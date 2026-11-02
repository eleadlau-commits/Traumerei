# Create

What the home page's **Create** opens: rooms of thoughts.

- **The rooms page** slides up from the bottom, leaving a strip of the home page at the top with a
  back arrow (top right) home. It is a still gradient of the picture's own colours under a
  light opacity mask (`look.js`), read once when it opens; the picture's animation stops
  underneath (the Renderer's `backdrop` service). The page is a grid of square cells. Each room
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
