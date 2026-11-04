# Side panel

A page docked on the left of the screen that other features open their editors in: the room's
content editor, the source editor. One thing shows in it at a time; opening another asks the one
that shows first (it may have changes) and then takes its place. Escape or × closes it.

Its right edge is dragged to set its width (at least 300 px, at most 70% of the window), which is
remembered; a double-click on the edge sets it back to 480 px. Whatever sits beside it moves over
rather than being covered: while it shows, its width is the CSS variable `--panel-width` on
`<html>` (`0px` when it is shut), and every change of width is sent as `panel:resized`.

## The panel service

`this.use('panel')` gives everything it offers:

| Member | What it does |
|---|---|
| `open({ key, kind, title, body, beforeClose, onClose })` | Shows `body` (a node) under a quiet `kind` word and a `title`, in place of whatever showed (which is asked first). `beforeClose()` returns true, or a promise of true, when it may close; `onClose()` runs once it has. Resolves with a handle `{ close(force), setTitle(text), setKind(text), open }`, or `null` when what showed would not close. |
| `close(key, force)` | Closes what shows (only if it is `key`, when given), asking its `beforeClose` first unless `force`. Resolves true once the panel is shut. |
| `isOpen(key)` | Whether it shows (showing `key`, when given). |
| `width` | Its width in px while it shows, else 0. |

**Event:** `panel:resized` `{ width }`, when it opens, closes or is dragged (0 when shut).

Keys pressed in it stay in it (the room doesn't see them). It has no slots and saves only its
width ('width').

**The code.** `Panel.js` is all of it; `style.css` its look (classes start with `panel-`).
