# The Träumerei plugin API, version 3

A plugin is a feature folder in `app/plugins/` or `app/optional/starter/` / `app/optional/extra/` whose `feature.json` has a `plugin` block
(`folio/README.md` §3). It reaches the app **only** through the `traumerei` service below, and
through Folio itself (its own storage, events, the `settings` slot, `ui`). The compiler leaves out
a plugin that uses any other core service or adds to a core feature's slot directly.

Version 3 (as 2 before it) names the app after the kernel's six tables ([`KERNEL.md`](KERNEL.md)): **marks**,
**places**, **links**, **distance**, **gaps**, **moments**. Each namespace has reads (frozen
rows), proposes (a change that lands as one step, or a refusal with its reason in words) and
`on(fn)`. Beside them sit `slots` (where a plugin plugs in), `ui`, `plugin` and `app`.

```js
import { Feature } from 'folio';

export default class Haiku extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    t.slots.rules.add({ id: 'haiku', name: 'Haiku', note: 'three lines at a time', /* … */ });
    t.slots.commands.add({ id: 'haiku.count', keys: ['Ctrl+Alt+H'], words: 'Count the syllables', zone: 'room',
      run: () => t.ui.toast(`${t.marks.in(t.ui.chosen()?.context).length} thoughts`) });
  }
}
```

List `"requires": ["api"]` in the plugin's feature.json, so it starts after the API and is left
out cleanly without it, and `"plugin": { "api": 3, … }`.

**Version 3 is frozen** (Träumerei 1.1.0, the end of the open core). It is version 2 with
additions only, so a plugin written for 2 connects as it is (`"api": 2` still works); one written
for 1 does not. From now on the API changes only by adding, never by renaming or taking away, and
only for a bug or something no plugin can do from this page. `tests/api.test.js` in
`app/core/api/` holds the whole list and `tests/corpus.test.js` runs the corpus through the
conformance suite, so an addition is made in three places at once: `v2.js` (the file keeps its
name), this page and the test.

**What version 3 adds to 2** (each marked "since 1.1.0" where it is described below). The open
core: everything at the drawing that was closed is now a seam, so a plugin can be anything from
a first-letter highlighter to a word processor or a drawing tool, and the tables and the eight
laws stay exactly as they were.

| Seam | Names |
|---|---|
| Size and fragments | a thin rule's row `width`, `height`, `align`, `lines` (fragments), zoom `bands` (`far`, `mid`, `near`); `claims`; box style `page`; `ui.measure`, `ui.size`; `links.link(…, 'part of', …, { at })` |
| Spans and the caret | `slots.spans` (kept on the mark, Law 1), `slots.decorators` (read-only), `ui.text`, commands in zone `editing`, `marks.markdown` |
| Places and zoom | `slots.bar`, `slots.strip`, `slots.pages`, `ui.zoom`, `ui.open.page` |
| Pointer and surface | `slots.surfaces`, a kind's `surface`, a box's `surface` and `data`, the need `surface` |
| Kinds in a flow and more ways out | a kind's `inline` and `height(mark, width)`; several formats with `exportRoom` |
| Rows | a mark row is frozen all the way down: its nested fields (a sketch's strokes, a thought's spans) are copies |

