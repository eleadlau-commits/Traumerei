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

**Version 2 is not frozen yet.** It changes freely through the kernel phases and is frozen at the
end of phase 8 (the stress corpus); from then on it changes only by adding. `tests/api.test.js`
in `app/core/api/` holds this list, so a change here is always made in three places at once:
`v2.js`, this file and the test. Version 1's names ([below](#version-1-the-compatibility-surface))
stay offered beneath v2 until phase 6.

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
| `marks` | `get(id)` · `in(context)` (the marks a context holds; `null` for the rooms) · `ofKind(kind)` · `text(id)` · `search(words, most?)` | `make({ kind?, content, in, at? })` (`kind` line by default, or room; `at`: `x`, `y`, `title`) · `edit(id, fields)` (never kind, context, members or id; a mark left empty is removed, `{ ok, id, removed: true }`) · `delete(id)` | `on(change)` |
| `places` | `of(mark)` · `home(mark)` (the context it is in) · `in(context, rule?)` · `loose(context)` (marks at home there that no rule places) · `position(mark, context, rule)` | `put(mark, context, rule?, position?)` (into a context, laid under a rule when given; a room onto a floor `floor:<n>` or into the Archive `archive`) · `move(mark, from, to)` (lands loose in `to`) · `unplace(mark, context)` (loose there, under every rule) | `on(change)` |
| `links` | `get(id)` · `from(mark, kind?)` · `to(mark, kind?)` · `members(group)` (ids, in order) · `holders(mark)` (group ids) · `standsFor(fold)` (the marks it folded) · `kinds()` (part of, stands for, relation) · `count()` | `link(from, to, kind, label?, { rule, note }?)` (a relation needs the `rule` whose arrows these are and goes through its checks) · `fold(context, ids)` (one new mark stands for them) · `unlink(id)` (a stands-for row undone brings the mark back loose) · `order(group, ids)` | `on(change)` |
| `distance` | `of(context)` (a reader, or `null`) | `declare(context, reader)` | `on(change)` |
| `gaps` | `of(mark)` · `opened(context?)` · `oldest(context?)` · `progress(group)` | `open(mark, direction)` · `resolve(mark, by?)` · `reopen(mark)` | `on(change)` |
| `moments` | `of(mark)` · `changed(mark)` (when last written) · `since(time)` · `day(date)` · `at(time)` (the marks as they were then) · `placesAt(time)` (the place rows as they were then) · `first()` · `kept()` (days of history kept) · `ahead(context?)` (due and return moments to come) · `seq()` · `outbox(seq)` (the rows since a seq as another copy of the world can take them; `null` for the whole world) | `keep(days)` (0: forever) · `absorb(rows)` (rows from another copy; the latest word on a thing wins) · `due(mark, time)` · `revisit(mark, time)` · `note(mark, text)` | `on(change)` |

Two names differ from the plan's table so that a read and a propose never share one word:
the open gaps are `gaps.opened(context?)` (the propose is `gaps.open(mark, direction)`), and the
moments to come are `moments.ahead(context?)` (the propose is `moments.due(mark, time)`).

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
and *edited* times. Gaps and the moments ahead: empty, until phases 5 and 7.

**Words.** Readers: `me now`, `me later`, `others`, `machine`. Directions: `to world` (check),
`from world` (do), `to maker` (judge). Link kinds now: `part of`, `relation`.

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

