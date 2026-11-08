// Code block: a kind of thought holding code, kept exactly as written, in a fixed-width face.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export const KIND = {
  kind: 'code', name: 'Code',
  tidy: (f, h) => { const code = typeof f.code === 'string' ? f.code.replace(/\s+$/, '') : h.lines(f.text); return code ? { code, lang: h.oneLine(f.lang) } : null; },
  text: (th) => th.code || '',
  node: (th, el) => el('pre', { class: 'code-kind', 'data-lang': th.lang || null }, el('code', {}, th.code || '')),
  fields: [{ key: 'code', type: 'text', label: 'Code' }, { key: 'lang', type: 'line', label: 'Language' }],
  add: { note: 'Code, kept as written' },
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class CodeBlock extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
