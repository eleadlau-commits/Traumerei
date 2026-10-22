// Light or dark. 'auto' follows the phone's setting; 'light' and 'dark' override it.
//
// Every dark style (the framework's, the app's theme and each feature's) is written inside
// @media (prefers-color-scheme: dark). So instead of keeping a second copy of them, this turns
// those rules on (dark), off (light), or back to following the phone (auto), and does the same
// for the theme-color tags that colour the phone's status bar.

export const APPEARANCES = [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']];

const DARK = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/g;
const LIGHT = /\(\s*prefers-color-scheme\s*:\s*light\s*\)/g;

// A media query rewritten for a mode: "(prefers-color-scheme: dark)" becomes "all" (always) or
// "not all" (never); other parts of the query stay. Auto gives the original back.
export function mediaFor(original, mode) {
  if (mode !== 'light' && mode !== 'dark') return original;
  const dark = mode === 'dark';
  // Each comma-separated query on its own: one that needs the other mode can never match.
  return original.split(',').map((query) => {
    const q = query.trim().replace(DARK, dark ? 'all' : 'NEVER').replace(LIGHT, dark ? 'NEVER' : 'all');
    return q.includes('NEVER') ? 'not all' : q;
  }).join(', ');
}

const originals = new WeakMap(); // rule or meta tag → its media before any change

function rewrite(rules, mode) {
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      if (!originals.has(rule)) originals.set(rule, rule.media.mediaText);
      const original = originals.get(rule);
      if (/prefers-color-scheme/.test(original)) rule.media.mediaText = mediaFor(original, mode);
    }
    if (rule.cssRules) rewrite(rule.cssRules, mode);
  }
}

export function applyAppearance(mode = 'auto') {
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a stylesheet from another site can't be read
    }
    rewrite(rules, mode);
  }
  for (const meta of document.querySelectorAll('meta[name="theme-color"][media]')) {
    if (!originals.has(meta)) originals.set(meta, meta.getAttribute('media'));
    meta.setAttribute('media', mediaFor(originals.get(meta), mode));
  }
  document.documentElement.dataset.appearance = mode;
}

// Applies the saved choice now, and again once the stylesheet has finished loading if it hadn't.
export function startAppearance(mode) {
  applyAppearance(mode);
  if (document.readyState !== 'complete') window.addEventListener('load', () => applyAppearance(mode), { once: true });
}
