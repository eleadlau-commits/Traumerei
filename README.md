# Träumerei

A small page, built with **Folio**, that turns a picture into a faint monochrome, cuts it with a
seeded opacity mask, and combines them. The same picture always gives the same result.

Everything for it is in this folder: a copy of Folio (`folio/`, version in `folio/VERSION`,
from the Mobile Durham repository), `build.py`, and the app in `app/`. The page itself is the
feature in `app/features/renderer/`, and its rendering engine is in
`app/features/renderer/engine/`. See that folder's README for how it works.

## Open it

**Live:** <https://eleadlau-commits.github.io/Traumerei/>

**Without anything installed:** double-click `standalone/mask-renderer.html`. It's the whole page
in one file, made by `python standalone.py` (which needs Node.js for esbuild).

## Publishing

You never rebuild the live copy by hand. After each merge to `main`, the **Publish live copy**
action (`.github/workflows/publish.yml`) runs `python standalone.py`, commits the new
`standalone/mask-renderer.html` to `main`, and GitHub Pages shows it about a minute later. Pull
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
