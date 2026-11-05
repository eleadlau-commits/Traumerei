# Rooms

What the home page's **Create** opens: the rooms page, a grid of rooms under the veil. Going into a
room hands it to the **room** feature (`app/features/room`), which shows it and writes in it.

## Its services and events

`this.use('create')` (for the home page) offers `open()`: slides the rooms page up.

`this.use('rooms')` (for the room) gives everything it offers:

| Member | What it does |
|---|---|
| `openRoom(id)` | Goes into room `id` (its square grows to fill the screen). |
| `showRooms()` | Back to the rooms page from the open room (it shrinks into its square). |
| `showFloor(i)` | Back to the rooms page, on floor `i` (from 0). |
| `showArchive()` | Back to the rooms page, on the Archive. |

It sends `room:open` `{ id, from, seed }` when a room is gone into (`from`: the square's
rectangle; `seed`: a first key typed on the rooms page, for Messy thoughts). It listens to
`room:changed` (a room was written in, so leaving asks for a comment for next time) and to the
world's events.

It defines one slot, `rooms.room`: the open room, shown over this page, as one item
`{ leave(), hasDraft(id) }` (the room feature fills it). `leave()` leaves the room and returns
the id of the room that showed, or `null`; `hasDraft(id)` says whether a thought was left half
written there. With nothing in it, the rooms page works on its own.

## What it does

- **The rooms page** slides up from the bottom, leaving a strip of the home page at the top with a
  back arrow home in the top-right corner (the menu ☰ keeps the top-left one). It is a light opacity mask (`look.js`) over the home picture
  itself, which is held still underneath: its spontaneity layer is off while the rooms page
  shows (the Renderer's `backdrop` service). The page is a grid of square cells. Each room
  is an opacity square on it: a deeper version of the room's own colour inside, (L_r − 0.35,
  C_r, h_r) in OKLCh, at α = strength × (1.1 − L_r) × opacity, so a darker room is a deeper
  square; a room written in during the last day glows. **Messy thoughts** is always there,
  four cells at the top left, the deepest square. Click an empty cell to make a room there; drag
  a room to any free cell (it snaps back if the cells are taken). **Settings → Rooms** has two folds: *The rooms page* (mask
  opacity, square strength, glow) and *Inside a room* (lightness,
  Messy's lightness, and the global ontology settings such as Joyce's line tension, with *Apply
  to all rooms*). Every colour comes from the app's palette (Settings →
  Colour, the Renderer's one tint): the mask is its ink, and a room with no colour of its own
  takes its paper. While the rooms page shows, the home picture's
  spontaneity layer is turned off. *Rooms*,
  *New room* and *Settings* (the app's Settings) are along the bottom; double-click a room's name
  to rename it. **Typing anything here opens Messy thoughts and starts writing there, at a random
  place.**
- **Tags.** A room's properties (right-click its square) list its tags as small chips. Its mode is
  always one of them and can't be taken off: a small room's one mode, or all three (Joyce, Pessoa,
  Russell) for a big room. *+ tag* adds one of its own, suggesting the tags other rooms have
  (Enter adds it; Backspace in the empty field takes off the last). Tags are the same whatever
  their case, and show only in properties and the tags list, never on the squares.
  Under a hairline below *Archive* (and the page numbers), **Arrange by** opens a quiet list:
  *None*, then each tag group (Ontology first, *Other* last for the tags in no group). A click on
  a group opens it to its tags, each with how many rooms have it. Picking a tag lights its rooms
  and dims the rest, as the search lights do: nothing hides or moves. *None*, picking the tag
  again, or Escape makes every room bright again. In the rooms page's Search, **#tag** does the
  same (it lights the rooms with a tag that starts so).
  **Making tags.** *+ group* at the foot of the list makes a group; *+ tag* under an open group's
  tags makes a tag in it. A tag made so shows 0 until a room has it. **Drag a tag** (not a mode's)
  from the list onto a square to add it to that room; take it off in the room's properties.
  Right-click a tag in the list (a long press on a phone) to type its group (empty takes it out);
  *Subject: Algebra* in a room's + tag also works. *Ontology* holds the modes and can't change.
- **Motion.** Going into a room zooms in: its square grows to fill the screen while the rooms
  page swells and fades behind it. Leaving zooms out the other way, the room shrinking back into
  its square. (None of it with reduced motion.)
- **Floors slide.** All floors sit one under another in one tall strip, Floor 1 at the top
  (`strip.js`). The canvas shows one floor at a time and slides only to whole floors, about 0.4 s
  (a jump with reduced motion): the scroll wheel or trackpad (one gesture, one floor), Page Up and
  Page Down, or a floor in the rail. *+ New floor* adds one at the end and slides down to it.
  Holding a dragged square at the top or bottom edge of the canvas slides to the floor above or
  below, to drop it on a cell there.
- **Deleting a floor** (`floor.js`), like a room: a right-click on a floor in the rail chooses it
  and shows its properties in the right dock's Editor tab (Floor n, how many rooms, *Delete
  floor*); while they show, a click on another floor switches them. *Delete floor* (or **Delete**)
  first warns in the dock what will happen, with *Delete floor* (Enter) and *Cancel* (Escape).
  Then its rooms go to the Archive, the floors below move up one, and Ctrl+Z brings it all back. Floor 1 stays (Messy thoughts lives there); a floor with a locked
  room says so and stays (the floors feature's `removeFloor`). The floor that shows is drawn in full; the others are still
  copies until the strip rests on them.
## Choosing and editing rooms

- **Rooms page:** hovering over a square outlines it; a click chooses it (a fine outline); a
  right-click (or a long press, the ContextMenu key, Shift+F10) shows its properties in
  the right dock's Editor tab (name, description, its kind, tags, colour, lightness,
  opacity, size 1 × 1 or 2 × 2, Back to the tint, Lock, Archive, Export, Delete; an archived
  room's: Restore, Delete). Going in, duplicating and moving are keys alone (Enter, Ctrl+D, Ctrl+M). While they show, a click on another square switches them to it; Escape
  or × closes them, and going in closes them. The page moves over beside the dock, its squares
  drawn smaller to fit (`docks:resized`). Without the docks feature they show in a pop-up beside
  the square. A double click or Enter goes in. **Ctrl+R** renames the chosen room (its properties open with
  the name chosen), the same verb as in a room; **Delete** deletes it. A colour picked there is the room's colour inside, its
  lightness included; the square shows a deeper version of it.
  There are no words along the bottom: empty squares make rooms, and Settings is in the menu.
- **Fixed floors:** every floor is the same fixed board (Settings → Floors: 6 × 4, 8 × 5 or
  10 × 6), and never grows. Its cells are as big as lets the whole floor fit the window beside
  the rail, so a floor never scrolls; below 56 px a cell stops shrinking. A dock opening never
  shrinks the squares: the board keeps its size and slides sideways so the chosen room stays in
  view beside the dock, and a sideways push (or Shift+wheel) scrolls to the columns it hides. Where a room goes is the **floors** feature's rule (its service:
  `place`, `move`, `resize`, `toFloor`, `settle`): a room made, imported or restored goes to its
  floor's first free cell, else a new floor; a room dragged onto a full floor's number stays.
- **Lights:** a room's glow follows your attention lately: going in and writing there light it,
  and the light fades over a day or two (`attention.js`, saved as 'attention').

## Peek, the last room, lights, Lock, Archive

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
- **Choosing many** (`many.js`): Shift+click or Ctrl+click adds a square to the choice or takes it
  out, Ctrl+A chooses every room shown, Escape lets go; the status bar says how many. Delete,
  Ctrl+D and Ctrl+M work on them all, each as one undo step. **Ctrl+G** groups them the rooms
  page's way, by a tag they share (written in a small field; "Group: tag" puts the tag in a group
  too), and **Ctrl+Shift+G** takes off the tags of their own they all share.
