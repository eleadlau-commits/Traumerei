# Audio note

A kind of thought that is a recording, picked as a file or dropped on the room.

A corpus plugin (kernel phase 8): written against `app/core/API.md` alone, and run through the
conformance suite (`app/core/api/tests/corpus.test.js`): the eight laws hold with it on,
switching it off and on loses no row, a .traum round-trip is stable, and it reaches nothing past
the API.

- **What it adds:** a kind `audio-note`, offered under Add.
- **What it needs:** the plugin API.
- **What it saves:** nothing else: the sound is kept in the mark, as a data URL.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
