# Mask renderer

A small page, built with **Folio**, that turns a picture into a faint monochrome, cuts it with a
seeded opacity mask, and combines them. The same picture always gives the same result.

Everything for it is in this folder: a copy of Folio (`folio/`, version in `folio/VERSION`,
from the Mobile Durham repository), `build.py`, and the app in `app/`. The page itself is the
feature in `app/features/renderer/`, and its rendering engine is in
`app/features/renderer/engine/`. See that folder's README for how it works.

## Open it

**Without anything installed:** double-click `standalone/mask-renderer.html`. It's the whole page
in one file, made by `python standalone.py` (which needs Node.js for esbuild). Run that again
after changing anything in `app/`.

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
