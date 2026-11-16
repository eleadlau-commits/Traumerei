# Sketch

A kind of mark that is a small drawing made with the pen, in any room. On the canvas it is drawn
by a surface: click into it and draw with the pen, the mouse or a finger. Each stroke, pointer
down to pointer up, is one edit and one Ctrl+Z; Backspace or Delete takes the last stroke away;
Esc or a click outside gives the room back. Everywhere else (outside the canvas, or with no
surface to draw it) it shows as a still picture of the same strokes, with its caption.

A corpus plugin (open core, step 4: surfaces): written against `app/core/API.md` alone. It proves
a kind with a surface (`slots.kinds` with `surface`, `slots.surfaces`, `surface` in `needs`), one
gesture landing as one step, and a drawing kept in the tables, so a .traum file carries it.

- **What it adds:** a kind `sketch` (under Add: a caption first, then draw) and the surface `sketch`.
- **What it needs:** the plugin API, and `surface` (it draws in a surface and takes the pointer).
- **What it saves:** its marks' fields only. `strokes`: a list of strokes, each a flat list of
  numbers `[x0, y0, x1, y1, …]` on a pad 240 wide and 160 tall, rounded to a tenth (at most 2,000
  strokes of 20,000 numbers each). `text`: a caption, one line. The stroke under way is never saved.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
