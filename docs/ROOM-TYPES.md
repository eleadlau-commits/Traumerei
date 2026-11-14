# Writing a Träumerei room type

You are writing one Markdown file that gives a Träumerei room a form of its own: a grid, a ladder,
a calendar, a board. The person adds it in Settings → Room types (Add from file…), and every room
can then be seen through it. Answer with the file only: nothing before or after it.

## What a room is

A room holds marks (thoughts: short texts). Each mark has an id, a kind (`line` for a thought;
skip `group`), a text and a time it was made (`at`, milliseconds). Marks can be linked, can carry
a gap (something still to do), and can have a moment ahead (a date it is due or set to revisit).
A room type never stores anything of its own: it reads these tables and says where each mark
sits. What it wants changed it proposes, and the app lands it.

## The file

~~~
# Name of the type                 ← first heading: the name (the id is the name as a slug)

One line on what it is for.         ← the note the mode menu shows

arrange: grid                       ← optional key: value lines (table below)
columns: 4

Any other prose is ignored, so explain yourself freely.

```js                               ← optional: the code behind it; it wins over arrange:
arrange = (reads, context) => …
```
~~~

| Key | Values | Default |
|---|---|---|
| `arrange` | `grid`, `rows`, `columns`, `spiral`, `by links` (a mark under the one it links to), `code` | `grid` |
| `cell` | width x height in world units, e.g. `240 x 160` (a thought is about 200 wide) | `240 x 160` |
| `columns` | a whole number, for `grid` and `columns` | `6` |
| `order` | `oldest first`, `newest first`, `by text`, `open gaps first` | `oldest first` |
| `links` | the link kinds a room of this type accepts, by name, joined by commas; others are refused | all |
| `hand` | `yes`: a mark dragged stays where it was put; `no`: it goes back to where the type puts it | `yes` |
| `icon` | an SVG path on a 24 × 24 grid (`M4 4h16v16H4z`), or SVG elements | a square |

## The code

The ```js block assigns up to five functions. Write them as assignments (`arrange = …`), not
declarations; `const` helpers above them are fine. They must be pure: read only from `reads`,
keep no state between calls, never touch the page, the network or storage. Plain JavaScript;
`Date`, `Math` and `Intl` are there.

| Function | Called when | Returns |
|---|---|---|
| `arrange(reads, context)` | the room is laid out | `[{ mark, x, y }]`: where each mark sits; `x, y` is the mark's centre. A mark left out goes in rows below the rest |
| `admit(reads, proposal)` | a link or a position is asked for | `true` to allow, or a reason in words to refuse. `proposal` is `{ kind: 'link', from, to, link }` or `{ kind: 'place', mark, context, position }` |
| `draw(reads, context)` | the room is drawn | `[{ x, y, w, h, label?, note? }]`: boxes drawn behind the marks; `x, y` is the box's top-left corner. A tap on a box chooses it |
| `drop(reads, context, mark, x, y)` | a mark is let go at `x, y` | a proposal, a list of them, or `null` |
| `land(reads, context, mark, x, y)` | a new thought is written while a box is chosen (`x, y` is the box's centre) | a proposal, a list of them, or `null` |

A **proposal** is about `mark` (add `mark: id` for another mark of the same room):
`{ due: time, note? }` (due at that time, milliseconds), `{ revisit: time, note? }`,
`{ clear: true }` (nothing ahead any more), `{ gap: 'from world' }` (open a gap: `to world` check
it, `from world` do it, `to maker` judge it), `{ resolve: true }` (close its gap). One the app
refuses is skipped. Undo takes back the gesture and its proposals together.

`context` is the room's id. A 1,500-mark room must arrange in under 50 ms: no loops inside loops
over all marks.

## What `reads` offers

Every call returns frozen rows; hold ids, not rows.

- `reads.marks`: `get(id)` → `{ id, kind, text, at, edited? }` · `in(context)` → the room's marks · `text(id)` · `ofKind(kind)` · `search(words)`
- `reads.links`: `from(mark, kind?)`, `to(mark, kind?)` → `[{ id, from, to, kind, label? }]` · `members(group)` · `holders(mark)` · `kinds()` · `named(kind)` · `get(id)` · `count()` · `standsFor(id)`
- `reads.gaps`: `of(mark)` → `{ direction, state: 'open' | 'resolved', openedAt }` or `null` · `opened(context?)` · `oldest(context?)` · `progress(mark)` → `{ open, resolved, of }`
- `reads.moments`: `next(mark)` → `{ kind: 'due' | 'revisit' | 'return', at, note, state: 'waiting' | 'back' | 'met' | 'refused' }` or `null` · `ahead(context?)` · `returns(context?)` · `of(mark)` (its history) · `changed(mark)` (when last written)
- `reads.places`: `home(mark)` · `of(mark)` · `in(context, rule?)` · `loose(context)` · `position(mark, context, rule)`
- `reads.distance`: `of(mark)`, `declared(context)`, `shut(mark)` (locked), `all()`, `readers()`

## Three worked files

A grid, in words only:

~~~markdown
# Index cards

Cards four to a row, newest first.

arrange: grid
columns: 4
cell: 260 x 180
order: newest first
~~~

A ladder, with code that refuses a link backwards:

~~~markdown
# Reading ladder

One column, newest at the foot; a step may only follow an older one.

links: follows

```js
arrange = (reads, context) =>
  reads.marks.in(context).filter((m) => m.kind !== 'group')
    .sort((a, b) => a.at - b.at)
    .map((m, i) => ({ mark: m.id, x: 0, y: i * 160 }));

admit = (reads, p) =>
  p.kind !== 'link' || reads.marks.get(p.from).at > reads.marks.get(p.to).at
    || 'A step may only follow an older one';
```
~~~

A calendar, with day boxes, drops that set a date and thoughts that land on the chosen day: the
whole file follows this guide (Copy guide in Settings → Room types appends it; in the
repository it is `docs/room-types/month-calendar.md`). Its shape:

```js
arrange = (reads, context) => …   // each dated mark in its day's box, undated ones on the left
draw = (reads, context) => …      // one box per day, labelled 'Mon 16', the current day noted 'today'
drop = (reads, context, mark, x, y) => ({ due: noonOfDayAt(x, y) })
land = (reads, context, mark, x, y) => ({ due: noonOfDayAt(x, y) })
```

## Before you answer

- The first line is `# Name`; the second paragraph is one sentence.
- Every function is an assignment inside one ```js block, and returns what the table says.
- `arrange` and `draw` must work on an empty room (return `[]`).
- Nothing outside `reads` is read, nothing is kept between calls.
