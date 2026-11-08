# The kernel: six tables and eight laws

Träumerei is being rebuilt on the six primitives of its philosophy of notes (a note is a mark made
now so that something the mind can't hold still does its work later). The kernel is the smallest
thing that can carry that: **six tables** and **eight laws** about them. Everything else, every
way of arranging a room, every kind of thought, every reader, is a plugin over the `traumerei`
API ([`API.md`](API.md)), which has one namespace per table.

This file is the contract. The phase each part lands in is given in brackets; until then the
API offers the name over today's world (`world/model.js`), as a thin layer.

## The six tables

| Table | Row | Notes |
|---|---|---|
| **marks** | `id`, `body { kind, content }`, `material?` | The only things that exist. `body.kind` is a plugin slot (text, passage, picture, maths); a room, a floor, a group, a tag, a note are marks of a kind too. `material` is a mark's own overrides of the look; the look itself stays in Folio. *(Today: a thought object. The body/material shape lands in phase 3.)* |
| **places** | `mark`, `context`, `rule`, `position`, `pinned?` | A context is any mark that holds marks: a room, a floor, the loose tray, the archive. One mark may have several rows, one per context or rule. **No row in a context means the mark is loose there.** *(Today: read off trains, laid spots and cells. Its own table in phase 3.)* |
| **links** | `from`, `to`, `kind`, `label?`, `order?` | `from` and `to` are marks. Kinds are a slot: *part of*, *stands for*, *relates to*, *about*, *answers*, *resolves*. Groups, trains, folds and arrows are all rows here. *(Today: part of and relation, read off groups and arrows. Its own table in phase 2.)* |
| **distance** | `context`, `reader` | Reader is one of *me now*, *me later*, *others*, *machine*. Declared per context, inherited by its marks. Lock sets it to others. *(Today: Lock. Its own table in phase 6.)* |
| **gaps** | `mark`, `direction`, `state`, `openedAt`, `resolvedBy?` | Direction: *to world* (check), *from world* (do), *to maker* (judge). `resolvedBy` is a link id or the word *judgement*. One open gap per mark at most. *(Phase 5.)* |
| **moments** | `time`, `kind`, `mark` or `context`, `payload?` | An append-only log: made, moved, linked, visited, resolved, due, return. Timeline, the daily record, the time scrub and undo are all reads of this table. *(Phase 1: `world/moments.js`, saved beside the world as 'moments'; rows carry `before` and `after` so undo and replay read the log; squashed to a row per thing per day after 30 days, folded into a base after the days kept. Due and return in phase 7.)* |

A context (a room, a floor, the tray) is a mark of kind `context`, so Borges, the rooms page's
ontology, is a rule over context marks like any other rule. A group is a mark of kind `group`
plus *part of* links; a fold is a new mark plus *stands for* links to the originals. Per-room
settings of a rule live on the context mark under `rules.<id>`. The whole saved world is these six
tables and nothing else; a `.traum` file is the same tables written as text.

## The eight laws

1. **Only marks exist.** Every row in places, links, gaps and distance refers to a mark id.
   Rooms, floors and tags are marks of a kind.
2. **A mark is never lost.** Removing a mark's last place puts it in the loose tray of its
   context; only an explicit delete removes it, and delete is one undoable moment.
3. **A rule may constrain, never destroy.** A rule can refuse a position, move a mark, or refuse
   a link (Russell refuses cycles). It cannot delete marks or links. If a mark cannot be placed
   under a rule, it is loose there.
4. **Links are the only structure.** Membership, folding, order and relation are all link rows.
   No plugin keeps its own list of members.
5. **One open gap per mark**, with a direction. A group's gap is derived: open while any
   *part of* child has an open gap. It is never stored.
6. **Every change is a moment.** Nothing writes to the five other tables except through an event
   that lands in moments. Undo, Timeline, the daily record and the scrub read the same log.
7. **Distance is inherited and only lengthens by hand.** A mark's reader is its context's
   reader. Lock sets a context to others; nothing automatic sets it back.
8. **The file is the tables.** A `.traum` file round-trips the six tables with no plugin loaded;
   plugin data that cannot be expressed as rows is not saved.

Each law has a test that is the gate of the phase that lands it (`api.test.js` and the world's
tests). Laws 2, 3 and 6 are what make the app trustworthy to finish things in: nothing a rule or a
plugin does can lose a thought, and every change can be walked back.

## Rules

An ontology is a **rule**: a pure function of the tables with no state of its own.

| A rule gives | What it is |
|---|---|
| `layout(places, links, context)` | where each mark sits under this rule: positions from rows, never stored by the rule *(phase 4; incremental, under 50 ms per change for 1,500 marks)* |
| `admit(proposal)` | yes, or a refusal in words: a position it won't take, a link it won't allow |
| `moves(mark)` | what this rule offers to do with a chosen mark |
| `draws(context)` | the canvas parts it draws beside the marks (lines, rings, a legend) |

Joyce (by moment), Pessoa (free), Russell (by *part of*), Proust (by link distance) and Borges
(place of places) are all rules. Pessoa is the rule that can always place a mark, which is what
Law 2 needs; it and Joyce ship on and cannot be switched off.

## How the API follows the tables

The `traumerei` API has one namespace per table, each with the same three shapes:

- **read**: frozen rows (`marks.get`, `places.of`, `links.from`, …). A plugin may hold mark ids,
  never row objects.
- **propose**: a change that goes through the active rules' `admit` and lands as a moment, or
  returns `{ ok: false, reason }` with the reason in words. No propose writes directly.
- **subscribe**: `on(fn)`, told after each change to that table.

Phases: 0 names · 1 moments (done) · 2 links · 3 places · 4 rules · 5 gap ·
6 distance and carriers, v1 deleted · 7 return · 8 stress corpus of thirty plugins, v2 frozen ·
9 readers (Provoke). Budgets throughout: a 1,500-thought room opens in ≤ 0.8 s, Enter ≤ 0.35 s,
keydown ≤ 20 ms, build < 2 MB.
