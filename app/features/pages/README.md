# Pages

Settings and Account as pages in the frame (the `frame` feature), the same frame as Home, the
rooms page and a room: the top bar says **Home › Settings** or **Home › Account** (Home and ← go
back, as does Escape), and the status bar has the page's quiet line (*Changes save as you make
them*; *Sign in to keep your rooms and settings on every device*), and Saved.

- **The rail** (Folio's `.rail`) lists the sections under *Settings*. A click goes to one; the one
  at the top of the page is marked as you scroll.
- **The panel** (Folio's `.page-panel`) holds one row per section (`.page-row`): its name on the
  left (`.page-label`), what it draws on the right.
- **Settings' sections** are Folio's `settings` slot, as every feature fills it (Colour, Theme,
  Typeface, Rooms, Floors, History, Advanced), then Folio's own Features and About
  (`settings.js`). The rail's icon for each is listed there by section id; anything else gets ⋯.
- **Account's sections** are what the item in Folio's `account` slot gives from `sections()`
  (the account feature: Sign in, Saving), each `{ id, title, icon, body }`. On `account:changed`
  the page draws again. An account item without `sections` keeps its own page.

Everything that opened Folio's Settings window or the account's page (the menu, Home, Settings in
a room) opens these pages instead: while this feature runs, the shell's `openSettings`,
`refreshSettings` (a section's data changed: the page draws again where it is), `closeSettings`
and `openAccount` are its own. Without it, the windows are as they were.

The page is a `<dialog>` shown open (not modal) and put last in the page each time, over whatever
shows. So while it shows, the key map, the rooms page and the room leave keys alone, as they do
for any pop-up. While it shows `<html>` has the class `page-open` (Home hides its words).

It offers no service and saves nothing. **The code.** `Pages.js` is the page, `settings.js` reads
the sections, `style.css` is its layout.
