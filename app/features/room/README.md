# Room

An open room of thoughts: a canvas to write in, seen through an ontological mode. The rooms page,
where rooms are made and gone into, is the **rooms** feature's (`app/features/rooms`); it says
which room to open, and this feature shows it and writes in it.

## How it talks to the rooms page

It fills the rooms feature's `rooms.room` slot with one item:

| Member | What it does |
|---|---|
| `leave()` | Leaves the open room (its sheet, the search panel and the draft put away) and hides it. Returns the room's id if it showed, else `null`. |
| `hasDraft(id)` | Whether a thought was left half written in room `id`. |

It listens to `room:open` `{ id, from, seed }` (from the rooms page: the room, the square's
rectangle to grow from, and a first key to write) and sends `room:changed` (the room's id) after
each saved step. It uses the `rooms` service to go back to the rooms page or into another room.
It opens Search through the `search` service and listens to `search:found`.
Its editors open in the right dock's Editor tab (the docks feature's `panel` service), and the
Timeline in its Timeline tab; while a dock shows, the room moves over beside it (`--dock-left`,
`--dock-right`, `docks:resized`), and leaving the room closes everything in the right dock.
It offers no service of its own.

## What it does

- **A room** fills the screen as one gradient of its own colour, with the back arrow to the rooms.
  Its colour, lightness and opacity are set only in its pop-up on the rooms page (by default the
  tint's paper colour at the default lightness; Messy is a little darker). It is a canvas. Drag to move around; the mouse wheel, Ctrl+wheel or a pinch zooms;
  a trackpad's two-finger scroll moves around. Type anywhere to write a thought; Enter ends it.
  On a phone, *Write* opens the keyboard. Escape goes back to the rooms (and from there, home).
- **Ontological modes**, under *Modes* in the rail on the left of a room (where the rooms page has its
  floors), each with its icon (the ontology's `icon`); the current one is marked. The canvas starts
  beside the rail, so nothing sits under it; Ctrl+Alt+B narrows the rail to its icons (the frame
  feature's), and the canvas takes the room. A small room (1 × 1) keeps the one mode it was made with,
  and the rail only names it. A big room (Messy thoughts, or any 2 × 2 room) lists them all and
  switches with a click, or with **Tab** (the next mode) and **Shift+Tab** (the one before) while
  nothing is being written and no field or word has the focus; a big room made small again keeps the mode it has then. Hovering over a
  mode shows a small ⚙ beside it (on a phone, tap the current mode): it opens this room's settings
  for that mode in the right dock's Editor tab (without docks, a card beside the rail), with
  *Reset to global*; the ⚙ again, ×, or Escape closes them, and switching mode switches them. Each room keeps its own; a new
  room starts from the global ones. Under *Views*, *Timeline* opens the list of its thoughts by
  time in the right dock, in any mode.
  - **Joyce** (the default). Thoughts are joined by time into *trains*, each read like a
    paragraph. Enter goes on with the same train; **Ctrl+Enter** starts a new train at a random
    place. A train can't be broken: it is dragged, and moved, whole.
  - **Pessoa**. Every thought floats on its own, laid on a loose spiral outwards in the order
    they were written, and can be dragged anywhere (Pessoa keeps its own places; Joyce is not
    changed by them).
  - **Russell**. Chapters in a tree, each an abstraction of the one above it. A chapter holds
    its thoughts in order, read top to bottom like a train. Arrows go from a parent chapter down to
    its children: any number of children, usually one parent, at most two (a *junction*). An
    arrow that would make a loop is refused. The tree lays itself out: the roots at the top, each
    generation a level lower, siblings side by side, a junction under both its parents. Each
    chapter's box is what is drawn (its name, or its title and thoughts), and the gaps grow when a
    label needs the room, always by whole steps of one rhythm so rows line up. An arrow runs from
    the middle of the parent's side that faces the child to the middle of the child's facing side
    (each arrow of a junction on its own), with its label at its middle; the room's Russell
    settings choose straight or curved arrows. A chapter
    dragged somewhere stays there, and its children still hang under it. Drag from the small
    circle at a chapter's foot onto another chapter to draw an arrow. A chapter's pop-up has *New
    child chapter* (the chapter and its arrow are made when its first thought is kept), *Add second
    parent* and *Remove arrow*, and a line for each arrow into it: its relation and its label
    ("forgets the coordinates"), shown beside the arrow, with maths if it has any. Each room's
    Russell settings keep its list of relations, written with commas ("forgets, generalises"); the
    first is the default, a relation renamed there is renamed on its arrows, and when there are
    several each label shows its relation's word. Double-click an arrow or its label to edit it where
    it is: its label, and its relation when the room has several; Enter keeps it, Esc lets it go.
    An arrow with no label shows a faint hint of its relation when the pointer is on it. In room Markdown a relation is a heading key
    after its parent (`{parent="Rings" generalises="to two operations"}`), and the list is
    `russell.relations: [forgets, generalises]`. Enter
    goes on with the same chapter; a thought written with no chapter chosen waits in the tray.
    **A closed chapter.** *Fold into one* in a chapter's pop-up (it asks for a name) closes it:
    only its name shows on the canvas. A click opens it in the content editor, in the right dock's
    Editor tab: its name and its thoughts in order as flowing paragraphs, maths drawn (without
    docks, a document pop-up, `document.js`). Click a paragraph
    to write in it; Enter keeps it and starts the next thought just after it, Ctrl+Enter is a new
    line, Backspace in an empty one goes back into the one before, and a thought emptied goes. Esc
    stops writing; Esc again or × closes it. Each paragraph is still its own
    thought, so search, the Timeline and the other modes see them one by one. *Unfold* opens the
    chapter on the canvas again.
- **The tray.** A mode can leave thoughts unplaced: Joyce, those in no train (written in Russell,
  say); Russell, those in no chapter. They fill the **left dock** (the docks feature) whenever the
  room has any, as a list; × or Ctrl+Alt+L hides the dock and Ctrl+Alt+L brings it back. (Without
  the docks feature, *Loose · n* at the foot of the room opens them in a row.) Drag one onto the
  room to place it (Joyce: a train of its own; Russell: into the chapter it is
  let go on, or a new chapter of its own on the empty canvas).
- **Moving.** Tap a train (Joyce) or a thought (Pessoa) to select it, then *Move to* a room, or
  *A new room*. A thought moved on its own leaves its train; the rest of the train stays joined.
- **Bigger thoughts.** *Passage* (Alt+P): a title and a paragraph or small article. *Picture*
  (Alt+I, or paste one): a picture, shrunk to a small JPEG, with a caption. Double-click either to
  edit it. Both are written in the right dock's Editor tab (without docks, a sheet over the room):
  Enter keeps, Esc or × cancels. Naming a folded group is written there too.
- **Folding.** Select a train and *Fold into one thought*, then name it. It shows as one thought
  (in Pessoa it floats as one); *Unfold* opens it again.
  In a big room, folding also asks how the other ontologies show it: **Replace** (the one folded
  thought takes the place of its thoughts) or **Keep both** (it is added beside them). It is the
  same train either way, never a copy, and its pop-up can change the choice later.

**The code.** The saved world, its rules (`model.js`, items, maths, ontologies, look, attention),
saving and undo are the **world** feature's (`app/features/world`, see its README); the room
reaches them through the `world` service (`this.w`), and `world.js` here binds the rules it
uses, so every file imports them from there. It goes back to the rooms page, or into another
room, through the `rooms` service. The `Room` class is written across several files:
`Room.js` (starting, entering and leaving a room, building the page), `view.js` (a room, its
rail and settings, clear space, Timeline), `writing.js` (thoughts, the draft, the caret),
`gestures.js` (pointer, keys, selection, copy and paste, opening Search) and `bars.js` (pop-ups, tray,
sheets, pictures). `editor.js` (the content editor) and `document.js` (a closed chapter as a
document, and the paragraphs both write in) are plain functions of the room. Each part is a class whose methods `mixIn` (end of `Room.js`) copies onto
`Room`, so `this` is always the feature. `shared.js` holds the constants they share.
A room in and out as Markdown is the **roomfile** feature's (`app/features/roomfile`); the room
only says where (its `roomfile` service), and leaves those choices out when it isn't there.

## Editing, the line, the timeline

- **Joyce's line:** each thought stands on its own, joined to the next by a line. Its tension
  comes from time: thoughts written close together are joined taut, a pause leaves slack, and
  pulling a thought far away makes it straight again (Line tension: the room's ⚙ beside Joyce). Drag a
  thought to move it alone; double-click a train to choose it whole, then drag it.
- **Spacing that fits the text:** in a Joyce train, each thought sits below the one before by that
  thought's real height as drawn (and a gap), so one that wraps onto several lines never runs
  into the next. A new train starts in clear space on the screen, away from everything drawn.
- **Clear space** (`clear.js`): after any change (writing, deleting, editing, folding, a drag),
  the room measures the real size of what is on its canvas and pushes apart anything that
  overlaps, in every mode. Joyce's blocks are its trains (and each run started by a thought
  dragged on its own); Pessoa's are its thoughts. The newer of two moves; the thought being
  written stays put. Each room's ⚙ has *Hand-placed can be overlapped* (on by default): on, what
  was dragged into place is left out; off, it stays where it is and the rest moves around it.
  A push belongs to the change that caused it, so Ctrl+Z takes both back together.
- **Timeline:** the quiet word under the modes, or **Ctrl+Alt+T**. It opens a list of everything
  written in the room, in any mode, in the order it was last changed (latest at the bottom),
  each with its time and, where the mode groups thoughts, its group as a tag (Joyce: its train). Scroll it to see
  everything; a click takes the view to that thought. It is the **Timeline tab** of the right
  dock, beside the Editor tab: while both are open, tabs show at the top of the dock. The same
  key (or word) brings the Timeline to the front when the Editor is in front, and closes it when it
  is already in front; × closes it too. Each room remembers whether its Timeline is open. Choosing
  a thing on the canvas while the editor is open brings the Editor to the front; a click in the
  Timeline switches the editor too but keeps the Timeline in front. (Without the docks feature it
  is a list down the right of the room.)
- **Editing:** a click on a thought (or a double click on a train) only chooses it. A right-click
  (or a long press, or Enter) opens the **content editor** (`editor.js`) in the side panel on the
  right, and the room moves over. At its top is what the old pop-up had: edit its words (a
  passage's title and body, a picture's caption, a train's or chapter's name), fold or unfold it,
  the mode's own rows (Russell's arrows), move it to another room, or delete it. Under that, a
  group's thoughts show as paragraphs to write in, as in a closed chapter's document (click one to
  write; Enter keeps it and starts the next; Ctrl+Enter a new line; Backspace in an empty one goes
  back). A small *Source* at the foot opens the group (or the group a thought is in) as room
  Markdown in the source editor, in the same panel. While the editor shows, a click on another
  thought, group or train switches it there; Escape or × closes it. Several things chosen together
  still get the small pop-up beside them, and with no docks feature the pop-up is used for all. In a thought's
  box Enter keeps it and **Ctrl+Enter** (Cmd+Enter) starts a new line inside the thought; the
  thought below makes room. Writing keeps its own keys: there Ctrl+Enter still starts a new train.
- **Add** (bottom left) unfolds to Thought, Passage, Picture and Keys, and (with the roomfile
  feature) *Import into this room…*, *Export as Markdown* and *Edit room as Markdown*, which opens
  the whole room as room Markdown in the source editor on the right. A group's pop-up has *Edit as
  Markdown* for just that group. A right-click on the empty
  canvas opens Add at the pointer, and what is made goes just there.
- **Search** (the bar in the middle of the top row, or Ctrl+K / ⌘K) opens the **search** feature's
  panel (`app/features/search`), which searches every room; a find opened there (`search:found`)
  brings the view to it, in its room. With no search feature the bar isn't there.
- **Ctrl+Z** undoes and **Ctrl+Shift+Z** (or Ctrl+Y) redoes. A quiet *Saved* shows in the corner,
  and a line of help the first time a room is seen.
- **Writing** works as in any text editor. The thought being written shows its real caret and
  selection (drawn from a hidden box, each letter measured on the screen): click to place the
  caret, drag or double-click to choose letters (three clicks, the whole thought), Shift to
  extend; Ctrl+arrows, Home and End, Ctrl+C, X and V. Backspace deletes the letter before the
  caret (Ctrl+Backspace a word, Delete forwards); in an empty thought it goes back into the end of
  the one before it, and a thought emptied that way goes. Ctrl+Z undoes typing inside a thought,
  and whole steps outside it. Words pasted on the canvas start a thought, several lines staying
  one thought. Backspace never deletes a chosen thing: Delete does (on a Mac, Cmd+Backspace too).
- **Edit in place:** a triple-click on a thought opens it to write in, on the canvas where it is,
  with the same editor (Enter keeps it; emptied, it goes). A double-click still chooses the train.
- **Thoughts as a set:** Shift+click adds a thought (or a train) to what is chosen; Ctrl+click
  (Cmd+click on a Mac) puts one in or takes it out. Ctrl+drag still moves the canvas. Ctrl+C
  copies what is chosen (and its words, for other apps); Ctrl+V puts copies in the open room,
  any room, as they sat, and chooses them. A copy is always a new thought, never the same one.
- **Choosing many:** drag on the empty canvas to draw a selection box; the chosen thoughts move
  together when one is dragged, and can be moved to a room or deleted together. **Ctrl+drag**
  (or two fingers on a phone) moves the canvas. Names keep with Enter.
- Every pop-up and panel (Add, the sheet, the timeline, a thing's edit pop-up)
  shares one pale, blurred style: the palette's veil.
- **The same verbs** on a thought or a group (and on a room, on the rooms page), in `verbs.js`:
  **Ctrl+R** renames (a thought is written in where it is; a group's properties open with its
  name chosen), **Ctrl+D** duplicates what is chosen beside it, **Ctrl+F** folds or unfolds its
  group (folding asks for a name, in the Editor tab), **Ctrl+M** opens Move to…, **Ctrl+G** makes what is
  chosen one group of this mode (a Joyce train, a Russell chapter: each mode's own rule, the
  world's `groupChosen`; Pessoa has no groups and says so), **Ctrl+Shift+G** takes it out of its
  group (Joyce: each its own train, where it was; Russell: loose again), and **Delete**
  deletes. In a field these keys do nothing (so the browser doesn't reload, bookmark or find).
- **Keys:** Ctrl+A chooses everything in a room; Delete deletes what is chosen; arrows nudge it
  (Shift for bigger steps); ? (or Add → Keys) lists them all, from the key map (the keys feature;
  the room's entries are in `keys.js`). Ctrl+drag, Space+drag or the middle button move the canvas.
