# Twin

A room two cells wide on the rooms page whose two sides are rooms of their own, side by side:
each with its own mode, its own thoughts and its own data. A thought or group can be moved across.

A corpus plugin (open core step 1a): built in and on. It adds one hook to the slot `t.slots.holds`
(`holds.js`): a room whose saved size is `'twin'` may hold rooms, its two sides. Nothing in core
lets a room hold a room without such a hook (`canHold` asks `mayHold`, `app/core/world/model.js`).

Switched off, the rooms page stops offering Twin… and no new Twin can be made. The Twins already
there are kept and still open as they were: a saved room inside a room is always read, and a .traum
file carries it (Law 8). Their side-by-side canvas is still the room's own (`app/core/room/twin.js`)
until the surfaces seam (open core step 3) lets a plugin draw two canvases.

It keeps no data: a side is a room whose home is its Twin, with a `twin` rule row `{ side }`.
