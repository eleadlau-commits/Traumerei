# Changelog

Each release with the versions of the contracts it carries: the plugin API (`app/core/API.md`),
the AI tasks (`app/core/AI.md`) and the room file (`app/plugins/roomfile/FORMAT.md`). Set a new
version with `python build.py release <version>`.

| App | Plugin API | AI tasks | .traum file |
|---|---|---|---|
| 1.0.2 | 2 | 1 | traum/3 |
| 1.0.1 | 2 | 1 | traum/3 |
| 1.0.0 | 2 | — | traum/3 |

## 1.0.2 (unreleased)

- Settings → Room types: every room type listed, and new ones from one Markdown file (name, note,
  arrangement in words or code), edited in place, exported as `.traumplug`. `docs/ROOM-TYPES.md` is
  the format, written for a model to follow; Copy guide puts it on the clipboard with a worked
  calendar (`docs/room-types/month-calendar.md`).
- A simple rule may `draw` boxes behind the marks, and propose through the tables on `drop` and
  `land` (due, revisit, clear, gap, resolve): a calendar with day cells, where a thought dropped on
  a day, or written onto a tapped day, is due that day. Plugin API 2, widened by additions only.

## 1.0.1 (13 Nov 2026)

- The AI framework: tasks, providers and engines (`app/core/AI.md`), Settings → AI, and Provoke's
  reader as the first provider.
- First run opens on a chooser with four templates and a sample room.
- `python build.py release <version>` and one app identifier, `app.traumerei.desktop`.
- Plugins can be packed into one `.traumplug` file and imported in Settings → Plugins.
- The stress corpus of test plugins is no longer in the app (pack and import one to try it).
- Provoke is no longer built in: it ships beside the installer as `provoke.traumplug`, to import.

## 1.0.0 (12 Nov 2026)

- First Windows release: Tauri 2 shell, NSIS installer, `.traum` files open the app, a daily
  check for a newer Release.
- Room files of the older `room/2` format are no longer read; 1.0.0 reads `traum/3` only.
