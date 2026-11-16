# Chart

A mode that lays a room's thoughts out in rows, six to a row in reading order (each group, then
its parts, then the loose thoughts), and above them a bar chart of the room's words: one bar for
each group (the words of its parts), and one for the loose thoughts, those in no group. A room
with no groups gets a bar for each of its wordiest thoughts instead (twelve at most).

A corpus plugin (open core, step 4): written against `app/core/API.md` alone. It proves a thin
rule's box that asks for a surface (`draw` gives a box with `surface: 'chart'`), and a surface that
only reads: it draws an SVG from the tables and writes nothing to them. Clicked into, a click on a
bar marks it until the chart is drawn again; nothing is kept.

- **What it adds:** a rule (mode) `chart`, and a surface `chart`.
- **What it needs:** the plugin API, and `surface` in its block's `needs`.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins
  and choose Chart for a room.
