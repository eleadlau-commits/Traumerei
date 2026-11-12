# Changelog

Each release with the versions of the contracts it carries: the plugin API (`app/core/API.md`),
the AI tasks (`app/core/AI.md`) and the room file (`app/plugins/roomfile/FORMAT.md`). Set a new
version with `python build.py release <version>`.

| App | Plugin API | AI tasks | .traum file |
|---|---|---|---|
| 1.0.1 | 2 | 1 | traum/3 |
| 1.0.0 | 2 | — | traum/3 |

## 1.0.1 (unreleased)

- The AI framework: tasks, providers and engines (`app/core/AI.md`), Settings → AI, and Provoke's
  reader as the first provider.
- First run opens on a chooser with four templates and a sample room.
- `python build.py release <version>` and one app identifier, `app.traumerei.desktop`.

## 1.0.0 (12 Nov 2026)

- First Windows release: Tauri 2 shell, NSIS installer, `.traum` files open the app, a daily
  check for a newer Release.
- Room files of the older `room/2` format are no longer read; 1.0.0 reads `traum/3` only.
