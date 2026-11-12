# Plugins

Settings → Plugins: one row for every plugin (a feature in `app/plugins/` with a `plugin` block,
`folio/README.md` §3), by name.

- **The switch works at once.** Off: the plugin stops, and everything it added goes (its modes,
  kinds, commands, dock tabs, top bar). Its data is kept; on again, it carries on where it was. A
  room seen through a mode that is off is seen through Pessoa, with a "Turn on" line in its rail.
- **What others need asks first.** Turning off a plugin that others require names them ("Turning
  off X also turns off Y") with *Turn them off* (Enter) and *Keep them on* (Escape).
- **Why one isn't running** is the line under its name: "Couldn't start: …", "Had a problem: …",
  "Needs …".
- **Safe mode** starts the app with every plugin off, this time only: *Start in safe mode* here,
  `?safe` in the address, or holding Shift while the app starts. *Start normally* ends it.

Folio does the switching (`app.stopFeature`, `app.startFeature`, `app.restart`, its `Feature.stop`,
`attach`, `listenTo`); this feature is the page and the words. When a plugin stops it asks the plugin
API to close what that plugin opened (`traumerei.release`).

## The `plugins` service

| Member | What it is |
|---|---|
| `list()` | `[{ id, name, on, status }]`, by name |
| `isOn(id)` | whether a plugin runs |
| `turnOn(id)` | switches it on (and what waited for it); resolves true when it runs |
| `turnOff(id)` | switches it off, and every plugin that needs it |
| `offMode(modeId)` | `{ id, name }` of the plugin that gives that mode, when it is off; else null |
| `safe` | whether the app started in safe mode |
| `importText(text)` | reads a `.traumplug`'s text and, when it passes the checks, shows the import card; resolves with the problem in words, or `''` |
| `remove(id)` | takes an imported plugin away (its saved data stays, as when switched off) |
| `imported()` | the ids of imported plugins |

## Imported plugins

**Import plugin…** at the foot of Settings → Plugins opens a `.traumplug` (from
`python build.py pack-plugin`). `imported.js` runs the compiler's checks again (format
`traumplug/1`, plugin API, oldest app, kinds and needs from app.json's one list, an id no feature
has, `requires` only `api`, and no `use` of anything but `traumerei`); a card says what it is, who
made it, what it adds and needs, and the person imports it or not. Its text is kept in this
feature's storage (`imported`) and it starts with the app from then on, once the built-in features
have (after `app:ready`), through Folio's `app.addFeature`. Its class holds one way in at run time
too: `use` answers only the plugin API and `add` reaches only Settings and its own slots. Safe mode
and the switch cover it like any plugin; **Remove** on its row takes it away (`app.removeFeature`).

Saved data: none (Folio keeps what is off, as `folio.disabled`).

**The code.** `Plugins.js` (the page, the service), `rows.js` (what a row says, as plain
functions), `style.css` (layout), `tests/rows.test.js`.
