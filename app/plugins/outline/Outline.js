// Outline: a rule that lays a room as an indented tree: each mark under what holds it (a group
// through part of, a parent through a relation), children in order, one line each.
// A corpus plugin (kernel phase 8). Saves nothing.
import { Feature } from 'folio';

export const INDENT = 60, LINE = 64;
export function arrange(reads, context) {
  const marks = reads.marks.in(context);
  const here = new Set(marks.map((m) => m.id));
  const parentOf = (id) => reads.links.holders(id).find((g) => here.has(g))
    ?? reads.links.from(id, 'relation').map((r) => r.to).find((p) => here.has(p)) ?? null;
  const kids = new Map();
  for (const m of marks) { const p = parentOf(m.id); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(m.id); }
  const out = [], seen = new Set();
  const walk = (id, depth) => {
    if (seen.has(id)) return; // a loop of relations is laid once
    seen.add(id);
    out.push({ mark: id, x: depth * INDENT, y: out.length * LINE });
    const order = reads.links.members(id);
    const list = (kids.get(id) || []).slice().sort((a, b) => (order.indexOf(a) + 1 || 1e9) - (order.indexOf(b) + 1 || 1e9));
    for (const k of list) walk(k, depth + 1);
  };
  for (const id of kids.get(null) || []) walk(id, 0);
  for (const m of marks) walk(m.id, 0); // anything only in a loop
  return out;
}

export function install(t) {
  t.slots.rules.add({ id: 'outline', name: 'Outline', note: 'an indented tree', icon: '<path d="M4 6h10M8 12h12M8 18h12M4 6v12"/>', arrange, hand: false });
}

export default class Outline extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
