// First letters: every word's first letter drawn bold, in every thought. A decorator: it only says
// how words are drawn and never changes them (nothing is kept, so switching it off leaves every
// thought as it was). A corpus plugin (open core, step 2): written against app/core/API.md alone.
import { Feature } from 'folio';

// The ranges to draw: each word's first letter.
export function firsts(text) {
  const out = [];
  for (const m of String(text).matchAll(/[\p{L}\p{N}]+/gu)) out.push({ from: m.index, to: m.index + 1, class: 'bold' });
  return out;
}

export function install(t) {
  t.slots.decorators.add({ id: 'first-letters', decorate: (text) => firsts(text) });
}

export default class FirstLetters extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
