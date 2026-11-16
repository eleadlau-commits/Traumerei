# Book

A book editor in any room. Seen as **Book** (Mode → Book, or Tab), the room is the book set on
pages (A4, Letter, A5 or 6 × 9, or one column without pages): a title page, each chapter on a
new page with its heading dropped, its sections with numbered headings, its paragraphs in order,
running on from page to page; page numbers at the foot and the chapter's title at the head; margin
notes beside the page; and after the last page, the room's thoughts not yet in the book. You write in it as in any room:
Enter keeps a paragraph and it lands right after the one you were on, in its chapter.

A plugin, shipped as `book.traumplug` (never built into the app). It reaches the app only
through the plugin API (`app/core/API.md`), and needs app 1.1.2 (the `join` proposal, `ui.text.edit`, quiet link kinds,
and room settings that redraw).

## The shape (all in the tables, Law 8)

- A **book** is a group of the family `book`; its parts, in order, are chapters and paragraphs.
- A **chapter** is a group of the family `book-chapter` (membership one: a paragraph is in one
  chapter). Its parts are paragraphs and sections (chapters again), three levels deep.
- A chapter's **heading** is a thought linked to it by a `heads` link and kept as its first part,
  so the caret runs through it and it is written in like a paragraph. It reads bold small
  capitals (a chapter), bold (a section) or italic (deeper), by a decorator; its number sits in
  the left margin.

## What it adds

- **Mode Book** (rule `book-page`, order 30). Its settings, per room (the ⚙ beside Book in the
  rail): Pages (A4 by default, Letter, A5, 6 × 9 in, or None: one column), Margins (narrow,
  normal, wide), A chapter starts a page (on), Column (Narrow, Book, Wide; without pages).
- **Pages** (`pages.js`, drawn, never stored): a heading keeps two lines of what follows on its
  page; a paragraph runs on to the next page in pieces, never leaving one line alone at a foot or
  a top; a table or figure moves to the next page whole.
- **Word document** (`word.js`, also "Export: Book as a Word document" in the room's ⋯ More):
  the room's page size and margins (A4 for a column without pages), the title on a page of its
  own, each chapter on a new page when the room says so (sections never), headings as Word's
  Heading 1–3 numbered as they nest (so Word's navigation pane and contents see them), kept with
  what follows; page numbers at the foot and the chapter's title at the head, off the title page;
  bold, italic, underline and strike; tables and figures. Margin notes stay out. `zip.js` is the
  plugin's own copy (it ships alone).
- **Margin notes**: a thought linked `about` a paragraph, drawn beside it (to the right of the
  page), out of the flow and out of the export. Alt+N on a chosen paragraph makes it a note on
  the one before it; Alt+N on a note puts it back after that paragraph.
- **Docks**, Ctrl+Alt+J in a room seen as Book (or Tools → Book):
  - left, **Contents**: chapters and sections numbered as they nest, their pages, words and
    open gaps for each; the chapter you are in is lit; a click goes to its heading; drag a line among its
    siblings to reorder; thoughts dragged from the canvas onto a line join that chapter.
  - right, **Book**: the title (rename it there), paragraphs, words and what is still open; the
    chapter, paragraph (its page, its notes) or note in hand; Export Markdown, Word document,
    Print or PDF (both at the room's page size and margins, a chapter on a new page).
  - the column is zoomed out, if it must be, to fit between the docks.
- **Keys on the chosen paragraph** (room seen as Book):
  - Ctrl+Alt+H: make it a heading (it gathers what follows, up to the next chapter); again: a
    paragraph.
  - Ctrl+] / Ctrl+[: a heading one level deeper / up.
  - Ctrl+Up / Ctrl+Down: move it one place (a heading moves its whole chapter; a paragraph
    crosses into the chapter it meets).
  - Alt+M: move it into a chapter you pick in the contents (Escape: no).
  - Ctrl+Shift+V: paste as paragraphs (split at blank lines). Plain paste never splits.
- **Keys while writing**:
  - ArrowDown on the last line / ArrowUp on the first: the caret runs on into the next or
    previous paragraph.
  - Alt+Enter: split the paragraph at the caret. Backspace at its start: join it to the one
    before (never into a heading).
  - Ctrl+Alt+H: this paragraph a heading (a new one becomes a heading when Enter keeps it).
  - Ctrl+Shift+V: paste as paragraphs after this one.
- In every other mode, the book is a card as before (0.1): double-click opens it in the right dock.

## What it needs

- **Plugin API:** 3 · **oldest app:** 1.1.2

## What it saves

- Nothing outside the tables.

## How to check it works

1. `python build.py test` (`app/core/api/tests/book-editor.test.js`, `book-word.test.js`, `book.test.js`).
2. `python build.py pack-plugin book`, import `packed/book.traumplug` in Settings → Plugins, and
   open the sample `.traum` handed out with the stage: it opens on a room seen as Book.
3. Choose a paragraph, type, Enter: it lands right after it. Ctrl+Alt+H on it: a heading, in the
   contents. Ctrl+Alt+J: the docks.
