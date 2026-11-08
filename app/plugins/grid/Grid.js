// Grid: a rule (a mode) that puts a room's marks in fixed cells, oldest first, six to a row.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export const COLS = 6, W = 240, H = 160;
export const arrange = (reads, context) => reads.marks.in(context).filter((m) => m.kind !== 'group')
  .sort((a, b) => a.at - b.at).map((m, i) => ({ mark: m.id, x: (i % COLS) * W, y: Math.floor(i / COLS) * H }));

export function install(t) {
  t.slots.rules.add({ id: 'grid', name: 'Grid', note: 'fixed cells, oldest first', icon: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>', arrange, hand: false });
}

export default class Grid extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
