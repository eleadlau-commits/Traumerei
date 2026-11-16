# Manuscript

A mode that reads a room as a manuscript: its chapters as headings in reading order, chapters
within chapters to any depth (numbered 1, 1.1 or I, i if the room's ⚙ says so), each chapter's
thoughts beneath it, the loose thoughts last, in one column. A thought written after another goes
into its chapter, just after it; a thought dragged into another chapter moves there. A chapter with
`break` draws a rule line above its heading.

**One way of seeing the room, not folders.** A chapter is a group mark; what it holds are `part of`
links, and a chapter inside a chapter is one more link. Every thought keeps its one home, the room:
switch to Joyce or Pessoa and the same thoughts are there, and taking a chapter away leaves its
thoughts where they are. Nothing here makes a container.

A corpus plugin (open core 1.1.1): written against `app/core/API.md` alone. It proves the `join`
proposal with `from` (land and drop), `reads.marks.draft` (the column makes room for the words
being written), a kind of group's own `fields` (`break`) and a thin rule's `choice` setting.

- **What it adds:** a rule (mode) `manuscript`; a kind of group `manuscript-chapter` (Chapter);
  a command, "Make a chapter of the chosen thoughts" (no keys of its own).
- **What it needs:** the plugin API (1.1.1).
- **What it saves:** nothing of its own: chapters are group marks and `part of` links.
- **Check it:** `python build.py test` (the corpus suite), then switch it on in Settings → Plugins.
