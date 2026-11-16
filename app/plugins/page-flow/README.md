# Page flow

A mode that lays a room out as fixed pages side by side, in reading order: each group's parts in
its order, its title as a heading, then the loose thoughts, oldest first. A paragraph that does
not fit at the foot of a page runs on to the next one; the bottoms stay ragged.

A corpus plugin (open core, step 1): written against `app/core/API.md` alone. It proves a layout
row's `width` and `align`, a mark laid out in fragments (`lines: [from, to]`), and `t.ui.measure`.

- **What it adds:** a rule (mode) `page-flow`.
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