**Since 1.1.1** (additions, as the freeze allows): the `join` proposal for a rule's `land` and
`drop` (with `from`, a move between groups), `land` heard after a chosen mark, and
`ui.text.edit(mark, at?)`. They let a plugin write a book: a paragraph typed after another lands in
its chapter as one step, and the caret runs on. Beside them: `reads.marks.draft(context)` (the
thought being written, for `arrange`), a kind of group's own `fields` and `tidy`, `together(async
fn)`, `ui.chosen().marks` with `ui.chosen.on` and `ui.choose`, `ui.repaint`, a span's `ref` and a
span kind's `click`, a thin rule's `choice` and `toggle` settings handed to its hooks, moment rows'
`before` and `after`, `slots.commands.list` and `run`, and `peers.on`.

| Seam | Since 1.1.1 |
|---|---|
| Writing a book | the `join` proposal (`at`, `from`), `land` after a mark, `ui.text.edit`, `reads.marks.draft` |
| Groups that carry more | `slots.groups`' `fields` and `tidy` |
| Steps | `together(async fn)` |
| What is chosen | `ui.chosen().marks`, `ui.chosen.on`, `ui.choose`, `ui.repaint` |
| Words that point | a span's `ref`, `slots.spans`' `click` |
| Settings | a thin rule's `{ kind: 'choice' }`, `{ kind: 'toggle' }`, handed to `arrange`, `draw`, `drop`, `land` |
| History, commands, peers | moment rows' `before`, `after`; `slots.commands.list`, `run`; `peers.on` |

Chapters within chapters stay links, never containers: a chapter is a group whose parts are
`part of` links (a chapter holding another is one more link), every mark keeps one home (its room),
a mark may sit in several groups of a family, and taking a chapter away leaves its thoughts where
they are. No folder is made of it, and every other mode shows the same thoughts.

The proof is the corpus (`docs/CORPUS.md`): the thirty plugins that froze version 2, plus one
written for each seam (Page flow, First letters, Spell marks, Bold and italic, Word count strip,
Sketch, Chart, Figure, Word document) and one written from this page alone by an author who had
read nothing else (Highlighter).

**Plain facts.** Every time is a number of milliseconds (`Date.now()`), in and out. Every propose,
`moments.due` and `revisit` too, returns `{ ok, … }`. `marks.in(context)` gives every mark there:
thoughts and groups (`kind: 'group'`), the marks at home there (a group's parts too, not what sits in a room inside it); filter by `kind`. A mark row carries every field the mark keeps (its `spans` too), frozen all the way down. A room's name is `marks.text(room)`. `t.ui.chosen().context` is the open
room's id. Build a node with Folio's `ui.el(tag, attrs, …kids)` (`import { ui } from 'folio'`).
Every slot item's `order` is optional (lower first, 50 by default). A `title?()` on an item is its tooltip. A bar word and the command that gives it a key are two items, each with its own id. `together(fn)` is
`t.together(fn)`.

## Connecting

| Member | What it is |
|---|---|
| `use('traumerei').version` | The API version the app offers (3). |
| `use('traumerei').connect(plugin)` | The API for this plugin (pass `this`). Throws when the plugin's block asks for a newer API, or for version 1; a plugin written for 2 connects to 3. |

## Rows, proposals and what they mean today

A **row** is a frozen plain object. In phase 0 a mark row is today's thought object
(`app/core/world/model.js`: `id`, `kind`, `text`, `at`, `edited`, …; a floor or the Archive is a
mark of kind `context`), a place row is `{ mark, context, rule, position }` (since phase 3 every
mark but a floor or the Archive has one home row, `rule: null`, saying which context it is in;
the rows with a rule say where that rule puts it), a link row `{ id, from, to, kind, order? | label?, note?, rule? }`,
a moment `{ time, kind, mark | link | place | context, step? }`. Read them freely; hold ids, not rows.

A **propose** returns `{ ok: true, id }` after the change was made and landed in the moments
log as one step Ctrl+Z can take back, or `{ ok: false, reason }` with the
reason in words and nothing changed. Where a table does not exist yet, the propose refuses and
names the phase that brings it, and the read is empty. A refusal is never a step.

## The six tables

| Namespace | read | propose | subscribe |
|---|---|---|---|
| `marks` | `get(id)` · `in(context)` (the marks a context holds; `null` for the rooms) · `ofKind(kind)` · `text(id)` · `markdown(id)` (its words with their spans as Markdown, each kind of span by its `md`, a span kind with no `md` as plain words; `''` for no such mark; since 1.1.0) · `search(words, most?)` | `make({ kind?, content, in, at? })` (`kind` line by default; `room` with its name as content and no `in`, onto the first floor; `group` with `{ title }`, and a mark made `in` a group joins it; a plugin's kind with its fields as content; `at`: `x`, `y`) · `edit(id, fields)` (never kind, context, members or id; a mark left empty is removed, `{ ok, id, removed: true }`) · `delete(id)` | `on(change)` |
| `places` | `of(mark)` · `home(mark)` (the context it is in) · `in(context, rule?)` · `loose(context)` (marks at home there that no rule places) · `position(mark, context, rule)` | `put(mark, context, rule?, position?)` (into a context, laid under a rule when given; a room onto a floor `floor:<n>` or into the Archive `archive`; since 1.0.4 a room with a cell `{ col, row }` goes exactly there by the floor rule, or is refused) · `move(mark, from, to)` (lands loose in `to`) · `unplace(mark, context)` (loose there, under every rule) | `on(change)` |
| `links` | `get(id)` · `from(mark, kind?)` · `to(mark, kind?)` · `members(group)` (ids, in order) · `holders(mark)` (group ids) · `standsFor(fold)` (the marks it folded) · `kinds()` (part of, stands for, relation and the declared ones) · `named(kind)` · `count()` | `link(from, to, kind, label?, { rule, note, at }?)` (a relation needs the `rule` whose arrows these are and goes through its checks; a *part of* takes `at`, its position in a group that keeps its order, 0 first, since 1.1.0) · `fold(context, ids)` (one new mark stands for them) · `unlink(id)` (a stands-for row undone brings the mark back loose) · `order(group, ids)` | `on(change)` |
| `carriers` | `list()`, `tables(context?)` (the six tables of a room, a group with its parts, or the whole world, deep frozen), `text(context?, { ids })` (as .traum text), `read(text)` (`{ tables, root, report }` or `null`), `check(context, read)` (what writing it over the context would do: `{ ok, kept, changed, made, deleted }` or a refusal) | `land(read, { into?, page?, cell? })` (new marks: a new room, or poured into one), `replace(context, read)` (edited text written back over it) | |
| `distance` | `of(mark)` (its reader: the farthest declared on its way up, or `null`), `declared(context)` (its own row's reader, or `null`), `all()`, `shut(mark)` (in a context for others or a machine: nothing can change), `readers()` | `declare(context, reader)` (a room, a floor, the Archive; `me now` takes the row away; Lock is `others`) | `on(change)` |
| `gaps` | `of(mark)` (its row: `{ mark, direction, state, openedAt, resolvedAt?, resolvedBy? }`, or the derived gap of a mark whose parts carry gaps: `{ …, derived: true, open, resolved, of }`, open while any part's is; `null` for none) · `opened(context?)` (the open rows, oldest first; of the marks at home in a context) · `oldest(context?)` · `progress(mark)` (`{ open, resolved, of }` over its parts, through *part of* and *relation* rows up to it, however deep) | `open(mark, direction)` (one open gap per mark; refuses on a mark whose gap is derived: open one on a part) · `resolve(mark, by?)` (`by` a link id that exists, or `judgement`, the default; a derived gap resolves only through its parts) · `reopen(mark)` (its direction kept, from now) | `on(change)` |
| `moments` | `of(mark)` (each row `{ time, kind, mark \| link \| place \| gap \| dist \| context, step? }`, and since 1.1.1 `before` and `after`, what the row's thing was and became, frozen, when the log still has them: compacted rows have none) · `changed(mark)` (when last written: its made time when never edited) · `since(time)` · `day(date)` · `at(time)` (the marks as they were then) · `placesAt(time)` (the place rows as they were then) · `first()` · `kept()` (days of history kept) · `ahead(context?)` (moments to come) · `returns(context?)` (come back, waiting for an answer) · `next(mark)` · `seq()` · `outbox(seq)` (the rows since a seq as another copy of the world can take them; `null` for the whole world) | `keep(days)` (0: forever) · `absorb(rows)` (rows from another copy; the latest word on a thing wins) · `due(mark, time, note?)` · `revisit(mark, time, note?)` · `note(mark, text)` (back on the next visit) · `meet(mark)` · `refuse(mark)` · `clear(mark)` | `on(change)` |

Two names differ from the plan's table so that a read and a propose never share one word:
the open gaps are `gaps.opened(context?)` (the propose is `gaps.open(mark, direction)`), and the
moments to come are `moments.ahead(context?)` (the propose is `moments.due(mark, time)`).

**Gaps** (phase 5). A gap is what a mark was made to close, with a direction: `to world` (check
it against the world), `from world` (do it), `to maker` (judge it). A mark has one at most, open
or resolved (Law 5); `gaps.of` reads it. A mark that holds others (a group, a Russell chapter, a
Proust hub: anything with *part of* or *relation* rows pointing up to it) has a **derived** gap,
read off its parts and never stored: open while any part's gap is open, resolved once every
part's is, with `open`, `resolved` and `of` counting the parts (a part that is itself derived
counts through its own parts, once). So a to-do list is a group whose parts have gaps to do, and
its progress is `gaps.progress(group)`; `gaps.open` and `gaps.resolve` on such a mark refuse and
say why. Every open, resolve and reopen is a moment (`opened`, `resolved`) Ctrl+Z takes back. The
room draws an open gap as an edge on the thought; the Gaps plugin (`app/optional/starter/gaps`) is the
hands: an Editor section and Ctrl+Alt+G.

**What the rows are read from, in phase 0.** Places: a thought in a train is placed under
`joyce` at `{ group, index }`; a thought a rule laid itself (Pessoa, Proust) at `{ x, y }`; a
group under its own rule at its `{ x, y }`; a room on `floor:<n>` under `borges` at
`{ col, row }`, or in the `archive` context; a Twin's side in its Twin under `twin`. Links (the
table itself since phase 2, `world/links.js`): a group holds its members as *part of* rows, `order`
as the group reads; a fold stands for the thoughts it folded as *stands for* rows; every arrow of
Russell or Proust is a *relation* row from the child up to its parent, with its relation as
`label`, its short label as `note` and its store as `rule`. A *linked* moment names its row as
`link`. Distance:
a locked room reads *others*, any other *me now*; `declare(context, 'others')` locks it,
`'me now'` unlocks it. Moments: the world's log (`world/moments.js`): *made*, *edited*, *moved*,
*linked*, *removed* of a mark, *arranged* and *visited* of a context, *undone* and *redone* of a
step; rows of one save share a `step`. A mark older than the history kept still reads its *made*
and *edited* times. Gaps: the gaps table (`world/gaps.js`, phase 5): *opened* and *resolved* moments, *removed* with the mark. Moments ahead (`world/ahead.js`, phase 7): *due*, *revisit* and *return* when asked for, *returned* when the time comes or the room is gone into (the world's doing: no step), *met* or *refused* when answered, *cleared* when taken back. `ahead(context?)` reads what is still to come, soonest first; `returns(context?)` what came back and waits (the Returns tray); `next(mark)` a mark's row, whatever its state. One per mark.

**Words.** Readers: `me now`, `me later`, `others`, `machine`. Directions: `to world` (check),
`from world` (do), `to maker` (judge). Link kinds: `part of`, `stands for`, `relation`, and every kind a plugin declares (`slots.linkKinds`).

**Subscribing.** `on(fn)` gives `fn({ table, rows, undone })` each time rows of that table land
in the moments log (a save, an undo, a visit), with those rows, and returns a function that stops
listening. `moments.on` hears every landing.
Everything a plugin listens to stops when it is switched off.

## Rules

Every mode is a **rule** (KERNEL.md): it keeps no state. Where it puts a mark is a rule row of
`places` (`places.of(mark)` shows them: `{ mark, context, rule, position }`), what it joins is a
row of `links`. `t.rules` reads each mode as the kernel sees it, frozen:

| Member | What it gives |
|---|---|
| `list()` | `[{ id, name }]`: the modes a room can be seen through |
| `layout(rule, context)` | `[{ mark, context, rule, position: { x, y } }]`: where each unit sits under that rule, from the rows; remembered until the tables change (a 1,500-thought room lays out in under 50 ms), and since 1.1.4, for a rule whose `arrange` reads `marks.draft`, until the thought being written grows or shrinks too (so it never lags the room's own drawing) |
| `admit(rule, proposal)` | `{ ok: true }` or `{ ok: false, reason }` for `{ kind: 'place', mark, context, position? }` or `{ kind: 'link', from, to, link, rule? }` (Russell refuses a loop). Changes nothing |
| `moves(rule, context, mark)` | `[{ id, label }]`: what the rule offers for a chosen mark |
| `draws(rule, context)` | `{ lines: [[mark…]], arrows: [{ from, to, label }], boxes: [{ x, y, w, h, label, note }] }`: what it draws beside the marks, as data |

**A rule of your own** is one function of the tables. Add it with `t.slots.rules.add`:

```js
t.slots.rules.add({
  id: 'grid', name: 'Grid', note: 'fixed cells, oldest first', icon: '<rect x="4" y="4" width="16" height="16"/>',
  arrange: (reads, context) => reads.marks.in(context).map((m, i) => ({ mark: m.id, x: (i % 6) * 240, y: Math.floor(i / 6) * 160 })),
  admit: (reads, proposal) => true, // optional: a reason in words refuses a position or a link
  hand: true,                       // optional: a mark dragged keeps where it was put (default true)
  clear: true,                      // optional, since 1.1.4: false (or hand: false) and the room's clear-space never pushes its marks
});
```

`arrange(reads, context)` returns `[{ mark, x, y }]` for the marks it places (world units; a
thought is about 200 wide; `x, y` is its centre). Since 1.1.0 a row may also give the unit's size
and say it draws in pieces:

- `width`, `height`: the room wraps the thought to `width` and draws it at least `height` tall;
  `align: 'start'` sets its words flush to the start instead of centred.
- **Fragments.** A mark may have several rows, each with `lines: [from, to]`: that piece shows the
  thought's wrapped lines `from` (counted from 0) up to `to`, at its own `x, y` (a paragraph that
  runs on from the foot of one page to the top of the next). `t.ui.measure(text, width)` says how
  many lines the words take at a width, so a rule can break them where the room will.
- **Zoom bands** (since 1.1.0): `far`, `mid`, `near` (words): under that band of the zoom
  (`t.ui.zoom.bands`) the unit keeps its place and size but shows those words instead of its own,
  set large enough to read from far off (a chapter's title on the map of a book). Rows without
  them pay nothing. The stage carries the class `room-band-far`, `-mid` or `-near`, so the one
  look can say the rest.
- `claims: [family ids]` on the rule (beside `arrange`): it lays out the groups of those families
  (`slots.groups` without a rule) itself, so their cards don't show in it.

`t.rules.layout` gives the same back: a row's `width`, `height` and `fragments` (`[{ x, y, width,
height, lines }]`), and its `bands` (`{ far?, mid?, near? }`, since 1.1.0). `app/plugins/page-flow` lays a room as fixed pages this way. `reads` is the read half of the six tables (the `READS` list below),
over the world the rule is handed: it may be a frozen one, or the world as it was at a moment of
the time scrub, so read only from it. The kernel makes the rest: the room's units, a mark dragged
kept as a rule row of `places`, marks `arrange` leaves out laid in rows below the rest, and the
result remembered until the tables change (marks, places, links, gaps or moments ahead). A
1,500-mark room must arrange in under 50 ms.

Three optional hooks let a rule give a room a form of its own (a calendar's days) and still keep
no state. Each reads the same `reads` and returns data; the kernel does the rest:

| Hook | Called when | Returns |
|---|---|---|
| `draw(reads, context)` | the room is drawn | `[{ x, y, w, h, label?, note?, right?, style?, level?, opens? }]`: boxes drawn behind the marks (`x, y` is a box's top-left corner; a mark's `x, y` from `arrange` is its centre). `right`: words on its right; `style` one of `plain` (the default), `title`, `heading`, `line`, `shelf`, `quiet`, `page` (a sheet of paper, since 1.1.0) (the room's classes); `level` 1 to 3; `opens` a mark's id, gone to on a double-click (a room: into it); `surface` a surface's id, drawn filling the box, and `data` what the box hands it (plain data, read from the same `reads`; since 1.1.0: Surfaces, below). A tap on a box chooses it. Since 1.1.4 `after`, a mark of the room: a thought begun while the box is chosen (a slot) is written after that mark, drawn under it as one written after a chosen mark is, and `land` hears the box (an invisible slot draws with `style: 'quiet'`). |
| `drop(reads, context, mark, x, y)` | a mark is let go at `x, y` | a proposal, a list of them, or nothing |
| `land(reads, context, mark, x, y)` | a new thought is kept while a box is chosen (`x, y` its centre), or at the point Add was asked at; since 1.1.1 also when it was written after a mark (the one chosen when writing began, or the thought kept just before with Enter: `x, y` that mark's centre, its first fragment's for one in pieces), and the thought being written is drawn under that mark, at its width | a proposal, a list of them, or nothing |

A **proposal** is about `mark` (or `p.mark`, another mark of the same room): `{ due: time, note? }`
or `{ revisit: time, note? }` (moments ahead), `{ clear: true }` (nothing ahead), `{ gap: direction }`,
`{ resolve: true }` (gaps), `{ place: room, x?, y? }` (places: into another room, loose there, or at `x, y` under that room's mode), and since 1.1.1 `{ join: group, at?, from? }` (links: a part of a group of the same room, a book's chapter, at `at` in its order, 0 first, as `links.link(mark, group, 'part of', null, { at })` joins it; a mark already a part of it moves to `at` among the others; the group's family says whether it may sit in another group of the family too; `from`: a group of the same room the mark leaves in the same step, so a drop from one chapter into another moves it rather than copying it. Refused in words when `group` is not a group, is in another room or locked, would hold its own group, or the mark is not a part of `from`). Each lands through its table in the same step as the gesture, so one
Ctrl+Z takes back both; one the table refuses is skipped. A hook that throws changes nothing.
`app/plugins/calendar` uses all three.

**Settings and the draft** (since 1.1.1). A thin rule's `settings` may be the core's own (sliders,
`type: 'switch'`, `type: 'choice'`, `ontologies/index.js`) or, in its own words,
`{ kind: 'choice', id, name, options: [{ id, name }], default }` and `{ kind: 'toggle', id, name,
default }`. Each room keeps its own (the ⚙ beside the mode's name, drawn with Folio's pick words and
switch; Settings → Rooms holds the values for new rooms), saved in the room's `rules`. `arrange`,
`draw`, `drop` and `land` are handed them as their last argument, `{ [id]: value }` (the room's,
else the value for new rooms, else the default): `arrange(reads, context, settings)`.
`reads.marks.draft(context)` is the thought being written there, `{ text, at?, after?, height? }`
(its words so far; `at` the point Add was asked at; `after` the mark it is written after; `height`
its box's height in world units), frozen, or `null`. It is for `arrange`, to leave room for the new
thought (a column that grows as the words wrap): never a mark, never in the tables, never saved. A
rule whose `arrange` read it is laid out again when the draft's box grows or shrinks, not at every key.

The read half, as handed to `arrange`, a link kind's `admit` and every view:
`marks` get, in, ofKind, text, search, draft (since 1.1.1) · `places` of, home, in, loose, position · `links` get,
from, to, members, holders, standsFor, kinds, named, count · `distance` of, declared, all, shut,
readers · `gaps` of, opened, oldest, progress · `moments` of, changed, ahead, returns, next.

A full mode (Joyce, Pessoa, Russell: trains, trays, its own drawing, gestures) gives `units`,
`point`, `drop` and more instead of `arrange`; that shape is the world's own
(`app/core/world/ontologies/index.js`). **Since 1.0.3 it is open to every plugin**, and stable on
the same terms as the rest of version 2 (it changes only by adding): Russell and Proust are
plugins written in it, with `t.parts`, and an imported plugin may be too. Keep the laws: the mode
keeps no state of its own (where it puts a thing is a rule row of `places`, what it joins a row
of `links`), and every write is one of its own gestures, which the room lands as one step.

## Store: what a plugin keeps on this computer

`t.store` is the plugin's own, on this computer only. **It is never written into a `.traum` file**:
the file is the six tables (Law 8), and what a plugin keeps here is outside them on purpose (a
learned weight, a downloaded model, a cache). Say `store` in the plugin block's `needs`.

| Member | What it is |
|---|---|
| `get(key, fallback?)`, `set(key, value)`, `remove(key)`, `keys()`, `clear()` | small state (JSON values), the plugin's alone |
| `files.put(name, data)`, `files.append(name, data)` | writes bytes, a Blob or words; refused over the quota |
| `files.get(name)` | a `Uint8Array`, or `null` |
| `files.list()`, `files.used()`, `files.quota` | `[{ name, bytes }]`; bytes kept; bytes it may keep (4 GB) |
| `files.remove(name)`, `files.clear()` | takes one or all away |
| `files.download(url, name, { bytes, label?, signal?, progress? })` | a large file from an https address, the first time it is needed: the person is asked first, with its size; written in pieces; a file already there at that size is kept; a failed download leaves nothing. `{ ok, bytes, kept? }` or `{ ok: false, reason }` |

Names are plain file names (letters, digits, `.`, `-`, `_`). Files live in the Windows app's data
folder (`plugins\<id>\`) or the browser's private file system; packages carry code only, and
models come down on first use. Settings → Plugins shows what each plugin keeps, with Clear.

## What a plugin adds and needs

The plugin block's `kind` and `needs` (`app/plugins/README.md` §2) use one list each, kept in
`app/app.json` under `plugins.kinds` and `plugins.needs` with the words Settings → Plugins shows.
The compiler refuses any other word, and the loader of imported plugins checks the same lists.
Kinds: `mode`, `item`, `view`, `editor`, `command`, `link`, `reader`, `format`, `page`, `look`,
`tool`, `dock`, `provider`. Needs: `files`, `network`, `sidecar`, `store`, `ai`, `surface` (since
1.1.0: it draws in a surface and takes the pointer, below). Both grow by additions only.

## Slots, ui, plugin and app

| Member | What it is |
|---|---|
| `slots.rules` | a way of seeing a room (an ontology, a rule in the kernel's words): `add(rule)`, `get(id)`, `all`, `settings`. Shape: `app/core/world/ontologies/index.js`. |
| `slots.kinds` | a kind of mark that isn't plain words: `add({ kind, name, tidy(fields), text(mark), node(mark, el), fields?, add?, takes?(file), fromFile?(file), label?(mark) })`. `kind` lowercase words joined by dashes; its fields may be named anything but `id`, `kind`, `at`, `edited`, `parent` and `archived`; `tidy` its own fields tidied, or `null` when empty; `text` its words as plain text (search reads it); `node` how it shows (`el` is Folio's `ui.el`); `fields` `[{ key, type: 'line' \| 'text' \| 'image', label }]` makes it written in the room's sheet; `add` `{ note, keys?, file? }` offers it under Add (with `file`, a file is picked and `fromFile` gives the fields); `open(mark)`: double-click or Enter on a card of the kind opens it this way, in any mode (instead of the sheet). Since 1.1.0, `inline: true` says it flows among paragraphs (a table, a figure: a rule laying a column sets it between them), and `height(mark, width)` how tall it draws at a width (world units); `ui.size` reads both. Make one with `marks.make({ kind, content: fields, in })`. A mark of a kind whose plugin is off is kept exactly as it is and shows as a quiet stand-in. `surface`: a surface's id (since 1.1.0): on the canvas the mark is drawn by that surface instead of `node` (Surfaces, below); `node` is still its picture everywhere else. |
| `slots.holds` | since 1.0.4: what a mark may hold beyond the core's own (items and groups in rooms, rooms on floors): `add({ id, name?, holds(parent, kind) })`, `holds` true when mark `parent` (the mark itself, never the world) may take a new mark of `kind`. Twin's: a room of size `'twin'` holds rooms, its sides. A hook only allows what is made or moved in: a saved mark inside another is read and kept with the hook off. |
| `slots.groups` | since 1.0.4, the one way to say a kind of group: `add({ id, name, membership?, order?, card?, keep?, open?(id), rule?, fields?, tidy? })`. Since 1.1.1, `fields: [names]` are fields its groups keep (plain JSON values: a chapter's target, its breaks), made with `marks.make`'s content, changed with `marks.edit` (`null` takes one off), saved in .traum files and copied with the group; `tidy(group) → group` reads them as the kind wants (its own fields only). Other fields are still dropped, and a name the core owns (`id`, `kind`, `of`, `title`, `closed`, `shared`, `family`, `x`, `y`, `at`, `edited`, `parent`, `members`, `archived`, `loose`, `mode`) is refused. With its plugin off, a group keeps its fields exactly as they are. With `rule` (its `id` the rule's id), the rule's own groups: laid out by that rule, and Ctrl+G in it makes one (a rule may still say the same as its own `groups`). Without `rule`, a family no rule lays out, exactly as `slots.families` below says. In a rule with no groups of its own, Ctrl+G makes a **plain group** (`of: 'group'`, the core's own kind): one card in every rule, waiting in the tray until placed, its parts still where they are; Ctrl+Shift+G there takes it apart. |
| `slots.families` | **Deprecated since 1.0.4: use `slots.groups` (without `rule`), which reads the same; this slot stays for plugins written before.** A family of groups that belongs to no mode (a book, its chapters): `add({ id, name, membership?, order?, card?, keep?, open?(id) })`. `id` lowercase words joined by dashes, never a mode's. Make one with `marks.make({ kind: 'group', content: { title, of: id }, in: room })`, put parts in with `links.link(part, group, 'part of')`, order them with `links.order(group, ids)`. Its groups hold parts like any group (a group of the family may hold another's: a book its chapters), and a mode never lays them out, so a thought sits in a chapter and in a Proust cluster at once. `membership` `'many'` (the default: a part in several of its groups) or `'one'`; `order` `'kept'` (the default: as put, a newcomer at the end) or `'time'`; `card: true`: each of its groups that no other group holds shows as one card in every mode (in the tray until it is placed), its parts still where they are; `keep` (default true): a group of it left empty stays; `open(id)`: double-click or Enter on its card opens it (a view in a dock). Deleting a family's group never deletes its parts, with its plugin on or off (the group says `family: true`), and its rows travel in .traum files like any group's. |
| `slots.spans` | since 1.1.0: a kind of span, the look of some words inside a thought: `add({ kind, name, class, md? })`. `class` one of `bold`, `italic`, `underline`, `wavy`, `highlight`, `strike`, `quiet`, `caps`, `mono` (the room's own classes: the one look holds); `md` `[open, close]` writes it in Markdown (bold `['**', '**']`). A span is **material of the mark** (Law 1: the look is part of it): a line keeps `spans: [{ from, to, kind }]` (character offsets, `to` not included), carried in .traum files; `marks.edit(id, { spans })` sets them, and new words carry them along (typing inside a bold word keeps it bold). A span of a kind whose plugin is off is kept and drawn plain. Since 1.1.1 a span may carry `ref`, a mark's or a link's id (words, kept with it: a footnote's mark, a comment on words; spans of one kind with different refs stay apart), and a kind may give `click(span, mark)`, called when its words are clicked in a kept thought (Ctrl+click in the thought being written; `mark` a frozen copy, `id` `null` for a new thought). The nine classes stay the only looks. |
| `slots.decorators` | since 1.1.0: how a thought's words are drawn, read-only: `add({ id, decorate(text, mark) → [{ from, to, class }] })`, `class` from the list above; `text` is the plain words (as `marks.text`) and the offsets count into them; it runs on words (kind `line`), the thought being written too (there `mark` is `{ id, text, spans }`, `id` `null` for a new thought); a decorator's class and a span's on the same words both draw. A decorator never changes anything and keeps nothing: every word's first letter bold, a wavy line under a misspelt word. It runs on every thought drawn, so keep it fast. |
| `slots.surfaces` | since 1.1.0: an element a kind or a rule's box draws in, with the pointer while it is focused: `add({ id, width?, height?, draw(el, ctx), pointer?(e, ctx), wheel?(e, ctx), key?(e, ctx), focus?(ctx), blur?(ctx), leave?(el, ctx) })`. Needs `surface` in the plugin block's `needs` (refused without). See Surfaces, below. |
| `slots.buttons` | a button in a room's rail, under **Tools**: `add({ id, label, icon, order, run(), on?(), visible?(), title?() })`, the same shape as ⋯ More's (`icon` a `ui.ICONS` name or a drawing on a 24 × 24 grid). |
| `slots.menu` | a row in the ☰ menu: `add({ id, label, icon, order, onClick(), visible?(), busy?() })` (Folio's `header.buttons`). |
| `slots.views` | a page of the app under everything else, such as the picture behind (Folio's `views`): `add({ id, label, icon?, order, mount(container, { head, actions }), render(), start?, hideTitle?, visible?() })`. The rooms page lies over it. |
| `slots.bar` | since 1.1.0: a word on a room's bar, at the right of the top bar beside Search, while a room is open: `add({ id, label, title?(context), order, run(context), on?(context), visible?(context) })`. `context` is the open room's id; `on()` true shows it pressed. Give it a command too, so it has a key. |
| `slots.strip` | since 1.1.0: a tool's status in the strip, one quiet line along the foot of a room's canvas (it never floats; the words sit at the right): `add({ id, text(context) → words, title?(context), onClick?(context), visible?(context), order })`. One line per item (cut at 120 characters); an item with no words, or not visible, shows nothing, and the strip hides when none shows. The room asks again when it is still for a moment after a change (never inside a keystroke), when the zoom's band changes, and when the slot changes: keep `text` quick (count once per `moments.seq()`). |
| `slots.pages` | since 1.1.0: a page of the plugin's own, in the frame like Settings (the top bar says Home › its label; Escape or ← goes back to what was there; going into a room leaves it): `add({ id, label, icon?, order?, idle?, visible?(), sections?() → [{ id, title, icon?, body }] \| render() → node })`. Its row in the ☰ menu comes with it and opens it; the function `add` gives back takes both away. `sections` gives a rail of sections beside their rows, as Settings has; `render` one body. `idle` is the status bar's quiet line there. Open it from a command with `ui.open.page(id)`. |
| `slots.account` | who is signed in and their account page (Folio's `account`; the first item counts): `add({ name(), open(), sections?() })`. |
| `slots.linkKinds` | a kind of link: `add({ kind, name, note?, both?, quiet?, admit?(from, to, reads) })`. `kind` lowercase words (`cites`, `example of`); `both`: it reads the same either way (one row for a pair); `quiet` (since 1.1.2): structure the plugin's own mode draws (a heading that heads its chapter, a margin note), so the room draws no line or ↗ for it in any mode and Alt+L does not follow it (with the plugin off, its rows show as any other kind's); `admit` returns `true` or a refusal in words. Then `links.link(from, to, kind, label?, { note }?)` makes one between any two marks, in any rooms, and `links.unlink(id)` takes it away. A row of a kind whose plugin is off is kept and travels in files. `links.named(kind)` gives `{ kind, name, note, both, quiet }`. |
| `slots.carriers` | a carrier of the six tables to somewhere else (the account's sync): `add({ id, name, moves })`, `moves` 'text' or 'moments'. Listed with the .traum file by `carriers.list()`. |
| `slots.commands` | a named action, with its keys if it has any: `add({ id, keys?, words, zone, order, when?(), run?(e) })`, `label(id)` (its keys as words). Since 1.1.1, `list()`: the commands live where the person is now, `[{ id, name, keys }]` (every plugin's and the app's), and `run(id)`: runs one as its keys would, `{ ok }`, refused when it is not live there, has nothing to run, or works in a room (`room`, `editing`) that is locked. `zone` is where it works: `room` (inside a room), `rooms` (the rooms page), `editing` (while a thought is being written, since 1.1.0) or `everywhere`; keys are written `Ctrl+Alt+K`; two commands clash when they share keys in one zone. |
| `slots.more` | an entry under ⋯ More: `add({ id, label, icon, order, run(), on?(), visible?(), title?() })`. |
| `slots.editor` | a section in the Editor for the chosen thing: `add({ id, order, when?(x), render(x) → node \| null })`. `x` is `{ id, roomId, mode, locked, refresh() }`: the chosen mark's id, its room, the room's mode, whether it is locked, and a function that draws the Editor again. Read the mark through `t.marks.get(x.id)`. |
| `slots.formats` | a file format: `add({ id, name, accepts(file), importRoom?(o), importInto?(roomId, o), exportRoom?(id) })`. `accepts` whether a picked or dropped file is this format's; `importRoom({ file })` makes a new room from it and returns `{ id }` of the room (or `null`), and may be async; `importInto(roomId, { file })` pours it into a room, `true` or `false`; `exportRoom(id)` hands the room out (with `ui.files.save`). Read a file with `await file.text()`. The first format with `exportRoom` serves a room's Export (the .traum file); since 1.1.0, when several formats have `exportRoom`, the room's ⋯ More offers each as "Export: its name" (a Word document beside the room file). Make the new room and its marks inside `together()`, so the import is one step. |
| Folio's `settings` slot | a section on the Settings page: `this.add('settings', { id, title, order, render() })`. |
| `ui.toast(text)` | A short message at the foot of the screen. |
| `ui.text` | Since 1.1.0: the words being written (a new thought, or one opened again to write in). `caret()`: `{ mark, from, to, text }` (`mark` `null` for a new thought; `text` all its words; `from`, `to` the selection in them, equal for a caret) or `null` when nothing is being written. `select(from, to?)`. `replace(mark, from, to, words)`: in the thought being written (mark `null` or its id: nothing is kept until Enter keeps it, as one step), or in a kept mark's words as one step (`{ ok }` either way). `edit(mark, at?)` (since 1.1.1): opens a kept line of the open room to write in, as a triple-click does, with the caret at `at` (its end by default), and keeps the thought being written first; `{ ok, id }`, or `{ ok: false, reason }` for a mark that is not words, not in the open room, or in a locked room (a caret that runs on from one paragraph into the next). `style(kind, from?, to?)`: a kind of span (`slots.spans`) on over those words of the thought being written, or off where they all have it (the selection by default; a bare caret styles nothing, so a plugin wanting the word at the caret finds it in `text` and passes `from`, `to`); `true`, or `false` when nothing is being written; `spans()` its spans now. `on(fn)` hears the caret move and the words change, `fn(caret)`. A command with `zone: 'editing'` runs while a thought is being written (Ctrl+B in a thought), and only then. |
| `ui.size(mark, width)` | Since 1.1.0: how tall a mark draws at `width`, for a rule laying marks in a column: `{ height, inline, lines?, lineHeight? }`. Words by their lines (as `ui.measure`); a kind with `height(mark, width)` by its own word; `inline` whether it flows among paragraphs (words do; a kind says so with `inline: true`). `null` for no such mark. |
| `ui.measure(text, width)` | Since 1.1.0: how words wrap at `width` (world units) as the room draws a thought: `{ lines, lineHeight, height }`. Pure: the same words and width give the same answer, so a rule's `arrange` may use it. |
| `ui.zoom` | Since 1.1.0, the open room's zoom: `get()` → `{ zoom, band }` or `null` outside a room; `set(zoom, at?)` zooms it (kept within 0.25 to 4) with the world point `at` (`{ x, y }`, the middle of the screen by default) staying where it is on the screen, → `{ ok, zoom, band }` or `{ ok: false, reason }`; `on(fn)` hears each change of zoom or of room, `fn({ zoom, band, context })`, and returns a function that stops (it stops when the plugin is switched off); since 1.1.4 `get()` also gives the view's centre `x`, `y` in world units, and `go({ x?, y?, zoom? }, { ms? })` moves the view there eased (what is left out stays; `ms` 320 by default, at most 2000, 0 at once; at once when the system asks for less motion) → `{ ok, x, y, zoom }` or `{ ok: false, reason }` outside a room (read the view with `get`, never the canvas's markup); `bands` the fixed bands, `{ far: [0.25, 0.5], mid: [0.5, 1.75], near: [1.75, 4] }`, each `[from, to)` (near holds 4). A room opens at 1, in `mid`: `far` sees the room as a map, `near` close up. A rule's row may give words for a band (Rules, above). |
| `ui.download(name, content, type?)` | Hands the person a file: `content` words or a Blob, `type` `text/plain` by default. The same as `ui.files.save`. |
| `ui.files` | Files in and out, in the browser or the desktop app (`app/core/api/files.js`). `open(accept)` resolves with the chosen `File` (`name`, `await file.text()`), or `null`; `accept` as an input's (`'.traum,.md'`). `save(name, content, type?)` hands the person a file (`content` words or a Blob): a download in the browser, Windows' Save dialog in the desktop app; resolves `true` once saved, `false` when cancelled. Export goes through `save`. `arrived(fn)` hears each file the person opened from Windows (a double-clicked `.traum`) as a `File`; never in a browser; returns a function that stops hearing. |
| `together(fn)` | Every propose `fn` makes lands as one step (one Ctrl+Z), not one each. Returns what `fn` returns. Since 1.1.1 `fn` may be async (a file picked, then marks made): the step stays open until its promise settles and lands as one step, and `together` resolves to what it resolved to; a rejected promise takes the whole step back and resolves to `{ ok: false, reason }`. After 30 s the step lands with what it has, with a warning in the console. A `together` inside it is the same step. While it is open, the person's own gestures are steps of their own. |
| `ui.link(url)` | Opens an `https://` address in the person's browser (a new tab; the default browser in the desktop app). `false` for any other address. |
| `ui.roundTrip(urlFor)` | The desktop app only: opens `urlFor(port)` (an `https://` address) in the person's browser and waits for the browser to come back to `http://127.0.0.1:<port>/…`; resolves with that path and query (`'/done?…'`), or `null` (in a browser, or nobody came back within five minutes). For what can't happen in the app's window, such as signing in with Google. |
| `ui.chosen()` | What the person is looking at: `{ context, mark, marks }`, the open room and the one mark chosen there (`mark` `null` for none, or when several are), or `null` outside a room. Since 1.1.1 `marks` is everything chosen (ids, frozen), and `ui.chosen.on(fn)` calls `fn({ context, mark, marks })` once after each change of the choice (in or out of a room too), until it is switched off or the function it returns is called. Since 1.1.4 both also carry `mode`, the open room's mode (a rule's id), and `chosen.on` fires when it changes (Tab, the rail, an undo, another room opened): listen here, never to the canvas's markup. |
| `ui.choose(ids)` | Since 1.1.1: chooses those marks of the open room, as a click and Shift-click would; `{ ok }`, refused outside a room or when none of them is there. |
| `ui.repaint(ids?)` | Since 1.1.1: the open room draws those marks (or all of it) again on the next frame, though no table changed: for a decorator or span whose look follows the plugin's own state. Asked many times in one frame, it draws once. `false` outside a room. |
| `peers` | What plugins offer each other, by name, through the API (an imported plugin reaches no other plugin any other way). `offer(name, value)` makes `value` the one offer under `name` (another plugin's offer of the same name refuses in words) and returns a function that takes it back; it also goes when the plugin is switched off. `get(name)` is the value offered now, or `null`: ask when it is needed, since the plugin offering it may start later or be off. The Source editor offers `source` this way and Room file asks for it. Since 1.1.1 `on(fn)` hears every offer made or taken back, `fn({ name, offered, owner })` (offered `false` when it went, its plugin switched off too); it returns a function that stops hearing. |
| `plugin` | `{ id, name }` of the plugin that connected. |
| `app` | `{ name, version, desktop }` of the app; `desktop` is true inside the desktop app (Windows), false in a browser. |

Each `add` returns a function that takes the item away again; everything a plugin adds is taken
away when it is switched off.

## Surfaces: drawing and the pointer

**Surfaces draw what they must to be a tool, never the app's own words** (since 1.1.1): a
surface may colour what it draws as its tool needs (a code editor's syntax, a chart's bars, a
drawing's strokes), but the app's own parts (buttons, labels, panels, its type and words) stay
Folio's, and a surface never draws them in a look of its own.

Since 1.1.0. A kind of mark (`slots.kinds`, with `surface: id`) or a thin rule's box (`draw`, a box
with `surface: id`) asks for a surface by its id, and the room gives the plugin that added it an
element, sized by the layout, to draw in: an SVG or a canvas the plugin makes and owns. Say
`surface` in the plugin block's `needs`.

```js
t.slots.kinds.add({ kind: 'sketch', name: 'Sketch', surface: 'sketch', tidy, text, node, add: { note: 'A drawing' } });
t.slots.surfaces.add({
  id: 'sketch', width: 240, height: 160,           // its size when the layout gives none (world units)
  draw(el, ctx) { el.replaceChildren(svgOf(t.marks.get(ctx.mark))); },
  pointer(e, ctx) { if (e.type === 'up') t.marks.edit(ctx.mark, { strokes: [...old, stroke] }); },
});
```

| Hook | Called when | Given |
|---|---|---|
| `draw(el, ctx)` | it shows, and again when its mark's fields, its box or its size change (never mid-gesture: once it ends) | `el`: an empty element the size of the surface, the plugin's to fill. An SVG there fills it and is filled in the text's colour with no stroke: say other paint on its shapes, or inline (`style`) on the svg itself, since the app's own rule for icons outranks attributes on an svg. |
| `pointer(e, ctx)` | while focused: `e.type` `down`, `move`, `up` or `cancel` | `e`: `{ type, x, y, pressure, buttons, pointer, shift, alt, ctrl }`; `x, y` in the surface's own units (0, 0 its top-left corner, `ctx.width, ctx.height` its foot), however far the room is zoomed; `pointer` `mouse`, `pen` or `touch` |
| `wheel(e, ctx)` | while focused | `e`: `{ x, y, dx, dy, ctrl, shift }`; return `true` when used, else the room pans and zooms as ever |
| `key(e, ctx)` | while focused, a key down | `e`: `{ key, code, shift, alt, ctrl }`; return `true` when used. Esc never reaches it (Esc gives the room back), nor Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z (undo and redo). The app's keys wait while a surface is focused. |
| `focus(ctx)`, `blur(ctx)` | it is clicked into; Esc, a click outside or another surface takes it back | |
| `leave(el, ctx)` | it is no longer drawn (its mark gone, the room left, the plugin off) | |

`ctx` is frozen: `{ surface, mark, context, box, width, height, focused, el }`: the mark's id (or
`null` for a box), the room's id, the box as `draw` gave it (or `null`), the size in world units,
and the element `draw` was handed (so `pointer` can draw a stroke live into it). Read the mark
through `t.marks.get(ctx.mark)`. A box's surface reads what it shows from `ctx.box.data`, which the
rule's `draw(reads, context)` worked out from the world being drawn (a moment of the time scrub
too); a box's surface is drawn again after each change to the room's marks or links. The size can
change with the layout, so a surface that keeps coordinates scales them to units of its own (Sketch
keeps a 240 × 160 pad). A kind's `tidy` gives back every field it owns, an empty one too: an edit
merges what `tidy` returns, so a field left out keeps its old value.

