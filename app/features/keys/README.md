# Keys

One key map for the whole app. Every feature adds its keys to the slot `keys`; the ? list is
drawn from it, showing the keys live where you are (the room's inside a room, the rooms page's on
the rooms page, and those that work everywhere). A key whose entry has `run` is pressed through
the map: one listener, before any feature's own, takes the key and calls it. Keys the room and the
rooms page still press themselves are in the map too, so the list shows them and a clash is caught.

Keys are written as words, `"Ctrl+Alt+E"`, `"Ctrl+Shift+Z"`, `"Delete"`, `"?"` (`keymap.js` says
exactly how). `Ctrl` means Ctrl, or Cmd on a Mac. A letter is matched by where it is on the
keyboard; AltGr never counts as Ctrl+Alt. Because every key is data in one place, letting people
change them in Settings later is a small step.

## The keys slot

`{ id, keys, shows?, words, zone, order, when?(), run?(e), typing? }`

| Field | What it is |
|---|---|
| `id` | A name for it, `feature.action` |
| `keys` | Its keys, as words (`['Ctrl+K']`); none for a click or for typing |
| `shows` | What the list says instead of the keys ("Right-click · Enter") |
| `words` | What it does, in the list |
| `zone` | Where it lives: `everywhere`, `rooms`, `room`, … Two entries clash when they share a key in the same zone, or either is `everywhere` |
| `when()` | True while it is live (default: always) |
| `run(e)` | Called when its key is pressed; the key is then taken. Without it, the map only lists the key |
| `typing` | True to run even while a field has focus |

`?` itself is the map's own entry (`keys.list`), live wherever any other key is.

## The keys service

| Member | What it does |
|---|---|
| `show()` · `hide()` | Shows or hides the ? list |
| `label(id)` | An entry's keys as the screen shows them ("Ctrl+K", "⌘K" on a Mac), for a hover title |
| `live()` | The entries live now: `{ id, keys, words, zone }` |
| `clashes()` | Every pair of entries sharing a key: `[{ key, a, b }]` (also warned in the console on start) |

**The code.** `Keys.js` is the slot, the listener and the list; `keymap.js` the rules;
`tests/keymap.test.js` checks the rules and that the keys the room, the rooms page and the docks
add never clash.
