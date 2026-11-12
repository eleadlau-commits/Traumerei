# Templates

Where a first run starts. The first time Träumerei opens with nothing written, a chooser sits over
Home: four rooms that start in a shape people already know, or **Start empty**. Each template runs
out within the first hour at the point where one of the primitives takes over (the handbook, *The
Träumerei way*, "Start from a template"):

| Template | Looks like | What it really is | Where it runs out |
|---|---|---|---|
| To-do list | A plain list you tick | A Pessoa room, every item a gap to do; Ctrl+Alt+G ticks | One item waits on another: switch to Russell |
| Essay or report | Headings with notes under them | A Joyce room named after the finished text, each heading a passage with the gap "not written" | How much is left? The desk; Export when nothing is open |
| Reading notes | One card per book or paper | A Proust room, each card with the gap "what does this mean for my project" | Closing those gaps is the real reading |
| Weekly plan | Seven days with things under each | A Joyce room of seven days from today; each thing due on its day | Friday: what is not done rolls on (Tomorrow, in Returns) |

A template adds no primitive, mode or plugin: it is .traum text (`rules.js`) landed through
`t.carriers`, only marks, places, links, gaps and moments.

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`: `t.marks.in`, `t.parts.model.MESSY`, `t.carriers.read/land`,
`t.ui.open.room`, `t.ui.toast`, `t.slots.more`, `t.slots.commands`).

## What it adds

- **The chooser**, once, on a fresh start (never answered before, only Messy thoughts, nothing in
  it). A choice lands the room on the first floor as one step (Ctrl+Z takes it back) and goes in.
  Escape, a click outside or Start empty puts it away for good.
- **⋯ More → Templates** and the command *Templates* (Ctrl+K), to open the chooser any time.

## What it needs

- **Requires:** api
- **Plugin API:** 2 · **oldest app:** 1.0.0

## What it saves

- `seen`: true once the chooser has been answered. The rooms are the world's own.

## How to check it works

1. `python build.py test` (`tests/templates.test.js`) and `node app/plugins/templates/tests/land.mjs`
   (every template lands in an empty world with no plugin on; every pull request runs it).
2. `python build.py serve` in a fresh browser profile: the chooser shows over Home. Pick To-do list:
   the room opens with five things, one ticked.