**The rules it keeps.** A press on a surface that is not focused goes to the room (choose the mark,
drag it); a click (let go where it was pressed) focuses it. **Pointer down to pointer up is one
gesture, and every propose the plugin makes in it lands as one step**: a stroke is one Ctrl+Z,
however many edits it made. A surface keeps nothing outside the tables: what it draws is read from
its mark's fields (an array of points is a field like any other, so a `.traum` file carries it:
Law 8), and what it changes is a propose (`marks.edit`). `t.store.files` is for what the tables
should not carry (a cache); it never travels in a file. A surface kind whose plugin is off shows as
the quiet stand-in, its fields kept as they are. A hook that throws changes nothing in the room.
`app/plugins/sketch` (a kind with a pen) and `app/plugins/chart` (a rule whose box draws a bar
chart) are the corpus's surfaces.

## AI

`t.ai` is the AI framework (its contract: [`AI.md`](AI.md)). Any plugin can call a task; a
provider plugs in as a slot. The AI never changes the world: a provider is handed reads only, and
a result that would change anything reaches the maker as a suggestion to keep or refuse.

| Member | What it is |
|---|---|
| `ai.tasks()` | `[{ name, version, note }]`: `embed`, `search`, `link`, `group`, `label`, `judge`, `suggest`, `gap` |
| `ai.schema(task)` | the task's input and output schemas as plain data (JSON Schema), or `null` |
| `ai.providers(task?)` | `[{ id, name, version, tasks, engine, hints }]`; for a task, in the order they are tried |
| `ai.first(task, context?)` | the provider a call would try first now, or `null` |
| `ai.call(task, input, opts?)` | a Promise of `{ ok: true, task, version, provider: { id, version }, output, ms, cached, tried }` or `{ ok: false, task, reason, tried }`; `opts` `{ context, priority, signal, part, only, fresh }` |
| `ai.verdict(v)` | routes Keep or Refuse (`{ provider, version, task, kept, features?, suggestion? }`) to the provider that made the result |
| `ai.verdicts(task?)` | the maker's verdicts, read from the suggestions in the tables |
| `ai.exam({ provider, task, cases? })` | scores a provider (the evaluation harness) |
| `ai.item(id)` | a mark as a task item `{ id, text, at? }` |
| `ai.bridges` | `worker(o)`, `http(o)`, `openai(o)`: ready-made providers for a Web Worker (JS or WebAssembly), a local connection (a sidecar) and an OpenAI-style server (AI.md, Bridges) |
| `slots.providers` | a provider: `add({ id, name, version, tasks, hints?, engine?, available?(), load?(), unload?(), run(task, input, ctx), verdict?(v) })` |
| `slots.engines` | a runtime several providers share: `add({ id, name, kind?, memory?, gpu?, load?(), unload?() })` |
| `slots.aiServices` | a replacement for the scheduler, cache or budget: `add({ id, replaces, make(defaults) })` |

