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
| `data(roomId)` | This plugin's own data in a room, an object kept with the room (created when first asked for). |
| `toast(text)` | A short message at the foot of the screen. |

## The world's rules

Plain functions of the world (`w` first), named as in the world feature's README.

| Part | Names |
|---|---|
| `model` | `own`, `shut`, `hash`, `roomSetting`, `setRoomSetting`, `isGroup`, `isLeaf`, `create`, `join`, `members`, `itemsIn`, `within`, `groupOf`, `groupsIn`, `roomItems`, `thoughtText`, `view` |
| `groups` | Groups of other modes as one thing here: `placedForeign`, `trayForeign`, `inForeign`, `waiting`, `wait`, `spot`, `putAt`, `place`, `unplace` |
| `layout` | `spiralPoint`: where a thought not yet placed sits |

## Shared parts

| Part | Names |
|---|---|
| `relations` | Named arrows between groups: `arrowsOf`, `cleanRelationList`, `relationEntry`, `relationEnds`, `listText` |
| `arrows` | `arrowView`: named arrows on the screen, edited where they are |
| `lines` | Lines on a canvas: `svg`, `layer`, `group`, `line`, `knot`, `slack`, `strand`, `path`, `middle`, `between`, `labelSpot`, `sidePoint`, `facing`, `PAD`, `ENDS`, `ENDS_WORDS`, `cleanEnds`, `PAUSE`, `HEAD` |
| `maths` | `maths(text)`: a thought's words with their LaTeX drawn |

## Places to plug in

Each has `add(item)`, which returns a function that takes the item away again. Everything a
plugin adds is taken away when it is switched off.

| Place | A plugin adds | Its shape |
|---|---|---|
| `modes` | a way of seeing a room | `app/core/world/ontologies/index.js` |
| `items` | a kind of item (a thought that isn't plain words: a PDF page, a sketch) | `app/core/world/items/index.js`. A thought of a kind whose plugin is off is kept exactly as it is and shows as a quiet stand-in. |
| `keys` | a key and what it does | `app/core/keys/README.md` |
| `more` | an entry under ⋯ More | `{ id, label, icon, order, run(), on?(), visible?(), title?() }` |
| Folio's `settings` slot | a section on the Settings page | `this.add('settings', { id, title, order, render() })` |

## Events a plugin may listen to

`world:saved`, `world:changed` (`{ undone }`), `world:look`, `world:palette`, `room:open`,
`room:changed`, and Folio's `app:ready`, `app:resume`, `app:tick`.
