# Proust

A way of seeing a room: every thought free on the canvas, joined by named **links** that may run
in loops, and gathered into **clusters**. Named after Proust's memory, where any moment can call
up any other, across time and back. It adds the ontology to the world's slot `world.ontologies`
(as the floors feature adds Borges), so switching this feature off takes the mode away; a room
seen through Proust is then seen through Pessoa.

## What it does

- **Nodes.** Every thought is on the canvas, as in Pessoa: on Pessoa's spiral until it is
  dragged, then where it was let go. A group another mode made (a train, a chapter) waits in the
  tray as one thing until it is dragged out; then it is one node. A cluster closed to its title
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
  every thought, and each shared group once.

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

Not yet: drawing a link by dragging, Ctrl+J, writing on from a chosen node, the Editor's link rows,
and Centre.
