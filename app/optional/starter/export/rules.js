// Export's rules: a room's six tables (t.carriers.tables) → an outline in the room's own order,
// then that outline as Markdown. Plain functions, no screen: the print view (Export.js) draws the
// same outline.
//
// The order follows the room's shape (its mode):
//   joyce   trains top to bottom, a titled train or passage a heading, the rest paragraphs;
//   pessoa  a list, top to bottom; a thought with a gap is a task (- [ ] / - [x]);
//   russell the tree as nested headings: a group or a thought with parts under it is a heading,
//           a leaf a paragraph under its parent (parts by order, relations' children under the
//           thought they point to);
//   proust  cards, one per thought, each with what it is linked to;
//   other   groups as headings with their parts, the rest paragraphs, in the order laid out.
// An open gap shows as a marker (Open, to do / to check / to judge). Maths is kept as typed ($…$).

const STRUCTURE = new Set(['part of', 'stands for', 'relation']);
export const WHY = { 'from world': 'to do', 'to world': 'to check', 'to maker': 'to judge' };

// The words of a mark as its kind keeps them; sized words ([w]{size=big}) as plain words.
const unsize = (s) => String(s ?? '').replace(/\[([^\]\n]*)\]\{size=\w+\}/g, '$1');
export function wordsOf(m) {
  const c = m?.body?.content || {};
  if (m?.body?.kind === 'group') return unsize(c.title || '').trim();
  return unsize(c.text ?? c.caption ?? c.name ?? '').replace(/\r/g, '').trim();
}
const titleOf = (m) => unsize(m?.body?.content?.title || '').trim();
const firstLine = (s) => String(s).split('\n')[0].replace(/^#+\s*/, '').trim();
const rest = (s) => String(s).split('\n').slice(1).join('\n').trim();

// The outline: { title, mode, open, blocks: [{ type, depth, text, gap?, links? }] }.
// type: 'heading' | 'para' | 'item' | 'card'. gap: 'open' or 'resolved' with its words.
export function outline(tables, root) {
  const byId = new Map(tables.marks.map((m) => [m.id, m]));
  const room = byId.get(root);
  const mode = room?.body?.content?.mode || null;
  const home = tables.places.filter((p) => p.context === root && p.rule == null && p.mark !== root && byId.has(p.mark)).map((p) => p.mark);
  const here = new Set(home);
  const pos = new Map();
  for (const p of tables.places) if (p.context === root && p.rule === mode && p.position && typeof p.position.y === 'number') pos.set(p.mark, p.position);
  const at = (id) => byId.get(id)?.at ?? 0;
  const order = (a, b) => {
    const pa = pos.get(a), pb = pos.get(b);
    if (pa && pb && (pa.y !== pb.y || pa.x !== pb.x)) return pa.y - pb.y || pa.x - pb.x;
    if (!!pa !== !!pb) return pa ? -1 : 1;
    return at(a) - at(b) || (a < b ? -1 : 1);
  };
  const parts = new Map(), held = new Set();
  for (const l of tables.links) {
    if (l.kind !== 'part of' || !here.has(l.from) || !here.has(l.to)) continue;
    if (!parts.has(l.to)) parts.set(l.to, []);
    parts.get(l.to).push(l); held.add(l.from);
  }
  for (const list of parts.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || order(a.from, b.from));
  const kids = new Map();
  if (mode === 'russell') {
    for (const l of tables.links) {
      if (l.kind !== 'relation' || !here.has(l.from) || !here.has(l.to) || held.has(l.from)) continue;
      if (!kids.has(l.to)) kids.set(l.to, []);
      kids.get(l.to).push(l.from); held.add(l.from);
    }
  }
  const gapOf = new Map(tables.gaps.map((g) => [g.mark, g]));
  const gap = (id) => { const g = gapOf.get(id); return g ? { state: g.state, why: WHY[g.direction] || 'open' } : null; };
  const linked = (id) => tables.links.filter((l) => !STRUCTURE.has(l.kind) && (l.from === id || l.to === id))
    .map((l) => byId.get(l.from === id ? l.to : l.from)).filter(Boolean).map((m) => firstLine(wordsOf(m)) || '(empty)');

  const blocks = [], seen = new Set();
  const under = (id) => [...(parts.get(id) || []).map((l) => l.from), ...(kids.get(id) || []).sort(order)];
  const walk = (id, depth) => {
    if (seen.has(id)) return; seen.add(id);
    const m = byId.get(id), kind = m.body?.kind, words = wordsOf(m), children = under(id);
    if (kind === 'group') {
      const title = titleOf(m);
      if (title) blocks.push({ type: 'heading', depth, text: title, gap: gap(id) });
      children.forEach((k) => walk(k, title ? depth + 1 : depth));
      return;
    }
    const title = titleOf(m);
    if (title) {
      blocks.push({ type: 'heading', depth, text: title, gap: gap(id) });
      if (words) blocks.push({ type: mode === 'pessoa' ? 'item' : 'para', depth: depth + 1, text: words, gap: null });
    } else if (children.length) {
      blocks.push({ type: 'heading', depth, text: firstLine(words) || '(empty)', gap: gap(id) });
      if (rest(words)) blocks.push({ type: 'para', depth: depth + 1, text: rest(words), gap: null });
    } else if (mode === 'pessoa') blocks.push({ type: 'item', depth, text: words, gap: gap(id) });
    else if (mode === 'proust') blocks.push({ type: 'card', depth, text: words, gap: gap(id), links: linked(id) });
    else blocks.push({ type: 'para', depth, text: words, gap: gap(id) });
    children.forEach((k) => walk(k, depth + 1));
  };
  home.filter((id) => !held.has(id)).sort(order).forEach((id) => walk(id, 0));
  home.sort(order).forEach((id) => walk(id, 0)); // anything in a loop of parts, so nothing is lost
  const open = blocks.filter((b) => b.gap?.state === 'open').length;
  return { title: (room?.body?.content?.name || 'Untitled').trim(), mode, open, blocks };
}

// The outline as Markdown.
export function markdown(o) {
  const out = [`# ${o.title}`, ''];
  if (o.open) out.push(`> ${o.open === 1 ? 'One gap is' : `${o.open} gaps are`} still open.`, '');
  const marker = (g) => (g?.state === 'open' ? `**Open, ${g.why}:** ` : '');
  let list = false, cards = 0;
  for (const b of o.blocks) {
    if (list && b.type !== 'item') { out.push(''); list = false; }
    if (b.type === 'heading') {
      const level = b.depth + 2;
      out.push(level <= 6 ? `${'#'.repeat(level)} ${marker(b.gap)}${b.text}` : `**${marker(b.gap)}${b.text}**`, '');
    } else if (b.type === 'item') {
      const box = b.gap ? (b.gap.state === 'open' ? '[ ] ' : '[x] ') : '';
      const note = b.gap?.state === 'open' && b.gap.why !== 'to do' ? ` *(${b.gap.why})*` : '';
      const lines = (b.text || '(empty)').split('\n');
      out.push(`- ${box}${lines[0]}${lines.length === 1 ? note : ''}`, ...lines.slice(1).map((l, i, a) => `  ${l}${i === a.length - 1 ? note : ''}`));
      list = true;
    } else if (b.type === 'card') {
      if (cards++) out.push('---', '');
      out.push(`${marker(b.gap)}${b.text}`, '');
      if (b.links?.length) out.push(`*Linked to:* ${b.links.join(' · ')}`, '');
    } else out.push(`${marker(b.gap)}${b.text}`, '');
  }
  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

// A file name from a room's name.
export const fileName = (title, ext) => `${String(title || 'Untitled').replace(/[\\/:*?"<>|\n]/g, '-').trim().slice(0, 80) || 'Untitled'}.${ext}`;
