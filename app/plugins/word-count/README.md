# Word count

An Editor section counting the chosen thought's words and characters; for a group, its parts'.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** an Editor section `word-count`.
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