- **Duplicate** (Ctrl+D, or Alt+drag the square to where the copy
  should go): a copy of the room with everything in it (the world's one copy rule, `copyRoom`),
  named "… copy", in the nearest free cell (the floors feature's `place` with `near`); a full floor
  spills onto a new one. **Move** to another floor: drag the square onto a floor in the rail, or
  Ctrl+M for a short list of floors (a number key picks, N a new
  floor). Each is one undo step (`verbs.js`).
- **Archive** (in a room's pop-up, or drop a square on *Archive* in the rail): the room leaves the
  grid for the Archive, a page of its own reached from *Archive* in the rail on the left (Escape,
  back or *Rooms* goes back). It has the same grid lines as the rooms page, with the rooms in the
  order they were archived, but its empty cells make no rooms. A right-click on a room shows
  Restore (to the first free cell) and Delete; Enter goes in. Archived rooms are still found by search.
- **Colour:** a square shows its room's colour more vividly than before: (L − 0.25, vivid × C, h)
  at α = strength × (1.2 − L) × opacity (Settings → Rooms → Colour strength, 1.6 by default).
- **Going in:** the square grows to fill the screen in the room's own colour, then fades into the
  room (skipped when the system asks for less motion). The room takes typing at once.

## Step 2: kinds of room, pages, the rail

- **Kinds.** A click (or a right-click) on an empty cell asks which kind the new room is: one
  room of each mode (*Joyce · Pessoa · Russell*, 1 × 1), or *All ontology*, a 2 × 2 room that
  holds every mode (a room's shape says how many ontologies it holds: Borges, the rooms page's
  own ontology, in the floors feature). A room from a file comes from *Import a room…* in the top
  bar, or a file dropped on the page. Rooms sit only on the rooms page; nothing nests. A square dropped on another
  square goes back to its place.
- **Pages.** The rooms page has pages, *1 2 3 +* along the bottom. *+* makes a new one; a square
  dropped on a number moves there. Messy thoughts stays on page 1.
- **The rail and the menu.** The menu (☰, with Settings) sits at the top left of the top bar on
  every page. On the rooms page and inside a room the back arrow sits in the top-right corner. Under it, on the rooms page, the rail
  (a column of veil down the left) holds, under *Floors*, each floor with its number, *+ New floor*
  and *Archive*, then under *Arrange by*, *Tags*. Each has a hairline icon beside its word;
  **Ctrl+Alt+B** (or the rail button at the left of the status bar) narrows it to the icons, and
  the grid takes the room it leaves (the frame feature holds how wide it is; `frame:rail`). Tags on
  a narrow rail widens it first.
- **Moving thoughts** (*Move to…*) lists every room, Messy thoughts first. Search and the timeline
  choose what they find without opening its properties.
- On a Mac, Ctrl+click is a right-click; Ctrl+drag still moves the canvas.

In `model.js`: a room's `page` and `archived` (when); `world.pages`. `addRoom` takes the page and
the kind; `addPage`, `archive` and `restore` do the rest, and the floors feature gives it a cell. A train sits in any room, a room
only on the rooms page.

**The code.** `Rooms.js` starts it, opens and closes the page, goes in and out of rooms, and builds
it; `grid.js` (the `RoomsGrid` class, copied onto `Rooms` at the end of `Rooms.js`) draws the
grid, the squares and their pop-ups, the rail, floors, tags and search lights. The world's rules
come from the world feature through `world.js` (bound in `Rooms.start`). `shared.js` holds the
constants. The import and export choices come from the **roomfile** feature, and are left out
when it isn't there.
