# Writing a plugin with no repo

## The package format, by hand

When neither the repo nor `scripts/traumplug.py` can run, write `<id>.traumplug` directly. It is
one JavaScript module (format `traumplug/1`) with three exports:

```js
// Träumerei plugin package (traumplug/1): Word echo 0.1.0. Import it in Settings → Plugins.
export const manifest = {"format": "traumplug/1", "id": "word-echo", "name": "Word echo",
  "description": "One sentence a person reads on the Plugins page.", "version": "0.1.0",
  "requires": ["api"],
  "plugin": {"api": 3, "minApp": "1.1.2", "kind": ["command"], "load": "start", "author": "E"}};
export const css = "";
export default (__folio__) => {
const { Feature, ui } = __folio__;          // what `import { Feature, ui } from 'folio'` gave

function echoes(text) { /* plain functions, as rules.js would hold */ return []; }

function install(t) {
  t.slots.commands.add({ id: 'word-echo.run', keys: ['Ctrl+Alt+E'], words: 'Echo the chosen thought', zone: 'room',
    when: () => !!t.ui.chosen()?.mark,
    run: () => t.ui.toast(t.marks.text(t.ui.chosen().mark)) });
}

class WordEcho extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
return WordEcho;
};
```

Rules the app checks when the file is imported (`app/core/plugins/imported.js`): `format` is
`traumplug/1`; `id` is lowercase words joined by dashes and not already taken; `name` is set;
`version` looks like `1.0.0`; `plugin.api` is 1 to 3; `plugin.minApp` looks like `1.1.2`; every
`kind` and `need` is from the one list (`api-guide.md` §1); `requires` holds only `api`; the code
calls `use()` only with `'traumerei'`; `default` is a function returning a class. Folio hands the
factory `App`, `Feature`, `ui`, `time` and `VERSION`, nothing else.

## Self-check list (before handing it over)

- [ ] Gap check written; no core gap left unsaid.
- [ ] Only `'folio'` is imported; no other feature's files, no npm packages, no `fetch` of code.
- [ ] Every propose's result is checked (`r.ok`), refusals shown with `t.ui.toast(r.reason)`.
- [ ] Several changes for one gesture are in one `t.together(() => …)`.
- [ ] `arrange` / `draw` / `decorate` / strip `text` only read, and are one pass over the marks.
- [ ] What the person makes is kept in the tables (mark fields, links, gaps, moments), not in a variable.
- [ ] A kind's `tidy` returns every field it owns (or `null` when empty); field names avoid `id kind at edited parent archived`.
- [ ] Command ids are `<id>.<name>`; keys don't clash with the app's (Ctrl+K, Ctrl+G, Ctrl+F, Ctrl+L, Ctrl+M, Ctrl+R, Ctrl+D, Ctrl+Alt+D/G/R/T/V/B).
- [ ] Look from Folio's classes (`hint`, `small`, `word`); CSS only for layout.
- [ ] Tests pass: `node scripts/run_tests.mjs <id>/`.
- [ ] No top-level name is declared in two files (the packer joins them into one scope).
- [ ] Parses: `node --check <file>` if node is at hand (rename to `.mjs` first).

The full check (laws, switching off and on, round-trip, budgets) runs in the repo:
`python build.py check path/to/<id>.traumplug`.
