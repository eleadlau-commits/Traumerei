# Returns

What comes back to you. Ask a thought to come back **due** on a day, to **revisit** tomorrow or
next week, or leave it a **note for next time**; when the day comes (the app open on or after it)
or its room is gone into, it is back, in the **Returns** tab of the left dock, beside Loose. Each
one can be met, put off to tomorrow, or refused; every answer is a moment in the record, and
Ctrl+Z takes it back. Moments ahead are the kernel's (`app/core/KERNEL.md`, phase 7); this plugin
is the hands on them.

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`: `t.moments.ahead`, `returns`, `next`, `due`, `revisit`, `note`, `meet`,
`refuse`, `clear`; `t.ui.docks.left`, `t.ui.chosen`).

## What it adds

- **The Returns tab** in the left dock. What is back, oldest first: its words, why it is back
  ("Due yesterday · in Thesis", "Left for this visit") and any note, with Go (into its room), Met,
  Tomorrow and Refuse. In a room, a field for a note for the next visit to that room (Enter keeps
  it). Under it, what is still to come, each with Take back. The tab opens by itself when
  something new comes back, including what fell due while the app was shut; its strip reads
  "Returns · 2" while the dock is hidden.
- **An Editor section, Return**, for the chosen thought: its return as it is, Tomorrow and Next week
  (to revisit, at nine in the morning), a date for Due, a field for a note for next time, and Take
  back.
- **Ctrl+Alt+R** shows or hides Returns; **Ctrl+Alt+N** in a room opens it on the note field.
  Under ⋯ More: Returns.

Saved data: none (what is to come is the world's own).

`rules.js` holds the words (days, why a mark is back, the Editor line); `tests/returns.test.js`
checks them.
