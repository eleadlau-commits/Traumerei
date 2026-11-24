---
name: traumerei-plugin
description: Build a Träumerei plugin (a mode, a kind of thought, a link kind, a look on words, a tool, an export or import, a surface) from an idea to a checked .traumplug file, in the Träumerei repo or in a chat with no repo. Use whenever someone asks for a Träumerei plugin or for a change that should be one.
---

# Building a Träumerei plugin

Träumerei is a desktop app of rooms for finishing things, built on six primitives (marks, places,
links, distance, gaps, moments) and eight laws. Everything beyond the core is a **plugin**: a small
folder that reaches the app only through the plugin API (version 3, frozen; it grows only by
additions) and ships as one `.traumplug` file that a person imports in Settings → Plugins.

Follow these five steps in order. Don't skip step 1.

## 1. Gap check (before any code)

Read `reference/gap-check.md` and walk the idea through the API: each part of the idea as a
primitive, each primitive as API names from `reference/api-guide.md`, then the honest list of
**core gaps** (what no plugin can do today) with the choice made for each. Put the short walk in
your reply. If the idea needs a seventh primitive, or a core addition, say so and ask before
building it; otherwise go on.

## 2. Pick the closest recipe

Open `reference/recipes.md`, find the row nearest the idea, and read that plugin whole (in
`examples/<id>/` here, or `app/plugins/<id>/` in the repo, where the corpus lives; `highlighter` shows the split into
`rules.js` and tests that a new plugin should have). Copy its shape: `install(t)` holding
everything, a default class that calls it, plain functions beside it.

## 3. Write the plugin

Read `reference/api-guide.md` once, whole: it is the full API in one page, with the laws, the
budgets and the do/never list. Then write the folder `app/optional/extra/<id>/` (on its own; `app/optional/starter/<id>/` only if E wants it in the starter set; or `<id>/` with no repo):

- `feature.json`: name, one-sentence description, `"version": "0.1.0"`, `"main"`, `"requires":
  ["api"]`, and `"plugin": { "api": 3, "minApp": "1.1.2", "kind": [...], "needs": [...], "load":
  "start", "author": "<who asked>" }`. (The bundled examples are corpus plugins: they say
  `"api": 2` and `"starts": "off"`; a new plugin says `"api": 3` and leaves `starts` out.)
- `<Name>.js`: `import { Feature, ui } from 'folio'` (the only bare import), `export function
  install(t) { … }`, `export default class <Name> extends Feature { start() {
  install(this.use('traumerei').connect(this)); } }`.
- `rules.js` with the logic as plain functions, and `tests/rules.test.js` testing them
  (`import { test, assert } from 'folio/testing'`; `assert.ok`, `equal`, `deepEqual`, `match`, `throws`).
- `README.md`: a sentence, then **What it adds**, **What it needs**, **What it saves**, **Check it**.
- `style.css` only if it needs layout (listed in `"styles"`); the look is Folio's classes.
- If it adds a kind whose `make` needs particular fields, export `samples = { <kind>: { …fields } }`
  from the main file so the checks can make one.

Rules that fail most first attempts: proposes return `{ ok, reason }` (check and toast, never
assume); several changes go in one `t.together(() => …)`; `arrange`/`draw` read only and run in
under 50 ms on 1,500 marks; content lives in marks, fields and links (Law 8), never only in a
variable; ids are namespaced (`<id>.<command>`); `tidy` returns every field the kind owns.

## 4. Check it

**In the repo** (Claude Code, `eleadlau-commits/traumerei`):

```
python build.py new-plugin <id> --kind <kinds> --author <who>   # optional: the starting files
python build.py check <id>                                      # compiles, its tests, the suite, the budgets, then packs
```

`check` builds the app with the plugin, runs its own tests and the conformance suite (the eight
laws hold with it on; everything it adds is used without an error; off and on again loses no row;
a `.traum` round-trip is stable) and the speed budgets on a 1,500-thought room, headless, then
writes `packed/<id>.traumplug`. Fix every ✗ and run it again until it says every check passed.
Then `python build.py test` for the whole suite before a PR. Every plugin but a corpus one ships
as a file: `tools/corpus.py` lists it among those shipped apart on its own.

**With no repo** (a chat), if you can run code: `node scripts/run_tests.mjs <id>/` runs its
tests (with a stand-in for `folio`, so test plain functions), then `python scripts/traumplug.py
<id>/ --out .` makes the same import checks the app makes and writes `<id>.traumplug`. The packer
keeps each file in its own scope, as a module (the same top-level name may be declared in two
files); it takes one main file plus files imported by `./name.js` (no `* as`, no `export { … }`
lists, no destructured exports, no packages).
If you cannot run code, write the package by hand in the format in `reference/no-repo.md`. Go
through the self-check list there. Hand over the folder and the `.traumplug`, and tell the person
the full check is `python build.py check <file>.traumplug` in the repo.

## 5. Hand it over

Give the person: what it adds in a sentence; the gap-check result (core gaps and choices); the
file(s); how to try it (Settings → Plugins → Import plugin…, then the key, the mode or the Add
entry it gives). In the repo, open a small PR with the plugin folder only. Never touch
`standalone/` files. Never change core in the same PR as a plugin. Only corpus plugins are built
into the app.
