# The Träumerei plugin API, version 2

A plugin is a feature folder in `app/plugins/` whose `feature.json` has a `plugin` block
(`folio/README.md` §3). It reaches the app **only** through the `traumerei` service below, and
through Folio itself (its own storage, events, the `settings` slot, `ui`). The compiler leaves out
a plugin that uses any other core service or adds to a core feature's slot directly.

Version 2 names the app after the kernel's six tables ([`KERNEL.md`](KERNEL.md)): **marks**,
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
      run: () => t.ui.toast(`${t.marks.in(roomId).length} thoughts`) });
    t.marks.on(() => this.refresh());
  }
}
```

List `"requires": ["api"]` in the plugin's feature.json, so it starts after the API and is left
out cleanly without it, and `"plugin": { "api": 2, … }`.

**Version 2 is frozen** (end of kernel phase 8, after thirty plugins were written against this
page alone: [`CORPUS.md`](CORPUS.md)). From now on it changes only by adding, never by renaming or
taking away. `tests/api.test.js` in `app/core/api/` holds this list and `tests/corpus.test.js`
runs the thirty through the conformance suite, so an addition is made in three places at once:
`v2.js`, this file and the test.

**Plain facts.** Every time is a number of milliseconds (`Date.now()`), in and out. Every propose,
`moments.due` and `revisit` too, returns `{ ok, … }`. `marks.in(context)` gives every mark there:
thoughts and groups (`kind: 'group'`); filter by `kind`. `t.ui.chosen().context` is the open
room's id. Build a node with Folio's `ui.el(tag, attrs, …kids)` (`import { ui } from 'folio'`).
A command's or section's `order` is optional (lower first, 50 by default). `together(fn)` is
`t.together(fn)`.

## Connecting

| Member | What it is |
|---|---|
| `use('traumerei').version` | The API version the app offers (2). |
| `use('traumerei').connect(plugin)` | The API for this plugin (pass `this`). Throws when the plugin's block asks for a newer API; a plugin written for 1 still connects. |

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
| `marks` | `get(id)` · `in(context)` (the marks a context holds; `null` for the rooms) · `ofKind(kind)` · `text(id)` · `search(words, most?)` | `make({ kind?, content, in, at? })` (`kind` line by default; `room` with its name as content and no `in`, onto the first floor; `group` with `{ title }`, and a mark made `in` a group joins it; a plugin's kind with its fields as content; `at`: `x`, `y`) · `edit(id, fields)` (never kind, context, members or id; a mark left empty is removed, `{ ok, id, removed: true }`) · `delete(id)` | `on(change)` |
| `places` | `of(mark)` · `home(mark)` (the context it is in) · `in(context, rule?)` · `loose(context)` (marks at home there that no rule places) · `position(mark, context, rule)` | `put(mark, context, rule?, position?)` (into a context, laid under a rule when given; a room onto a floor `floor:<n>` or into the Archive `archive`) · `move(mark, from, to)` (lands loose in `to`) · `unplace(mark, context)` (loose there, under every rule) | `on(change)` |
| `links` | `get(id)` · `from(mark, kind?)` · `to(mark, kind?)` · `members(group)` (ids, in order) · `holders(mark)` (group ids) · `standsFor(fold)` (the marks it folded) · `kinds()` (part of, stands for, relation and the declared ones) · `named(kind)` · `count()` | `link(from, to, kind, label?, { rule, note }?)` (a relation needs the `rule` whose arrows these are and goes through its checks) · `fold(context, ids)` (one new mark stands for them) · `unlink(id)` (a stands-for row undone brings the mark back loose) · `order(group, ids)` | `on(change)` |
| `carriers` | `list()`, `tables(context?)` (the six tables of a room, a group with its parts, or the whole world, deep frozen), `text(context?, { ids })` (as .traum text), `read(text)` (`{ tables, root, report }` or `null`), `check(context, read)` (what writing it over the context would do: `{ ok, kept, changed, made, deleted }` or a refusal) | `land(read, { into?, page?, cell? })` (new marks: a new room, or poured into one), `replace(context, read)` (edited text written back over it) | |
| `distance` | `of(mark)` (its reader: the farthest declared on its way up, or `null`), `declared(context)` (its own row's reader, or `null`), `all()`, `shut(mark)` (in a context for others or a machine: nothing can change), `readers()` | `declare(context, reader)` (a room, a floor, the Archive; `me now` takes the row away; Lock is `others`) | `on(change)` |
| `gaps` | `of(mark)` (its row: `{ mark, direction, state, openedAt, resolvedAt?, resolvedBy? }`, or the derived gap of a mark whose parts carry gaps: `{ …, derived: true, open, resolved, of }`, open while any part's is; `null` for none) · `opened(context?)` (the open rows, oldest first; of the marks at home in a context) · `oldest(context?)` · `progress(mark)` (`{ open, resolved, of }` over its parts, through *part of* and *relation* rows up to it, however deep) | `open(mark, direction)` (one open gap per mark; refuses on a mark whose gap is derived: open one on a part) · `resolve(mark, by?)` (`by` a link id that exists, or `judgement`, the default; a derived gap resolves only through its parts) · `reopen(mark)` (its direction kept, from now) | `on(change)` |
| `moments` | `of(mark)` · `changed(mark)` (when last written: its made time when never edited) · `since(time)` · `day(date)` · `at(time)` (the marks as they were then) · `placesAt(time)` (the place rows as they were then) · `first()` · `kept()` (days of history kept) · `ahead(context?)` (moments to come) · `returns(context?)` (come back, waiting for an answer) · `next(mark)` · `seq()` · `outbox(seq)` (the rows since a seq as another copy of the world can take them; `null` for the whole world) | `keep(days)` (0: forever) · `absorb(rows)` (rows from another copy; the latest word on a thing wins) · `due(mark, time, note?)` · `revisit(mark, time, note?)` · `note(mark, text)` (back on the next visit) · `meet(mark)` · `refuse(mark)` · `clear(mark)` | `on(change)` |

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
room draws an open gap as an edge on the thought; the Gaps plugin (`app/plugins/gaps`) is the
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
| `layout(rule, context)` | `[{ mark, context, rule, position: { x, y } }]`: where each unit sits under that rule, from the rows; remembered until the tables change (a 1,500-thought room lays out in under 50 ms) |
| `admit(rule, proposal)` | `{ ok: true }` or `{ ok: false, reason }` for `{ kind: 'place', mark, context, position? }` or `{ kind: 'link', from, to, link, rule? }` (Russell refuses a loop). Changes nothing |
| `moves(rule, context, mark)` | `[{ id, label }]`: what the rule offers for a chosen mark |
| `draws(rule, context)` | `{ lines: [[mark…]], arrows: [{ from, to, label }] }`: what it draws beside the marks, as data |

**A rule of your own** is one function of the tables. Add it with `t.slots.rules.add`:

```js
t.slots.rules.add({
  id: 'grid', name: 'Grid', note: 'fixed cells, oldest first', icon: '<rect x="4" y="4" width="16" height="16"/>',
  arrange: (reads, context) => reads.marks.in(context).map((m, i) => ({ mark: m.id, x: (i % 6) * 240, y: Math.floor(i / 6) * 160 })),
  admit: (reads, proposal) => true, // optional: a reason in words refuses a position or a link
  hand: true,                       // optional: a mark dragged keeps where it was put (default true)
});
```

`arrange(reads, context)` returns `[{ mark, x, y }]` for the marks it places (world units; a
thought is about 200 wide). `reads` is the read half of the six tables (the `READS` list below),
over the world the rule is handed: it may be a frozen one, or the world as it was at a moment of
the time scrub, so read only from it. The kernel makes the rest: the room's units, a mark dragged
kept as a rule row of `places`, marks `arrange` leaves out laid in rows below the rest, and the
result remembered until the tables change (marks, places, links, gaps or moments ahead). A
1,500-mark room must arrange in under 50 ms.

The read half, as handed to `arrange`, a link kind's `admit` and every view:
`marks` get, in, ofKind, text, search · `places` of, home, in, loose, position · `links` get,
from, to, members, holders, standsFor, kinds, named, count · `distance` of, declared, all, shut,
readers · `gaps` of, opened, oldest, progress · `moments` of, changed, ahead, returns, next.

A full mode (Joyce, Pessoa, Russell: trains, trays, its own drawing, gestures) gives `units`,
`point`, `drop` and more instead of `arrange`; that shape is the world's own
(`app/core/world/ontologies/index.js`) and is for modes that ship with the app.

## Slots, ui, plugin and app

| Member | What it is |
|---|---|
| `slots.rules` | a way of seeing a room (an ontology, a rule in the kernel's words): `add(rule)`, `get(id)`, `all`, `settings`. Shape: `app/core/world/ontologies/index.js`. |
| `slots.kinds` | a kind of mark that isn't plain words: `add({ kind, name, tidy(fields), text(mark), node(mark, el), fields?, add?, takes?(file), fromFile?(file), label?(mark) })`. `kind` lowercase words joined by dashes; its fields may be named anything but `id`, `kind`, `at`, `edited`, `parent` and `archived`; `tidy` its own fields tidied, or `null` when empty; `text` its words as plain text (search reads it); `node` how it shows (`el` is Folio's `ui.el`); `fields` `[{ key, type: 'line' \| 'text' \| 'image', label }]` makes it written in the room's sheet; `add` `{ note, keys?, file? }` offers it under Add (with `file`, a file is picked and `fromFile` gives the fields). Make one with `marks.make({ kind, content: fields, in })`. A mark of a kind whose plugin is off is kept exactly as it is and shows as a quiet stand-in. |
| `slots.linkKinds` | a kind of link: `add({ kind, name, note?, both?, admit?(from, to, reads) })`. `kind` lowercase words (`cites`, `example of`); `both`: it reads the same either way (one row for a pair); `admit` returns `true` or a refusal in words. Then `links.link(from, to, kind, label?, { note }?)` makes one between any two marks, in any rooms, and `links.unlink(id)` takes it away. A row of a kind whose plugin is off is kept and travels in files. `links.named(kind)` gives `{ kind, name, note, both }`. |
| `slots.carriers` | a carrier of the six tables to somewhere else (the account's sync): `add({ id, name, moves })`, `moves` 'text' or 'moments'. Listed with the .traum file by `carriers.list()`. |
| `slots.commands` | a named action, with its keys if it has any: `add({ id, keys?, words, zone, order, when?(), run?(e) })`, `label(id)` (its keys as words). `zone` is where it works: `room` (inside a room), `rooms` (the rooms page) or `everywhere`; keys are written `Ctrl+Alt+K`; two commands clash when they share keys in one zone. |
| `slots.more` | an entry under ⋯ More: `add({ id, label, icon, order, run(), on?(), visible?(), title?() })`. |
| `slots.editor` | a section in the Editor for the chosen thing: `add({ id, order, when?(x), render(x) → node \| null })`. `x` is `{ id, roomId, mode, locked, refresh() }`: the chosen mark's id, its room, the room's mode, whether it is locked, and a function that draws the Editor again. Read the mark through `t.marks.get(x.id)`. |
| `slots.formats` | a file format: `add({ id, name, accepts(file), importRoom?(o), importInto?(roomId, o), exportRoom?(id) })`. `accepts` whether a picked or dropped file is this format's; `importRoom({ file })` makes a new room from it and returns `{ id }` of the room (or `null`), and may be async; `importInto(roomId, { file })` pours it into a room, `true` or `false`; `exportRoom(id)` hands the room out (with `ui.files.save`). Read a file with `await file.text()`. Only the first format with `exportRoom` serves a room's Export (the .traum file); another way out is a command or a ⋯ More entry. Make the new room and its marks inside `together()`, so the import is one step. |
| Folio's `settings` slot | a section on the Settings page: `this.add('settings', { id, title, order, render() })`. |
| `ui.toast(text)` | A short message at the foot of the screen. |
| `ui.download(name, content, type?)` | Hands the person a file: `content` words or a Blob, `type` `text/plain` by default. The same as `ui.files.save`. |
| `ui.files` | Files in and out, in the browser or the desktop app (`app/core/api/files.js`). `open(accept)` resolves with the chosen `File` (`name`, `await file.text()`), or `null`; `accept` as an input's (`'.traum,.md'`). `save(name, content, type?)` hands the person a file (`content` words or a Blob): a download in the browser, Windows' Save dialog in the desktop app; resolves `true` once saved, `false` when cancelled. Export goes through `save`. `arrived(fn)` hears each file the person opened from Windows (a double-clicked `.traum`) as a `File`; never in a browser; returns a function that stops hearing. |
| `together(fn)` | Every propose `fn` makes lands as one step (one Ctrl+Z), not one each. Returns what `fn` returns. |
| `ui.chosen()` | What the person is looking at: `{ context, mark }`, the open room and the one mark chosen there (`mark` `null` for none), or `null` outside a room. For a command on the chosen thought; nothing else of the screen is in the API. |
| `plugin` | `{ id, name }` of the plugin that connected. |
| `app` | `{ name, version, desktop }` of the app; `desktop` is true inside the desktop app (Windows), false in a browser. |

Each `add` returns a function that takes the item away again; everything a plugin adds is taken
away when it is switched off.

## ui: docks, the frame and going somewhere

| Member | What it is |
|---|---|
| `ui.docks` | `{ left, right, canvasOnly() }`, or `null` when the app has no docks. `canvasOnly()` hides every dock that shows; again brings them back. Each dock has `open({ key, tab, kind, title, label, body, beforeClose, onClose })` (resolves with a handle, or `null`), `close(key, force)`, `show(key)`, `isOpen(key)`, `isShowing(key)` (`app/core/docks/README.md`). Every tab a plugin opens is closed when it is switched off. |
| `ui.frame` | The top bar and status bar for a page the plugin shows: `show({ crumbs, idle })`, `update(o)`, `hide()`, `hint(text)`, `clearHint()` (`app/core/frame/README.md`). `null` without the frame. |
| `ui.open` | `rooms()` (the rooms page), `room(id)` (into a room, from anywhere), `mark(id)` (into the room a mark is at home in, with the view on it and it chosen; a room: into it; `false` when it is in no room). |

## Parts: what rules and views share

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
