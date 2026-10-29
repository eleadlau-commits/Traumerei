# Account

Sign in with Google, and your settings follow you to every device.

## What it adds

- The **account page**, opened by the account button in the top bar and the menu's Account row
  (the framework's `account` slot). Signed out: **Sign in with Google**. Signed in: your name,
  email and photo, whether your settings are saved, and **Sign out**. The menu shows who is signed in.
- **Settings sync.** Signed in, everything the app saves (every feature's area except `account` and
  `folio`, and never the `once` records) is kept in Firestore at `users/{uid}` as one packed text
  field, `settings`, with the time it was `updated`. This device keeps its own copy too, so the page
  works offline and signed out.
  - Signing in to a **new** account gives it this device's settings.
  - Signing in to an account that **already has settings**: the account wins, and the page reloads
    so every feature uses them. The same happens when you open the page on a device whose
    settings are older than the account's.
  - Each change is sent up 1.5 s after the last one (sliders save on every move), and when the page closes.
- Signing out keeps this device's settings as they are.

## Setting it up

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → turn on **Google**. Under Settings → Authorized domains,
   add `eleadlau-commits.github.io`.
3. **Firestore Database** → Create database, then paste `extras/firestore.rules` into its Rules tab
   and publish. Each person can read and write only their own settings.
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
