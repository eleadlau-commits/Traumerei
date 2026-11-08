# __NAME__

__DESCRIPTION__

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`).

## What it adds

- An Editor section for the chosen thought, saying how many words it holds.
  (Change this list as the plugin grows: every button, key, mode, section and More entry, and where it appears.)

## What it needs

- **Requires:** __REQUIRES_TEXT__ (it's left out if these are missing)
- **Plugin API:** __API__ · **oldest app:** __MIN_APP__

## What it saves

- Nothing.

## How to check it works

1. Run `python build.py test`.
2. Run `python build.py serve`, open a room, right-click a thought: the Editor shows its words.
3. Settings → Plugins: switch __NAME__ off (the section goes) and on again (it comes back).
