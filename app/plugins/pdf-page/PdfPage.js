// PDF page: a kind of thought that shows one page of a PDF, picked as a file (or dropped on the
// room); its page number is written in the sheet.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing else:
// the PDF is kept in the mark itself, as a data URL.
import { Feature } from 'folio';

const asUrl = (file) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => no(r.error); r.readAsDataURL(file); });
const pageOf = (v) => Math.max(1, Math.floor(+String(v ?? '').trim()) || 1);
export const KIND = {
  kind: 'pdf-page', name: 'PDF page',
  tidy: (f, h) => (typeof f.src === 'string' && f.src.startsWith('data:application/pdf') ? { src: f.src, page: String(pageOf(f.page)), name: h.oneLine(f.name) } : null),
  text: (th) => `${th.name || 'PDF'}, page ${pageOf(th.page)}`,
  node: (th, el) => el('div', { class: 'pdf-kind' }, el('object', { data: `${th.src}#page=${pageOf(th.page)}`, type: 'application/pdf', width: '320', height: '420' }, `${th.name || 'PDF'}, page ${pageOf(th.page)}`)),
  fields: [{ key: 'page', type: 'line', label: 'Page' }, { key: 'name', type: 'line', label: 'Name' }],
  add: { note: 'A page of a PDF', file: 'application/pdf' },
  takes: (file) => file?.type === 'application/pdf',
  fromFile: async (file) => ({ src: await asUrl(file), page: '1', name: file.name.replace(/\.pdf$/i, '') }),
  label: (th) => `${th.name || 'PDF'}, page ${pageOf(th.page)}`,
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class PdfPage extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
