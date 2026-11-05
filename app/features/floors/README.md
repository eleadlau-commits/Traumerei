# Floors

The rooms page's floors: how big every floor is, and where a room goes when it is placed for you.

- **One size for every floor**, chosen in **Settings → Floors**: Small 6 × 4, Medium 8 × 5 (the
  default) or Large 10 × 6. A floor never grows a row or column.
- **Choosing a smaller size** while any room sits outside it shows an error under the choice
  ("Floor 2 has rooms outside 6 × 4. Move them first.") and keeps the old size.
- **Placed for you** (a new room, an imported file, a room restored from the Archive, a new room
  made from inside a room, a room with no cell in old saved data): in the cell asked for if it is
  free, else the first free spot of its size on its own floor, else a new floor at the end. Other
  floors are not searched. A note says so: "Floor 2 was full, so Algebra is on a new Floor 4."
- **Moved by you:** dragging to a cell or making a room 2 × 2 works only on the board; a room
  dragged onto a full floor's number stays where it was.

## The floors service

`this.use('floors')` gives everything it offers:

| Member | What it does |
|---|---|
| `size` | `{ cols, rows }`: every floor's size. |
| `place(id, cell)` | Places room `id` by the rule above (`cell`: `{ col, row }`, optional). Returns `{ page, from, spilled }`, or `null` (no such room, or archived). The caller saves. |
| `settle(page)` | Places every room on floor `page` with no cell, outside the board or on another's cells (Messy thoughts first). Returns the rooms that went to a new floor. |
| `move(id, col, row)` | Moves a room to a cell of its floor, if it is on the board and free (not a locked room). True when it moved. |
| `resize(id, size)` | A room 1 × 1 or 2 × 2, if its cells stay on the board and free. True when it changed. |
| `toFloor(id, page, cell)` | Moves a room to floor `page`, in `cell` if it is free there, else the first free spot: true, false (Messy thoughts, a locked room, its own floor), or `'full'`. |
| `fits(size)` | Whether every room fits floors of `size` (`{ cols, rows }`). |

**Event:** `floors:size` `{ cols, rows }`, when the size is changed.

It saves only the chosen preset ('size'). It has no slots and no styles of its own.

**The code.** `rule.js` is the rule (plain functions of a world and a board, no screen), tested
in `tests/floors.test.js`; `Floors.js` keeps the preset, says the notes and draws the setting.
The world's rules come from the world feature through `world.js` (bound in `Floors.start`).
