# Book

A book editor in any room. Seen as **Book** (Mode → Book, or Tab), the room is the book set on
pages (A4, Letter, A5 or 6 × 9, or one column without pages): a title page, each chapter on a
new page with its heading dropped, its sections with numbered headings, its paragraphs in order,
running on from page to page; page numbers at the foot and the chapter's title at the head; margin
notes beside the page; and after the last page, the room's thoughts not yet in the book. You write in it as in any room:
Enter keeps a paragraph and it lands right after the one you were on, in its chapter. While it
is being written, the lines below move down to make room for it (`reads.marks.draft`), page by
page too.

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
  the left margin. Headings step down in size as they nest, as a book sets them (`column.js`
  `HEAD_SCALE`: 1.45, 1.2 and 1.05 of the reading size), and each heading's row is laid out that
  tall, so the pages break where the room draws them; the Word document (17.5, 14.5, 12.5 pt),
  print, Book · blocks' outline labels and the far band step the same way. The number hangs in
  the margin set flush right in a box that ends half a line before the heading, as wide as the
  number needs (`numBox`), so a deep one (12.10.3) grows into the margin, never into the words.

## What it adds

- **Mode Book** (rule `book-page`, order 30). Its settings, per room (the ⚙ beside Book in the
  rail): Pages (A4 by default, Letter, A5, 6 × 9 in, or None: one column), Margins (narrow,
  normal, wide), A chapter starts a page (on), Pages side by side (fix Columns or Rows, and how
  many: 1, 2, 3, 4 or 6; Columns 1 by default, one under another), Column (Narrow, Book, Wide;
  without pages).
- **Type size** (0.4.5; the ⚙ beside Book, the right dock, or Alt+Shift+= / Alt+Shift+-, in
  Book and Book · blocks): 70%, 80%, 90%, 100%, 110% or 125%. The words, the headings at each
  level, the line spacing, the space between paragraphs and the margin numbers get smaller or
  larger together, so the proportions hold and more (or less) fits on a page. The page size and
  margins stay. The room draws words at one size, so the book is laid out with the page, its
  margins, the column and a block on the board as many times larger as the type is smaller
  (`column.js` `typeOf`). The dock and the keys change the zoom by as much, so the page keeps its
  size on the screen and the words shrink or grow on it. The Word document (`stylesFor`) and print
  set the type itself at that size. Kept per room under the rule (`type`).
- **Pages side by side** (with pages): fix the columns and that many pages sit across, the rows
  following as many as the book needs; two columns (or four, or six) pair them as facing pages,
  the title page alone on the right as a recto, a narrow gutter between the two. Fix the rows and
  that many pages run down, the columns following, so the book reads left to right as a strip (a
  shelf, zoomed out). Only where each page sits changes, never what is on it; margin notes go in
  the outer margin (left of a left-hand page of a spread). In the right dock (Fix: Columns ·
  Rows; How many: 1 · 2 · 3 · 4 · 6) or by keys, in a room seen as Book: Alt+= one more, Alt+-
  one fewer, Alt+G columns or rows. Printing and the Word document stay one page to a sheet.
