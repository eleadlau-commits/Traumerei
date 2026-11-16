# First letters

Draws every word's first letter bold in every thought. A decorator

A corpus plugin (open core, step 2): written against `app/core/API.md` alone, run through the
conformance suite (`app/core/api/tests/corpus.test.js`), off and left out of the product.

- **What it adds:**  it only says how words are drawn, never changes them, keeps nothing.:a decorator (`slots.decorators`).
- **What it needs:** the plugin API.
- **What it saves:** nothing of its own.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`).
