// Random: a rule that scatters a room's marks afresh each time it is gone into, for seeing
// constellations. Pure: the scatter is seeded by the room's last visit (moments), so the same
// visit always shows the same sky. A corpus plugin (kernel phase 8). Saves nothing.
import { Feature } from 'folio';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
export function arrange(reads, context) {
  const visits = reads.moments.of(context).filter((r) => r.kind === 'visited');
  const seed = String(visits.at(-1)?.time ?? 0);
  const marks = reads.marks.in(context).filter((m) => m.kind !== 'group');
  const side = Math.ceil(Math.sqrt(marks.length || 1)) * 260;
  return marks.map((m) => { const h = hash(seed + m.id); return { mark: m.id, x: (h % 10007) / 10007 * side, y: ((h >>> 12) % 10007) / 10007 * side }; });
}

export function install(t) {
  t.slots.rules.add({ id: 'random', name: 'Random', note: 'a new sky each visit', icon: '<circle cx="5" cy="8" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="11" cy="14" r="1"/><circle cx="19" cy="18" r="1"/><circle cx="6" cy="19" r="1"/>', arrange });
}

export default class Random extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
