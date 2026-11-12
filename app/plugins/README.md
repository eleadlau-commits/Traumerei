# Make a plugin

New work in Träumerei is a plugin: a folder here in `app/plugins/` that can be switched off in
Settings → Plugins without breaking anything else. This guide takes you from nothing to a working
plugin. The full list of what a plugin may use is `app/core/API.md`.

## 1. Make the folder

```
python build.py new-plugin word-count --kind editor --author E
```

This makes `app/plugins/word-count/` from the template in `app/templates/plugin/`:

| File | What it is |
|---|---|
| `feature.json` | Its name, what it needs (`"requires": ["api"]`) and its `plugin` block |
| `WordCount.js` | The plugin: connects to the API and adds an Editor section |
| `rules.js` | Plain functions that don't need the screen |
| `tests/rules.test.js` | Tests for them |
| `style.css` | Layout only |
| `README.md` | What it adds, needs and saves, and how to check it |

Options: `--name "Word count"`, `--description "…"`, `--requires docks` (features it needs besides
the API), `--kind mode,editor` (what it adds), `--author`. Run `python build.py test`, then
`python build.py serve`: the template already works (right-click a thought and the Editor says how
many words it holds).

A whole `feature.json`, for a plugin with no styles:

```json
{ "name": "Word count", "description": "…", "version": "0.1.0", "main": "WordCount.js",
  "requires": ["api"], "plugin": { "api": 2, "minApp": "1.0.0", "kind": ["editor"], "load": "start", "author": "E" } }
```

## 2. The plugin block

```json
"plugin": { "api": 2, "minApp": "1.0.0", "kind": ["editor"], "load": "start", "author": "E" }
```

| Key | What it says |
|---|---|
| `api` | The plugin API version it was written for. A plugin for a newer API than the app offers is left out, with the reason on the Plugins page. |
| `minApp` | The oldest app version it works with. |
| `kind` | What it adds, from the one list in app.json's `plugins.kinds`: `mode`, `item`, `view`, `editor`, `command`, `link`, `reader`, `format`, `page`, `look`, `tool`, `dock`, `provider` (AI tasks). The compiler refuses any other word; Settings → Plugins shows them in words. |
| `needs` | What it needs, from app.json's `plugins.needs`: `files` (opens and saves files), `network` (the internet or a local server), `sidecar` (starts a program on this computer), `store` (keeps its own files), `ai` (asks for AI tasks). Shown on its row and on the import card. Default `[]`. |
| `sidecar` | A program the desktop app starts for it: `{ program, url, bytes, checksum, args?, idle? }` (app/core/AI.md, Sidecars). Needs `sidecar` in `needs`. Packed as written. |
| `load` | `start` (the default) or `when-used`. |
| `author` | Who made it. |
| `starts` | `on` (the default) or `off`: it waits, switched off, under More plugins in Settings → Plugins until someone switches it on (then it stays on). The stress corpus starts off. |

The compiler checks the block, and leaves out a plugin that imports another feature's files or
uses a core service or slot directly: a plugin reaches the app **only** through the `traumerei`
service.

## 3. Connect

```js
import { Feature } from 'folio';

export default class WordCount extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    // …use t here
  }
}
```

`t` is the plugin API, version 2. Its names follow the kernel's six tables
(`app/core/KERNEL.md`):

| Name | Use it to |
|---|---|
| `t.marks` | read thoughts and rooms (`get`, `in`, `text`, `search`), make, edit and delete them |
| `t.places` | read and change where a mark sits in a room, under which rule |
| `t.links` | read and make links: a group's members (`part of`), arrows (`relation`) |
| `t.distance` | who a room is for (`me now`, `others`): a locked room reads `others` |
| `t.gaps` | what a thought was made to close: open a gap (to check, do or judge), resolve it, read a group's or a tree's progress |
| `t.moments` | times: made, edited, visited; what is to come and what came back (due, revisit, a note for the next visit) |
| `t.slots.rules` | add a mode (a way of seeing a room) |
| `t.slots.kinds` | add a kind of thought (a picture, a PDF page) |
| `t.slots.commands` | add a named action, with keys |
| `t.slots.more` | add an entry under ⋯ More |
| `t.slots.editor` | add a section to the Editor |
| `t.slots.formats` | add a file format to import and export |
| `t.ui.toast(text)` | show a short message |
| `t.ui.chosen()` | the open room and the thought chosen there, as ids (for a command on it) |
| `t.plugin`, `t.app` | `{ id, name }` of this plugin; `{ name, version }` of the app |

