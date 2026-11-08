# Due finder

A reader by rule: sets thoughts in the open room due on the dates their words name ("by 12 Nov", "tomorrow"), where nothing is ahead yet; one step.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a command.
- **What it needs:** the plugin API.
- **What it saves:** nothing (the days are the moments table's).
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
