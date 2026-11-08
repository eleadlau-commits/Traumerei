// Table: a kind of thought written as lines, cells split by | (or tabs, or commas when there is
// no |); the first line is the head.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export function cells(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^\|?[\s:|-]+\|?$/.test(l));
  const sep = lines.some((l) => l.includes('|')) ? '|' : lines.some((l) => l.includes('\t')) ? '\t' : ',';
  return lines.map((l) => l.replace(/^\||\|$/g, '').split(sep).map((c) => c.trim()));
}
export const KIND = {
  kind: 'table', name: 'Table',
  tidy: (f, h) => { const text = h.lines(f.text); return text && cells(text).length ? { text } : null; },
  text: (th) => cells(th.text).map((r) => r.join(' ')).join('\n'),
  node: (th, el) => { const [head = [], ...body] = cells(th.text); return el('table', { class: 'table-kind' }, el('thead', {}, el('tr', {}, ...head.map((c) => el('th', {}, c)))), el('tbody', {}, ...body.map((r) => el('tr', {}, ...r.map((c) => el('td', {}, c)))))); },
  fields: [{ key: 'text', type: 'text', label: 'Rows (cells split by |)' }],
  add: { note: 'Rows and columns' },
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class Table extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
