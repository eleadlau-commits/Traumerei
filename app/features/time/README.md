# Time

A tab of the right dock, **Time** (Ctrl+Alt+T), the same everywhere Create shows:

- **In a room** it is the room's Timeline: everything written there, in the order it last changed
  (latest at the bottom), each with its time and, where the mode groups thoughts, its group as a
  tag (Joyce: its train; Russell: its chapter). A click takes the room to it (the Editor follows,
  but Time stays in front). A Twin's side shows that side's thoughts.
- **On the rooms page** it lists the days something was written or written in, newest first, and
  under each day the rooms written in (most first) with how many thoughts. A click chooses that
  room, on its floor (or the Archive).

Ctrl+Alt+T (or Time under ⋯ More, at the foot of both rails: the frame feature's `rail.more`) turns it on, brings its tab to the front when another is in
front, or turns it off; its × or Escape turns it off too. Whether it is on is one choice for
everywhere, saved as 'open': going into a room or back out keeps it on, showing that place.
Without the docks feature, Time is off and adds no key.

## The daily record

Time also keeps a record of the rooms page, day by day (`record.js`), for going back in time:
at the end of each day, every square on the rooms page (name, floor, cell, size, archived, colour)
and which rooms were written in that day (from `room:changed`; a Twin's side counts for its
Twin). Only changes are kept: a day holds the rooms that changed since the day before, the rooms
that went, and the rooms written in, and a day with none holds nothing. It is written a moment
after the world is saved (or a step undone), and when Create starts.

**Settings → History** says how long it is kept: 1 month, 1 year (the usual) or forever. Days
older than that are folded into one starting picture (`base`), so the record never grows past it.

## The time.place slot

Time draws only the dock. Where Create is, and what a click does, belongs to the place: the room
feature and the rooms feature each add one item. The first whose `live()` is true is used.

`{ live(), room(), chosen?(), go(f), redraw?() }`

| Field | What it is |
|---|---|
| `live()` | True while this place shows |
| `room()` | The open room's id, or `null` for the rooms page |
| `chosen()` | The id chosen there (a thought, group or room), lit in the list |
| `go(f)` | Goes to a find `{ id, kind, room }` (a room: `{ id, kind: 'room' }`) |
| `redraw()` | Time was turned on or off (a rail shows whether it is on) |

## The time service

`this.use('time')`:

| Member | What it does |
|---|---|
| `toggle()` | As Ctrl+Alt+T |
| `refresh()` | The place changed: drawn again, left, or a new choice (Time follows a moment later) |
| `show()` | Brings its tab to the front |
| `on` | Whether Time is on |
| `showing` | Whether its tab is in front and the dock shows |

It listens to `world:saved`, `world:changed`, `room:open` and `room:changed`, and reads the
world through the `world` service. Saved data: 'open' (whether it is on), 'record' (the daily
record), 'keep' (days of history kept, 0 for forever).

**The code.** `Time.js` is the feature; `days.js` and `record.js` its rules with no screen
(tested in `tests/`); `keys.js` its key; `style.css` its layout (classes start with `time-`).
