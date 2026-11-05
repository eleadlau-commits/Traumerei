# Frame

Create's frame around the canvas, the same on the rooms page and in a room: the top bar (the
wordmark beside the menu ☰, Search in the middle, the back arrow top right) and the quiet words
at the foot ("Saved" and a line of help). Without it the rooms page and rooms work the same, with
no frame (Ctrl+K still searches, Escape still goes back).

The rooms page shows the frame when it opens, and a room shows its own over it; the one shown
last is the one that shows, and hiding it brings back the one before.

## The frame service

`this.use('frame')`:

| Member | What it does |
|---|---|
| `show(owner, o)` | Shows the frame for `owner` (any object, usually the feature), on top of any other. `o`: `{ search()?, back()?, backLabel?, ink? }`: Search is shown only with `search`; `back` is what the arrow does and `backLabel` what it is called; `ink` the colour of its words (a CSS colour). |
| `update(owner, o)` | Changes some of what `owner`'s frame says. |
| `hide(owner)` | Takes `owner`'s frame away; the one under it shows, or none. |
| `saved(word)` | A quiet word at the foot for a moment ("Saved", "Undone"). |
| `hint(text)` | A line of help at the foot for a while; the first key or click takes it away. |
| `clearHint()` | Takes it away now. |

It has no slots or events and saves nothing. Beside an open dock it keeps clear of it, through the
docks feature's `--dock-left` and `--dock-right`.

**The code.** `Frame.js` builds it and offers the service; `style.css` is its layout.
