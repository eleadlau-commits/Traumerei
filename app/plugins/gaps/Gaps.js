// Gaps: the checker. A gap is what a thought was made to close: something to check against the
// world, to do in it, or to judge (the kernel's gaps table, app/core/KERNEL.md Law 5). This
// plugin is the hands on that table: a section in the Editor for the chosen thought (its gap,
// the words to open one, Resolve, Open again, and for a group or a tree the progress of its
// parts) and one key, Ctrl+Alt+G, that opens a gap to do on the chosen thought, resolves it, or
// opens it again. The room itself draws the gap's edge on a thought (the room feature), and the
// rooms page a dot on a room with open gaps.
//
// A plugin. It reaches the app only through the plugin API, the `traumerei` service
// (app/core/API.md), never another feature's files; the compiler leaves out a plugin that does.
// Everything it adds through the API is taken away again when it is switched off in
// Settings → Plugins.
//
// Saved data: none (the gaps are the world's own table).

import { Feature, ui } from 'folio';
import { DIRECTIONS, VERBS, WORDS, stateLine, progressLine, nextMove, share } from './rules.js';

const { el } = ui;

export default class Gaps extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    t.slots.editor.add({
      id: 'gaps',
      order: 40,
      when: (x) => !!t.marks.get(x.id),
      render: (x) => this.section(x),
    });
    t.slots.commands.add({
      id: 'gaps.toggle', keys: ['Ctrl+Alt+G'], zone: 'room', order: 60,
      words: 'Gap: open one to do on the chosen thought, resolve it, or open it again',
      when: () => !!t.ui.chosen()?.mark,
      run: () => this.toggle(),
    });
  }

  // Ctrl+Alt+G on the chosen thought.
  toggle() {
    const mark = this.t.ui.chosen()?.mark;
    if (!mark) return;
    const gap = this.t.gaps.of(mark);
    const move = nextMove(gap);
    if (move === 'parts') { this.t.ui.toast(`This one's gap is its parts': ${progressLine(gap)}`); return; }
    const r = this.act(mark, move, 'from world');
    if (r.ok) this.t.ui.toast(move === 'open' ? 'A gap to do: Ctrl+Alt+G again resolves it' : move === 'resolve' ? 'Resolved' : 'Open again');
  }

  // One change to a mark's gap through the API; says why not when it refuses.
  act(mark, move, direction = 'from world') {
    const g = this.t.gaps;
    const r = move === 'open' ? g.open(mark, direction) : move === 'resolve' ? g.resolve(mark) : g.reopen(mark);
    if (!r.ok) this.t.ui.toast(r.reason);
    return r;
  }

  // The Editor's section: the gap as it is, and what can be done with it.
  section(x) {
    const gap = this.t.gaps.of(x.id);
    const act = (move, direction) => { if (this.act(x.id, move, direction).ok) x.refresh(); };
    const word = (label, title, onclick) => el('button', { type: 'button', class: 'word', title, onclick, disabled: x.locked ? '' : null }, label);
    const head = el('div', { class: 'label' }, 'Gap');
    if (!gap) {
      return el('div', { class: 'gaps-section' }, head,
        el('div', { class: 'gaps-open' }, ...DIRECTIONS.map((d) => word(VERBS[d], `Open a gap ${WORDS[d]}`, () => act('open', d)))),
        el('p', { class: 'hint' }, 'Nothing to close. Open a gap: something to check against the world, to do in it, or to judge.'));
    }
    if (gap.derived) {
      const bar = el('div', { class: 'gaps-bar', role: 'progressbar', 'aria-valuenow': String(Math.round(share(gap) * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
        el('div', { class: 'gaps-bar-done', style: `width:${Math.round(share(gap) * 100)}%` }));
      return el('div', { class: 'gaps-section' }, head, el('div', { class: 'gaps-line' }, stateLine(gap)), bar,
        el('p', { class: 'hint' }, gap.open ? 'Resolved when every part is.' : 'Every part of it is resolved.'));
    }
    const line = el('div', { class: 'gaps-line' + (gap.state === 'open' ? ' open' : '') }, stateLine(gap));
    const button = gap.state === 'open' ? word('Resolve', 'Resolve this gap, by judgement', () => act('resolve')) : word('Open again', 'Open this gap again', () => act('reopen'));
    return el('div', { class: 'gaps-section' }, head, line, el('div', { class: 'gaps-open' }, button));
  }
}
