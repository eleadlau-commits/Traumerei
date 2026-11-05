# Time

A tab of the right dock, **Time** (Ctrl+Alt+T), the same everywhere Create shows:

- **In a room** it is the room's Timeline: everything written there, in the order it last changed
  (latest at the bottom), each with its time and, where the mode groups thoughts, its group as a
  tag (Joyce: its train; Russell: its chapter). A click takes the room to it (the Editor follows,
  but Time stays in front). A Twin's side shows that side's thoughts.
- **On the rooms page** it lists the days something was written or written in, newest first, and
  under each day the rooms written in (most first) with how many thoughts. A click chooses that
  room, on its floor (or the Archive).

Ctrl+Alt+T (or Time in a room's rail) turns it on, brings its tab to the front when another is in
front, or turns it off; its × or Escape turns it off too. Whether it is on is one choice for
everywhere, saved as 'open': going into a room or back out keeps it on, showing that place.
Without the docks feature, Time is off and adds no key.

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

It listens to `world:saved`, `world:changed` and `room:open`, and reads the world through the
`world` service.

**The code.** `Time.js` is the feature; `days.js` its rules with no screen (tested in
`tests/days.test.js`); `keys.js` its key; `style.css` its layout (classes start with `time-`).
