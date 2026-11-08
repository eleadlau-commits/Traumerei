# The Träumerei plugin API, version 1

A plugin is a feature folder in `app/plugins/` whose `feature.json` has a `plugin` block
(`folio/README.md` §3). It reaches the app **only** through the `traumerei` service below, and
through Folio itself (its own storage, events, the `settings` slot, `ui`). The compiler leaves out
a plugin that uses any other core service or adds to a core feature's slot directly.

```js
import { Feature } from 'folio';

export default class Haiku extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    t.modes.add({ id: 'haiku', name: 'Haiku', note: 'three lines at a time', /* … */ });
    t.commands.add({ id: 'haiku.count', keys: ['Ctrl+Alt+H'], words: 'Count the syllables', zone: 'room', run: () => t.toast('5 · 7 · 5') });
  }
}
```

List `"requires": ["api"]` in the plugin's feature.json, so it starts after the API and is left
out cleanly without it.

**Version 1 is not frozen yet.** It may change freely until the desktop app ships; from then on
it changes only by adding. `tests/api.test.js` in `app/core/api/` holds this list, so a change
here is always made on purpose, in both places.

## Connecting

| Member | What it is |
|---|---|
| `use('traumerei').version` | The API version the app offers (1). |
| `use('traumerei').connect(plugin)` | The API for this plugin (pass `this`). Throws when the plugin's block asks for a newer API. |

## What a plugin gets

| Member | What it is |
|---|---|
| `version` | 1 |
| `app` | `{ name, version }` of the app. |
| `plugin` | `{ id, name }` of the plugin that connected. |
| `world` | The world itself (its shape: `app/core/world/model.js`). Read it freely; change it only with the calls below. |
| `save()` | After a change: a change to the thoughts or rooms is a step Ctrl+Z can take back. |
| `write()` | Writes the world down now, rather than soon (for a change made outside a room, such as Home's quick thought). |
| `load()` | Reads the world afresh (it may have come from the account) with a fresh undo history, and returns it. |
| `data(roomId)` | This plugin's own data in a room, an object kept with the room (created when first asked for). |
| `toast(text)` | A short message at the foot of the screen. |
| `frame` | The top bar and status bar for a page the plugin shows: `show({ crumbs, idle })`, `update(o)`, `hide()`, `hint(text)`, `clearHint()` (`app/core/frame/README.md`). `null` without the frame. Hidden when the plugin is switched off. |
| `open` | Going somewhere: `rooms()` (the rooms page), `room(id)` (into a room, from anywhere). |
| `floors` | `place(id, cell?)`: where a new room goes on the rooms page (`cell` if free, else its floor's first free cell, else a new floor). |

## The world's rules

Plain functions of the world (`w` first), named as in the world feature's README.

| Part | Names |
|---|---|
| `model` | `own`, `shut`, `hash`, `roomSetting`, `setRoomSetting`, `isGroup`, `isLeaf`, `create`, `join`, `members`, `itemsIn`, `within`, `groupOf`, `groupsIn`, `roomItems`, `thoughtText`, `view`, `setOrder`, `groupLabel` (a group's name: its title, else its first words), `room`, `roomThoughts`, `kindOf`, `update`, `remove`, `groupsOf`, `addRoom`, `seedRoomSettings`, `search` (every room's thoughts, groups and rooms by their words), `MESSY` (Messy thoughts' id), `DEFAULT_MODE` |
| `groups` | Groups of other modes as one thing here: `placedForeign`, `trayForeign`, `inForeign`, `waiting`, `wait`, `spot`, `putAt`, `place`, `unplace` |
| `layout` | `spiralPoint`: where a thought not yet placed sits |
| `trains` | A train's rhythm (Joyce's, in the core), for any mode that reads thoughts top to bottom: `stepAfter`, `setHeights`, `STEP` |
| `twins` | A Twin, two rooms side by side: `isTwin`, `twinOf`, `sides`, `addTwin` |
| `kinds` | The kinds of item there are now: `ITEMS` (kept up to date as plugins add kinds), `kindFor(kind)` (a quiet stand-in for a kind whose plugin is off), `isKnown` |

## Shared parts

| Part | Names |
|---|---|
| `relations` | Named arrows between groups: `arrowsOf`, `cleanRelationList`, `relationEntry`, `relationEnds`, `listText`, `relationName`, `splitList`, `cleanRelations`, `relationShown`, `withRelation`, `RELATIONS` |
| `arrows` | `arrowView`: named arrows on the screen, edited where they are |
| `lines` | Lines on a canvas: `svg`, `layer`, `group`, `line`, `knot`, `slack`, `strand`, `path`, `middle`, `between`, `labelSpot`, `sidePoint`, `facing`, `PAD`, `ENDS`, `ENDS_WORDS`, `cleanEnds`, `PAUSE`, `HEAD` |
| `maths` | `maths(text)`: a thought's words with their LaTeX drawn; `broken(text)`: the LaTeX in it KaTeX can't draw |
| `pictures` | `keepOrShrink(blob, src?)`: a picture made small enough to keep, as pasted ones are |

## Places to plug in

Each has `add(item)`, which returns a function that takes the item away again. Everything a
plugin adds is taken away when it is switched off.

| Place | A plugin adds | Its shape |
|---|---|---|
| `modes` | a way of seeing a room | `app/core/world/ontologies/index.js`. Also `get(id)` (the mode with that id; the default mode when it is off or unknown), `all` (every mode now) and `settings` (each mode's settings for new rooms). |
| `items` | a kind of item (a thought that isn't plain words: a PDF page, a sketch) | `app/core/world/items/index.js`. A thought of a kind whose plugin is off is kept exactly as it is and shows as a quiet stand-in. |
| `commands` | a named action, with its keys if it has any (the ? list, and later a command list, read them all from here) | `{ id, keys?, words, zone, order, when?(), run?(e) }`: `app/core/keys/README.md`. Also `label(id)`: a command's keys as words ("Ctrl+K"), or `''`. |
| `more` | an entry under ⋯ More | `{ id, label, icon, order, run(), on?(), visible?(), title?() }` |
| `editor` | a section in the Editor for the chosen thing | `{ id, order, when?(x), render(x) → node \| null }`, x: `{ world, roomId, mode, id, thing, locked, refresh() }`: `app/core/room/README.md` |
| `formats` | a file format: rooms in and out, and edited as text | `{ id, name, accepts(file), importRoom?, importInto?, exportRoom?, canEdit?, editRoom?, editGroup?, cancel? }`: `app/core/world/formats.js` |
| Folio's `settings` slot | a section on the Settings page | `this.add('settings', { id, title, order, render() })` |

## Docks

`docks` is `{ left, right }`, or `null` when the app has no docks. Each dock has `open({ key, tab,
kind, title, label, body, beforeClose, onClose })` (resolves with a handle, or `null`), `close(key,
force)`, `show(key)`, `isOpen(key)` and `isShowing(key)`, as in `app/core/docks/README.md`. Every
tab a plugin opens is closed when it is switched off.

## Events a plugin may listen to

`world:saved`, `world:changed` (`{ undone }`), `world:look`, `world:palette`, `room:open`,
`room:changed`, and Folio's `app:ready`, `app:resume`, `app:tick`.
