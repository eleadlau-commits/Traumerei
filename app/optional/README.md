# The extra plugins

Every plugin that is not a corpus plugin lives here, each in its own folder (Book in `book/`,
Search in `search/`, …). None is built into the app: each reaches people as a file to import in
Settings → Plugins. The corpus plugins (the room types and the stress corpus) stay in
`app/plugins/`, which also holds the guide to making a plugin (`app/plugins/README.md`).
`tools/corpus.py` keeps the lists, and the build refuses a plugin in the wrong folder.

## Where to get them

- **Latest from main, no release needed.** After every merge to main, `plugins.yml` packs each
  plugin here and puts it on the rolling prerelease `plugins-latest`, overwritten each time, so
  each file keeps one link:
  `https://github.com/eleadlau-commits/Traumerei/releases/download/plugins-latest/<id>.traumplug`,
  plus `starter-set.traumplug` (all but Book and Provoke) and `traumerei-plugins-latest.zip`.
- **With each app release.** `release.yml` puts the same files beside the installer.
- **From a pull request.** The check attaches them as `plugins-to-import`.
- **Locally.** `python build.py pack-plugin <id>` (or `--all`) writes `packed/<id>.traumplug`.

## Add one

`python build.py new-plugin <id>` makes `app/optional/<id>/`; then follow `app/plugins/README.md`.
