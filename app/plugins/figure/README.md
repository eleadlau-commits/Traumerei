# Figure

A kind of mark: a picture with a caption that flows among paragraphs (`inline: true` with its own
`height`), so a rule laying a column, such as Page flow, sets it between them like a document's
figure. The picture is kept in the mark (shrunk on the way in), the caption is its words.

A corpus plugin (open core, step 5): written against `app/core/API.md` alone, run through the
conformance suite, off and left out of the product.

- **What it adds:** a kind of mark `figure` (`slots.kinds`, with `inline` and `height`).
- **What it needs:** the plugin API.
- **What it saves:** nothing outside the tables.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`).
