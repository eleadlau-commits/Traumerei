// Calendar: a rule that puts each mark on the day it is due or set to revisit (moments ahead),
// weeks as rows, Monday first; marks with nothing ahead wait in a column on the left.
// A corpus plugin (kernel phase 8). Saves nothing: the days are the moments table's.
import { Feature } from 'folio';

const DAY = 86400e3, W = 230, H = 150;
const monday = (time) => { const d = new Date(time); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

export function arrange(reads, context) {
  const marks = reads.marks.in(context).filter((m) => m.kind !== 'group');
  const dated = [], undated = [];
  for (const m of marks) { const a = reads.moments.next(m.id); (a?.at ? dated : undated).push({ m, at: a?.at }); }
  const out = undated.map(({ m }, i) => ({ mark: m.id, x: -W - 60, y: i * 110 }));
  if (!dated.length) return out;
  const start = monday(Math.min(...dated.map((d) => d.at)));
  const perDay = new Map();
  for (const { m, at } of dated.sort((a, b) => a.at - b.at)) {
    const day = Math.round((new Date(at).setHours(0, 0, 0, 0) - start) / DAY);
    const n = perDay.get(day) || 0;
    perDay.set(day, n + 1);
    out.push({ mark: m.id, x: (day % 7) * W, y: Math.floor(day / 7) * (H * 3) + n * 60 });
  }
  return out;
}

export function install(t) {
  t.slots.rules.add({ id: 'calendar', name: 'Calendar', note: 'each on the day it is due', icon: '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>', arrange, hand: false });
}

export default class Calendar extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
