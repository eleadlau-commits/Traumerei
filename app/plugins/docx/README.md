# Word document

A format that takes a room out as a Word document (`.docx`), in reading order: each group's title
as a heading with its parts in order, then the loose marks, oldest first. A thought's spans come out
as bold, italic, underline and strike; a `table` mark as a table; a `figure` as its picture and
caption. It offers itself in the room's ⋯ More beside the room file's own Export.

A corpus plugin (open core, step 5): written against `app/core/API.md` alone, run through the
conformance suite, off and left out of the product. `zip.js` writes the file (stored, no
compression).

- **What it adds:** a format `docx` (`slots.formats`, `exportRoom` only).
- **What it needs:** the plugin API.
- **What it saves:** nothing.
- **Check it:** `python build.py test`, then switch it on in Settings → Plugins (`python standalone.py --corpus`) and open the file in Word.
