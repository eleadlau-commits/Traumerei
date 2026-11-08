# Folio

**Apps made of feature folders.** Each feature of an app lives in its own folder. A compiler reads the folders and assembles the app, a bit like LaTeX assembles a document. Delete a folder and the app still works, just without that feature.

Folio is for small personal and group apps: schedules, trackers, lists, notes, forms. The same files run as a web app, an Android app and (later) an iPhone app.

## Contents

1. [The big picture](#1-the-big-picture)
2. [A feature folder](#2-a-feature-folder)
3. [feature.json reference](#3-featurejson-reference)
4. [Writing a feature](#4-writing-a-feature)
5. [The framework's slots and events](#5-the-frameworks-slots-and-events)
6. [Helpers: ui and time](#6-helpers-ui-and-time)
7. [Saving data](#7-saving-data)
8. [The compiler](#8-the-compiler)
9. [Tests](#9-tests)
10. [The rules](#10-the-rules)
11. [Starting a new app](#11-starting-a-new-app)

---

## 1. The big picture

```
build.py                 run this: python build.py
folio/                   the framework (knows nothing about any particular app)
  runtime/               the code that runs inside every app
  compiler/folioc.py     the compiler
  templates/feature/     what `new-feature` copies
  tests/                 the framework's own tests
app/
  app.json               the app's name, version, colours and phone app id
  theme.css              the app's own colours and fonts (optional)
  fonts/                 font files theme.css uses (optional)
  icons/                 the app's icons
  features/              one folder per feature (or the folders app.json lists in "folders",
                         such as core/ and plugins/: see §3)
  tests/seed.js          sample data used by the automatic tests
dist/                    the compiled app (made by the compiler, never edited)
```

Features connect to each other in three ways, so they never need to touch each other's code:

| Way | What it is | Example |
|---|---|---|
| **Slots** | Named places where features add things. The feature that owns the place decides what an item looks like. | Notes adds a section to `session.details` |
| **Services** | An object one feature offers to others. Others get it with `this.use(name)`, which returns `null` if that feature isn't there. | Maps uses the `places` service from Durham rooms |
| **Events** | Named messages. Any feature can send one, and any can listen. | Timetable sends `timetable:cleared`, and Notes listens and forgets its notes |

**What keeps it safe to delete a folder:**
- **At compile time:** a feature whose `requires` are missing is left out, with the reason in the log.
- **When the app starts:** if a feature's code fails, it's switched off and everything it added is removed. The rest of the app carries on.
- **While it runs:** if a slot item or event listener throws, it's reported and skipped.
- **In your code:** `this.use()` returns `null` for missing services, and features handle that.
- **In the tests:** `python build.py test` checks all of the above automatically, by removing each feature in turn.

## 2. A feature folder

```
app/features/notes/
  feature.json      the instructions: name, what it needs, its files
  Notes.js          the feature: a class that extends Feature
  notes.css         its styles (optional)
  templates.html    larger pieces of fixed HTML, as <template id="…"> (optional)
  README.md         what it does, in plain English
  tests/            *.test.js files (not shipped in the app)
  extras/           anything else that isn't part of the app, e.g. a server script (not shipped)
  native/           files for the phone app's build, e.g. google-services.json (not shipped; see native.android.files)
```

Make a new one with `python build.py new-feature study-timer --requires sessions`.

## 3. feature.json reference

```json
{
  "name": "Notes",
  "description": "Your own notes on any session.",
  "version": "1.0.0",
  "main": "Notes.js",
  "styles": ["notes.css"],
  "templates": "templates.html",
  "requires": ["sessions"],
  "uses": ["durham-rooms"],
  "platforms": ["web", "android", "ios"],
  "enabled": true,
  "web": { "manifest": { } },
  "native": {
    "packages": { "@capacitor/local-notifications": "^7.0.0" },
    "capacitor": { "plugins": { } },
    "android": {
      "permissions": ["CAMERA"], "features": [{ "name": "android.hardware.camera", "required": false }],
      "files": { "app/google-services.json": "native/google-services.json" },
      "gradle": { "rgcfaIncludeGoogle": true }
    },
    "ios": {
      "plist": { "NSCameraUsageDescription": "Why the camera is needed." },
      "files": { "GoogleService-Info.plist": "native/GoogleService-Info.plist" },
      "pods": ["pod 'CapacitorFirebaseAuthentication/Google', :path => '../../node_modules/@capacitor-firebase/authentication'"]
    }
  }
}
```

| Setting | Needed? | Meaning |
|---|---|---|
| `name`, `description` | yes | Shown in Settings → Features and in the build report. |
| `main` | yes | The file whose default export is the feature class. |
| `version` | no | The feature's own version, for the report. Default `1.0.0`. |
| `styles` | no | CSS files, added to the app's stylesheet in start order. |
| `templates` | no | An HTML file of `<template id="name">` blocks. Get a copy with `this.template('name')`. |
| `requires` | no | Features this one can't work without. It starts after them, and is left out without them. |
| `uses` | no | Features this one works better with. It starts after them if they're there, and works without them. |
| `platforms` | no | Where it runs: `web`, `android`, `ios`. Default: everywhere. |
| `enabled` | no | `false` switches the feature off without deleting it. |
| `web.manifest` | no | Merged into the web app manifest, e.g. a `share_target`. |
| `native` | no | What the phone apps need: npm `packages`, Capacitor config to merge, Android permissions and features, iPhone Info.plist entries. For Android also `files` (copied into the Android project: where it goes in the project → the file in the feature's `native/` folder) and `gradle` (settings added to the project's `variables.gradle`, e.g. a plugin's switch). For iPhone also `files` (added to the app: its name in the app → the file in `native/`, e.g. Firebase's `GoogleService-Info.plist`) and `pods` (lines added to the Podfile's app target, e.g. a plugin's optional part). iPhone `plist` entries are merged: lists are added to, dictionaries combined. |

The folder name is the feature's id: lowercase words joined by dashes.

**Feature folders and plugins.** An app keeps its features in `app/features/`, or in several
folders that `app.json` lists in `"folders"`, read in that order (ids must differ across them):

```json
{ "folders": ["core", "plugins"], "plugins": { "folder": "plugins", "api": 1 } }
```

`"plugins"` says which of those folders holds **plugins**, and the plugin API version the app
offers (`api`, a whole number; the app's own service for plugins says what each version holds).
Every feature in the plugins folder has a `plugin` block in its feature.json, and no feature
elsewhere has one:

```json
"plugin": { "api": 1, "minApp": "1.0.0", "kind": ["mode"], "load": "start", "author": "E" }
```

| Setting | Needed? | Meaning |
|---|---|---|
| `api` | yes | The plugin API version it was written for. A plugin written for a newer API than the app offers is left out, with the reason. |
| `minApp` | yes | The oldest app version (app.json's `version`) it works with. A newer one than the app is left out, with the reason. |
| `kind` | no | What it adds, as words the app understands, like `["mode"]` or `["dock", "tool"]`. Default `[]`. |
| `load` | no | `start` (the default: started with the app) or `when-used` (started the first time it is needed). |
| `author` | no | Who made it. |

The block reaches the app in its registry entry (`plugin`, with `kind` and `load` filled in), and
the app's config has `pluginApi`.

**One way in.** When `"plugins"` also names a `service` (`{ "folder": "plugins", "api": 1, "service":
"my-app" }`), a plugin reaches the rest of the app only through that service: one that uses
another service a feature outside the plugins folder provides, or adds to a slot one of them
defines, is left out with the reason. Folio's own slots (`settings`, …) and other plugins'
services and slots are always fine. `"exempt": ["old-plugin"]` lets named plugins through while
they are being moved onto the service.

## 4. Writing a feature

```js
import { Feature, ui, time } from 'folio';

const { el } = ui;

export default class Notes extends Feature {
  start() {
    this.sessions = this.use('sessions');          // another feature's service
    this.notes = this.storage.get('notes', {});      // this feature's saved data

    this.add('session.details', {                    // add to a slot
      order: 30,
      render: (session) => el('p', {}, this.notes[session.key] || 'No note'),
    });
    this.on('timetable:cleared', () => this.storage.clear());   // listen to an event
  }
}
```

**Everything a feature can do through `this`:**

| Member | What it does |
|---|---|
| `start()` | Override it. Runs once, after everything in `requires` has started. May be `async`. |
| `add(slot, item)` | Adds an item to a slot. Returns a function that removes it. |
| `defineSlot(name, description)` | Creates a slot for other features. Describe what an item looks like. |
| `slot(name)` | A slot, to read its items: `.items`, `.map(fn)`, `.first(fn)`, `.some(fn)`, `.each(fn)`, `.run(item, fn)`. All of these contain errors. `.watch(fn)` calls `fn(slot)` after its items change and returns a function that stops it. |
| `provide(name, object)` | Offers a service. Often the feature itself: `this.provide('sessions', this)`. |
| `use(name)` | Another feature's service, or `null`. Always handle `null`. |
| `on(event, fn)`, `emit(event, data)` | Listen to and send events. |
| `storage` | This feature's saved data (see [7](#7-saving-data)). |
| `refresh()` | Redraws the top bar and the current view. |
| `template(name)` | A copy of a template from templates.html. |
| `toast(message)` | A short message at the bottom of the screen. |
| `native` | `true` in the Android or iPhone app. |
| `plugin(name)` | A Capacitor plugin (e.g. `'LocalNotifications'`), or `null` on the web. |
| `getText(url)` | Downloads text from another website. In the phone apps the phone makes the download itself (CapacitorHttp, called directly), so sites that block web pages still work; on the web it's a fetch. Throws an error with `.status` for an HTTP error. |
| `app.shell` | The app's frame: `setTitle(text)` (the browser tab's name), `showScreen(owner, node)`, `hideScreen(owner)`, `selectView(id)` (also opens a view inside another, such as Day inside Planner), `openMenu()`, `closeMenu()`, `openSettings()`, `closeSettings()`, `refreshSettings()`, `openAbout()`, `openAccount()`. |

**Defining your own slots.** If your feature shows something other features might want to add to, define a slot and describe the item shape in one sentence. Then draw its items, for example `this.slot('session.card').map((line) => line.render(session))`. Items from features that aren't installed simply aren't there.

## 5. The framework's slots and events

**The frame:** one top bar on a dark background, with the menu button on the left and the account button on the right. Features can put icon buttons just left of the account button (`header.actions`). Under it, the open view's title, on the page (or on the dark area too, for a view marked `darkHead`), with room on its right for small buttons (`mount`'s `actions`). Along the bottom, a tab bar with one tab per view; the open tab is filled in the accent colour, and a line above the bar glows over it. The app always opens on the view marked `start`.

**The tab bar:** tap a tab, or swipe left or right on the bar itself to go to the next or previous tab (it stops at the ends). While the finger is down the bar shifts with it a little, and the highlight and glow move part of the way; they settle on the new tab when it lets go. Swiping sideways anywhere on the page does the same, except where something there has its own sideways swipe: an element marked `data-own-swipe` (such as Home's pages) or anything that scrolls sideways. The arrow keys go to the view's `step()`.

**The menu:** the menu button slides a panel in from the left, over most of the screen, with the rest dimmed. It closes when you tap the dimmed part, swipe the panel to the left, press Escape, or press back (Android, or the browser's back button). It respects "reduce motion". At the top: who is signed in (*Not signed in* until a feature fills the `account` slot) with the `header.status` line under it. Then the rows: the framework's own **Account** (order 10), **Settings** (60) and **About** (80), mixed by `order` with the features' `header.buttons`.

**The account button** and the menu's Account row open the account page from the `account` slot. With nothing in it, they say *Account is coming soon*.

**Slots:**

| Slot | Item | Where it appears |
|---|---|---|
| `views` | `{ id, label, icon?, order, mount(container, { head, actions }), render(), step?(direction), visible?(), start?, darkHead?, hideTitle?, subtitle?(), contains?(id), open?(id), subviews?() }` | Tabs along the bottom. `mount` runs once and `render` on every redraw. `head` is a place under the title, for things like a switch. `actions` is a place on the right of the title, after the status line, for one or two small round buttons (e.g. `icon-btn ghost`). `darkHead: true` extends the dark area of the top bar down over the title and `head` (Home uses this for its clock); otherwise only the top bar is dark. `step(±1)` is called on the arrow keys (swipes change tabs). `start: true` makes it the view the app opens on. `hideTitle` hides the title; `subtitle()` replaces the status line next to it. A view that holds other views (like Planner) answers `contains(id)`, switches with `open(id)` and lists them in `subviews()`. |
| `header.buttons` | `{ id, label, icon, order, onClick(), visible?(), busy?() }` | Rows in the menu (the button at the top left). `icon` is a name from `ui.ICONS` or SVG drawing. `busy()` makes its icon spin. They're mixed by `order` with the framework's Account (10), Settings (60) and About (80). |
| `account` | `{ name(), open() }` | Who is signed in, at the top of the menu (`name()` → their name, or null for *Not signed in*), and their account page (`open()`), opened by the account button and the menu's Account row. Only the first item is used. Empty until an app has accounts. |
| `header.actions` | `{ id, label, icon, order, onClick(), visible?() }` | Icon buttons in the top bar, on every tab, just left of the account button, each in a soft box. `label` is read out by screen readers and shown when you hover. Keep it to one or two: the top bar is small. |
| `header.status` | `{ order, text() }` | A short line at the top of the menu, under who is signed in, and next to each view's title unless the view gives a `subtitle()`. "offline" is added automatically. |
| `settings` | `{ id, title?, order, render() }` | A section in the Settings window. Return `null` or `false` to show nothing. |

Settings opens with the framework's **Appearance** choice (Automatic, Light or Dark; write dark styles inside `@media (prefers-color-scheme: dark)` and they follow it). The framework's own Settings sections, **Features** (switch features on and off for this phone, folded away until you open it) and **About** (version and problems), always come last. About is also its own window, from the menu.

**Events:**

| Event | When |
|---|---|
| `app:ready` | Every feature has started. |
| `app:resume` | The app came back to the screen. |
| `app:tick` | Once a minute while the app is on screen. |
| `app:online` / `app:offline` | The connection came back or dropped. |

**Order:** `order` numbers sort items from low to high, and the default is 50. Leave gaps (10, 20, 30) so new features can slot in between.

## 6. Helpers: ui and time

`ui`: `el(tag, attrs, ...children)`, `icon(name)`, `ICONS`, `toast(text)`, `dialog({ title, className, size, onClose })` → `{ open, close, setContent, setTitle, isOpen, element, content }` (a pop-up that fills the screen, with its title bar staying at the top; pulling it down from the top closes it; `size: 'box'` makes it a small box in the middle instead, for something quick), `errorBox()` → element with `.show(text)`, `hint(text, { small })`, `missing(reason, attrs)` → a "Missing content" box saying what's missing, `select(options, { value, id, onChange })`, `toggle({ checked, label, onChange })`, `filePicker(accept)` → `{ pick() }`, `onSwipe(element, fn)` (fn(±1, startElement)), `ownsSwipe(node, stop)`, `loadScript(url)`.

Icons in `ui.ICONS`: close, refresh, gear, bell, card, pin, clock, note, trash, left, right, plus, check, menu, account, people, calendar, home, book, dots, link, palette, help, info, chat, qr.

`time`: `MINUTE`, `HOUR`, `DAY`, `startOfDay`, `addDays`, `startOfWeek`, `sameDay`, `formatTime`, `formatDate`, `formatLongDate`, `formatDateTime`, `dayLabel`, `ago`, `inTime`, `toLocalInput`.

Shared CSS classes from `runtime/base.css`, which holds the app's one look (words on paper: square corners, hairlines, the palette's ink on its pale veil, one typeface). Features use these and keep only their layout: `word` (a plain spaced word that works as a button; a hairline under it on hover, and under the chosen one: `aria-current`, `aria-selected="true"`, `aria-checked="true"`, `aria-pressed="true"` or `.on`), `panel` (a pop-up or panel: the blurred veil with a hairline edge; a `toast` is one too), `veil` (the full-screen veil), `shade` (a faint shade over the screen, under a pop-up), `close-x` (a thin cross; `--x-size` sets its square), `sheet` and `top-sheet` (a panel in the middle, or near the top; `sheet-words` and `sheet-keys` for its row of words), `pop` (a small card of properties: `pop-name`, `pop-desc`, `pop-row`, `pop-note`, `pop-delete`), `pick` (a row in a list to pick from; `pick-note`, `pick-rule`), `keys-list` (a list of keys), `code-box` (a box of code or source), `sub-head` (a section name under a short hairline), `label`, `hint` (`small`), `btn` (a word too: `primary`, `danger`, `block`, `small`), `icon-btn`, `link-btn`, `seg` (a row of words, one chosen), `field`, `row`, `stack`, `group`, `error`, `empty`, `missing`, `list`, `advanced` (for `<details>`, shown with + and −), `check`, `switch`. Create's frame, shared by the rooms page and a room: `wordmark`, `find-btn` (the search bar; `find-key`), `back-btn`, `rail` (a column of veil down the left: `rail-head`, `rail-item` with a `rail-icon` or `rail-num` beside its `rail-word`, `rail-rule`, `rail-wide` for a part that hides when it is narrow; `<html>` has `rail-narrow` while it is 48px), `chrome-bar` (the top bar's band), `crumbs` (`crumb`, `crumb-sep`, `crumb-note`), `status-bar` (`status-info`, `status-right`, `status-saved`), `expand` (going into a room), `page-canvas`, `page-panel`, `page-row` and `page-label` (a page in the frame such as Settings: a veil panel of label and value rows on plain paper; inside `page-panel` the controls are sentence case at the working size: `word` and `btn` as boxes, `seg` as joined boxes with the chosen one washed amber, folds and choices in working words), with `--bar`, `--strip`, `--status-h` and `--rail`. Buttons with no class, text boxes, choices, sliders and folds are styled as they are, with no weight (`:where()`), so a feature's own class always wins. Colours come from the palette the Renderer paints on the page: `--paper`, `--ink`, `--pale`, `--veil`, `--glow`, each also as `--name-rgb` ("r g b", for an alpha). Folio's names follow from them: `--bg`, `--text`, `--text-2`, `--muted`, `--faint`, `--line`, `--surface` (a panel), `--surface-2` (a faint wash), `--accent`, `--accent-ink`, `--accent-soft`, `--danger`, `--shadow` (a panel's hairline edge), `--blur`. Also `--font` (the Typeface setting), `--font-mono`, `--word-size`, `--word-spacing`, `--ease`, `--gutter`; the corner shapes `--radius`, `--shape`, `--shape-btn`, `--shape-sm` are all 0. The look is the same in light and dark mode, and the page is desktop-only: no phone frame, no tab bar. An app adds its own colour names in `app/theme.css`.

The working look (the pro workspace) adds names and pieces: the type scale `--t-hint`, `--t-label`, `--t-work`, `--t-title`, `--t-read` and the reading face `--font-read`; spacing steps `--s-1` … `--s-8`, `--row`, `--field`; the one accent `--amber` / `--amber-soft`; the chrome surface `--chrome` / `--chrome-edge`; motion `--quick` / `--slow`; and the states `--hover-wash`, `--sel-line`, `--sel-fill`, `--focus-ring` (every `:focus-visible`), `--drop-line`, `--lift`, `--off`, with classes `st-sel`, `st-drop`, `st-drag`, `st-off`. Panel chrome: `tab-strip`, `tab` (`aria-selected="true"` is in front), `tab-tail`, `key` (a key named beside what it does), `sec` (a folding section, a `<details>`; `sec-body`), `kv` (a label/value row), `box-btns` / `box-btn` (`danger`), `title-field`. A relation's look, for any line joining things: `rel-line-dashed`, `rel-line-dotted`, `rel-colour-ink|amber|rust|moss|slate|plum` (tokens `--rel-*`), and `rel-swatch` (a colour to pick; `aria-checked="true"` when chosen).

## 7. Saving data

`this.storage` is the feature's private area in the device's storage. Values can be anything JSON can hold.

```js
this.storage.get('notes', {});         // value, or the fallback if nothing is saved
this.storage.set('notes', notes);      // false if the device refused (storage full)
this.storage.remove('notes');
this.storage.clear();                  // everything this feature saved
this.storage.once('import-v1', fn);    // runs fn only the first time, on each device
```

- **Never rename a key** that a released version has used, or people lose that data. Add a new key instead, and use `once()` to move old data across.
- **Data saved outside Folio** (by an older version of the app) can be read with `this.app.storage.raw(key)` or `rawJSON(key)`.
- **Only this phone can see the data.** Nothing is sent anywhere unless a feature does so on purpose.
- **Copying everything somewhere else** (such as an account): `this.app.storage.snapshot(skip)` returns every saved key as `{ 'area.key': raw JSON }` (leaving out the areas in `skip` and every `once` record), `restore(data, skip)` puts such a copy back, and `watch(fn)` calls `fn(key)` after any save (not during a restore) and returns a function that stops it.

## 8. The compiler

| Command | What it does |
|---|---|
| `python build.py` | Compiles `app/` into `dist/`. Prints a log, writes `dist/report.html`. |
| `python build.py check` | Checks every feature for mistakes, without compiling. |
| `python build.py list` | Lists features, what they need, and their start order. |
| `python build.py new-feature ID` | Creates a feature folder from the template. Options: `--name`, `--description`, `--requires a,b`. |
| `python build.py serve` | Compiles, then runs the app at http://localhost:8000. Add `--test` for sample data and the tests page (`/tests.html`). |
| `python build.py test` | Runs every test, including the delete-a-folder test (see [9](#9-tests)). `--quick` skips that one. |
| `python build.py --without notes,maps` | Compiles without some features, to see what happens. |
| `python build.py android-manifest PATH` / `android-project PATH` | Used by GitHub: add features' Android permissions to the manifest, and copy their Android `files` and `gradle` settings into the Android project. |
| `python build.py ios-project PATH --build N --team TEAM` | Used by GitHub: prepare the iPhone project Capacitor made (`dist/ios/App`): features' Info.plist entries, `files` (copied in and listed in the Xcode project; needs `pip install pbxproj`) and Podfile lines, and the app's id, version, build number, devices and Apple team. |

The compiler only needs Python 3.9 or newer. The browser tests also need Chrome or Edge.

**What it does:**
1. **Reads** `app.json` and every `feature.json` in its feature folders, checking each for mistakes (and each plugin's block: see §3).
2. **Checks imports:** a feature may only import `'folio'` and its own files. Anything else is a mistake.
3. **Leaves features out** when they're switched off, have a mistake, or are missing something they `require`, and keeps doing so until nothing else changes.
4. **Orders features** so each starts after what it requires and uses. Features that require each other in a circle are left out.
5. **Writes `dist/web/`:**
   - `index.html` with the templates
   - `app.css` (base styles, the accent colour from app.json, `app/theme.css`, then each feature's styles)
   - `fonts/`, copied from `app/fonts/`
   - `start.js` (the list of features)
   - the framework and feature code
   - the web manifest, icons, and `sw.js`, the offline support, which is versioned automatically
6. **Writes what the phone apps need:**
   - `dist/package.json` (Capacitor and the packages features asked for)
   - `dist/capacitor.config.json` (merged from every feature)
   - `dist/native.json` (Android permissions and files, iPhone settings, files and Podfile lines)
   - `dist/assets/icon-only.png`
7. **Writes `dist/report.html`:** the features, their slots, services and events, and the log.

## 9. Tests

`python build.py test` runs four kinds of test:

1. **Compiler tests** (`folio/tests/test_*.py`): finding, checking, ordering and compiling features.
2. **Feature and framework tests:** every `tests/*.test.js` file, run in a hidden browser.
   ```js
   import { test, assert } from 'folio/testing';
   import { moduleKey } from '../format.js';

   test('module codes group sessions', () => {
     assert.equal(moduleKey('ECON1011 Lecture'), 'ECON1011');
   });
   ```
   `assert` has `ok`, `equal`, `deepEqual`, `match`, `throws`. Put rules that don't need the screen in their own small file, so they're easy to test.
3. **Whole-app test:** the app is started with the sample data from `app/tests/seed.js`. The test opens every view (and every view inside one) and the first item in it, then Settings, then each button in the menu and each button in the top bar. Any problem fails the test.
4. **Delete-a-folder test:** the same check again, once without each feature, and once with no features at all.

On GitHub, these run before every release. If anything fails, nothing is released.

## 10. The rules

1. **One feature, one folder.** Everything a feature needs is inside it, including its phone permissions in `feature.json`.
2. **Import only `'folio'` and your own files.** To use another feature, use its service, slot or events.
3. **Handle missing features.** `this.use()` can return `null`, and a slot can be empty. The app must still work.
4. **Requires vs uses.** List what you can't work without in `requires` and what you work better with in `uses`.
5. **Build screens with `ui.el()` or templates, never `innerHTML` with outside text.** Text from calendars, files or websites can contain code.
6. **Keep saved data in `this.storage`, and never rename a released key.**
7. **Describe it.** Every feature has a `README.md`, and every slot you define has a one-line description of its items.
8. **Test it.** Rules go in small files with tests. Run `python build.py test` before releasing.
9. **Don't edit `dist/`.** It's rebuilt every time.
10. **Change `folio/` only for something every app needs.** A new slot or helper there benefits every feature. If it's only for one app, it belongs in a feature.

## 11. Starting a new app

1. Copy `build.py`, `folio/` and `.github/` into a new folder.
2. Create `app/app.json`:
   ```json
   { "id": "study-planner", "name": "Study planner", "description": "…", "version": "1.0.0",
     "theme": { "accent": "#00897b", "accentDark": "#4db6ac" },
     "native": { "appId": "io.github.studyplanner.app" } }
   ```
   For the iPhone app, `native.ios` can add `appId` (if the iPhone app needs a different id, e.g. because Apple says it's taken), `plist` (Info.plist entries for the whole app, e.g. `"ITSAppUsesNonExemptEncryption": false`) and `devices` (`"iphone"`, or the default `"iphone-and-ipad"`).
3. Optionally, set the app's own colours and fonts in `app/theme.css`, with font files in `app/fonts/`.
4. Add icons to `app/icons/`: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `icon-only.png` (1024×1024, for the phone app).
5. Create features with `python build.py new-feature …`. Features that aren't tied to one app can be copied between apps, such as campus-card.
6. Optionally, add `app/tests/seed.js` with sample data for the tests.

Folio's version is in `folio/VERSION`. When the framework changes in a way features notice, the version goes up and the change is described here.

**1.1.0:** a new frame. The top bar has only the menu (which now lists the `header.buttons`) and an account button that opens Settings. Views are tabs along the bottom, with icons, and each view has a title on a dark area. Views can hold other views (`contains`, `open`, `subviews`), mark the view to open on (`start`), and put things under their title (`mount`'s `head`). New: `ui.missing()`, more icons, `app/theme.css` and `app/fonts/`. Features written for 1.0 keep working.

**1.2.0:** only the top bar is dark now; a view's title sits on the page. A view can ask for the dark area to continue under its title with `darkHead: true`.

**1.3.0:** features can add icon buttons to the top bar, left of the account button, with the new `header.actions` slot. The account button no longer has a box around it. Corners come from three shapes, `--shape`, `--shape-btn` and `--shape-sm`, which an app can set in `app/theme.css` (they may have uneven corners). Features written for 1.2 keep working.

**1.4.0:** the menu is a panel that slides in from the left (tap outside, swipe left, Escape or back to close), with who is signed in at the top and the framework's own Account, Settings and About rows mixed in with the `header.buttons` by `order`. A new `account` slot is for apps with accounts; until it's filled, the account button and the Account row say *coming soon* (the account button no longer opens Settings). Swiping the tab bar changes tabs, and the selected tab's highlight slides between tabs. Views get a place for small buttons on the right of their title (`mount`'s `actions`). In Settings, Features is folded away. New icons: help, info, chat. The app's `description` from app.json is in `app.config` and shown in About. Inside the framework, the menu, tab bar and Settings are now in `Menu.js`, `Tabs.js` and `Settings.js`. Features written for 1.3 keep working; a feature whose only way in was a `header.buttons` row still has it.

**1.5.0:** pop-ups (`ui.dialog`, and Settings and About) fill the screen. Their title bar, with the close button, stays at the top while the rest scrolls, and on a wide screen the content keeps to a readable width. For a quick one that should stay a small box in the middle, pass `size: 'box'`. Features written for 1.4 keep working; their pop-ups are simply full screen now.

**1.6.0:** a feature can put files into the Android project and set its Gradle settings, with `native.android.files` and `native.android.gradle` in feature.json (for example a plugin's `google-services.json`). The files live in the feature's `native/` folder, which isn't shipped in the app. GitHub's build runs the new `python build.py android-project dist/android` after creating the Android project. Features written for 1.5 keep working.

**1.7.0:** swiping sideways anywhere on the page changes tab, like swiping the tab bar; it no longer calls the view's `step()`, which is now only for the arrow keys. Something with its own sideways swipe marks itself `data-own-swipe` (anything that scrolls sideways counts too). Full-screen pop-ups close when pulled down from the top of their content. Features written for 1.6 keep working; a view whose swipes changed days now changes tabs instead.

**1.8.0:** Settings starts with **Appearance**: Automatic (follows the phone, as before), Light or Dark, saved on the phone. It works by switching every `@media (prefers-color-scheme: dark)` rule on or off (and the status-bar colour tags), so features don't need anything new: keep writing dark styles inside that media query. The rules are in `runtime/appearance.js`. Features written for 1.7 keep working.

**1.9.0:** features have `this.getText(url)` for downloading text from another website: in the phone apps through the CapacitorHttp plugin directly, on the web with fetch. Use it instead of switching CapacitorHttp on for the whole app, which takes over every request and breaks some services (such as Firebase's database). Features written for 1.8 keep working.

**1.10.0:** the iPhone app. Features' `native.ios` can now also list `files` to add to the iPhone app and `pods` (Podfile lines), alongside `plist`; app.json's `native.ios` can set the iPhone app's own `appId`, app-wide `plist` entries and `devices`. The new `python build.py ios-project` prepares the iPhone project Capacitor makes, like `android-project` does for Android, and `@capacitor/ios` is always in `dist/package.json`. Features written for 1.9 keep working.

**1.11.0:** app.json can fix the appearance with `"appearance": "auto"`, `"light"` or `"dark"`. Settings then leaves out the Appearance choice, and the app always uses that mode, whatever was saved before. The default, `"choose"`, keeps the choice in Settings as before.

**1.12.0:** features can live in several folders (app.json's `"folders"`, such as `["core", "plugins"]`), and one of them can hold plugins (`"plugins": { "folder", "api" }`), each with a `plugin` block in its feature.json: the plugin API version it was written for, the oldest app version it works with, what it adds and when it loads (see §3). The compiler checks the block and leaves out a plugin that needs a newer API or app, or (with `plugins.service`) reaches past the app's plugin service. `python build.py list` and the report show each feature's folder. app.json's `version` must now look like `1.0.0`, and two files in a feature whose names differ only in capitals (`Api.js`, `api.js`) are a mistake, since they break on Windows and in one-file builds. Apps with only `app/features/` keep working unchanged. A slot can be watched: `slot.watch(fn)` calls `fn(slot)` after an item is added or removed.
