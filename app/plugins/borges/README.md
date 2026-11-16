# Borges

The rooms page's way of seeing its rooms: rooms on the cells of the floors, floor on floor, and a
room's shape saying how many ways of seeing it holds (1 × 1 one, a Twin 2 × 1 two, 2 × 2 all).

A corpus plugin (open core step 1a): built in and on. It is a rule marked `roomsPage`, so it is
never a room's mode. Its `drop` asks the tables to put a room on a cell (`t.places.put(room,
'floor:<n>', 'borges', { col, row })`), which the floor rule allows or refuses. The floor rule
itself (one size for every floor, no overlaps, where a room goes when placed for you) belongs to
the floors feature in core: switched off, the rooms page still places and moves rooms by it.

It adds one rule (`t.slots.rules`). `rules.js` is the rule; `world.js` lists what it uses of the
plugin API. It keeps no data: a room's cell is its rule row under `borges` on its floor.
