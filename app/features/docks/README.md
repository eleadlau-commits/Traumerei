# Docks

A dock on the left and a dock on the right of the screen, that other features open things in:
the room's content editor and the source editor open in the right one. The two behave the same,
mirrored. One thing shows in a dock at a time; opening another asks the one that shows first (it
may have changes) and then takes its place. Escape or × closes it.

A dock's inner edge is dragged to set its width (at least 220 px, at most 70% of the window),
which is remembered; a double-click on the edge sets it back to the usual width (left 300 px,
right 480 px). The right dock runs the full height; the left one starts under the strip at the
top, so the menu stays put. Whatever sits beside a dock moves over rather than being covered:
while it shows, its width is the CSS variable `--dock-left` or `--dock-right` on `<html>` (`0px`
when it is shut), `<html>` has the class `dock-left-open` or `dock-right-open`, and every change
of width is sent as `docks:resized`.

## The docks service

`this.use('docks')` gives `{ left, right }`, one dock each, and each offers:

| Member | What it does |
|---|---|
| `open({ key, kind, title, body, beforeClose, onClose })` | Shows `body` (a node) under a quiet `kind` word and a `title`, in place of whatever showed (which is asked first). `beforeClose()` returns true, or a promise of true, when it may close; `onClose()` runs once it has. Resolves with a handle `{ close(force), setTitle(text), setKind(text), open }`, or `null` when what showed would not close. |
| `close(key, force)` | Closes what shows (only if it is `key`, when given), asking its `beforeClose` first unless `force`. Resolves true once the dock is shut. |
| `isOpen(key)` | Whether it shows (showing `key`, when given). |
| `width` | Its width in px while it shows, else 0. |

## The panel service

`this.use('panel')` is the right dock, the same members as above: the name editors have always
used for the side panel.

**Event:** `docks:resized` `{ side, width }`, when a dock opens, closes or is dragged (0 when shut).

Keys pressed in a dock stay in it (the room doesn't see them). It has no slots and saves only the
two widths ('left', 'right').

**The code.** `Docks.js` makes the two docks and offers the services; `dock.js` is one dock;
`style.css` their layout (classes start with `dock-`).
