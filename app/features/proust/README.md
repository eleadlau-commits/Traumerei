# Proust

A way of seeing a room: every thought free on the canvas, joined by named **links** that may run
in loops, and gathered into **clusters**. Named after Proust's memory, where any moment can call
up any other, across time and back. It adds the ontology to the world's slot `world.ontologies`
(as the floors feature adds Borges), so switching this feature off takes the mode away; a room
seen through Proust is then seen through Pessoa.

## What it does

- **Nodes.** Every thought is on the canvas, as in Pessoa: on Pessoa's spiral until it is
  dragged, then where it was let go. A group another mode made (a train, a chapter) waits in the
  tray as one thing until it is dragged out; then it is one node (one card: its thoughts are not
  nodes on their own as well). A cluster closed to its title
  (Ctrl+Shift+F) is one node too.
- **Links** join any two nodes: thoughts, clusters, other modes' groups. Each has a relation and
  a label (the world's `relations.js`, shared with Russell). Loops are fine (A to B to C to A);
  two nodes have at most one link each way, and a link back the other way bows to the other
  side; a link from a node to itself is refused. A link is a strand like Joyce's: taut between
  thoughts written close together, slack after a pause (the room's Line tension). A
  double-click on a link (or its label) edits it where it is: its relation and its label.
- **Each relation has its own ends**, set in the room's ⚙ list by a mark after its name:
  `related to` (a plain line; `--` says the same), `leads to ->` (an arrow), `is equivalent to
  <->` (both ways). These three are the default list; a new link gets the first. The first
  relation's name never shows beside its links; the others' do.
- **Clusters** (Ctrl+G) are Proust's groups: a faint box around their thoughts, which links can
  join as a whole. A thought is in one cluster at a time, and clusters can hold clusters. Like
  every group made on purpose, a cluster is one shared object in the other modes' trays.
  Double-click a thought in a cluster to choose the cluster whole, then drag it.
- **Writing** follows Joyce. Typing with nothing to go on gives a loose thought (no cluster, no
  link). Enter keeps it, and the next thought goes just below it (or the nearest clear place),
  linked on from it. **Ctrl+Enter** starts a new cluster; the thoughts written on with Enter join
  it, each linked to the one before.
- **Throw back** (Ctrl+Shift+Backspace) sends a cluster, or another mode's group, back to the
  tray, and every link touching it (or anything in it) goes; Ctrl+Z brings them back. A thought
  can't go back: Proust places every thought itself.
- Links are Proust's own: no other mode shows them. Proust sees the same objects as Pessoa:
  every thought not in another mode's group, and each such group once.

## Its parts

- `rules.js`: the ontology without a screen: nodes, where they sit, clusters, links
  (`links()`: relations.js's `arrowsOf` for Proust), writing on (`begin`, `goOn`, `kept`), the tray
  and throw back.
- `draw.js`: the canvas: each node, a cluster's box, the links through the world's `lines` and
  `arrowview` parts.
- `world.js`: what it uses of the world service's `lib` (that list is all).
- `style.css`: only how strong a cluster's box is and where its title sits; the look is the
  room's and Folio's.

**Saved data:** none of its own outside the world. In a room, `own(w, room, 'proust')` holds where
each node was placed (`{ x, y }`, the shape `groups.js` keeps for other modes' groups) and
`own(w, room, 'proust-links')` its links (relations.js's shape). Its settings are the room's
(`relations`, `tension`).

**Uses:** the `world` service only. It offers no service of its own.

**In a .traum file** (the roomfile feature's FORMAT.md, *Ontology: proust*) its `# In proust`
section has `at:`, `on canvas:`, `tray:` and a `link:` line for each link, its ends between its two
ends: `link: ^a -> ^b | leads to | the proof` (`--` a plain line, `<->` both ways). It reads
Russell's `arrow:` lines as links with an arrow, and relation objects (with an optional `ends:`).
A relation a file brings that the room lacks joins the room's list with the line's ends; one the
room has keeps its own ends, and a line that says otherwise is reported. Tests:
`tests/traum.test.js`.

**Working with links** (`draw.js`; tests: `tests/links.test.js`):

- **Drag from a dot.** While the pointer is on a node, a small dot shows just off its right side
  (an open cluster's sits on its box's right side, always faint). Drag it onto another node: a link
  from the first, with the room's first relation.
- **Ctrl+J** links the two things chosen (click one, Shift+click the other), from the one chosen
  first, and opens the new link where it is to be named: its relation and its label, Enter keeps.
- **A double-click** on a link or its label edits it where it is (the world's `arrowview.js`).
- **Writing on from a chosen node.** With one thing chosen, typing starts a thought just below it,
  linked on from it (and in its cluster, if it is a thought in an open one).
- **The Editor** has a Proust section for a node with links: *Points to* (its arrows out),
  *Pointed to by* (arrows in) and *Linked with* (plain lines and both ways, once a pair). Each name
  goes to that node and chooses it.

**Relations** live in the room's ⚙, in the world's relations editor (`relationsview.js`), the same
one Russell's arrows use: a row for each relation with its name, its ends (a plain line, an arrow,
or both ways), its line (solid, dashed, dotted) and its colour; add, reorder (the first is what a
new link gets) and delete (it asks what that relation's links become). *Legend on the canvas* shows
each relation's line beside its name, over the web. In a .traum file each relation's look rides in
`proust.relations` (`"calls up -> | dashed amber"`).

**Centre** (Ctrl+Shift+C; `centre.js` is the layout, `draw.js` runs it; tests:
`tests/centre.test.js`). What is chosen goes to the middle and every other node into rings round
it by how many links away it is, counting links both ways, from the nearest chosen node (so
several chosen, or webs that never meet, all work). Each ring is shared out all the way round, in
the order its nodes already lay, and then it settles like a web of springs: links pull, nodes push
each other off, nothing overlaps. It moves into place elastically and the screen drifts with it, so
what is chosen ends in the middle; a node dragged meanwhile is held where it is dragged and the
rest settle round it again. The room's ⚙ *Centre shows* is the whole web, or 1, 2 or 3 steps out:
nodes further out (or never reached) wait faint on the outermost ring. With nothing chosen it is
**Tidy**: the whole web just settles round its middle.

Centre is a **view**: nothing is saved (the places it shows are kept in `rules.js`'s Centre view,
not in the world). A bar over the layout says *Centred* (or *Tidied*) with **Keep this layout**,
which places every node where it shows (one step, Ctrl+Z takes it back), and **Back**; **Esc**
goes back too, to the layout by hand. A move while centred moves a node only in the view. A thought
written while centred shows where it was written, and is placed there by hand too.
