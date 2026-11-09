# Träumerei

Rooms for thinking, built with **Folio**: write your thoughts, arrange them in different ways,
and finish what you start.

Every pull request runs **Check pull request** (`.github/workflows/check.yml`): all the tests
(`python build.py test`), then a build of the one-file page, then the speed budgets on it
(`node tests/speed.mjs`: a 1,500-thought room opens in 0.8 s, starting a thought and Enter each
show in 0.35 s, a key typed into a thought takes under 20 ms, the page stays under 2 MB). To try a PR before merging, open its
check run on GitHub and download **traumerei-preview** from the summary; unzip it and double-click
`traumerei.html`.

Everything for it is in this folder: a copy of Folio (`folio/`, version in `folio/VERSION`,
from the Mobile Durham repository), `build.py`, and the app in `app/`: what every room needs in
`app/core/`, and everything that can be switched off in `app/plugins/`. The picture behind the
page is the plugin in `app/plugins/renderer/`, and its rendering engine is in
`app/plugins/renderer/engine/`. See that folder's README for how it works.

## Open it

**Live:** <https://eleadlau-commits.github.io/Traumerei/>

**Without anything installed:** double-click `standalone/traumerei.html`. It's the whole page
in one file, made by `python standalone.py` (which needs Node.js for esbuild).

## Publishing

You never rebuild the live copy by hand. After each merge to `main`, the **Publish live copy**
action (`.github/workflows/publish.yml`) runs `python standalone.py`, commits the new
`standalone/traumerei.html` to `main`, and GitHub Pages shows it about a minute later. Pull
requests should not change that file; if you run `standalone.py` locally, don't commit the
result.

**While working on it:** from this folder,

```
python build.py serve
```

Then open <http://localhost:8000>. (Needs Python 3.9 or newer.)

## Check it

```
python build.py test
```

Runs the engine's tests, Folio's own tests, and the whole-app checks (needs Chrome or Edge).

## Desktop app (Windows)

`desktop/` wraps the same one-file page in a Tauri 2 window. `python standalone.py --desktop`
writes the page to `desktop/dist/index.html`; `cd desktop && npm ci && npx tauri build` makes the
installer (needs Rust and, on Windows, WebView2). The **Desktop app** Action builds it on every PR
that touches `desktop/` (download "traumerei-windows" from the run) and puts it on a draft Release
for every `v*` tag.
