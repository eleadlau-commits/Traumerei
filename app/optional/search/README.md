# Search

Search every room (Ctrl+K, ⌘K on a Mac, or the Search bar in a room): a quiet panel near the top
that looks through every room for a thought, a group or a room whose words hold what is typed.
The finds are listed latest first, each with its room's name (or *Room*). The arrows move through
them, Enter or a click opens one, and Escape or a click outside closes the panel. With no finds it
says *Nothing yet with those words*.

**The link hand.** With a mark chosen in a room, Ctrl+K opens the panel linking: it says
*Link “…” to…*, the chosen mark is left out of the finds, and Enter or a click links the two (a
`link`, the kind Search declares: these two belong together, read either way), in any rooms. The
panel closes and the room stays; the room draws the link (a line, or a ↗ to follow it with Alt+L).
Ctrl+Z takes it away. **Tab** switches between linking and only finding. `linkTo` is tested in
`tests/link.test.js`.

It only finds. What a find opens is up to whoever shows rooms (the room feature): the room, or
the room a thought is in with the view on that thought.

The rooms page's own Ctrl+K, the search lights that dim the squares without the words, is part of
the rooms page (the rooms feature), because it is a way of drawing the grid.

## The search service

`this.use('search')` gives everything it offers:

| Member | What it does |
|---|---|
| `open()` | Shows the panel, with the field ready for typing. |
| `close()` | Hides it, if it shows. |
| `isOpen` | Whether it shows. |

It sends `search:found` when a find is opened, with `{ id, kind, text, room, roomName }` as the
world's `search` gives it (`kind` is `'room'`, `'group'` or a thought's kind; `room` is the room
it is in). It has no slots.

**The code.** `Search.js` is all of it; the matching is the world's `search` (`t.model.search`,
through the plugin API: Search is a plugin). `style.css` holds its look (classes start with `search-`).
