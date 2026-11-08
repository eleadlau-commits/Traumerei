# Russell

A way of seeing a room, as a plugin. Chapters in a tree, each an abstraction of the one above it. A chapter holds
its thoughts in order, read top to bottom like a train. Arrows go from a parent chapter down to
its children: any number of children and any number of parents (more than one makes a *junction*). An
arrow that would make a loop is refused. The tree lays itself out: the roots at the top, each
generation a level lower, siblings side by side, a junction under both its parents. Each
chapter's box is what is drawn (its name, or its title and thoughts), and the gaps grow when a
label needs the room, always by whole steps of one rhythm so rows line up. An arrow runs from
the middle of the parent's side that faces the child to the middle of the child's facing side
(each arrow of a junction on its own), with its label at its middle; the room's Russell
settings choose straight or curved arrows. A chapter
dragged somewhere stays there, and its children still hang under it. Drag from the small
circle at a chapter's foot onto another chapter to draw an arrow. A chapter's pop-up has *New
child chapter* (the chapter and its arrow are made when its first thought is kept), *Add
parent* and *Remove arrow*, and a line for each arrow into it: its relation and its label
("forgets the coordinates"), shown beside the arrow, with maths if it has any. A relation is any
words or signs ("is a case of", "⊂"), or none. Each room's Russell settings keep its list of
relations, written with commas (a name with a comma in quotes); a new arrow gets the first, and
a relation renamed there is renamed on its arrows. A relation shows beside its label when it
tells arrows apart. Double-click an arrow or its label to edit it where it is: its relation
(any of the room's, "(no relation)", or "+ New…", which adds one to the room's list) and its
label; Enter keeps it, Esc lets it go. The chapter's pop-up has the same picker for each arrow
into it. In a .traum file an arrow is an `arrow: ^from -> ^to | relation | label` line in its
`# In russell` section (roomfile's FORMAT.md). Enter
goes on with the same chapter; a thought written with no chapter chosen waits in the tray.

## As a plugin

It reaches the app only through the plugin API (`app/core/API.md`): `world.js` lists every name
it uses, bound from the API when it starts, and `Russell.js` adds the mode with `t.modes.add`.
Switching it off takes the mode away: a room seen through Russell is then seen through Pessoa,
and its chapters, arrows and labels are kept in the room, untouched, until it is on again.

- `rules.js`: the tree (chapters, arrows through the API's `relations`, the layout), the
  ontology Russell adds, its canvas, and its `# In russell` section of a `.traum` file.
- `world.js`: what it uses of the plugin API (that list is all).
- `style.css`: the layout of its canvas (a chapter's hairline, name and foot). The arrows'
  look is the room's (`.room-arrow-*`).

Its arrows can't be built when the file loads (the API isn't bound yet), so they are made the
first time they're asked for; the same for the settings, which are read when asked.

**Saved data:** none of its own outside the world. In a room, `own(w, room, 'russell')` holds each
chapter's parents, labels and relations, and the room's settings hold its list of relations.

**Uses:** the plugin API (`traumerei`) only. It offers no service of its own.

**Tests:** `tests/russell.test.js` (the tree, arrows, layout, the tray, and that it is a whole mode
once bound). Core tests that use Russell as an example of a mode with chapters bind it the same
way (`world/tests/groups.test.js`, `twin.test.js`, `ontologies.test.js`, `arrowview.test.js`).
