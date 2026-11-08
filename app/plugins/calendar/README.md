# Calendar

A mode that puts each thought on the day it is due or set to revisit, weeks as rows; thoughts with nothing ahead wait on the left.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a rule (mode) `calendar`, read from the moments ahead.
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