## ui: docks, the frame and going somewhere

| Member | What it is |
|---|---|
| `ui.docks` | `{ left, right, canvasOnly() }`, or `null` when the app has no docks. `canvasOnly()` hides every dock that shows; again brings them back. Each dock has `open({ key, tab, kind, title, label, body, beforeClose, onClose, drop })` (`drop: { drop(ids, target), accepts?(ids, target) }`: thoughts dragged from the canvas may be let go on the tab, onto the element under the pointer with a `data-drop` attribute, or the tab itself; the room lights it while one is held over it and leaves the thoughts where they were) (resolves with a handle, or `null`), `close(key, force)`, `show(key)`, `isOpen(key)`, `isShowing(key)` (`app/core/docks/README.md`). Since 1.1.4 `hide()` tucks the dock away, keeping what it holds (its strip stays), `show()` with no key brings it back as it was, and `shown` says whether it shows; `hide` gives true once it is hidden, `show()` true once it shows (false when it holds nothing). Every tab a plugin opens is closed when it is switched off. |
| `ui.frame` | The top bar and status bar for a page the plugin shows: `show({ crumbs, idle })`, `update(o)`, `hide()`, `hint(text)`, `clearHint()` (`app/core/frame/README.md`). `null` without the frame. |
| `ui.open` | `rooms()` (the rooms page), `room(id)` (into a room, from anywhere), `mark(id)` (into the room a mark is at home in, with the view on it and it chosen; a room: into it; `false` when it is in no room), `page(id)` (since 1.1.0: a page a plugin added with `slots.pages`; `false` when there is none). |

