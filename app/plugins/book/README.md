# Book

A book in any room: chapters of the room's thoughts, in your order, opened in the right dock; a contents page, drag to reorder, drop thoughts in, export as Markdown or PDF.

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`).

## What it adds

- An Editor section for the chosen thought, saying how many words it holds.
  (Change this list as the plugin grows: every button, key, mode, section and More entry, and where it appears.)

## What it needs

- **Requires:** api (it's left out if these are missing)
- **Plugin API:** 2 · **oldest app:** 1.0.2

## What it saves

- Nothing.

## How to check it works

1. Run `python build.py test`.
2. Run `python build.py serve`, open a room, right-click a thought: the Editor shows its words.
3. Settings → Plugins: switch Book off (the section goes) and on again (it comes back).
