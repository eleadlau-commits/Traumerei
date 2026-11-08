// CSV of marks: the open room's marks out as a spreadsheet (one row each: id, kind, words, made,
// edited, gap, due), and a .csv in as a room, one thought per row (its "text" column, or its first).
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const iso = (time) => (Number.isFinite(time) ? new Date(time).toISOString() : '');
export function rows(text) {
  const out = []; let row = [], v = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { v += '"'; i++; } else if (c === '"') q = false; else v += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(v); v = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(v); out.push(row); row = []; v = ''; }
    else v += c;
  }
  if (v || row.length) { row.push(v); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}
export function csv(t, room) {
  const head = ['id', 'kind', 'text', 'made', 'edited', 'gap', 'due'];
  const lines = (t.marks.in(room) || []).map((m) => { const g = t.gaps.of(m.id), a = t.moments.next(m.id);
    return [m.id, m.kind, t.marks.text(m.id), iso(m.at), iso(m.edited), g ? `${g.direction} ${g.state || (g.open ? 'open' : 'resolved')}` : '', iso(a?.at)].map(cell).join(','); });
  return `${[head.join(','), ...lines].join('\n')}\n`;
}
export function land(t, name, text) {
  const [head = [], ...body] = rows(text);
  const col = Math.max(0, head.findIndex((h) => /^(text|words|title|note)$/i.test(h.trim())));
  return t.together(() => {
    const room = t.marks.make({ kind: 'room', content: name });
    if (room.ok) for (const r of body) if (r[col]?.trim()) t.marks.make({ content: r[col].trim(), in: room.id });
    return room.ok ? room.id : null;
  });
}

export function install(t) {
  t.slots.formats.add({ id: 'csv', name: 'Spreadsheet (.csv)', order: 61, accepts: (file) => /\.csv$/i.test(file?.name || ''),
    importRoom: async ({ file } = {}) => { if (!file) return null; const id = land(t, file.name.replace(/\.csv$/i, ''), await file.text()); return id ? { id } : null; } });
  t.slots.commands.add({ id: 'csv.room', zone: 'room', order: 68, words: 'Export this room\'s marks as a spreadsheet (.csv)',
    when: () => !!t.ui.chosen()?.context, run: () => { const r = t.ui.chosen().context; t.ui.download(`${t.marks.text(r) || 'room'}.csv`, csv(t, r), 'text/csv'); } });
}

export default class CsvMarks extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
