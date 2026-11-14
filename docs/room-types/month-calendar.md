# Month calendar

Each thought on the day it is due, weeks as rows; tap a day and type to write onto it.

hand: no
icon: M4 6h16v14H4zM4 10h16M9 3v4M15 3v4

Drop a thought on a day and it is due that day; drop it left of the days and nothing is ahead.
Thoughts with no date wait in a column on the left.

```js
const W = 230, H = 200, DAY = 86400000;
const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const midnight = (t) => new Date(t).setHours(0, 0, 0, 0);
const monday = (t) => { const d = new Date(midnight(t)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const dayOf = (start, t) => Math.round((midnight(t) - start) / DAY);
const noonOf = (start, i) => { const d = new Date(start); d.setDate(d.getDate() + i); d.setHours(12, 0, 0, 0); return d.getTime(); };

// Which thoughts have a date, and the weeks to show (at least five, from this week or the earliest date).
const span = (reads, context) => {
  const dated = [], undated = [];
  for (const m of reads.marks.in(context)) {
    if (m.kind === 'group') continue;
    const a = reads.moments.next(m.id);
    if (a && a.at && (a.state === 'waiting' || a.state === 'back')) dated.push({ m, at: a.at }); else undated.push(m);
  }
  const now = Date.now();
  const start = monday(Math.min(now, ...dated.map((d) => d.at)));
  const weeks = Math.max(5, Math.floor(dayOf(start, Math.max(now, ...dated.map((d) => d.at))) / 7) + 1);
  return { dated, undated, start, weeks };
};

const dayAt = (reads, context, x, y) => {
  const { start, weeks } = span(reads, context);
  const col = Math.floor(x / W), row = Math.floor(y / H);
  return col >= 0 && col < 7 && row >= 0 && row < weeks ? noonOf(start, row * 7 + col) : null;
};

arrange = (reads, context) => {
  const { dated, undated, start } = span(reads, context);
  const out = undated.map((m, i) => ({ mark: m.id, x: -W / 2 - 60, y: 50 + i * 60 }));
  const perDay = new Map();
  for (const { m, at } of dated.sort((a, b) => a.at - b.at)) {
    const day = dayOf(start, at), n = perDay.get(day) || 0;
    perDay.set(day, n + 1);
    out.push({ mark: m.id, x: (day % 7) * W + W / 2, y: Math.floor(day / 7) * H + 56 + n * 44 });
  }
  return out;
};

draw = (reads, context) => {
  const { start, weeks } = span(reads, context);
  const today = dayOf(start, Date.now()), boxes = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(noonOf(start, i));
    const month = d.getDate() === 1 || i === 0 ? ' ' + d.toLocaleString('en', { month: 'short' }) : '';
    boxes.push({ x: (i % 7) * W, y: Math.floor(i / 7) * H, w: W, h: H, label: NAMES[i % 7] + ' ' + d.getDate() + month, note: i === today ? 'today' : '' });
  }
  return boxes;
};

drop = (reads, context, mark, x, y) => {
  const at = dayAt(reads, context, x, y);
  return at ? { due: at } : x < 0 ? { clear: true } : null;
};

land = (reads, context, mark, x, y) => {
  const at = dayAt(reads, context, x, y);
  return at ? { due: at } : null;
};
```
