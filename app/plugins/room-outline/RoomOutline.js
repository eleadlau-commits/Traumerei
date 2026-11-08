// Room outline: a tab in the left dock (Ctrl+Alt+U) listing the open room as an outline: each
// group with its parts indented under it, every relation's child under its parent, the rest
// after. Drawn again when marks or links change. A corpus plugin (kernel phase 8): written
// against app/core/API.md alone. Saves nothing.
import { Feature, ui } from 'folio';

// The outline as lines: [{ id, depth, words }].
export function lines(t, context) {
  const marks = t.marks.in(context) || [];
  const here = new Set(marks.map((m) => m.id));
  const under = (id) => [...t.links.members(id), ...t.links.to(id, 'relation').map((r) => r.from)].filter((k) => here.has(k));
  const isChild = (id) => t.links.holders(id).some((g) => here.has(g)) || t.links.from(id, 'relation').some((r) => here.has(r.to));
  const out = [], seen = new Set();
  const walk = (id, depth) => { if (seen.has(id)) return; seen.add(id); const m = t.marks.get(id); out.push({ id, depth, words: m?.kind === 'group' ? (m.title || 'Group') : t.marks.text(id) }); under(id).forEach((k) => walk(k, depth + 1)); };
  marks.filter((m) => !isChild(m.id)).forEach((m) => walk(m.id, 0));
  marks.forEach((m) => walk(m.id, 0));
  return out;
}

export function install(t) {
  let context = null;
  const body = () => ui.el('div', { class: 'room-outline' }, ...lines(t, context).map((l) => ui.el('div', { style: `padding-left:${l.depth * 16}px` }, l.words || '(empty)')));
  const show = () => t.ui.docks?.left.open({ key: 'room-outline', kind: 'Outline', title: t.marks.text(context) || 'Outline', label: 'Outline', body: body() });
  t.slots.commands.add({ id: 'room-outline.open', keys: ['Ctrl+Alt+U'], zone: 'room', order: 65, words: 'Show this room as an outline',
    run: () => { context = t.ui.chosen()?.context; if (!context) return; if (!t.ui.docks) t.ui.toast(`${lines(t, context).length} lines`); else show(); } });
  const again = () => { if (context && t.ui.docks?.left.isOpen('room-outline')) show(); };
  t.marks.on(again);
  t.links.on(again);
}

export default class RoomOutline extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
