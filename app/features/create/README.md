# Create

What the home page's **Create** opens: rooms of thoughts.

- **The rooms page.** Rooms are squares on a grid, under the same veil as the menu (the picture
  shows through, pale and soft), like the windows of a building at night. A room written in
  during the last day is lit. There is always a dark room called **Messy thoughts**. *New room*
  adds one; double-click a room's name to rename it. **Typing anything here opens Messy thoughts
  and starts writing there, at a random place.**
- **A room** is a dark canvas. Drag to move around; the mouse wheel, Ctrl+wheel or a pinch zooms;
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

The rules (no screen) are in `model.js`, tested in `tests/model.test.js`. Everything is saved under
the key `world` and follows the account like the settings. Other features reach it through the
`create` service (`open()`).
