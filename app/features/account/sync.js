// The rules for keeping saved settings and an account in step. No screen code and no Firebase,
// so they can be tested on their own.

// The areas that stay on the device: the account's own data and the framework's (which features
// are switched off here).
export const LOCAL_AREAS = ['account', 'folio'];

// The same settings in the same order, so two copies can be compared as text.
export function pack(settings) {
  const sorted = {};
  for (const k of Object.keys(settings).sort()) sorted[k] = settings[k];
  return JSON.stringify(sorted);
}

export function unpack(text) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    for (const v of Object.values(value)) if (typeof v !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

// What to do on signing in (or opening the page signed in), given the account's saved copy
// (null if it has none yet) and this device's:
//   'upload'  the account is new: give it this device's settings
//   'same'    nothing to do
//   'apply'   the account wins: take its settings and reload the page so they're used
// `justReloaded` is true when this page was reloaded to apply the account's settings less than
// RELOAD_GUARD ago. Then the device's copy is the account's plus whatever opening the app saved
// (a day's record, a last visit), so it is sent up instead: never a second reload, never a loop.
export const RELOAD_GUARD = 60 * 1000; // ms

export function decide(cloud, local, justReloaded = false) {
  if (cloud == null) return 'upload';
  if (pack(cloud) === pack(local)) return 'same';
  return justReloaded ? 'upload' : 'apply';
}

// True if the last automatic reload (a time in ms, or null) was less than RELOAD_GUARD before `now`.
export function reloadedRecently(at, now) {
  return at != null && now - at >= 0 && now - at < RELOAD_GUARD;
}
