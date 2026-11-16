# Spell marks

A wavy line under a misspelt word (a small list of common slips); Ctrl+. while writing puts the right spelling in at the caret, Ctrl+Alt+. puts every one right in the chosen thought, as one step.

A corpus plugin (open core, step 2): written against `app/core/API.md` alone, run through the
conformance suite (`app/core/api/tests/corpus.test.js`), off and left out of the product.

- **What it adds:** a decorator, and two commands using `t.ui.text.caret` and `t.ui.text.replace`.
- **What it needs:** the plugin API.
- **What it saves:** nothing of its own.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`).
