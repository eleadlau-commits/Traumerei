// Export: a room leaves as words. "Export as Markdown" (⋯ More, or Ctrl+Shift+E in a room) hands
// out the open room as a .md file in the room's own order (rules.js): headings, lists, cards, open
// gaps marked, maths kept as TeX. "Print or save as PDF" (⋯ More, or Ctrl+P in a room) prints a
// clean page of the same outline, maths drawn: the print dialog's "Save as PDF" makes the PDF, so
// no PDF library is shipped. Step 7 of the handbook: export when nothing is open.
//
// A plugin. It reaches the app only through the plugin API (app/core/API.md): t.carriers.tables
// to read the room, t.ui.files.save to hand the file out (Windows' Save dialog in the desktop app,
// a download in the browser), t.parts.maths to draw formulas on the printed page. Saved data: none.

import { Feature, ui } from 'folio';
import { outline, markdown, fileName } from './rules.js';

export function install(t) {
  const room = () => t.ui.chosen()?.context || null;
  const shape = (id) => outline(t.carriers.tables(id), id);
  const toMarkdown = async () => {
    const id = room(); if (!id) return;
    const o = shape(id);
    const saved = await t.ui.files.save(fileName(o.title, 'md'), markdown(o), 'text/markdown');
    if (saved && o.open) t.ui.toast(`Exported, with ${o.open} ${o.open === 1 ? 'gap' : 'gaps'} still open`);
  };
  t.slots.commands.add({ id: 'export.markdown', keys: ['Ctrl+Shift+E'], zone: 'room', order: 68, words: 'Export this room as Markdown (.md)',
    when: () => !!room(), run: toMarkdown });
  t.slots.more.add({ id: 'export-markdown', label: 'Export as Markdown', order: 22, visible: () => !!room(), run: toMarkdown,
    icon: '<path d="M4 6h16v12H4zM7 15V9l3 3 3-3v6M16 9v6m-2-2 2 2 2-2"/>', title: () => 'Export this room as a Markdown file, in its own order' });
  const toPaper = () => {
    const id = room(); if (!id || typeof document === 'undefined') return;
    printPage(page(t, shape(id)));
  };
  t.slots.commands.add({ id: 'export.print', keys: ['Ctrl+P'], zone: 'room', order: 69, words: 'Print this room, or save it as PDF',
    when: () => !!room(), run: toPaper });
  t.slots.more.add({ id: 'export-print', label: 'Print or save as PDF', order: 23, visible: () => !!room(), run: toPaper,
    icon: '<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3"/><path d="M7 14h10v6H7z"/>', title: () => 'Print this room as a clean page; choose Save as PDF in the dialog for a PDF' });
  return { shape };
}

// The printed page of an outline: a node, its formulas drawn when maths has loaded.
export function page(t, o) {
  const { el } = ui;
  const words = (text) => { const out = t.parts?.maths?.maths ? t.parts.maths.maths(text) : text; return [].concat(out); };
  const tag = (g) => (g?.state === 'open' ? [el('span', { class: 'export-open' }, `Open, ${g.why}`), ' '] : []);
  const nodes = [el('h1', {}, o.title)];
  if (o.open) nodes.push(el('p', { class: 'export-left' }, `${o.open === 1 ? 'One gap is' : `${o.open} gaps are`} still open.`));
  let list = null, cards = 0;
  for (const b of o.blocks) {
    if (b.type !== 'item') list = null;
    if (b.type === 'heading') nodes.push(el(`h${Math.min(b.depth + 2, 6)}`, {}, ...tag(b.gap), ...words(b.text)));
    else if (b.type === 'item') {
      if (!list) { list = el('ul', {}); nodes.push(list); }
      const box = b.gap ? (b.gap.state === 'open' ? '☐ ' : '☑ ') : '';
      list.append(el('li', { class: b.gap ? 'export-task' : '' }, box, ...(b.gap?.state === 'open' && b.gap.why !== 'to do' ? tag(b.gap) : []), ...words(b.text)));
    } else {
      if (b.type === 'card' && cards++) nodes.push(el('hr', {}));
      nodes.push(el('p', {}, ...tag(b.gap), ...words(b.text)));
      if (b.links?.length) nodes.push(el('p', { class: 'export-links' }, `Linked to: ${b.links.join(' · ')}`));
    }
  }
  return el('div', { class: 'export-print' }, ...nodes);
}

// Prints a page over the app: everything else is hidden while the dialog is open, and the page is
// taken away after. The title names the PDF the dialog offers to save.
function printPage(node) {
  document.querySelectorAll('body > .export-print').forEach((n) => n.remove()); // one left by a print that never said it ended
  const title = document.title;
  document.title = node.querySelector('h1')?.textContent || title;
  document.body.append(node);
  document.body.classList.add('export-printing');
  const done = () => { node.remove(); document.body.classList.remove('export-printing'); document.title = title; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

export default class Export extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    install(t);
  }
}
