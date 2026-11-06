# Frame

Create's frame around the canvas, the same on the rooms page and in a room: the top bar (a 44 px
band of flat veil: the wordmark beside the menu ☰, then where you are, as a breadcrumb such as
Rooms › Floor 1 › Messy thoughts, then Search always at the right, then the back arrow) and the status bar at the
foot (26 px of veil: on the left, what the pointer is over, with its keys, or a line of help; on
the right, what is chosen, the mode, and Saved). Without it the rooms page and rooms work the same, with
no frame (Ctrl+K still searches, Escape still goes back).

The rooms page shows the frame when it opens, and a room shows its own over it; the one shown
last is the one that shows, and hiding it brings back the one before.

## The frame service

`this.use('frame')`:

| Member | What it does |
|---|---|
| `show(owner, o)` | Shows the frame for `owner` (any object, usually the feature), on top of any other. `o`: `{ crumbs?, search()?, back()?, backLabel?, selection?, mode?, idle?, ink? }`: `crumbs` is where you are, a list of steps `{ label, onClick?, title?, current?, note? }` (a step with `onClick` is a word to press; `note` is a quiet word after it), or `{ node }` for a node of the owner's own (a name to rename in place); Search is shown only with `search`, and the arrow only with `back`; `back` is what the arrow does and `backLabel` what it is called; `selection` and `mode` show at the right of the status bar ("2 chosen", "Joyce"); `idle` is its quiet line on the left while the pointer is over nothing that says what it is; `ink` is kept for words drawn on the canvas (a CSS colour). |
| `update(owner, o)` | Changes some of what `owner`'s frame says. |
| `hide(owner)` | Takes `owner`'s frame away; the one under it shows, or none. |
| `saved(word)` | Saved, at the right of the status bar; another word ("Undone") for a moment. |
| `hint(text)` | A line of help on the left of the status bar for a while; the first key or click takes it away. |
| `hover(text)` | What the pointer is over, said by the owner (a thought on the canvas); `null` lets the frame read it again from the element's `data-hint`, `title` or name. |
| `clearHint()` | Takes it away now. |
| `toggleRail()` | Narrows the rail to its icons (48 px), or widens it again (206 px). |
| `railNarrow` | Whether the rail is narrow now. |
| `more()` | ⋯ More for the foot of a rail (see below). |

**The rail.** The rooms page and a room each draw their own rail (Folio's `.rail`, a column of
veil down the left); the frame holds only how wide it is. **Ctrl+Alt+B** (in the key map, working
everywhere) or the rail button at the left of the status bar narrows it to its icons and back.
While it is narrow `<html>` has the class `rail-narrow` (so `--rail` is 48 px), and each change is
sent as **`frame:rail`** `{ narrow }`. It saves that (`railNarrow`) and whether ⋯ More is open (`moreOpen`).

**⋯ More.** `more()` gives a node for the foot of a rail (the rooms page and a room each put it
under their own items): a rule, then ⋯ More, which a click unfolds to what other features put in
the slot **`rail.more`** (Time) and folds again; it remembers which (`moreOpen`). It is empty when
nothing there is visible. An item is `{ id, label, icon, order, run(), on?(), visible?(), title?() }`:
`icon` a `ui.ICONS` name, `on()` shows it pressed, `visible()` false leaves it out, `title()` its
hover words. Each rail draws `more()` again when it redraws, so an item's state follows.

It has one slot, `rail.more`. While it shows, `<html>` has `--status` (the status
bar's height, else `0px`): the docks start under its top bar and end above its status bar. An
element says what it is in the status bar with `data-hint` (or its `title`).

**The code.** `Frame.js` builds it and offers the service; `style.css` is its layout.
