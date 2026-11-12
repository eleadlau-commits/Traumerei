# Plugin store

Where each plugin keeps what is its own on this computer, never in a `.traum` file (Law 8: the file
is the six tables). A plugin reaches it as `t.store` (app/core/API.md); the app's own features use
the `store` service.

- `Store.js`: the feature; asks the person before a download, with its size.
- `keeper.js`: one plugin's store (small state, files with a quota, downloads).
- `backends.js`: where files live: the Windows app's data folder through its store commands
  (`desktop/src-tauri/src/store.rs`, `%APPDATA%\app.traumerei.desktop\plugins\<id>\`), the browser's
  origin private file system (`plugins/<id>/`), or memory.

## The `store` service

| Member | What it is |
|---|---|
| `for(id)` | that plugin's store: `get`, `set`, `remove`, `keys`, `clear`, `files` (as `t.store`) |
| `backend` | `desktop`, `opfs` or `memory` |
| `used(id)` | bytes its files take |
| `clear(id)` | takes its files and small state away |
| `size(bytes)` | the size in words (274 MB) |

Saved data: small state in the storage area `store.<id>.`; files in the backend.