Reads return frozen rows: hold ids, not rows. A change (`make`, `edit`, `put`, `link`, …) returns
`{ ok: true, id }` after it is saved as one step Ctrl+Z takes back, or `{ ok: false, reason }`
with nothing changed. `on(fn)` on any table calls `fn` after each saved step and each undo.

Beside them: `t.ui` (`toast`, `chosen`, `docks`, `frame`, `open.rooms()`, `open.room(id)`, `open.mark(id)`),
`t.carriers` (a room as .traum text and back) and `t.parts`, what a rule (a mode) or a view of the
tables shares: the rule kit (`parts.model`, `parts.groups`: plain functions of a world handed to
them), the drawing parts (`lines`, `arrows`, `maths`, `layout`, `trains`, `relations`), `kinds`,
`twins`, `pictures`, and `parts.world()`, the tables as the world holds them now. A rule writes
with the kit only inside its own gestures, which the room lands as one step; anything else proposes
through the tables. Version 1's flat names (`t.model`, `t.world`, `t.save`, …) went in kernel
phase 6, and a plugin written for API 1 no longer connects. Version 2 is frozen (kernel phase 8): it changes only by adding.

## 4. Switching off

Everything a plugin adds through `t` (slots, table listeners, dock tabs, the frame) and through
Folio (`this.add`, `this.on`, `this.provide`) is taken away when it is switched off, and the
plugin starts afresh when switched back on. Undo the rest yourself:

- `this.attach(node, parent)` puts a node on the page and removes it on stop.
- `this.listenTo(target, type, fn)` listens to `window` or `document` and stops on stop.
- `this.whenStopped(fn)` runs `fn` on stop.
- `stop()` is called last: cancel timers and animation frames there.

A thought of a kind whose plugin is off is kept exactly as it is, and a room in a mode whose
plugin is off shows in Pessoa with a "Turn on" line. Holding **Shift** while the app starts (or
`?safe`) starts it with core only, so a broken plugin can always be switched off.

## 5. Rules that keep plugins easy to change

- **One owner.** Everything for the plugin lives in its folder. It talks to other features only
  through the API, slots and events.
- **One look.** Use Folio's classes from `folio/runtime/base.css` (`hint`, `pick`, panels, words
  as buttons); keep only layout in `style.css`. Never copy colours or type into a plugin.
- **Tests.** Put rules in plain modules and test them; `python build.py test` runs every
  `tests/*.test.js`.
- **README.** Keep its "What it adds", "What it needs" and "What it saves" lists true.
- **Missing something?** When the API lacks what a plugin needs, add it to the API (`v2.js`,
  `API.md` and `tests/api.test.js` together), never reach past it.

## 6. Pack it into one file

```
python build.py pack-plugin word-count
```

writes `packed/word-count.traumplug` (`--out <folder>` to put it elsewhere): the whole plugin
in one file a person imports in Settings → Plugins (Import plugin…, checked again there; see
`app/core/plugins/README.md`). A package (format `traumplug/1`) is one
JavaScript module exporting `manifest` (id, name, description, version, requires and the plugin
block), `css` (the plugin's styles) and a default `(folio) => class extends folio.Feature`. The
plugin's `import … from 'folio'` is read from the folio the app hands over, so the file has no bare
imports. Packages carry code and styles only; anything large (a model) is downloaded on first use.
A `sidecar` in the plugin block (program, checksum, permissions) is passed through as written.
