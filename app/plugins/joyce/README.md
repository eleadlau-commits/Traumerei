# Joyce

A way of seeing a room: thoughts joined by time into trains, each read like a paragraph, with a
line from thought to thought (taut between quick thoughts, slack after a pause; Line tension is
its setting). Enter goes on with the same train, Ctrl+Enter starts a new one; a thought in no train
waits in the tray and, dragged out, starts a train there. Another rule's group shows as one thought.

A corpus plugin (open core step 1a): built in and on, but nothing in core is special about it.
New rooms open in Joyce because it is the default in Settings → Rooms, a setting like any other.
Switched off, its rooms are seen through Pessoa (or the core's Rows), and its trains wait, kept.

It adds one rule (`t.slots.rules`). `rules.js` is the rule; `world.js` lists what it uses of the
plugin API's parts (model, groups, trains, lines). It keeps no data: a train is a group with
`of: 'joyce'`, its place a rule row.
