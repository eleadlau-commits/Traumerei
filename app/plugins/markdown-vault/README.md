# Markdown vault

Obsidian in and out: a .md note or a .zip vault comes in as rooms (paragraphs and list items as thoughts, headings as groups, [[wikilinks]] as "mentions" links); every room goes out as a vault .zip (Ctrl+Alt+M, or More), the open room as one .md.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a format `markdown`, a link kind `mentions`, the command Ctrl+Alt+M, a More entry and a command for the open room.
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
