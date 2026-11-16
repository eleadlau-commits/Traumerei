# Träumerei plugin API 3: the guide for writing a plugin

Condensed from `app/core/API.md` (Träumerei 1.1.2, plugin API 3, frozen in 1.1.0 and grown only by
additions since). When the repo is at hand and this page and API.md disagree, API.md wins.

## 1. What a plugin is

A folder `app/plugins/<id>/` (id: lowercase words joined by dashes) with:

| File | What |
|---|---|
| `feature.json` | name, description, version, `main`, `"requires": ["api"]`, the `plugin` block |
| `<Main>.js` | `export function install(t) {…}` and `export default class X extends Feature` that calls it |
| `rules.js` (optional) | plain functions with no screen, so tests can check them |
| `tests/*.test.js` | `import { test, assert } from 'folio/testing'`; run by `build.py check <id>` and `build.py test` |
| `style.css` (optional) | layout only; list it in `"styles": ["style.css"]` |
| `README.md` | What it adds / What it needs / What it saves / Check it |

```json
{
  "name": "Word count", "description": "One sentence a person reads on the Plugins page.",
  "version": "0.1.0", "main": "WordCount.js", "requires": ["api"],
  "plugin": { "api": 3, "minApp": "1.1.2", "kind": ["editor"], "load": "start", "author": "E" }
}
```

Plugin block keys: `api` (3), `minApp` (oldest app it works with: write `1.1.2` for a new
plugin), `kind` (list, from: `mode`, `item`, `view`,
`editor`, `command`, `link`, `reader`, `format`, `page`, `look`, `tool`, `dock`, `provider`),
`needs` (list, from: `files`, `network`, `sidecar`, `store`, `ai`, `surface`; default none),
`load` (`start`), `author` (the person who asked for it; `E` when unsure in this project), `starts` (`on` default; `off` waits under More plugins). Any other word
is refused by the compiler and by the importer.

The main file, always in this shape:

```js
import { Feature, ui } from 'folio';          // the only bare import allowed

export function install(t) {
  t.slots.commands.add({ id: 'my-plugin.go', keys: ['Ctrl+Alt+Y'], words: 'Do the thing', zone: 'room',
    run: () => t.ui.toast(`${t.marks.in(t.ui.chosen()?.context).length} marks here`) });
}

export default class MyPlugin extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
```

`install(t)` is what the checks drive headless; keep everything in it (or in functions it calls).
A plugin reaches the app **only** through `t` (the `traumerei` service) and Folio itself
(`ui.el`, the `settings` slot). Importing another feature's files, `use()`-ing any other service
or adding to a core slot directly gets it left out of the build and refused at import.

## 2. Plain facts

- Times are milliseconds (`Date.now()`), in and out.
- **Reads** return frozen rows, frozen all the way down. Hold ids, not rows; read again after a change.
- **Proposes** (`make`, `edit`, `link`, `put`, `open`, `due`…) return `{ ok: true, id }` after
  landing as one undo step, or `{ ok: false, reason }` with nothing changed. Never throw for a
  refusal; show `reason` with `t.ui.toast`.
- `t.together(fn)`: every propose inside lands as ONE step. `fn` may be async (picked file, then
  marks); a rejection undoes the whole step.
- `on(fn)` on any table: `fn({ table, rows, undone })` after each landing; returns a stop function.
  Everything a plugin adds or listens to is taken away when it is switched off.
- `marks.in(context)`: every mark at home there (thoughts, groups `kind: 'group'`, a group's
  parts too); filter by `kind`. Plain words are `kind: 'line'`. A room's name is `marks.text(room)`.
- `t.ui.chosen()` → `{ context, mark, marks }` (open room, the one chosen mark or `null`, all
  chosen ids) or `null` outside a room.
- Build nodes with `ui.el(tag, attrs, ...kids)`; SVG with `document.createElementNS`.
- Slot items: `order` optional (lower first, 50 default); `title?()` a tooltip. Each `add`
  returns a function that removes the item.