A mode a plugin adds may give `layout(w, room)` (every unit's point at once, for speed) and
`admit(w, proposal)` (its own refusals); without them the kernel reads `point()` and the shared
refusals. Law 3 is tested on every mode: its reads run on a frozen world, and its moves never
take a thought or a link away (`world/tests/rules.test.js`).

## Slots, ui, plugin and app

| Member | What it is |
|---|---|
| `slots.rules` | a way of seeing a room (an ontology, a rule in the kernel's words): `add(rule)`, `get(id)`, `all`, `settings`. Shape: `app/core/world/ontologies/index.js`. |
| `slots.kinds` | a kind of mark that isn't plain words (a passage, a picture, a PDF page): `add(kind)`. Shape: `app/core/world/items/index.js`. A thought of a kind whose plugin is off is kept exactly as it is and shows as a quiet stand-in. |
| `slots.commands` | a named action, with its keys if it has any: `add({ id, keys?, words, zone, order, when?(), run?(e) })`, `label(id)` (its keys as words). `app/core/keys/README.md`. |
| `slots.more` | an entry under ⋯ More: `add({ id, label, icon, order, run(), on?(), visible?(), title?() })`. |
| `slots.editor` | a section in the Editor for the chosen thing: `add({ id, order, when?(x), render(x) → node \| null })`. `app/core/room/README.md`. |
| `slots.formats` | a file format: `add({ id, name, accepts(file), importRoom?, importInto?, exportRoom?, canEdit?, editRoom?, editGroup?, cancel? })`. `app/core/world/formats.js`. |
| Folio's `settings` slot | a section on the Settings page: `this.add('settings', { id, title, order, render() })`. |
| `ui.toast(text)` | A short message at the foot of the screen. |
| `plugin` | `{ id, name }` of the plugin that connected. |
| `app` | `{ name, version }` of the app. |

Each `add` returns a function that takes the item away again; everything a plugin adds is taken
away when it is switched off.

## Docks, the frame and going somewhere

| Member | What it is |
|---|---|
| `docks` | `{ left, right }`, or `null` when the app has no docks. Each dock has `open({ key, tab, kind, title, label, body, beforeClose, onClose })` (resolves with a handle, or `null`), `close(key, force)`, `show(key)`, `isOpen(key)`, `isShowing(key)` (`app/core/docks/README.md`). Every tab a plugin opens is closed when it is switched off. |
| `frame` | The top bar and status bar for a page the plugin shows: `show({ crumbs, idle })`, `update(o)`, `hide()`, `hint(text)`, `clearHint()` (`app/core/frame/README.md`). `null` without the frame. |
| `open` | `rooms()` (the rooms page), `room(id)` (into a room, from anywhere). |
| `floors` | `place(id, cell?)`: where a new room goes on the rooms page. |
| `data(roomId)` | This plugin's own data in a room, kept with the room. *(Goes with Law 4 and the file law: what a plugin keeps here that is not rows is not saved after phase 6.)* |

## Events a plugin may listen to

`world:saved`, `world:changed` (`{ undone }`), `world:look`, `world:palette`, `room:open`,
`room:changed`, and Folio's `app:ready`, `app:resume`, `app:tick`. Prefer a table's `on`.

## Version 1: the compatibility surface

These names are still offered, unchanged, beneath v2, and go in kernel phase 6. New plugins
should not use them; existing ones move to the tables phase by phase. `modes`, `items`,
`commands`, `more`, `editor`, `formats` and `toast` are the same objects as `slots.*` and `ui.toast`.

| Member | What it is |
|---|---|
| `version` | 2 |
| `world` | The world itself (`app/core/world/model.js`). Read it freely; change it only through proposes or the calls below. |
| `save()`, `write()`, `load()` | A step Ctrl+Z can take back; written down now; read afresh with a fresh undo history. |
| `model` | `own`, `parentOf`, `shut`, `hash`, `roomSetting`, `setRoomSetting`, `isGroup`, `isLeaf`, `create`, `join`, `members`, `itemsIn`, `within`, `groupOf`, `groupsIn`, `roomItems`, `thoughtText`, `view`, `setOrder`, `groupLabel`, `room`, `roomThoughts`, `kindOf`, `update`, `remove`, `groupsOf`, `addRoom`, `seedRoomSettings`, `search`, `MESSY`, `DEFAULT_MODE`, `leave`, `replaceIn` |
| `groups` | `placedForeign`, `trayForeign`, `inForeign`, `waiting`, `wait`, `spot`, `putAt`, `place`, `unplace` |
| `layout` | `spiralPoint` |
| `trains` | `stepAfter`, `setHeights`, `STEP` |
| `twins` | `isTwin`, `twinOf`, `sides`, `addTwin` |
| `kinds` | `ITEMS`, `kindFor(kind)`, `isKnown` |
| `relations` | `arrowsOf`, `cleanRelationList`, `relationEntry`, `relationEnds`, `listText`, `relationName`, `splitList`, `cleanRelations`, `relationShown`, `withRelation`, `RELATIONS` |
| `arrows` | `arrowView` |
| `lines` | `svg`, `layer`, `group`, `line`, `knot`, `slack`, `strand`, `path`, `middle`, `between`, `labelSpot`, `sidePoint`, `facing`, `PAD`, `ENDS`, `ENDS_WORDS`, `cleanEnds`, `PAUSE`, `HEAD` |
| `maths` | `maths(text)`, `broken(text)` |
| `pictures` | `shrinkPicture(file)` (a picture file made small enough to keep), `keepOrShrink(blob, src?)` |

The drawing helpers (`lines`, `arrows`, `maths`, `pictures`, `trains`) are not kernel; they move
to a `parts` plugin that other plugins may require. The kernel API has no DOM in it.
