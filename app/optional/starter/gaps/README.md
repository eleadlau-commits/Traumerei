# Gaps

The checker: open a gap on a thought (something to check, do or judge), resolve it, and see a
group's or a tree's progress in the Editor (Ctrl+Alt+G). A gap is the kernel's fifth table
(`app/core/KERNEL.md`, Law 5): what a thought was made to close. This plugin is the hands on it;
the room itself draws an open gap as a fine edge at the thought's start, and the rooms page a dot
on a room with open gaps.

A plugin: switch it off and on in Settings → Plugins. It reaches the app only through the plugin
API (`app/core/API.md`: `t.gaps`, `t.ui.chosen`).

## What it adds

- **An Editor section, Gap**, for the chosen thought or group. With no gap: three words, Check,
  Do, Judge, each opening a gap of that direction (`to world`, `from world`, `to maker`). Open:
  since when, and Resolve (by judgement). Resolved: when and by what, and Open again. For a
  group, a Russell chapter or anything with parts that carry gaps: the parts' progress ("3 of 12
  parts open") and a thin bar; such a gap is derived and resolves only through its parts.
- **Ctrl+Alt+G** in a room: on the chosen thought, opens a gap to do, resolves an open one, or
  opens a resolved one again; on a derived gap it says the progress.

Writing on from a thought with an open gap (Enter under a plan) opens a gap of the same direction
on the new thought: that is the room's doing (`app/core/room/writing.js`), not this plugin's, so a
list of things to do grows by writing with the plugin off too.

## What it needs

- **Requires:** api (it's left out if these are missing)
- **Plugin API:** 2 · **oldest app:** 1.0.0

## What it saves

- Nothing: the gaps are the world's own table, kept and undone with it.

## How to check it works

1. Run `python build.py test` (`tests/gaps.test.js` here; the table's own gate is
   `app/core/world/tests/gaps.test.js`).
2. Run `python build.py serve`, open a room, write a thought, right-click it: the Editor's Gap
   section shows Check · Do · Judge. Press Do: the thought gains an edge at its start, the rooms
   page a dot on the room. Enter writes the next thought on from it: it opens a gap too. Group
   them (Ctrl+G) and choose the group: "2 of 2 parts open". Resolve both: the group reads resolved.
3. Settings → Plugins: switch Gaps off (the section and the key go; the edges stay, they are the
   room's) and on again.
