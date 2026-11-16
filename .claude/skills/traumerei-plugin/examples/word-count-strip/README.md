# Word count strip

The open room's word count in the strip at the foot of the canvas (*1,204 words in 37 thoughts*,
with the chosen thought's words first when one is chosen), **Words** on the room's bar beside
Search and **Ctrl+Alt+W** to show or hide it, and **Word counts** in the ☰ menu: a page of every
room's count, most first (a click on the strip opens it too). Zoomed far out (the far band) the
strip names the room with its words, a label for the map.

A corpus plugin (open core, step 3): written against `app/core/API.md` alone. It proves
`slots.bar`, `slots.strip`, `slots.pages` and `ui.zoom` (`get`, `on`, the bands).

- **What it adds:** a strip item, a bar word, a command (Ctrl+Alt+W) and a page, all `word-count-strip` / `word-counts`.
- **What it needs:** the plugin API.
- **What it saves:** nothing (shown or hidden lasts until the app restarts).
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
