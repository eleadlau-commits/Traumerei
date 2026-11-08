// Markdown vault: Obsidian in and out. A .md file (or a .zip of a vault) comes in as rooms, one
// per note: each paragraph or list item a thought, each heading a group of what follows it, and
// each [[wikilink]] a "mentions" link from the thought to the room of that note. Out: every room
// as a note in a .zip (⋯ More, or Ctrl+Alt+M), or the open room as one .md.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';
import { zip, unzip } from './zip.js';

// A note's words → { title, blocks: [{ heading } | { text }] }.
export function parse(name, text) {
  const blocks = [];
  let para = [];
  const flush = () => { if (para.length) blocks.push({ text: para.join(' ').trim() }); para = []; };
  for (const raw of String(text).replace(/^---\n[\s\S]*?\n---\n/, '').split('\n')) {
    const line = raw.trim();
    const h = line.match(/^#{1,6}\s+(.*)$/), li = line.match(/^(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (!line) flush();
    else if (h) { flush(); blocks.push({ heading: h[1] }); }
    else if (li) { flush(); blocks.push({ text: li[1] }); }
    else para.push(line);
  }
  flush();
  return { title: name.replace(/^.*\//, '').replace(/\.md$/i, ''), blocks: blocks.filter((b) => b.heading || b.text) };
}
export const wikilinks = (text) => [...String(text).matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)].map((m) => m[1].trim());

// Notes → rooms of marks, as one step. Returns the first room's id.
export function land(t, notes) {
  return t.together(() => {
    const rooms = new Map(), spoken = [];
    for (const n of notes) {
      const room = t.marks.make({ kind: 'room', content: n.title });
      if (!room.ok) continue;
      rooms.set(n.title.toLowerCase(), room.id);
      let into = room.id;
      for (const b of n.blocks) {
        if (b.heading) { const g = t.marks.make({ kind: 'group', content: { title: b.heading }, in: room.id }); into = g.ok ? g.id : room.id; continue; }
        const m = t.marks.make({ content: b.text, in: into });
        if (m.ok) for (const to of wikilinks(b.text)) spoken.push([m.id, to]);
      }
    }
    for (const [from, to] of spoken) { const room = rooms.get(to.toLowerCase()); if (room) t.links.link(from, room, 'mentions'); }
    return rooms.values().next().value ?? null;
  });
}

// A room → the words of a note.
export function note(t, room) {
  const marks = t.marks.in(room) || [];
  const held = new Set(), out = [];
  const say = (id) => { const words = t.marks.text(id); return words + t.links.from(id, 'mentions').map((l) => `[[${t.marks.text(l.to)}]]`).filter((w) => !words.includes(w)).map((w) => ` ${w}`).join(''); };
  for (const g of marks.filter((m) => m.kind === 'group')) {
    out.push(`## ${g.title || 'Group'}`, '');
    for (const id of t.links.members(g.id)) { held.add(id); out.push(`- ${say(id)}`); }
    out.push('');
  }
  for (const m of marks) if (m.kind !== 'group' && !held.has(m.id)) out.push(say(m.id), '');
  return `${out.join('\n').trim()}\n`;
}
const safe = (s) => String(s || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);

export function install(t) {
  t.slots.linkKinds.add({ kind: 'mentions', name: 'Mentions', note: 'a [[wikilink]] from a note' });
  t.slots.formats.add({
    id: 'markdown', name: 'Markdown note or vault (.md, .zip)', order: 60,
    accepts: (file) => /\.(md|markdown|zip)$/i.test(file?.name || ''),
    importRoom: async ({ file } = {}) => {
      if (!file) return null;
      const notes = /\.zip$/i.test(file.name)
        ? (await unzip(new Uint8Array(await file.arrayBuffer()))).filter((f) => /\.md$/i.test(f.name)).map((f) => parse(f.name, f.text))
        : [parse(file.name, await file.text())];
      const id = land(t, notes);
      return id ? { id } : null;
    },
  });
  const vault = () => {
    const rooms = t.marks.ofKind('room');
    t.ui.download('traumerei-vault.zip', new Blob([zip(rooms.map((r) => ({ name: `${safe(t.marks.text(r.id))}.md`, text: note(t, r.id) })))], { type: 'application/zip' }), 'application/zip');
  };
  t.slots.commands.add({ id: 'markdown.vault', keys: ['Ctrl+Alt+M'], zone: 'everywhere', order: 66, words: 'Export every room as a Markdown vault (.zip)', run: vault });
  t.slots.more.add({ id: 'markdown-vault', label: 'Markdown vault out', icon: '<path d="M4 6h16v12H4zM7 15V9l3 3 3-3v6M16 9v6m-2-2 2 2 2-2"/>', order: 71, run: vault });
  t.slots.commands.add({ id: 'markdown.room', zone: 'room', order: 67, words: 'Export this room as a Markdown note',
    when: () => !!t.ui.chosen()?.context, run: () => { const r = t.ui.chosen().context; t.ui.download(`${safe(t.marks.text(r))}.md`, note(t, r), 'text/markdown'); } });
}

export default class MarkdownVault extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
