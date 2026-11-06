# Home

The home page, laid over the picture that the Renderer draws full screen behind it:

- **Traumerei** in the middle, in the chosen typeface.
- **Create** beneath it, then **Settings** and **Account** under that. They are plain words,
  not buttons. Create opens the rooms (the `create` feature, if it's there); Settings and
  Account open those pages.
- The top bar keeps only the menu button: the three lines alone at 80% opacity
  (`style.css`).

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
