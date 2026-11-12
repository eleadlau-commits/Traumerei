# How Träumerei is built

One page of orientation for someone changing the code. Each part has one contract; read it before
changing that part. The user side (what Träumerei is for and how to use it) is in the README and
the handbook, not here.

## Core

`app/core/` holds only what every room needs: the world (rooms, thoughts, saving, undo), rooms and
floors, the room view, the workspace frame and its docks, keys, pages, the plugin API and the AI
framework. The world is rebuilt on six tables (marks, places, links, distance, gaps, moments) and
eight laws, written in [`app/core/KERNEL.md`](../app/core/KERNEL.md). Features talk only through
Folio's services, slots and events (`folio/README.md`); each keeps its own folder, README, styles
and saved data.

## Plugins

Everything that can be switched off is a plugin in `app/plugins/`, made with
`python build.py new-plugin <id>` and described in [`app/plugins/README.md`](../app/plugins/README.md).
A plugin's `feature.json` has a `plugin` block (API version, oldest app version, what it adds,
when it loads). `python build.py pack-plugin <id>` packs one into a single `.traumplug` file a
person can import. The thirty stress plugins written to test the API are listed in
[`CORPUS.md`](CORPUS.md).

## Plugin API

A plugin reaches the app only through the `traumerei` service, the plugin API, version 2:
[`app/core/API.md`](../app/core/API.md). Its namespaces are named after the six tables; it changes
only by additions. The compiler leaves out a plugin that reaches past it.

## AI

All AI work goes through tasks, providers and engines: [`app/core/AI.md`](../app/core/AI.md). The
AI never changes the world; every result is a suggestion the maker keeps or refuses. Provider id
`default` is reserved for Träumerei's own system.

## Files

A room is saved as a `.traum` file (format `traum/3`), which is the six tables written out (Law 8):
[`app/plugins/roomfile/FORMAT.md`](../app/plugins/roomfile/FORMAT.md). What a plugin keeps outside
the tables is not in the file.

## Desktop

The Windows app is a Tauri 2 shell (`desktop/`) around the same one-file page as the web copy,
made by `python standalone.py --desktop`. Files go through one seam, `t.ui.files.open` and
`t.ui.files.save`. `.github/workflows/release.yml` builds the installer on each `v*` tag;
`python build.py release <version>` keeps the three version fields in step. Versions are in
[`CHANGELOG.md`](../CHANGELOG.md).
