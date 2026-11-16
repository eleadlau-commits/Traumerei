// Checkbox: a kind of thought that is a line to do. Its tick is the kernel's gap, not a field:
// unticked while its gap to do is open (or it has none), ticked once resolved, so a group of
// checkboxes shows its progress like any other parts. Ctrl+Alt+X ticks the chosen one.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing else.
import { Feature } from 'folio';

export const ticked = (gap) => gap?.state === 'resolved';
export function kind(t) {
  return {
    kind: 'checkbox', name: 'Checkbox',
    tidy: (f, h) => { const text = h.oneLine(f.text); return text ? { text } : null; },
    text: (th) => th.text || '',
    node: (th, el) => el('div', { class: 'checkbox-kind' }, el('span', { class: 'checkbox-box' }, ticked(t.gaps.of(th.id)) ? '☑' : '☐'), ' ', th.text || ''),
    fields: [{ key: 'text', type: 'line', label: 'To do' }],
    add: { note: 'A line to tick off' },
  };
}
// Ticks or unticks a mark: opens a gap to do, resolves it, or opens it again.
export function tick(t, mark) {
  const g = t.gaps.of(mark);
  if (!g) return t.together(() => { const r = t.gaps.open(mark, 'from world'); return r.ok ? t.gaps.resolve(mark) : r; });
  return g.state === 'resolved' ? t.gaps.reopen(mark) : t.gaps.resolve(mark);
}

export function install(t) {
  t.slots.kinds.add(kind(t));
  t.slots.commands.add({ id: 'checkbox.tick', keys: ['Ctrl+Alt+X'], zone: 'room', order: 61, words: 'Tick or untick the chosen checkbox',
    when: () => t.marks.get(t.ui.chosen()?.mark)?.kind === 'checkbox',
    run: () => { const r = tick(t, t.ui.chosen().mark); if (!r.ok) t.ui.toast(r.reason); } });
}

export default class Checkbox extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
