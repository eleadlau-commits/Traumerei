# The optional plugins

Every plugin that is not a corpus plugin lives here, each in its own folder. None is built into
the app: each reaches people as a file to import in Settings → Plugins. The folder it sits in says
whether it is in the starter set (E, 16 Nov 2026):

- **`starter/<id>/`**: in `starter-set.traumplug`, the one file that gives a fresh install what
  the app had built in before 1.0.4 (Home, Search, the desk, gaps and returns, Time, Export, room
  files and the rest). Each one is also downloadable on its own.
- **`extra/<id>/`**: only on its own, never in the starter set (Book in `extra/book/`, Provoke in
  `extra/provoke/`).

Packaging reads the folders, not a list: move a plugin between `starter/` and `extra/` to put it
in or take it out of the starter set. Nothing else changes for it: its id, its own file and its
download link stay the same. The corpus plugins (the room types and the stress corpus) stay in
`app/plugins/`, which also holds the guide to making a plugin (`app/plugins/README.md`).
`tools/corpus.py` keeps the lists, and the build refuses a plugin in the wrong folder (one put
straight in `app/optional/<id>/` too).

## Where to get them

- **Latest from main, no release needed.** After every merge to main, `plugins.yml` packs each
  plugin here and puts it on the rolling prerelease `plugins-latest`, overwritten each time, so
  each file keeps one link:
  `https://github.com/eleadlau-commits/Traumerei/releases/download/plugins-latest/<id>.traumplug`,
  plus `starter-set.traumplug` (everything in `starter/`) and `traumerei-plugins-latest.zip`.
- **With each app release.** `release.yml` puts the same files beside the installer.
- **From a pull request.** The check attaches them as `plugins-to-import`.
- **Locally.** `python build.py pack-plugin <id>` (or `--all`) writes `packed/<id>.traumplug`.

## Add one

`python build.py new-plugin <id>` makes `app/optional/extra/<id>/` (`--starter`:
`app/optional/starter/<id>/`); then follow `app/plugins/README.md`.
