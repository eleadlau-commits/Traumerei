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
  normal, wide), A chapter starts a page (on), Pages side by side (fix Columns or Rows, and how
  many: 1, 2, 3, 4 or 6; Columns 1 by default, one under another), Column (Narrow, Book, Wide;
  without pages).
- **Pages side by side** (with pages): fix the columns and that many pages sit across, the rows
  following as many as the book needs; two columns (or four, or six) pair them as facing pages,
  the title page alone on the right as a recto, a narrow gutter between the two. Fix the rows and
  that many pages run down, the columns following, so the book reads left to right as a strip (a
  shelf, zoomed out). Only where each page sits changes, never what is on it; margin notes go in
  the outer margin (left of a left-hand page of a spread). In the right dock (Fix: Columns ·
  Rows; How many: 1 · 2 · 3 · 4 · 6) or by keys, in a room seen as Book: Alt+= one more, Alt+-
  one fewer, Alt+G columns or rows. Printing and the Word document stay one page to a sheet.
- **Zoom** (`zoom.js`): far off (under 0.5), the book is a shelf of page thumbnails: the body as
  quiet lines, each chapter's title large on its first page and at the head of the pages after.
  Far off, a double-click on a page goes to it, the page filling the height (in a spread, both
  pages when they fit). A click on a chapter in the contents brings its first page into view.
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
- **Drag on the pages** (`flowdrop.js`, the rule's `drop`): let a paragraph go between two rows
  and it moves there (the row under it, before or after by its half; a piece of a paragraph that
  runs on counts as its paragraph), within its chapter or into another, on any page of the grid or
  spread, or in the one column of Pages: None (`{ join, at, from }`, one step with the gesture).
  Onto a heading: first in that chapter. A heading dragged carries its whole chapter (onto another
  heading's top half, or the space above it: before that chapter, at its level; never into
  itself or a section it holds). Under the last page, among the thoughts not yet in the book: out
  of the book. Into the outer margin beside a paragraph: a margin note on it; a note dragged back
  into the flow is a paragraph there again, or beside another paragraph, a note on that one. Out
  of the book and into or out of the margin are done by the plugin just after the gesture (no
  proposal leaves a group or links a note), still one step, one Ctrl+Z. Let go where it is, or
  nudged within its own row: nothing. The keys stay as they are.
- **Keys while writing**:
  - ArrowDown on the last line / ArrowUp on the first: the caret runs on into the next or
    previous paragraph.
  - Alt+Enter: split the paragraph at the caret. Backspace at its start: join it to the one
    before (never into a heading).
  - Ctrl+Alt+H: this paragraph a heading (a new one becomes a heading when Enter keeps it).
  - Ctrl+Shift+V: paste as paragraphs after this one.
- In every other mode, the book is a card as before (0.1): double-click opens it in the right dock.

## Book · blocks

A sibling rule (`book-blocks`, order 31, `blocks.js`): Arrange by → Book · blocks, or Tab from
Book. The same book as a board, in reading order a row at a time:

- every paragraph a block of up to four lines in a thin frame; one still to write in a dashed
  frame marked "to write"; its margin notes under it, in its frame;
- each chapter a dotted outline around its blocks and sections, each section one inside it, the
  heading on the outline's top (its number on the left, its words on the right); zoomed out, the
  headings read large (the far band): the corkboard;
- below the book, the tray: the room's thoughts not yet in it.
- **Drag** a block between two others: it moves there, into that chapter when the outline is
  another's (`{ join, at, from }`, one step). Onto an outline's top: to the end of that chapter.
  A heading dragged moves its whole chapter (never into itself). Into the tray: out of the book.
  A margin note stays a note (Alt+N). Let go inside its own block: nothing.
- The keys on the structure work here too (Ctrl+Alt+H, Ctrl+] / Ctrl+[, Ctrl+Up / Ctrl+Down,
  Alt+N, Alt+M, Ctrl+Shift+V), and the docks stay open (the column is not fitted). Enter after a
  chosen block lands the new paragraph right after it.
- Blocks across (2, 3, 4 by default, 6 or 8), its one setting: in the right dock, or Alt+= and
  Alt+- in a room seen as Book · blocks.
- No other settings; the frames and outlines are the room's boxes (plain, shelf, quiet; the
  plugin's style gives the quiet ones a dotted line in this mode only).

## What it needs

- **Plugin API:** 3 · **oldest app:** 1.1.2

## What it saves

- Nothing outside the tables.

## How to check it works

1. `python build.py test` (`app/core/api/tests/book-editor.test.js`, `book-drag.test.js`, `book-word.test.js`, `book.test.js`).
2. `python build.py pack-plugin book`, import `packed/book.traumplug` in Settings → Plugins, and
   open the sample `.traum` handed out with the stage: it opens on a room seen as Book.
3. Choose a paragraph, type, Enter: it lands right after it. Ctrl+Alt+H on it: a heading, in the
   contents. Ctrl+Alt+J: the docks.
