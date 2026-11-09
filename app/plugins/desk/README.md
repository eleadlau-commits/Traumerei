# Desk

Where the day starts. Every **open gap** (to check, to do, to judge) and everything that **came
back** (due, revisit, a note for this visit), across all rooms, in the **Desk** tab of the left
dock. Work from the desk once a day: done is no open gaps.

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`: `t.gaps.opened`, `t.moments.returns`, `t.places.home`, `t.marks.get`,
`t.marks.text`, `t.ui.docks.left`, `t.ui.open.mark`). It only reads; answering a gap or a return
is the Gaps and Returns plugins' work.

## What it adds

- **The Desk tab** in the left dock. At the top, the count ("5 open gaps · 2 back") and **By room**
  or **By floor**. By room: each room with something waiting, a room with something back first,
  then the room whose oldest item has waited longest; in each, what came back first, then the
  gaps oldest first. By floor: the same rooms under their floor, the Archive last. A row says the
  mark's words and why it is there ("To do, since 6 Nov", "Due yesterday"); a click or Enter goes
  into its room with the view on it and it chosen.
- **Ctrl+Alt+D** shows the desk with the first row ready (Up, Down, Home, End move; Enter goes);
  again, from inside the desk, hides it. Under ⋯ More: Desk.

Saved data: none.

`rules.js` holds the gathering and the words; `tests/desk.test.js` checks them.