- **Zoom** (`zoom.js`): far off (under 0.5), the book is a shelf of page thumbnails: the body as
  quiet lines, each chapter's title large on its first page and at the head of the pages after; a heading's
  words far off stay on one line, cut short with … at the page's measure.
  Far off, a double-click on a page goes to it, the page filling the height (in a spread, both
  pages when they fit). A click on a chapter in the contents brings its first page into view.
  Going there is one move: the view slides and zooms together (eased, 260–520 ms; at once when
  the system asks for less motion), the heading chosen without opening the room again, so the
  right dock keeps the Book tab.
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
- **Docks**, Ctrl+Alt+J in a room seen as Book (or Tools → Book; again hides them). The left
  dock is left as Book found it: when only the room's Loose strip showed there, closing the
  contents (× or Tools → Book) hides the dock again rather than leaving the Loose tray open.
  On a **Twin** with a side seen as Book (`side.js`), the docks stay while you work on the other
  half, still about the book (nothing of the other side is in hand; thoughts from there can't yet
  be dropped on a chapter), so switching sides never moves the canvas. The first time the Book
  side is live it is placed on its own half and zoomed out, if it must be, to fit it, margin
  numbers and all (core opens a Twin measuring the whole canvas: core-gaps.md 15):
  - left, **Contents**: chapters and sections numbered as they nest, their pages, words and
    open gaps for each; the chapter you are in is lit; a click goes to its heading. **Drag a
    line** onto another (`treedrop.js`, one step, Ctrl+Z takes it back): its top third puts it
    before that chapter, its foot after it (into it before its first section, when it has
    sections: the line under it), its middle into it as its last section; a rule above or below,
    or the line lit, shows where it lands while it is held. Across chapters as well as among
    siblings, the chapter's paragraphs and sections coming with it. Never into itself or a chapter
    it holds, never deeper than three levels (a line it may not go on is struck faint; let go
    there, it says why). Thoughts dragged from the canvas onto a line join that chapter, at the
    end of its own paragraphs (before its first section), as Alt+M does. The keys do the same:
    Ctrl+Up / Ctrl+Down, Ctrl+] / Ctrl+[, Alt+M.
  - right, **Book**: the title (rename it there), paragraphs, words and what is still open; the
    chapter (its Title, typed or emptied; Numbered · Unnumbered; its keys), paragraph (its page,
    its notes, and its chapter's Title and numbering) or note in hand; Export Markdown, Word document,
    Print or PDF (both at the room's page size and margins, a chapter on a new page).
  - the column is zoomed out, if it must be, to fit the canvas between the docks (on a Twin, its half).
- **Keys on the chosen paragraph** (room seen as Book):
  - Ctrl+Alt+H: make it a heading at the level of the one it sits under, right after that one: a
    paragraph of chapter 3 becomes chapter 4, one of section 3.1 section 3.2, taking with it what
    follows it there (one directly in the book, before any chapter, becomes a chapter, gathering up
    to the next chapter). Headings made one after another never nest; Ctrl+] makes one a section of
    the one before. Again: a paragraph, read on at the end of the chapter (or section) before it.
  - Ctrl+] / Ctrl+[: a heading one level deeper / up.
  - Ctrl+Up / Ctrl+Down: move it one place (a heading moves its whole chapter; a paragraph
    crosses into the chapter it meets).
  - Alt+M: move it into a chapter you pick in the contents (Escape: no): a paragraph at the end
    of that chapter's own paragraphs, a chapter as its last section.
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
- **Writing: click anywhere in a chapter to write there** (`slots.js`, the rule's `draw` and
  `land`). Click the blank space after a chapter's last paragraph (down to the next heading, or
  the page's foot when the next chapter starts a page), the space right under an empty chapter's
  heading, or the gap between two paragraphs (or a heading and its first paragraph): a caret
  blinks there (a slot, an invisible box of the rule, chosen as any box is; between two
  paragraphs a faint rule across the gap and the caret just left of the column). Type: the words
  appear in place, under the heading or paragraph above, and the lines below make room. Enter
  keeps the paragraph exactly there, in that chapter or section, as one step (one Ctrl+Z), and the
  caret goes on under it, so paragraph after paragraph is typed in order. An empty chapter (or an
  empty book) says "Click here, or choose a paragraph, and type" in that space. It says nothing while a paragraph is being typed anywhere in the room (`reads.marks.draft`), and comes back once it is kept or dropped. Choosing a
  paragraph and typing works as before: the new one lands right after it. A click on the caret's
  own slot keeps it. Far off (the shelf of pages) the slots take no clicks, so a double-click
  still goes to a page; paragraphs, headings and margin notes stay on top of the slots, so
  choosing and dragging are as before. Works on pages (pieces, grids and spreads) and with Pages:
  None. The room has no API word for the box chosen, so the plugin reads it off the canvas (as
  `zoom.js` does) and, for the moment a key begins the paragraph, chooses the mark above the slot
  so the room draws the words under it (core gap 11 in the project's notes).
- **Keys while writing**:
  - ArrowDown on the last line / ArrowUp on the first: the caret runs on into the next or
    previous paragraph.
  - Alt+Enter: split the paragraph at the caret. Backspace at its start: join it to the one
    before (never into a heading).
  - Ctrl+Alt+H: this paragraph a heading, at the level of the one it sits under (a new one becomes
    a heading when Enter keeps it).
  - Ctrl+Shift+V: paste as paragraphs after this one.
- In every other mode, the book is a card as before (0.1): double-click opens it in the right dock.

## Book · blocks

A sibling rule (`book-blocks`, order 31, `blocks.js`): Arrange by → Book · blocks, or Tab from
Book. The same book as a board, in reading order a row at a time:

- every paragraph a block of up to four lines in a thin frame; one still to write in a dashed
  frame marked "to write"; its margin notes under it, in its frame;
- **each chapter a block holding blocks** (nested blocks): a heavier frame with a faint wash,
  its heading on top (its number on the left, its words on the right, its words count at the far
  right), its paragraph blocks inside it, N across, and its sections as blocks inside it in
  reading order among its paragraphs, each spanning the chapter's width and holding theirs, three
  levels deep. Zoomed out, the headings read large (the far band): the corkboard;
- below the book, the tray: the room's thoughts not yet in it.
- **Drag** a block between two others: it moves there, into that chapter when the block is
  another chapter's (`{ join, at, from }`, one step). Onto a chapter block's top: to its end.
  **Drag a chapter block by its heading** into another chapter block: it nests there, where it
  is let go (between two of its blocks, or at its end on its top), its paragraphs and sections
  with it; between blocks at any level, it moves there. Let go inside its own block: nothing.
  Never deeper than three levels, with the sections it brings ("A book goes three levels deep",
  said, and nothing moves). Into the tray: out of the book. A margin note stays a note (Alt+N).
- **Choose a chapter's frame** (a tap on its block, outside the blocks in it): it is the chapter in
  hand, even an unnamed one with no heading to choose; Ctrl+Up / Ctrl+Down, Ctrl+] / Ctrl+[,
  Alt+C, Alt+Shift+C, Alt+Shift+H and Alt+U act on it, and the right dock shows it.
- The keys on the structure work here too (Ctrl+Alt+H, Ctrl+] / Ctrl+[, Ctrl+Up / Ctrl+Down,
  Alt+N, Alt+M, Ctrl+Shift+V), and the docks stay open (the column is not fitted). Enter after a
  chosen block lands the new paragraph right after it.
- Blocks across (2, 3, 4 by default, 6 or 8), its one setting: in the right dock, or Alt+= and
  Alt+- in a room seen as Book · blocks.
- No other settings; the frames are the room's boxes (plain, shelf, quiet; the plugin's style
  frames the quiet ones, the chapter blocks, heavier, in this mode only).

## Chapters: named or unnamed, numbered or unnumbered (`nest.js`)

In Book and Book · blocks alike (the chapter in hand: a chosen heading's chapter, a chosen
chapter block's, or the chosen paragraph's own chapter). Each is one step, one Ctrl+Z.

- **Unnamed**: a chapter with no heading thought and an empty title. In Book · blocks a block with
  no title (its number alone, or with no number a faint frame, "unnamed" at its right); in Book a
  break with its number and no heading words (or `* * *` with neither); in the contents its number
  alone, or "(untitled)"; in Markdown and Word a heading of its number alone (or `* * *`).
  - **Alt+C**: an unnamed chapter around the chosen block(s) (Shift+click for several, side by
    side in one chapter), where the first of them was; a chosen chapter block is wrapped too.
  - **Alt+Shift+C**: a new, empty, unnamed chapter at the end of the chapter in hand (nothing in
    hand: at the end of the book).
  - **Name it**: Ctrl+Alt+H (or Alt+Shift+H) on the first paragraph of a chapter with no heading
    makes it that chapter's heading, the chapter kept where it is; or type its **Title** in the
    right dock (a heading thought is made with those words, or the heading's words change).
  - **Unname it**: Alt+Shift+H: its heading back to a paragraph (first in the chapter), its title
    emptied, the chapter and everything in it kept; or empty the dock's Title.
- **Unnumbered** (the chapter's own field `numbered: false`, kept in the tables through
  `slots.groups` `fields`, so it travels in a `.traum` file): no number, and skipped in its
  siblings' numbering, as LaTeX's starred sections (Preface, 1, 2, Interlude, 3); the sections in
  it are unnumbered with it. Everywhere numbers are read: the Book view, Book · blocks, the
  contents, the old card's dock, Markdown and the Word document. **Alt+U**, or the right dock's
  Chapter in hand: Numbered · Unnumbered.
- Never deeper than three levels: Alt+C and Alt+Shift+C refuse in words where it would not fit.

## What it needs

- **Plugin API:** 3 · **oldest app:** 1.1.2

## What it saves

- Nothing outside the tables.

## How to check it works

1. `python build.py test` (`app/core/api/tests/book-editor.test.js`, `book-blocks.test.js`, `book-nest.test.js`, `book-drag.test.js`, `book-slots.test.js`, `book-twin.test.js`, `book-headings.test.js`, `book-type.test.js`, `book-tree.test.js`, `book-word.test.js`, `book.test.js`).
2. `python build.py pack-plugin book`, import `packed/book.traumplug` in Settings → Plugins, and
   open the sample `.traum` handed out with the stage: it opens on a room seen as Book.
3. Choose a paragraph, type, Enter: it lands right after it. Ctrl+Alt+H on it: a heading, in the
   contents. Ctrl+Alt+J: the docks.
