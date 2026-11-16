# Time

A tab of the right dock, **Time** (Ctrl+Alt+T), the same everywhere Create shows:

- **In a room** it is the room's Timeline: everything written there, in the order it last changed
  (latest at the bottom), each with its time and, where the mode groups thoughts, its group as a
  tag (Joyce: its train; Russell: its chapter). A click takes the room to it (the Editor follows,
  but Time stays in front). A Twin's side shows that side's thoughts.
- **On the rooms page** it lists the days something was written or written in, newest first, and
  under each day the rooms written in (most first) with how many thoughts. A click chooses that
  room, on its floor (or the Archive).
- **Going back** (the rooms page): above the list, a slider of days, the oldest known at the left
  and today (Now) at the right; a day's date in the list goes there too (again: back to now).
  While a past day shows, the rooms page draws itself as it was at the end of that day, from
  what Time gives it (`showDay`): the rooms of that day where they sat, named as they were; a
  room deleted since as a faint ghost; the rooms written in that day glowing; rooms made later
  not there. It is view only. In the dock ↑ goes a day later and ↓ a day earlier (Shift: a
  week); Escape, × or Now comes back to now, and so does leaving the rooms page. Days before the
  log's history began show its starting picture.
- **Going back in a room**: the same slider (from the day the room or its first thought was
  made). The list keeps only the thoughts made by the end of that day, those written that day
  with their time lit. On the canvas everything stays where it is now; the room (through
  `showDay`, `{ day, later, lit }` from `days.js`'s `roomBoard`) fades the thoughts made later
  and lights those written that day. Leaving the room comes back to now.

Ctrl+Alt+T (or Time under ⋯ More, at the foot of both rails: the plugin API's `t.more`) turns it on, brings its tab to the front when another is in
front, or turns it off; its × or Escape turns it off too. Whether it is on is one choice for
everywhere, saved as 'open': going into a room or back out keeps it on, showing that place.
Without the docks, Time is off and adds no key. It is a plugin: it reaches the app only through
the plugin API (`app/core/API.md`), and defines its own slot `time.place` and service `time`.

## Going back in time

Going back to a day reads the world's moments log through the API's moments table (`t.moments`):
`moments.at(time)` gives the things as they were at that day's end, so the rooms page shows the
rooms where they sat and as they were called then (`record.js`'s `pastBoard`), and
`moments.changed(id)` says when each thought was last written, for the Timeline's order and the
days list (`days.js`). Time keeps no record of its own.

**Settings → History** says how many days the log keeps (`moments.keep(days)`): 1 month, 1 year
(the usual) or forever. Days older than that fold into one starting picture in the log.

## The time.place slot

Time draws only the dock. Where Create is, and what a click does, belongs to the place: the room
feature and the rooms feature each add one item. The first whose `live()` is true is used.

`{ live(), room(), chosen?(), go(f), redraw?(), showDay?(past) }`

| Field | What it is |
|---|---|
| `live()` | True while this place shows |
| `room()` | The open room's id, or `null` for the rooms page |
| `chosen()` | The id chosen there (a thought, group or room), lit in the list |
| `go(f)` | Goes to a find `{ id, kind, room }` (a room: `{ id, kind: 'room' }`) |
| `redraw()` | Time was turned on or off (a rail shows whether it is on) |
| `showDay(past)` | Show a past day, or `null` for now. The rooms page gets `{ day, rooms, written, counts }` (`record.js`'s `pastBoard`), a room `{ day, later, lit }` (`days.js`'s `roomBoard`). Only a place with it gets the slider. |

## The time service

`this.use('time')`:

| Member | What it does |
|---|---|
| `toggle()` | As Ctrl+Alt+T |
| `refresh()` | The place changed: drawn again, left, or a new choice (Time follows a moment later) |
| `show()` | Brings its tab to the front |
| `on` | Whether Time is on |
| `showing` | Whether its tab is in front and the dock shows |
| `now()` | Back from a past day to now (the rooms page's Escape) |

It listens to `world:saved`, `world:changed`, `room:open` and `room:changed`, and reads the
world through the `world` service. Saved data: 'open' (whether it is on).

**The code.** `Time.js` is the feature; `days.js` and `record.js` its rules with no screen
(tested in `tests/`); `keys.js` its key; `style.css` its layout (classes start with `time-`).
