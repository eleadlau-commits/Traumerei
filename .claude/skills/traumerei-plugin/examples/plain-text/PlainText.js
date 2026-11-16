// Plain text: a room out as a .txt (its name, each group as a heading with its parts, then the
// rest, a blank line between thoughts), and a .txt in as a room, one thought per paragraph.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

export function text(t, room) {
  const marks = t.marks.in(room) || [];
  const held = new Set(), out = [t.marks.text(room).toUpperCase(), ''];
  for (const g of marks.filter((m) => m.kind === 'group')) {
    out.push(`${g.title || 'Group'}:`);
    for (const id of t.links.members(g.id)) { held.add(id); out.push(`  ${t.marks.text(id)}`); }
    out.push('');
  }
  for (const m of marks) if (m.kind !== 'group' && !held.has(m.id)) out.push(t.marks.text(m.id), '');
  return `${out.join('\n').trim()}\n`;
}
export function land(t, name, words) {
  return t.together(() => {
    const room = t.marks.make({ kind: 'room', content: name });
    if (room.ok) for (const p of String(words).split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)) t.marks.make({ content: p, in: room.id });
    return room.ok ? room.id : null;
  });
}

export function install(t) {
  t.slots.formats.add({ id: 'plain-text', name: 'Plain text (.txt)', order: 63, accepts: (file) => /\.txt$/i.test(file?.name || ''),
    importRoom: async ({ file } = {}) => { if (!file) return null; const id = land(t, file.name.replace(/\.txt$/i, ''), await file.text()); return id ? { id } : null; } });
  t.slots.commands.add({ id: 'plain-text.out', zone: 'room', order: 71, words: 'Export this room as plain text',
    when: () => !!t.ui.chosen()?.context, run: () => { const r = t.ui.chosen().context; t.ui.download(`${t.marks.text(r) || 'room'}.txt`, text(t, r)); } });
}

export default class PlainText extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
