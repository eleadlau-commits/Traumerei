# Calendar

A mode that puts each thought on the day it is due or set to revisit, weeks as rows; thoughts with nothing ahead wait on the left.
It draws the days as boxes; a thought let go on a day is due that day (let go left of the days, nothing ahead);
tap a day and type, and the new thought is due that day. It is the worked example of a rule's three hooks
(`draw`, `drop`, `land`: `app/core/API.md`, A rule of your own).

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a rule (mode) `calendar`, read from the moments ahead; it proposes `due` and `clear` through the moments table.
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
