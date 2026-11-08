// Export this room: one key (Ctrl+Alt+S) hands the open room out as a .traum file, its six
// tables as text, from anywhere in it. A corpus plugin (kernel phase 8): written against
// app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export const fileName = (name) => `${String(name || 'room').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.traum`;

export function install(t) {
  t.slots.commands.add({ id: 'export-room.traum', keys: ['Ctrl+Alt+S'], zone: 'room', order: 77, words: 'Export this room as a .traum file',
    when: () => !!t.ui.chosen()?.context,
    run: () => { const r = t.ui.chosen().context; t.ui.download(fileName(t.marks.text(r)), t.carriers.text(r), 'text/plain'); } });
}

export default class ExportRoom extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
