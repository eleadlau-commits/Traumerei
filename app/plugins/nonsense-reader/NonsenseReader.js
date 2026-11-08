// Nonsense reader: a machine reader that proposes only nonsense, to show the kernel refuses it.
// Every proposal is one the tables must turn down in words, changing nothing: marks there are
// not, a context that is not one, a link to itself, a gap with no direction, a due time that is
// no time, a reader no one is. Its command runs them all and says how many were refused.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

// [label, () => a propose's answer]: each must be { ok: false, reason }.
export function nonsense(t) {
  const any = (t.marks.ofKind('room')[0] || {}).id;
  const thought = any && (t.marks.in(any) || []).find((m) => m.kind !== 'group')?.id;
  return [
    ['edit a mark there is not', () => t.marks.edit('no-such-mark', { text: 'x' })],
    ['delete a mark there is not', () => t.marks.delete('no-such-mark')],
    ['make a thought nowhere', () => t.marks.make({ content: 'adrift' })],
    ['make a thought in no context', () => t.marks.make({ content: 'adrift', in: 'no-such-room' })],
    ['change a mark\'s kind', () => (thought ? t.marks.edit(thought, { kind: 'room' }) : { ok: false, reason: 'nothing to try' })],
    ['put a mark into what is not', () => t.places.put(thought || 'no-such-mark', 'no-such-room')],
    ['link a mark to itself', () => t.links.link(thought || 'x', thought || 'x', 'relation', null, { rule: 'russell' })],
    ['link with no kind', () => t.links.link(thought || 'x', any || 'y', 'nonsense')],
    ['unlink what is not', () => t.links.unlink('no-such-link')],
    ['open a gap with no direction', () => t.gaps.open(thought || 'x', 'sideways')],
    ['resolve a gap there is not', () => t.gaps.resolve('no-such-mark')],
    ['set due at no time', () => t.moments.due(thought || 'x', NaN)],
    ['declare for no one', () => t.distance.declare(any || 'x', 'everyone')],
    ['fold nothing', () => t.links.fold(any || 'x', [])],
  ];
}
export function run(t) {
  const out = nonsense(t).map(([label, propose]) => { let r; try { r = propose(); } catch (err) { r = { ok: true, reason: `threw: ${err.message}` }; } return { label, ...r }; });
  return { refused: out.filter((r) => r.ok === false && typeof r.reason === 'string' && r.reason).length, of: out.length, answers: out };
}

export function install(t) {
  t.slots.commands.add({ id: 'nonsense.run', zone: 'everywhere', order: 74, words: 'Let the nonsense reader propose (every proposal should be refused)',
    run: () => { const r = run(t); t.ui.toast(`${r.refused} of ${r.of} nonsense proposals refused`); } });
}

export default class NonsenseReader extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
