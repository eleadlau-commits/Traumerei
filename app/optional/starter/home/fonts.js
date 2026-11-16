// The typefaces the home page can be set in. The first is the default.
//
// Each entry: { id, name, family, files?: [{ src, weight?, style?, family?, range? }] }
//   family  the CSS font-family to use, with fallbacks
//   files   font files to load (data: URLs or paths); leave out for fonts already on the device.
//           A file's own `family` names its face (else the first name in `family`), and `range`
//           limits it to some characters (a CSS unicode-range).
//
// To add a font (for example Traumerei Sans once it's ready): put its .woff2 in fonts/ as a
// data: URL module like tenor-sans.js, import it here, and add an entry. To make it the default,
// put it first.

import tenorSans from './fonts/tenor-sans.js';
import umlautDots from './fonts/umlaut-dots.js';
import * as serif from './fonts/source-serif-4.js';

export const FONTS = [
  {
    id: 'tenor-sans',
    name: 'Tenor Sans',
    // Traumerei Dots first: Tenor Sans's own Ä and ä, with the dots wide enough to read small.
    family: '"Traumerei Dots", "Tenor Sans", "Optima", "Candara", sans-serif',
    files: [
      { src: tenorSans, weight: '400', family: 'Tenor Sans' },
      { src: umlautDots, weight: '400', family: 'Traumerei Dots', range: 'U+00C4, U+00E4' },
    ],
  },
  {
    id: 'system',
    name: 'System',
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
];

export const DEFAULT_FONT = FONTS[0].id;

// The reading face, for thoughts (folio/runtime/base.css names it --font-read). Always loaded.
export const READING = {
  id: 'source-serif-4',
  name: 'Source Serif 4',
  family: '"Source Serif 4", Georgia, serif',
  files: [{ src: serif.regular, weight: '400' }, { src: serif.italic, weight: '400', style: 'italic' }, { src: serif.semibold, weight: '600' }],
};

export function findFont(id) {
  return FONTS.find((f) => f.id === id) || FONTS[0];
}

// Loads a font's files once (later calls reuse the first), then resolves.
const loaded = new Map();
export function loadFont(font) {
  if (!font.files?.length || typeof FontFace === 'undefined') return Promise.resolve();
  if (!loaded.has(font.id)) {
    const name = font.family.split(',')[0].trim().replace(/^["']|["']$/g, '');
    loaded.set(font.id, Promise.all(font.files.map(async (f) => {
      const face = new FontFace(f.family || name, `url(${f.src})`, {
        weight: f.weight || '400', style: f.style || 'normal', display: 'swap', ...(f.range ? { unicodeRange: f.range } : {}) });
      document.fonts.add(await face.load());
    })).catch(() => {}));
  }
  return loaded.get(font.id);
}
