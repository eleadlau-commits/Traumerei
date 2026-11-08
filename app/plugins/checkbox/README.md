# Checkbox

A kind of thought that is a line to do; its tick is the thought's gap (resolved: ticked), so a group of checkboxes shows its progress. Ctrl+Alt+X ticks the chosen one.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a kind `checkbox` and the command Ctrl+Alt+X.
- **What it needs:** the plugin API.
- **What it saves:** nothing (the tick is the gaps table's).
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
