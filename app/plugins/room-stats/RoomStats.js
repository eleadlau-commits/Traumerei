// Room statistics: Ctrl+Alt+I shows, in the right dock, what the open room holds: thoughts and
// words, groups, links by kind, gaps open and resolved, what is ahead, and how many were made
// and changed this week. A corpus plugin (kernel phase 8): written against app/core/API.md alone.
// Saves nothing.
import { Feature, ui } from 'folio';

const WEEK = 7 * 86400e3;
export function stats(t, room, now = Date.now()) {
  const marks = t.marks.in(room) || [];
  const thoughts = marks.filter((m) => m.kind !== 'group');
  const links = new Map();
  for (const m of marks) for (const l of t.links.from(m.id)) links.set(l.kind, (links.get(l.kind) || 0) + 1);
  const gaps = thoughts.map((m) => t.gaps.of(m.id)).filter((g) => g && !g.derived);
  return {
    thoughts: thoughts.length, groups: marks.length - thoughts.length,
    words: thoughts.reduce((n, m) => n + (t.marks.text(m.id).match(/\S+/g) || []).length, 0),
    links: Object.fromEntries(links), open: gaps.filter((g) => g.state === 'open').length, resolved: gaps.filter((g) => g.state === 'resolved').length,
    ahead: t.moments.ahead(room).length, made: thoughts.filter((m) => now - m.at < WEEK).length,
    changed: thoughts.filter((m) => now - (t.moments.changed(m.id) || 0) < WEEK).length,
  };
}
export const lines = (s) => [`${s.thoughts} thoughts, ${s.words} words, ${s.groups} groups`,
  `Links: ${Object.entries(s.links).map(([k, n]) => `${n} ${k}`).join(', ') || 'none'}`,
  `Gaps: ${s.open} open, ${s.resolved} resolved · ${s.ahead} ahead`, `This week: ${s.made} made, ${s.changed} changed`];

export function install(t) {
  t.slots.commands.add({ id: 'room-stats.show', keys: ['Ctrl+Alt+I'], zone: 'room', order: 76, words: 'Show this room\'s statistics',
    when: () => !!t.ui.chosen()?.context,
    run: () => {
      const r = t.ui.chosen().context, l = lines(stats(t, r));
      if (!t.ui.docks) { t.ui.toast(l[0]); return; }
      t.ui.docks.right.open({ key: 'room-stats', kind: 'Statistics', title: t.marks.text(r), label: 'Stats', body: ui.el('div', {}, ...l.map((x) => ui.el('p', { class: 'hint small' }, x))) });
    } });
}

export default class RoomStats extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