## Parts: what rules and views share

Stable for every plugin since 1.0.3 (before, only for the modes that ship with the app): a name
here may gain siblings, never be renamed or taken away, and `tests/api.test.js` holds the list.

| Member | What it is |
|---|---|
| `parts.model`, `parts.groups` | The rule kit: plain functions of a world handed to them (`parentOf`, `shut`, `members`, `groupOf`, `create`, `join`, `setSpot`, …; `wait`, `putAt`, `trayForeign`, …). A rule reads the world its layout and gestures are handed; a write with the kit is a rule's own gesture, which the room lands as one step. Anything else proposes through the tables. |
| `parts.world()` | The tables as the world holds them now, for a rule or a view to read (read afresh each time: the world is replaced when read back from storage). |
| `parts.lines`, `parts.arrows`, `parts.maths`, `parts.layout`, `parts.trains`, `parts.relations` | Drawing: lines and their ends, arrows on the screen, KaTeX, Pessoa's spiral, a train's rhythm, relation lists. |
| `parts.kinds`, `parts.twins`, `parts.pictures` | `ITEMS`, `kindFor(kind)`, `isKnown`; `isTwin`, `twinOf`, `sides`, `addTwin`; `shrinkPicture(file)`, `keepOrShrink(blob, src?)`. |

## Events a plugin may listen to

`world:saved`, `world:changed` (`{ undone }`), `world:look`, `world:palette`, `room:open`,
`room:changed`, and Folio's `app:ready`, `app:resume`, `app:tick`. Prefer a table's `on`.

## Version 1

Version 1's flat names (`world`, `save`, `write`, `load`, `data`, `model`, `groups`, `modes`,
`items`, `commands`, `toast`, `docks`, `frame`, `open`, `floors`, …) went in kernel phase 6. A
plugin written for API 1 no longer connects; `tests/api.test.js` checks none is offered.
