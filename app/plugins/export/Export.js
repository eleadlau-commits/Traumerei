// Export: a room leaves as words. "Export as Markdown" (⋯ More, or Ctrl+Shift+E in a room) hands
// out the open room as a .md file in the room's own order (rules.js): headings, lists, cards, open
// gaps marked, maths kept as TeX. Step 7 of the handbook: export when nothing is open.
//
// A plugin. It reaches the app only through the plugin API (app/core/API.md): t.carriers.tables
// to read the room, t.ui.files.save to hand the file out (Windows' Save dialog in the desktop app,
// a download in the browser). Saved data: none.

import { Feature } from 'folio';
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
  return { shape };
}

export default class Export extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    install(t);
  }
}
