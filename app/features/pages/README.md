# Pages

Settings as a page in the frame (the `frame` feature), the same frame as Home, the rooms page and
a room: the top bar says **Home › Settings** (Home and ← go back, as does Escape), the status bar
says *Changes save as you make them*, and Saved.

- **The rail** (Folio's `.rail`) lists the sections under *Settings*. A click goes to one; the one
  at the top of the page is marked as you scroll.
- **The panel** (Folio's `.page-panel`) holds one row per section (`.page-row`): its name on the
  left (`.page-label`), what it draws on the right.
- **The sections** are Folio's `settings` slot, as every feature fills it (Colour, Theme,
  Typeface, Rooms, Floors, History, Advanced), then Folio's own Features and About
  (`settings.js`). The rail's icon for each is listed there by section id; anything else gets ⋯.

Everything that opened Folio's Settings window (the menu, Home, Settings in a room) opens this
page instead: while this feature runs, the shell's `openSettings`, `refreshSettings` (a section's
data changed: the page draws again where it is) and `closeSettings` are its own. Without it, the
window is as it was.

The page is a `<dialog>` shown open (not modal) and put last in the page each time, over whatever
shows. So while it shows, the key map, the rooms page and the room leave keys alone, as they do
for any pop-up. While it shows `<html>` has the class `page-open` (Home hides its words).

It offers no service and saves nothing. **The code.** `Pages.js` is the page, `settings.js` reads
the sections, `style.css` is its layout.
