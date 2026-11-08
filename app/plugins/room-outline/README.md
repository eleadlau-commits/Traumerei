# Room outline

A tab in the left dock (Ctrl+Alt+U) listing the open room as an outline: groups with their parts, relations' children under their parents.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** the command Ctrl+Alt+U and a left-dock tab `room-outline`.
- **What it needs:** the plugin API (the left dock when there is one).
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
