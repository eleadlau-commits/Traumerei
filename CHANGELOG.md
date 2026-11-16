# Changelog

Each release with the versions of the contracts it carries: the plugin API (`app/core/API.md`),
the AI tasks (`app/core/AI.md`) and the room file (`app/plugins/roomfile/FORMAT.md`). Set a new
version with `python build.py release <version>`.

| App | Plugin API | AI tasks | .traum file |
|---|---|---|---|
| 1.0.5 | 2 | 1 | traum/3 |
| 1.0.3 | 2 | 1 | traum/3 |
| 1.0.2 | 2 | 1 | traum/3 |
| 1.0.1 | 2 | 1 | traum/3 |
| 1.0.0 | 2 | — | traum/3 |

## 1.0.5 (unreleased)

One release for everything since 1.0.3 (1.0.4 was never tagged): the open core, step by step.

### The house in order (step 0)

- Only corpus plugins are built in (the room types). Everything else ships as a plugin file beside
  each Release: the home page, Search, the desk, gaps and returns, Time, Export, room files, Book,
  pictures, the picture behind, templates, the account and the source editor.
  `starter-set.traumplug` brings them all back in one import (Settings → Plugins → Import
  plugin…). The app alone opens on the rooms page.
- Plugin API 2 widened by additions: `t.peers` (what plugins offer each other), and `slots.menu`,
  `slots.views` and `slots.account`.
- A book's card shows its title and counts, not every thought's words.
- The first letter of a new thought puts in only that thought, not the whole room (about 80 ms
  in a room of 1,500, was 240 ms).
- `python build.py new-plugin` makes a plugin that ships as a file; `--corpus` for a corpus plugin.

### Step 1: a rule may say how big a unit is and draw it in pieces

- A thin rule's `arrange` row may give `width` and `height` (the room wraps the thought to them)
  and `align: 'start'`; a mark may have several rows, each a fragment with `lines: [from, to]`
  (a paragraph that runs on to the next page). `t.rules.layout` reads them back.
- `t.ui.measure(text, width)`: how words wrap at a width as the room draws them.
- A rule may claim families (`claims: [family ids]`): it lays their groups out, and their cards
  don't show in it.
- `links.link(part, group, 'part of', null, { at })` joins at a position in the order (the kit's
  `join(w, group, id, at)` too).
- Corpus plugin **Page flow**: a room as fixed pages, a paragraph running on in fragments.

### Step 2: the look of words inside a thought, and the caret

- Spans: a thought keeps `spans: [{ from, to, kind }]` as material of the mark (Law 1), carried
  in .traum files and following its words as they change. Kinds of span come from plugins
  (`slots.spans`); decorators (`slots.decorators`) only draw. Both use the room's span classes.
- `t.ui.text`: the caret in the thought being written, select, replace (one step on a kept
  mark), style, spans, on. Commands with `zone: 'editing'` run while a thought is written.
- `marks.markdown(id)`: a thought's words with their spans as Markdown.
- Corpus plugins **First letters**, **Spell marks**, **Bold and italic**.

## 1.0.3 (15 Nov 2026)

- Room settings: a Settings item in the room's rail opens the room's own settings in the right dock
  (name, colour, categories, what is inside it, and the mode's settings for this room).
- Floors have names: "Floor 2 – Thesis" in the rail, crumbs and status bar. Name one in its settings.
- Categories (the tag groups on the rooms page): opening one draws a dotted outline around its rooms.
- Entering a room no longer opens the loose tray; the rail stays as you left it. Leaving the rooms
  page for the menu can be cancelled.
- Plugins can do more (plugin API 2, widened by additions only): their own families of groups
  (cards that open by themselves), buttons under Tools in the rail, their own link kinds, dock pages
  that take marks dropped on them, and every mode and part of the room. Room types gain box styles
  (title, heading, line, shelf, quiet; levels, right side, a box that opens a mark) and can propose
  where a thought is placed.
- The Book plugin: a book in any room, chapters of thoughts, a contents page, a reading view, export
  to Markdown and print (Ctrl+Alt+J).

## 1.0.2 (14 Nov 2026)

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
