// Calendar: a rule that puts each mark on the day it is due or set to revisit (moments ahead),
// weeks as rows, Monday first; marks with nothing ahead wait in a column on the left.
// It draws the days as boxes (draw), a mark let go on a day is due that day (drop), and a thought
// written while a day is chosen is due that day (land). A corpus plugin (kernel phase 8): written
// against app/core/API.md alone. Saves nothing: the days are the moments table's.
import { Feature } from 'folio';

const DAY = 86400e3;
export const W = 230, H = 200, WEEKS = 5, NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const midnight = (time) => new Date(time).setHours(0, 0, 0, 0);
const monday = (time) => { const d = new Date(midnight(time)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const dayOf = (start, time) => Math.round((midnight(time) - start) / DAY);
const noonOf = (start, i) => { const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(12, 0, 0, 0); return d.getTime(); };

// The weeks shown: from the Monday of today or of the earliest date, whichever is first, to at
// least WEEKS weeks and past the latest date.
function span(reads, context) {
  const marks = reads.marks.in(context).filter((m) => m.kind !== 'group');
  const dated = [], undated = [];
  for (const m of marks) { const a = reads.moments.next(m.id); (a?.at && (a.state === 'waiting' || a.state === 'back') ? dated : undated).push({ m, at: a?.at }); }
  const now = Date.now();
  const start = monday(Math.min(now, ...dated.map((d) => d.at)));
  const last = Math.max(now, ...dated.map((d) => d.at));
  const weeks = Math.max(WEEKS, Math.floor(dayOf(start, last) / 7) + 1);
  return { dated, undated, start, weeks };
}

export function arrange(reads, context) {
  const { dated, undated, start } = span(reads, context);
  const out = undated.map(({ m }, i) => ({ mark: m.id, x: -W / 2 - 60, y: 50 + i * 60 }));
  const perDay = new Map();
  for (const { m, at } of dated.sort((a, b) => a.at - b.at)) {
    const day = dayOf(start, at), n = perDay.get(day) || 0;
    perDay.set(day, n + 1);
    out.push({ mark: m.id, x: (day % 7) * W + W / 2, y: Math.floor(day / 7) * H + 56 + n * 44 });
  }
  return out;
}

export function draw(reads, context) {
  const { start, weeks } = span(reads, context);
  const today = dayOf(start, Date.now()), boxes = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(noonOf(start, i));
    boxes.push({ x: (i % 7) * W, y: Math.floor(i / 7) * H, w: W, h: H, label: `${NAMES[i % 7]} ${d.getDate()}${d.getDate() === 1 || i === 0 ? ` ${d.toLocaleString('en', { month: 'short' })}` : ''}`, note: i === today ? 'today' : '' });
  }
  return boxes;
}

// The day under x, y, as its noon; null off the days.
function dayAt(reads, context, x, y) {
  const { start, weeks } = span(reads, context);
  const col = Math.floor(x / W), row = Math.floor(y / H);
  return col >= 0 && col < 7 && row >= 0 && row < weeks ? noonOf(start, row * 7 + col) : null;
}
// Let go on a day: due that day. Let go left of the days: nothing ahead.
export const drop = (reads, context, mark, x, y) => { const at = dayAt(reads, context, x, y); return at ? { due: at } : x < 0 ? { clear: true } : null; };
export const land = (reads, context, mark, x, y) => { const at = dayAt(reads, context, x, y); return at ? { due: at } : null; };

export function install(t) {
  t.slots.rules.add({ id: 'calendar', name: 'Calendar', note: 'each on the day it is due', icon: '<path d="M4 6h16v14H4zM4 10h16M9 3v4M15 3v4"/>', arrange, draw, drop, land, hand: false });
}

export default class Calendar extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
