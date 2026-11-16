# Export

A room leaves as words: step 7 of the handbook, export when nothing is open.

- **Export as Markdown** (⋯ More in a room, or Ctrl+Shift+E): the open room as a `.md` file, in
  the room's own order (`rules.js`). Joyce: trains top to bottom, titled trains and passages as
  headings. Pessoa: a list, thoughts with a gap as tasks (`- [ ]`, `- [x]`). Russell: the tree as
  nested headings, leaves as paragraphs under their parent. Proust: one card per thought, with
  what it is linked to. Any other mode: groups as headings, the rest in the order laid out.
  An open gap shows as **Open, to do / to check / to judge**, and the top says how many are left.
  Maths stays as typed (`$…$`, `$$…$$`).

- **Print or save as PDF** (⋯ More in a room, or Ctrl+P): the same outline as a clean page,
  maths drawn, black on white in every theme, everything else hidden while the print dialog is
  open. Choose **Save as PDF** in the dialog for a PDF: no PDF library is shipped. The PDF is
  offered under the room's name.

- **What it needs:** the plugin API: `t.carriers.tables` (read), `t.ui.files.save` (Windows' Save
  dialog in the desktop app, a download in the browser), `t.parts.maths` (formulas on the page), `t.slots.commands`, `t.slots.more`.
- **What it saves:** nothing.
- **Check it:** `python build.py test` (`tests/rules.test.js`), then open a room and choose
  ⋯ More → Export as Markdown.
