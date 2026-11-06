# Home

The home page, laid over the picture that the Renderer draws full screen behind it, in the same
frame as the rooms page and a room (the `frame` feature):

It is kept clean: no rail and no Search (Search and Ctrl+K are on the rooms page and in rooms).

- **The top bar** says *Home*. There is no back arrow and no Search.
- **Traumerei** in the middle, in the chosen typeface, and **Create**
  beneath it, a plain word, not a button. Create opens the rooms (the `create` service).
- **The quick thought** (`quick.js`), under Create: faint words in the reading face, *Note down a
  messy thought…*, and nothing else (no box, no buttons). Typing anywhere on Home writes there; it is a
  plain text field, so ordinary editing works. **Enter** drops the thought into Messy thoughts as
  a loose thought, waiting in its tray in every mode (the world's `groups.wait`, as a thought added
  from the tray); the words fade and the status bar says *Dropped in Messy thoughts*. **Ctrl+Enter**
  puts in a new line, Escape lets go of the line. The world is read afresh before
  and written at once after, so the rooms page finds it. Messy thoughts can't be deleted (the
  world gives it back if it is missing); if it is locked, nothing drops and the status bar says so.
- **The status bar** at the foot: its quiet line, and Saved.

It uses the services `create`, `world` (Messy thoughts) and `frame`. Settings, Account and About
are in the menu.

## The menu ("Veil")

The menu is Folio's, restyled in `style.css`: no panel and no dark backdrop. When it opens, the
page goes pale and soft-focus behind a veil of light, and the words (Create, Account, Settings,
About) stand on the left in the home page's type, in sentence case, fading in one after another. Who is signed in
sits small at the bottom. The three lines become a thin cross in the same place. It closes on a
tap anywhere empty (the cross included), Escape, back, or a swipe left. Create in the menu calls
the same `create()` as the home page.

Its colours (the ink of the words, the veil, Settings' pale page) are the app's palette, the CSS
variables `--ink`, `--veil` and `--ink-rgb` / `--veil-rgb` that the Renderer sets from the one tint
(Settings → Colour), with today's warm black and white as the fallback. The app is always light:
app.json fixes `"appearance": "light"`, so Settings has no Appearance choice.

## Typeface

Settings → Typeface. The choices are listed in `fonts.js`, the first one being the default
(Tenor Sans). Fonts are kept inside the code as data: URLs (`fonts/tenor-sans.js`), so the page
needs no font server and the one-file standalone page works too.

To add Traumerei Sans: turn its .woff2 into a module like `fonts/tenor-sans.js`
(`'data:font/woff2;base64,…'`), import it in `fonts.js` and add an entry. Put it first to make
it the default.

Tenor Sans is © 2011 Denis Masharov, SIL Open Font License 1.1 (`fonts/OFL-TenorSans.txt`).

**The reading face.** Thoughts are set in Source Serif 4 (`READING` in `fonts.js`,
`fonts/source-serif-4.js`: regular, italic and semibold), loaded at start whatever the typeface;
base.css names it `--font-read`. Source Serif 4 is © 2014–2021 Adobe, SIL Open Font License 1.1
(`fonts/OFL-SourceSerif4.txt`).
