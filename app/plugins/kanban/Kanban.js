// Kanban: a rule that makes each group of a room a column, its parts stacked under it in their
// order, open gaps first and resolved ones last; marks in no group are the first column.
// Moving a card is joining a group (links), so the board keeps no state of its own.
// A corpus plugin (kernel phase 8). Saves nothing.
import { Feature } from 'folio';

const W = 260, H = 110;
const rank = (reads, id) => { const g = reads.gaps.of(id); return !g ? 1 : g.state === 'open' || g.open ? 0 : 2; };

export function arrange(reads, context) {
  const marks = reads.marks.in(context);
  const groups = marks.filter((m) => m.kind === 'group');
  const held = new Set();
  const out = [];
  groups.forEach((g, col) => {
    out.push({ mark: g.id, x: (col + 1) * W, y: 0 });
    const parts = reads.links.members(g.id);
    parts.map((id, i) => [id, i]).sort((a, b) => rank(reads, a[0]) - rank(reads, b[0]) || a[1] - b[1])
      .forEach(([id], row) => { held.add(id); out.push({ mark: id, x: (col + 1) * W, y: (row + 1) * H }); });
  });
  marks.filter((m) => m.kind !== 'group' && !held.has(m.id)).forEach((m, row) => out.push({ mark: m.id, x: 0, y: (row + 1) * H }));
  return out;
}

export function install(t) {
  t.slots.rules.add({ id: 'kanban', name: 'Kanban', note: 'groups as columns', icon: '<path d="M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z"/>', arrange, hand: false });
}

export default class Kanban extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
