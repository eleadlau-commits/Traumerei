# The gap check: walk the idea through the API before writing code

Do this first, every time, in a few lines. It decides whether the plugin can be written today,
and it stops you from inventing API that does not exist.

## 1. Say the idea as primitives

Write one line per part of the idea, in the kernel's words. Every part must be one of:

| Part of the idea | Is a… |
|---|---|
| a thing someone writes or makes | **mark** (a kind of thought: `line`, or a plugin kind with fields) |
| where it sits, under which way of seeing | **place** (a rule's `arrange`, `places.put`) |
| what belongs with what, what points to what, order | **link** (`part of`, `relation`, a declared link kind) |
| who it is for, locked or not | **distance** |
| what is still missing, to check, do or judge | **gap** |
| when: made, due, revisit, history | **moment** |
| how words look | **span** (kept) or **decorator** (never kept) |
| a tool's own drawing and pointer | **surface** |

If a part fits none of them, that is the red flag: the idea needs a seventh primitive. Rephrase it
(usually it is a link or a gap) or name it as a gap in the core (step 3).

Typical translations: a tag = a link kind or a group family; a status = a gap (open/resolved) or
a group; a deadline = a moment (`due`); a checklist = a group whose parts have gaps; a chapter =
a group, its parts `part of` links in order; a comment on words = a span with `ref` to a mark; a
setting = the rule's `settings`, or `t.store` when it is the plugin's own (never content).

## 2. Map each part to the API

For each line, name the exact names from `api-guide.md`: the slot, the reads, the proposes, the
hooks. Example, "a reading tracker: each book a card with pages read, shelves by status":

| Part | API |
|---|---|
| a book with title, author, pages, read | `slots.kinds` kind `book` with `fields`; `tidy` keeps numbers |
| shelves "to read / reading / done" | `slots.rules` `arrange` by `gaps.of(id)` (none / open / resolved) + `draw` three shelf boxes |
| dropping a card on a shelf changes its status | `drop` returning `{ gap: 'from world' }` / `{ resolve: true }` |
| progress line in the strip | `slots.strip` text cached by `moments.seq()` |

Then say the plugin's `kind` list (`item`, `mode`, `tool`) and `needs` (none here).

## 3. Name the gaps, honestly

For every part that has no name in the API, write: **"Core gap: <what>, because <why no plugin
can do it from the API>."** Check first that it really is missing: search `app/core/API.md` (repo)
or `api-guide.md` (no repo) for the words, and look at the recipe that comes closest.

Then choose, and say which:

- **Work around it inside the API** (most common): compose it from what exists, and say what is
  lost (e.g. "the shelf is drawn as a box, not a real column; good enough").
- **Leave that part out** of the first version, and say so.
- **Propose a core addition**: only when every room or every plugin of its kind would need it.
  The core grows only by adding (API 3 is frozen against renames and removals): a new name in
  `app/core/api/v2.js`, `app/core/API.md` and `app/core/api/tests/api.test.js` together, as its own
  small PR before the plugin, and never something only this plugin would use. Ask the person
  before building it.

Never reach past the API (importing core files, `use()` of another service, touching
`app.json`'s `plugins.exempt`) to close a gap: the compiler leaves such a plugin out.

## 4. Write the result down

Put the walk in your reply (or the plugin's README under "How it is made") in this shape:

```
Idea: <one line>
Primitives: <part → primitive, one per line>
API: <part → names>
Plugin block: kind [...], needs [...]
Core gaps: none | <gap, and the choice made>
Closest recipe: <plugin id>
```

Only then write code.
