# Bold and italic

Ctrl+B and Ctrl+I while writing make the chosen words (or the word at the caret) bold or italic; the look is kept in the thought as spans (material of the mark, carried in .traum files). ⋯ More → Markdown with bold and italic hands out the room with `**` and `*`.

A corpus plugin (open core, step 2): written against `app/core/API.md` alone, run through the
conformance suite (`app/core/api/tests/corpus.test.js`), off and left out of the product.

- **What it adds:** two kinds of span (`slots.spans`), two editing commands (`t.ui.text.style`), a ⋯ More entry using `marks.markdown`.
- **What it needs:** the plugin API.
- **What it saves:** nothing of its own.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`).
