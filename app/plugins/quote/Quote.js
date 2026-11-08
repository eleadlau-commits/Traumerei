// Quote: a kind of thought holding someone else's words and where they come from.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export const KIND = {
  kind: 'quote', name: 'Quote',
  tidy: (f, h) => { const text = h.lines(f.text); return text ? { text, source: h.oneLine(f.source) } : null; },
  text: (th) => (th.source ? `${th.text} (${th.source})` : th.text || ''),
  node: (th, el) => el('figure', { class: 'quote-kind' }, el('blockquote', {}, th.text || ''), th.source ? el('figcaption', {}, `— ${th.source}`) : null),
  fields: [{ key: 'text', type: 'text', label: 'Words' }, { key: 'source', type: 'line', label: 'Source' }],
  add: { note: 'Someone else\'s words, with where they come from' },
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class Quote extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
