# Pictures

Pictures in a room, as a plugin: a small copy of the file (a JPEG, at most 720px a side, kept
with the room and with the account) and a caption under it.

- **Add** (right-click the canvas), the loose tray's **+**, or **Alt+I** picks a file; pasting or
  dropping a picture on a room does the same. Then the sheet asks for a caption (Enter keeps it).
- The **Editor** shows the caption, to change it.
- In a **.traum** file a picture is `## ^id picture: its caption`, then its address on one line (a
  `data:image/…` URL, or `https://…`, fetched when the file comes in).
- Switched **off**, every picture is kept exactly as it is: it shows as a quiet stand-in naming
  it, goes out to a .traum file under its own kind with its picture, and comes back whole when
  Pictures is on again. A .traum file read while Pictures is off keeps its pictures as they were
  written (the card says so) and writes them back out; read it again with Pictures on to see them.

It offers no service and sends no events. Saved data: none of its own (pictures are thoughts).

**The code.** It reaches the app only through the plugin API (`app/core/API.md`).

- `item.js`: the item kind (`app/core/world/items/index.js` says the shape): its fields, how Add
  makes one from a file (`add`, `takes`, `fromFile`), its words and how it shows.
- `Picture.js` adds the kind with `t.items.add`.
- `style.css`: a picture's layout on a canvas.
- `tests/picture.test.js`: the kind, and a room's pictures going out and back with the plugin on
  and off.