- A thought is about 200 world units wide and a one-line thought about 40 tall (space rows 44 to
  60 apart, or ask `t.ui.size(mark, width)`); rule positions are a unit's **centre**, box
  positions a box's **top-left**.
- A read of something that is not there gives `null` (`marks.get`, `gaps.of`, `moments.next`);
  a list read gives `[]`.

## 3. The six tables

Words: readers `me now`, `me later`, `others`, `machine`. Gap directions `to world` (check),
`from world` (do), `to maker` (judge). Link kinds `part of`, `stands for`, `relation` + declared.

| Table | Read | Propose |
|---|---|---|
| `t.marks` | `get(id)`, `in(context)` (`null` = the rooms), `ofKind(kind)`, `text(id)`, `markdown(id)`, `search(words, most?)` | `make({ kind?, content, in, at? })` (`kind` default `line`, content = its words; `room` with name as content and no `in`; `group` with `{ title }` or `{ title, of: family }`; a plugin kind with its fields as content), `edit(id, fields)` (never kind/context/members/id; emptied → removed), `delete(id)` |
| `t.places` | `of(mark)`, `home(mark)`, `in(context, rule?)`, `loose(context)`, `position(mark, context, rule)` | `put(mark, context, rule?, position?)`, `move(mark, from, to)`, `unplace(mark, context)` |
| `t.links` | `get(id)`, `from(mark, kind?)`, `to(mark, kind?)`, `members(group)` (ids, ordered), `holders(mark)`, `standsFor(fold)`, `kinds()`, `named(kind)`, `count()` | `link(from, to, kind, label?, { rule, note, at }?)` (`part of` takes `at`; `relation` needs `rule`), `fold(context, ids)`, `unlink(id)`, `order(group, ids)` |
| `t.distance` | `of(mark)`, `declared(context)`, `all()`, `shut(mark)`, `readers()` | `declare(context, reader)` (`others` locks, `me now` unlocks) |
| `t.gaps` | `of(mark)` → `{ mark, direction, state: 'open'\|'resolved', openedAt, resolvedAt? }`, derived `{ derived: true, open, resolved, of }`, or `null` for none; `opened(context?)` the stored open rows of the marks at home there (a group's parts too; derived gaps not counted), oldest first, `oldest(context?)`, `progress(mark)` → `{ open, resolved, of }` | `open(mark, direction)` (refused while one is open: resolve it first; on a resolved gap it opens a new one, any direction), `resolve(mark, by?)`, `reopen(mark)` (same direction). A mark with parts has a derived gap: open/resolve its parts instead |
| `t.moments` | `of(mark)` (rows with `before`/`after` since 1.1.1), `changed(mark)`, `since(time)`, `day(date)`, `at(time)`, `placesAt(time)`, `first()`, `ahead(context?)`, `returns(context?)`, `next(mark)` → `{ at, state: 'waiting'\|'back'\|…, note }`, `seq()` (changes on every landing: cache by it) | `due(mark, time, note?)`, `revisit(mark, time, note?)`, `note(mark, text)`, `meet(mark)`, `refuse(mark)`, `clear(mark)`, `keep(days)` |
| `t.carriers` | `list()`, `tables(context?)`, `text(context?, { ids })` (.traum text), `read(text)`, `check(context, read)` | `land(read, { into? })`, `replace(context, read)` |

**Law 8: the `.traum` file is the tables.** What a plugin keeps anywhere else (a variable,
`t.store`, Folio storage) is not saved with the room and does not travel. Keep content in marks,
their fields, links, gaps and moments; keep only caches and settings outside.

## 4. Slots: where a plugin plugs in

| Slot | `add({...})` shape | Plugin `kind` |
|---|---|---|
| `t.slots.rules` | a mode: `{ id, name, note, icon, arrange(reads, context, settings) → [{ mark, x, y, width?, height?, align?, lines?, far?, mid?, near? }], admit?, hand?, draw?, drop?, land?, claims?, settings? }` (§5) | `mode` |
| `t.slots.kinds` | a kind of mark: `{ kind, name, tidy(fields, h) → fields\|null, text(mark), node(mark, el), fields?: [{ key, type: 'line'\|'text'\|'image', label }], add?: { note, keys?, file? }, takes?(file), fromFile?(file), label?(mark), open?(mark), inline?, height?(mark, width), surface? }`. `h` = `{ oneLine, lines }`. Field names may not be `id kind at edited parent archived`. `tidy` returns EVERY field it owns (an edit merges) | `item` |
| `t.slots.linkKinds` | `{ kind, name, note?, both?, quiet?, admit?(from, to, reads) → true\|'reason' }`; then `t.links.link(a, b, kind)` | `link` |
| `t.slots.groups` | a family of groups (book, chapters): `{ id, name, membership?: 'many'\|'one', order?: 'kept'\|'time', card?, keep?, open?(id), rule?, fields?: [names], tidy?(group) }` | `mode`/`view` |
| `t.slots.holds` | `{ id, holds(parent, kind) → bool }` what a mark may hold | — |
| `t.slots.spans` | a kind of span kept on the words (Law 1): `{ kind, name, class, md?: [open, close], click?(span, mark) }`. `class` ∈ `bold italic underline wavy highlight strike quiet caps mono` | `look` |
| `t.slots.decorators` | read-only look: `{ id, decorate(text, mark) → [{ from, to, class }] }`, same nine classes; runs on every thought drawn and each key: keep it FAST | `look` |
| `t.slots.surfaces` | `{ id, width?, height?, draw(el, ctx), pointer?(e, ctx), wheel?, key?, focus?, blur?, leave? }` (§6). Needs `surface` | `item`/`mode` |
| `t.slots.commands` | `{ id, keys?: ['Ctrl+Alt+K'], words, zone: 'room'\|'rooms'\|'editing'\|'everywhere', order?, when?(), run(e) }`; also `list()`, `run(id)`, `label(id)` | `command` |
| `t.slots.more` | ⋯ More entry: `{ id, label, icon, order, run(), on?(), visible?(), title?() }` | `command` |
| `t.slots.buttons` | rail Tools button: same shape as More | `tool` |
| `t.slots.bar` | word on the room's top bar: `{ id, label, title?(context), order, run(context), on?(context), visible?(context) }`. Give it a command too, for a key | `tool` |
| `t.slots.strip` | quiet status line at the canvas foot: `{ id, text(context) → string, title?, onClick?, visible?, order }`; `''` shows nothing (no need for `visible` to hide an empty count). Cache by `t.moments.seq()` | `tool` |
| `t.slots.editor` | Editor section for the chosen thing: `{ id, order, when?(x), render(x) → node\|null }`, `x = { id, roomId, mode, locked, refresh() }` | `editor` |
| `t.slots.pages` | a page in the frame (like Settings): `{ id, label, icon?, order?, idle?, visible?(), sections?() → [{ id, title, icon?, body }] \| render() → node }`; open with `t.ui.open.page(id)` | `page` |
| `t.slots.views` | a whole view under everything: `{ id, label, icon?, order, mount(container, { head, actions }), render() }` | `view` |
| `t.slots.menu` | ☰ row: `{ id, label, icon, order, onClick(), visible?() }` | `command` |
| `t.slots.formats` | `{ id, name, accepts(file), importRoom?({ file }) → { id }, importInto?(roomId, { file }), exportRoom?(id) }`; make the room inside `together()`; read a file with `await file.text()` | `format` |
| `t.slots.providers` / `engines` | AI (see `app/core/AI.md`); the AI never changes the world, it suggests | `provider` |
| Folio `this.add('settings', { id, title, order, render() })` | a Settings section (in the class, not `t`) | — |

## 5. Rules (modes) and their proposals

A rule keeps **no state**. `arrange(reads, context, settings)` is a pure function of the read
half of the tables (`reads.marks/places/links/distance/gaps/moments`, reads only; it may be a
frozen world or a past moment). Return `[{ mark, x, y }]`, centres; marks left out are laid in
rows below. 1,500 marks must arrange in **under 50 ms**: one pass, no nested scans of `marks.in`.

Optional row fields: `width`, `height`, `align: 'start'`; fragments `lines: [from, to]` (several
rows per mark: a paragraph split over pages; `t.ui.measure(text, width)` → `{ lines,
lineHeight, height }` says where the room wraps); zoom-band words `far`, `mid`, `near`. On the
rule: `claims: [family ids]` lays those families' groups itself; `hand: false` when a dragged
mark should not stay where dropped; `settings: [{ kind: 'choice', id, name, options: [{ id, name }],
default }, { kind: 'toggle', id, name, default }]` (handed as the last argument).

Hooks that give a room a form (each pure, returns data):

| Hook | When | Returns |
|---|---|---|
| `draw(reads, context, settings)` | room drawn | boxes `[{ x, y, w, h, label?, note?, right?, style?, level?, opens?, surface?, data? }]` (top-left). `label` small words at its top-left, `note` small words at its foot (`today`), `right` small words at its top-right. `style`: `plain` (a framed box, the default), `shelf` (dashed frame, faintly filled: lanes, columns, areas), `title` (no frame, a large label), `heading` (no frame, a heading label; `level` 2–3 smaller and indented), `line` (a dotted line along its foot), `quiet` (no frame, faint label), `page` (a sheet of paper with a shadow). The look is the room's, so pick by meaning |
| `drop(reads, context, mark, x, y, settings)` | a mark let go at x, y | a proposal, a list, or nothing |
| `land(reads, context, mark, x, y, settings)` | a new thought kept while a box is chosen, at Add's point, or written after a mark | a proposal, a list, or nothing |

Proposals: `{ due: time, note? }`, `{ revisit: time, note? }`, `{ clear: true }`, `{ gap: direction }`,
`{ resolve: true }`, `{ place: room, x?, y? }`, `{ join: group, at?, from? }`; add `mark` to
target another mark of the room. They land with the gesture as one step, in list order; a refused
one is skipped. `{ gap }` acts as `gaps.open`: refused while a gap is open, so return
`[{ resolve: true }, { gap: 'from world' }]` to change an open gap's direction; on a resolved or
missing gap `{ gap }` alone opens one. Read `reads.gaps.of(mark)` in the hook to return only what applies.

`reads.marks.draft(context)` → the thought being written `{ text, at?, after?, height? }` or
`null` (leave room for it). `t.rules.layout/admit/moves/draws(rule, context)` read any rule.

## 6. Surfaces (drawing tools, canvases)

Say `"needs": ["surface"]`. A kind with `surface: id`, or a rule box with `surface: id, data`, gets
an element to draw in. `draw(el, ctx)` fills it (called on show and after its mark/box changes);
`pointer(e, ctx)` with `e.type` `down|move|up|cancel`, `x, y` in the surface's own units; `key(e)`
and `wheel(e)` return `true` when used. `ctx = { surface, mark, context, box, width, height,
focused, el }`. Pointer down → up is one gesture and ONE undo step. Keep what it draws in the
mark's fields (`t.marks.edit`), never only in the element. Never draw the app's own buttons or
words in a look of your own: surfaces colour only what the tool needs.

## 7. ui

`ui.toast(text)` · `ui.chosen()`, `ui.chosen.on(fn)`, `ui.choose(ids)` · `ui.open.rooms()`,
`.room(id)`, `.mark(id)`, `.page(id)` · `ui.files.open(accept)` → `File|null`,
`ui.files.save(name, content, type?)` → bool, `ui.download(name, content, type?)`,
`ui.files.arrived(fn)` · `ui.docks.left|right.open({ key, tab, kind, title, label, body, drop? })`,
`.close(key)`, `.isOpen(key)`, `ui.docks.canvasOnly()` (`ui.docks` may be `null`) ·
`ui.frame.hint(text)`, `.clearHint()` · `ui.text.caret()` → `{ mark, from, to, text }|null`,
`.select`, `.replace(mark, from, to, words)`, `.edit(mark, at?)`, `.style(spanKind, from?, to?)`,
`.spans()`, `.on(fn)` · `ui.measure(text, width)`, `ui.size(mark, width)` · `ui.zoom.get()`,
`.set(zoom, at?)`, `.on(fn)`, `.bands` · `ui.repaint(ids?)` · `ui.link(url)` (https only).

Also: `t.peers.offer(name, value)`, `.get(name)`, `.on(fn)` (plugin to plugin); `t.store`
(`get/set/remove/keys/clear`, `files.*`; needs `store`; never saved in .traum); `t.ai` (needs
`ai`); `t.plugin` `{ id, name }`; `t.app` `{ name, version, desktop }`; `t.parts` (the rule kit
for full modes: only when writing a whole mode like Russell's).

## 8. The laws (the checks enforce them)

From `app/core/KERNEL.md`:

1. **Only marks exist.** Every row in places, links, gaps and distance refers to a mark id; rooms
   and floors are marks of a kind. A mark's material (words, fields, spans) is part of it.
2. **A mark is never lost.** Only an explicit delete removes it; every mark but a room or floor
   is in one context.
3. **A rule may constrain, never destroy.** It can refuse a position or a link, never delete;
   `arrange` and `draw` read and change nothing.
4. **Links are the only structure.** Membership, folding, order, relation are link rows; no
   plugin keeps its own list of members (a chapter is a group whose parts are `part of` links).
5. **One open gap per mark**, with a direction; a group's gap is derived from its parts.
6. **Every change is a moment**, landing in the log, undone as one step.
7. **Distance is inherited and only lengthens by hand** (lock = `others`).
8. **The file is the tables.** What cannot be expressed as rows is not saved.

Plus: switching a plugin off takes away all it added and loses no row; on again it works the same.
A thought of a kind (or a span, a link kind) whose plugin is off is kept untouched.

## 9. Do / never

- **Do** export `install(t)`; put logic in plain functions; test them in `tests/rules.test.js`.
- **Do** wrap multi-step changes in `t.together`, check `.ok` and toast `.reason`.
- **Do** cache counts by `t.moments.seq()`; keep decorators and strip text cheap.
- **Do** use Folio's classes for the look (`hint`, `small`, `word` buttons, `pick`); CSS only for layout.
- **Do** namespace ids: `<plugin-id>.<thing>` for commands and for slot items (`<plugin-id>` alone is fine for a plugin's one rule or one item of a slot).
- **Never** import another feature's files, or anything bare but `folio` (no npm packages: write
  it yourself, or load it at run time from `t.store.files.download`).
- **Never** keep content outside the tables, mutate a row, or write in `arrange`/`draw`.
- **Never** add a seventh primitive: compose from marks, places, links, distance, gaps, moments.
- **Never** copy colours or type into a plugin; never touch `standalone/` files.
- **Never** change core for one plugin. If the API truly lacks something, say so (gap check) and
  propose an addition to `v2.js` + `API.md` + `tests/api.test.js` as its own small PR.

## 10. Budgets (`build.py check` measures them on a 1,500-thought room)

Start ≤ 100 ms · rule layout ≤ 50 ms and places all 1,500 · rule boxes ≤ 50 ms · all decorators
over the room ≤ 50 ms, one thought ≤ 2 ms · strip text ≤ 20 ms. The app's own: room open 0.8 s,
Enter 0.35 s, a key 20 ms, page under 2 MB.
