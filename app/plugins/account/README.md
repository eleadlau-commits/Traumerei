# Account

Sign in with Google, and your settings follow you to every device.

## What it adds

- The **account page**, opened by the account button in the top bar and the menu's Account row
  (the framework's `account` slot). Its slot item also gives the page as two sections,
  `sections()` (*Sign in* and *Saving*, each `{ id, title, icon, body }`), which the pages feature
  shows as a page in the frame; it sends `account:changed` when the page should be drawn again.
  Signed out: **Sign in with Google**. Signed in: your name,
  email and photo, whether your settings are saved, and **Sign out**. The menu shows who is signed in.
- **Settings sync.** Signed in, everything the app saves (every feature's area except `account` and
  `folio`, the world's own keys, and never the `once` records) is kept in Firestore at `users/{uid}`
  as one packed text field, `settings`, with the time it was `updated`. This device keeps its own
  copy too, so the page works offline and signed out.
- **The world travels as moments.** The world and its moments log (`world/moments.js`) are never
  sent as settings. Each push sends the log's rows since the last push, as a batch
  `{ at, device, from, to, rows }` in `users/{uid}/moments` (cut so no batch outgrows a document);
  undos travel as the plain changes they made. On signing in or opening the page, the batches
  other devices sent since this one last looked are taken into the world and the log
  (`world.moments.absorb`): on each thing the latest word wins, and nothing taken in is this
  device's to undo. Rows taken in count as sent, so they never bounce. The account keeps every
  batch (compaction of the account's copy is for the carriers phase of the kernel plan).
  - Signing in to a **new** account gives it this device's settings and its whole world as a
    first batch.
  - Signing in to an account that **already has settings**: the account wins, and the page reloads
    so every feature uses them, with the moments taken in. The same happens when you open the
    page on a device whose settings are older than the account's, or when moments have arrived.
  - **Reload guard.** Opening the app can save things before the account is compared, so right
    after that reload the copies may differ again. Within a minute of an automatic reload the page
    never reloads again: it sends this device's copy up instead, and the account page says so.
  - Each change is sent up 1.5 s after the last one (sliders save on every move), and when the page closes.
- Signing out keeps this device's settings as they are.

## Setting it up

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → turn on **Google**. Under Settings → Authorized domains,
   add `eleadlau-commits.github.io`.
3. **Firestore Database** → Create database, then paste `extras/firestore.rules` into its Rules tab
   and publish. Each person can read and write only their own settings and moments.
4. **Project settings** → Your apps → add a **Web** app, and paste its `firebaseConfig` into
   `config.js`. The values are public; the rules are what keep settings private.
5. Run `python standalone.py`.

Until `config.js` has a project, the account page says accounts aren't set up yet, and nothing is
loaded from Google.

## How it's built

| File | What's in it |
|---|---|
| `Account.js` | The page, signing in and out, and sending settings up and down. Loads Firebase 11 from gstatic.com only once someone signs in (or was signed in last time). |
| `sync.js` | The rules: what stays on the device, packing settings to compare them, and what to do on signing in. |
| `config.js` | The Firebase project. |
| `extras/firestore.rules` | The database rules. |

It uses the framework's `storage.snapshot()`, `restore()` and `watch()`.

## In the desktop app

When `t.app.desktop` is true there is no sign-in (Google's sign-in popup can't open in the app's
window) and Firebase is never loaded: the page says the rooms are saved on this computer. Instead,
once a day it asks GitHub for the latest Release; a newer version is said once as a toast and stays
on the page under *Version* with a **Download** button (`t.ui.link`). Nothing installs itself.
Saved data: `checkedAt`, `latest` (the latest Release's version), `told` (the version last said).
