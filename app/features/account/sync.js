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
export function decide(cloud, local) {
  if (cloud == null) return 'upload';
  return pack(cloud) === pack(local) ? 'same' : 'apply';
}
