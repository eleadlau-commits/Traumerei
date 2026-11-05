# Docks

A dock on the left and a dock on the right of the screen, that other features open things in:
the room's content editor and the source editor open in the right one's **Editor** tab, and the
room's Timeline in its **Timeline** tab. The two behave the same, mirrored. A dock holds one thing
per tab: opening into a tab asks what that tab held first (it may have changes) and then takes its
place; opening into another tab keeps the first and comes to the front. Its tabs show along its top,
and a click brings one to the front. Escape or ×
closes the one in front; the dock shuts when it holds nothing. The right dock's first tab is
Editor; a thing in the left dock is named by its tab, or else its kind.

Every dock wears the same frame: a 32 px strip of tabs (one for each thing it holds, the one in
front underlined in amber) with the dock's key and × on the right; under it, the front one's quiet
kind and title (left out when both are empty); then its body. A dock's inner edge is dragged to
set its width (the right one 280 to 560 px, the left one 220 to 560 px, never more than 70% of the
window), which is remembered; a double-click on the edge sets it back to the usual width (left
280 px, right 340 px). Both docks start under the top bar (`--bar`), so the menu, Search and the
back arrow stay put, and end above the status bar (`--status`, the frame feature's). Whatever sits beside a dock moves over rather than being covered:
while it shows, its width is the CSS variable `--dock-left` or `--dock-right` on `<html>` (`0px`
when it is shut), `<html>` has the class `dock-left-open` or `dock-right-open`, and every change
of width is sent as `docks:resized`.

## The docks service

`this.use('docks')` gives `{ left, right }`, one dock each, and each offers:

| Member | What it does |
|---|---|
| `open({ key, tab, kind, title, body, beforeClose, onClose })` | Shows `body` (a node) in front, in tab `tab` (the dock's first tab when left out), under a quiet `kind` word and a `title`, in place of whatever that tab held (which is asked first). `beforeClose()` returns true, or a promise of true, when it may close; `onClose()` runs once it has. Resolves with a handle `{ close(force), setTitle(text), setKind(text), open }`, or `null` when what the tab held would not close. |
| `close(key, force)` | Closes what holds `key`, or the one in front when no key is given, asking its `beforeClose` first unless `force`. Resolves true once it has closed. |
| `closeAll(force)` | Closes everything the dock holds. Resolves true once the dock is shut. |
| `show(key)` | Brings what holds `key` to the front (and the dock back, if hidden). False when nothing holds it. |
| `isOpen(key)` | Whether it holds `key` (anything, when no key is given), in front or not. |
| `isShowing(key)` | Whether `key` is in front and the dock shows. |
| `toggle()` | Hides it, keeping what it holds, or brings it back. False when it holds nothing. |
| `shown` | Whether it shows on the screen (it holds something and isn't hidden). |
| `width` | Its width in px while it shows, else 0. |

`docks.canvasOnly()` hides every dock that shows; the same again brings back just those.

## Keys

Added to the key map (the keys feature), working while typing too (`keys.js`):
**Ctrl+Alt+L** shows or hides the left dock, **Ctrl+Alt+E** the right dock, and
**Ctrl+Alt+F** is Canvas only. Opening something in a hidden dock brings it back.

## The panel service

`this.use('panel')` is the right dock, the same members as above: the name editors have always
used for the side panel.

**Event:** `docks:resized` `{ side, width }`, when a dock opens, closes or is dragged (0 when shut).

Keys pressed in a dock stay in it (the room doesn't see them). It has no slots and saves only the
two widths ('left', 'right').

**The code.** `Docks.js` makes the two docks and offers the services; `dock.js` is one dock; `keys.js` its keys;
`style.css` their layout (classes start with `dock-`; the tabs are Folio's words).
