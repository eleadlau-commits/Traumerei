// The key map's rules, with nothing of the page in them: reading a key written as words
// ("Ctrl+Alt+E"), telling whether a key press is that key, writing it for the screen, and finding
// two actions that share a key. Keys.js uses these; tests/keymap.test.js checks them.
//
// How a key is written: modifiers, then the key, joined by "+": "Ctrl+K", "Ctrl+Shift+Z",
// "Ctrl+Alt+E", "Delete", "PageUp", "?". "Ctrl" means Ctrl, or Cmd on a Mac, as everywhere in
// the app. A letter or digit is matched by where it is on the keyboard (so Alt+E still counts on a
// Mac, where Alt changes the letter); any other key by what it types or its name. A key that is a
// sign ("?", "+") ignores Shift, since Shift is how it is typed.

const MODS = ['ctrl', 'alt', 'shift'];

// "Ctrl+Alt+E" → { ctrl: true, alt: true, shift: false, key: 'e' }, or null when it isn't a key.
export function parse(combo) {
  if (typeof combo !== 'string' || !combo.trim()) return null;
  const parts = combo.trim().split('+');
  // "Ctrl++" (the plus key) splits into a trailing empty part: put the plus back.
  if (parts.length > 1 && parts[parts.length - 1] === '' ) { parts.pop(); parts[parts.length - 1] = '+'; }
  const key = parts.pop();
  if (!key) return null;
  const k = { ctrl: false, alt: false, shift: false, key: key.length === 1 ? key.toLowerCase() : key };
  for (const p of parts) {
    const m = p.trim().toLowerCase();
    const name = m === 'cmd' || m === 'meta' ? 'ctrl' : m === 'option' ? 'alt' : m;
    if (!MODS.includes(name)) return null;
    k[name] = true;
  }
  return k;
}

const isSign = (key) => key.length === 1 && !/[a-z0-9]/i.test(key);

// The same key written one way, so two spellings of it compare equal ("ctrl+alt+e").
export function normal(combo) {
  const k = parse(combo);
  if (!k) return null;
  return [...MODS.filter((m) => k[m] && !(m === 'shift' && isSign(k.key))), k.key.toLowerCase()].join('+');
}

// Whether a keydown event is this key. AltGr (Ctrl+Alt on some keyboards, which types € and
// such) never counts as Ctrl+Alt.
export function matches(combo, e) {
  const k = typeof combo === 'string' ? parse(combo) : combo;
  if (!k || !e) return false;
  if (e.getModifierState?.('AltGraph')) return false;
  const ctrl = !!(e.ctrlKey || e.metaKey);
  if (ctrl !== k.ctrl || !!e.altKey !== k.alt) return false;
  if (isSign(k.key)) return e.key === k.key;
  if (!!e.shiftKey !== k.shift) return false;
  if (/^[a-z]$/.test(k.key)) return e.code ? e.code === `Key${k.key.toUpperCase()}` : (e.key || '').toLowerCase() === k.key;
  if (/^[0-9]$/.test(k.key)) return e.code ? e.code === `Digit${k.key}` : e.key === k.key;
  return (e.key || '').toLowerCase() === k.key.toLowerCase();
}

// The key as the screen shows it: "Ctrl+Alt+E", or "⌘⌥E" on a Mac.
export function label(combo, mac = false) {
  const k = parse(combo);
  if (!k) return combo || '';
  const key = k.key.length === 1 ? k.key.toUpperCase() : k.key;
  if (mac) return `${k.ctrl ? '⌘' : ''}${k.alt ? '⌥' : ''}${k.shift && !isSign(k.key) ? '⇧' : ''}${key}`;
  return [k.ctrl && 'Ctrl', k.alt && 'Alt', k.shift && !isSign(k.key) && 'Shift', key].filter(Boolean).join('+');
}

// Two places' keys can clash when the places can be live at once: the same place, or either is
// 'everywhere'.
export const overlaps = (a, b) => a === b || a === 'everywhere' || b === 'everywhere';

// Every pair of entries that share a key in places that overlap: [{ key, a, b }] by entry id.
// An entry is { id, keys: [combo…], zone }; entries without keys (a click, "type anywhere") are
// left alone.
export function clashes(entries) {
  const seen = [];
  const found = [];
  for (const entry of entries) {
    const zone = entry.zone || 'everywhere';
    for (const combo of entry.keys || []) {
      const key = normal(combo);
      if (!key) continue;
      for (const s of seen) if (s.key === key && s.id !== entry.id && overlaps(s.zone, zone)) found.push({ key, a: s.id, b: entry.id });
      seen.push({ key, id: entry.id, zone });
    }
  }
  return found;
}
