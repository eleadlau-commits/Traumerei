# Highlighter

Ctrl+Shift+H while writing highlights the word at the caret (or the chosen words), kept in the thought as a span and written `==…==` in Markdown. Words in capitals are drawn as such, the strip counts the room's highlighted thoughts, and the bar word **Markdown** (Ctrl+Alt+Shift+H) hands the room out as Markdown.

A corpus plugin (open core, step 6): written from `app/core/API.md` alone by an author who had read
nothing else of the code, as the check that froze plugin API 3. Where the page tripped that author
was put right in `API.md` (CHANGELOG 1.1.0, step 6). Run through the conformance suite
(`app/core/api/tests/corpus.test.js`), off and left out of the product.

- **What it adds:** a kind of span (`slots.spans`), an editing command (`t.ui.text.style`), a decorator, a strip line, a bar word and its command.
- **What it needs:** the plugin API.
- **What it saves:** nothing of its own.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`).
