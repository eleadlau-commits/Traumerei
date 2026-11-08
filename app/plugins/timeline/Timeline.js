// Timeline: a rule that lays a room's marks left to right by when each was made, a day to a
// stretch, marks of one day stacked. A corpus plugin (kernel phase 8). Saves nothing.
import { Feature } from 'folio';

const DAY = 86400e3;
export function arrange(reads, context) {
  const marks = reads.marks.in(context).filter((m) => m.kind !== 'group').sort((a, b) => a.at - b.at);
  if (!marks.length) return [];
  const first = Math.floor(marks[0].at / DAY);
  const stack = new Map();
  return marks.map((m) => {
    const day = Math.floor(m.at / DAY) - first;
    const n = stack.get(day) || 0;
    stack.set(day, n + 1);
    return { mark: m.id, x: day * 260, y: n * 120 };
  });
}

export function install(t) {
  t.slots.rules.add({ id: 'timeline', name: 'Timeline', note: 'by the day each was made', icon: '<path d="M3 12h18M7 9v6M12 9v6M17 9v6"/>', arrange });
}

export default class Timeline extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
