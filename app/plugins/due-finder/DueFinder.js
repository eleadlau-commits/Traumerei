// Due finder: a reader by rule. In the open room it reads each thought's words for a date
// ("by 12 Nov", "2026-11-20", "tomorrow", "on Friday") and sets it due then, where nothing is
// ahead already. One step. A corpus plugin (kernel phase 8): written against app/core/API.md
// alone. Saves nothing: the days are the moments table's.
import { Feature } from 'folio';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const noon = (y, m, d) => new Date(y, m, d, 12).getTime();

// The time a text names, read from `now`, or null.
export function dateIn(text, now = Date.now()) {
  const s = String(text).toLowerCase(), today = new Date(now);
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return noon(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
  if (m) {
    const [d, mon] = /\d/.test(m[1]) ? [+m[1], m[2]] : [+m[2], m[1]];
    let t = noon(today.getFullYear(), MONTHS.indexOf(mon), d);
    if (t < now - 86400e3) t = noon(today.getFullYear() + 1, MONTHS.indexOf(mon), d);
    return t;
  }
  if (/\btomorrow\b/.test(s)) return noon(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (/\btoday\b|\btonight\b/.test(s)) return noon(today.getFullYear(), today.getMonth(), today.getDate());
  m = s.match(/\b(?:on|by|next)\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  if (m) { const ahead = ((DAYS.indexOf(m[1]) - today.getDay() + 7) % 7) || 7; return noon(today.getFullYear(), today.getMonth(), today.getDate() + ahead); }
  return null;
}

export function install(t) {
  t.slots.commands.add({ id: 'due-finder.run', zone: 'room', order: 73, words: 'Set thoughts due on the dates their words name',
    when: () => !!t.ui.chosen()?.context,
    run: () => {
      const marks = (t.marks.in(t.ui.chosen().context) || []).filter((m) => m.kind !== 'group' && !t.moments.next(m.id));
      const n = t.together(() => marks.filter((m) => { const at = dateIn(t.marks.text(m.id)); return at != null && t.moments.due(m.id, at).ok; }).length);
      t.ui.toast(n ? `${n} set due` : 'No dates found');
    } });
}

export default class DueFinder extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
