# Source editor

A thing's source as plain text, in the right dock (the plugin API's `t.docks.right`; it requires the docks): for now the
the .traum text of a group or a whole room, which the roomfile feature gives it. It is a large
monospace box with two quiet lists above it, and plain words below.

- **Above the box**, a line says what the text holds now ("1 chapter, 14 thoughts · 12 kept, 2
  new"), checked again a moment after each key. Under it, *Apply will* lists each change Apply
  would make (a rename, an arrow moved, a group added), and *Couldn't be read* lists what can't be
  read or drawn, each with its line.
- **Below the box:** *Copy* (the text, to hand to Claude), *Download* (as a file), *Paste*
  (replaces the box with the clipboard; a Markdown code fence around it, as Claude replies, is
  taken off), *Reset* (back to what the thing holds now) and *Apply* (Ctrl+Enter). Apply closes
  the editor once it has worked. A tab is two spaces.
- **Closing** (Escape or ×) never asks. Text changed and not applied is kept as a draft (under
  the name the opener gives, `draft`) and comes back the next time the same thing opens, with a
  line saying so (and that it changed since, if it did; *Reset* shows it as it is now). Apply, or
  closing with the text as it was, lets the draft go. Drafts are saved ('drafts').
- **Read only** (a locked room): only Copy and Download.

It knows nothing about rooms or Markdown: whoever opens it says what the text means.

## The source service

`this.use('source')` gives everything it offers:

| Member | What it does |
|---|---|
| `open({ kind, title, text, readOnly, fileName, options, check, apply, full, reset, draft })` | Opens the editor in the panel. `check(text, options)` returns `{ summary, changes, report, options, blocked }` (lists of lines; `blocked` greys Apply). `apply(text, options)` does it, resolving true when it worked (the editor then closes). `options`: tick boxes `[{ key, label, value }]` passed to both (check may return them again, with `show: false` to hide one). `full(text)` is what Download writes; `reset()` gives the text afresh. `draft` names what is edited, for keeping unapplied changes. Resolves when the editor closes: true if Apply worked. |
| `close()` | Closes it (changes not applied are kept as its draft). |
| `isOpen()` | Whether it shows. |
| `unfence(text)` | The text without a Markdown code fence around it (`unfence.js`). |

It sends no events and has no slots. Before checking and applying, the text loses any code fence
around it.

**The code.** `Source.js` is all of the screen; `unfence.js` takes the fence off (tested in
`tests/source.test.js`); `style.css` its look (classes start with `source-`).
