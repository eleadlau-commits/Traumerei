# Room types

Settings → Room types: every way a room can be seen (built in, from a plugin, or made here), and
new ones made from one Markdown file. A made type is a rule in the API's sense (app/core/API.md,
A rule of your own): it arranges the room's marks and may draw boxes, take drops and land new
thoughts, but keeps no state. A room left in a type that is removed opens in Pessoa and keeps its
places; adding the type again brings it back.

- **The file:** `# Name`, one line of note, `key: value` lines (arrange, cell, columns, order, links,
  hand, icon), and an optional ```js block assigning `arrange`, `admit`, `draw`, `drop`, `land`.
  The whole format, written for a model to follow, is `docs/ROOM-TYPES.md`; the worked calendar is
  `docs/room-types/month-calendar.md`. **Copy guide** puts both on the clipboard.
- **The page:** Add from file… (.md), New, Copy guide; each made type has Edit (its name and code
  in one box; Save checks it on an empty room first and refuses a broken one), Export (`<id>.traumplug`,
  which Import plugin… takes on another computer) and Remove.
- **Files:** `file.js` reads the Markdown; `rule.js` makes the rule (self-contained: Export copies
  its source); `types.js` keeps the made types in `t.store` and registers them; `pack.js` writes the
  .traumplug; `guide.js` is the guide and the calendar, copied from `docs/` by
  `python tools/room_types_guide.py`.
- **What it saves:** each made type's Markdown, on this computer only (`t.store`, key `types`),
  never in a .traum file.
- **Trust:** a type's code runs like an imported plugin's: only add files you would import as a
  plugin.
- **Check it:** `python build.py test` (tests/room-types.test.js, and tools/tests/test_room_types.py
  for the guide).
