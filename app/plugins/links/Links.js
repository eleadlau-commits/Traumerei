// Links: the hands for every kind of link a plugin declares (cites, contradicts, …). An Editor
// section lists the chosen thought's links of those kinds, both ways, each with a word to take it
// away, and links it to another thought found by its words, in any room.
// A corpus plugin (kernel phase 8): written against app/core/API.md alone. Saves nothing.
import { Feature, ui } from 'folio';

const { el } = ui;
const STRUCTURE = ['part of', 'stands for', 'relation'];

// The chosen mark's links of declared kinds, as lines: { id, kind, other, out }.
export function linesOf(t, mark) {
  const kinds = t.links.kinds().filter((k) => !STRUCTURE.includes(k));
  const out = t.links.from(mark).filter((r) => kinds.includes(r.kind)).map((r) => ({ id: r.id, kind: r.kind, other: r.to, out: true }));
  const back = t.links.to(mark).filter((r) => kinds.includes(r.kind)).map((r) => ({ id: r.id, kind: r.kind, other: r.from, out: false }));
  return [...out, ...back];
}
const short = (words) => (words.length > 40 ? `${words.slice(0, 39)}…` : words) || '(empty)';

export function install(t) {
  t.slots.editor.add({
    id: 'links', order: 45,
    when: (x) => !!t.marks.get(x.id) && t.links.kinds().some((k) => !STRUCTURE.includes(k)),
    render: (x) => {
      const kinds = t.links.kinds().filter((k) => !STRUCTURE.includes(k));
      const say = (r) => { if (!r.ok) t.ui.toast(r.reason); else x.refresh(); };
      const rows = linesOf(t, x.id).map((l) => el('div', { class: 'links-row' },
        el('span', {}, `${l.out ? '' : '← '}${t.links.named(l.kind)?.name || l.kind} ${short(t.marks.text(l.other))}`),
        el('button', { type: 'button', class: 'word', disabled: x.locked || null, title: 'Take this link away', onclick: () => say(t.links.unlink(l.id)) }, '✕')));
      const kind = el('select', { class: 'links-kind' }, ...kinds.map((k) => el('option', { value: k }, t.links.named(k)?.name || k)));
      const found = el('div', { class: 'links-found' });
      const find = el('input', { type: 'search', placeholder: 'Link to… (words)', class: 'links-find', disabled: x.locked || null,
        oninput: () => {
          found.replaceChildren(...t.marks.search(find.value, 6).filter((m) => m.id !== x.id && m.kind !== 'group').map((m) =>
            el('button', { type: 'button', class: 'word', onclick: () => say(t.links.link(x.id, m.id, kind.value)) }, short(t.marks.text(m.id)))));
        } });
      return el('div', { class: 'links-section' }, el('div', { class: 'label' }, 'Links'), ...rows, el('div', { class: 'links-add' }, kind, find), found);
    },
  });
}

export default class Links extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
