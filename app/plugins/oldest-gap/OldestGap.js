// Oldest open gap: one key (Ctrl+Alt+O) and an entry under ⋯ More that go to the room holding
// the oldest gap still open anywhere, and say what it is and how long it has waited.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

const DAY = 86400e3;
const VERB = { 'to world': 'to check', 'from world': 'to do', 'to maker': 'to judge' };
export function oldest(t, now = Date.now()) {
  const gap = t.gaps.oldest();
  if (!gap) return null;
  const room = t.places.home(gap.mark);
  const days = Math.floor((now - gap.openedAt) / DAY);
  return { mark: gap.mark, room, words: `${VERB[gap.direction] || 'open'}: ${t.marks.text(gap.mark).slice(0, 60)} (${days ? `${days} days` : 'today'})` };
}
function go(t) {
  const o = oldest(t);
  if (!o) { t.ui.toast('No gap is open: nothing waits'); return; }
  if (o.room) t.ui.open.room(o.room);
  t.ui.toast(`Oldest open gap, ${o.words}`);
}

export function install(t) {
  t.slots.commands.add({ id: 'oldest-gap.go', keys: ['Ctrl+Alt+O'], zone: 'everywhere', order: 62, words: 'Go to the oldest open gap', run: () => go(t) });
  t.slots.more.add({ id: 'oldest-gap', label: 'Oldest open gap', icon: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>', order: 70, run: () => go(t) });
}

export default class OldestGap extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
