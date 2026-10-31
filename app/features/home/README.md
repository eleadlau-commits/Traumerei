# Home

The home page, laid over the picture that the Renderer draws full screen behind it:

- **Traumerei** in the middle, in the chosen typeface.
- **Create** beneath it, then **Settings** and **Account** under that. They are plain words,
  not buttons, and do nothing yet: `create()`, `settings()` and `account()` in `Home.js` are
  where that goes.
- The top bar keeps only the menu button: the three lines alone at 80% opacity
  (`style.css`).

## The menu ("Veil")

The menu is Folio's, restyled in `style.css`: no panel and no dark backdrop. When it opens, the
page goes pale and soft-focus behind a veil of light, and the words (Create, Account, Settings,
About) stand on the left in the home page's type, fading in one after another. Who is signed in
sits small at the bottom. The three lines become a thin cross in the same place. It closes on a
tap anywhere empty (the cross included), Escape, back, or a swipe left. Create in the menu calls
the same `create()` as the home page.

## Typeface

Settings → Typeface. The choices are listed in `fonts.js`, the first one being the default
(Tenor Sans). Fonts are kept inside the code as data: URLs (`fonts/tenor-sans.js`), so the page
needs no font server and the one-file standalone page works too.

To add Traumerei Sans: turn its .woff2 into a module like `fonts/tenor-sans.js`
(`'data:font/woff2;base64,…'`), import it in `fonts.js` and add an entry. Put it first to make
it the default.

Tenor Sans is © 2011 Denis Masharov, SIL Open Font License 1.1 (`fonts/OFL-TenorSans.txt`).
