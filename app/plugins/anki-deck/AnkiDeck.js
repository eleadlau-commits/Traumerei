// Anki deck out: the open room as flashcards Anki imports (tab-separated text). A card's front
// is a thought; its back is what it belongs to: its group's title, the parent it hangs from, or
// the thought a link points to. A corpus plugin (kernel phase 8): written against
// app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

const clean = (s) => String(s || '').replace(/[\t\n]+/g, ' ').trim();
export function cards(t, room) {
  const out = [];
  for (const m of t.marks.in(room) || []) {
    if (m.kind === 'group') continue;
    const backs = [
      ...t.links.holders(m.id).map((g) => t.marks.get(g)?.title).filter(Boolean),
      ...t.links.from(m.id).filter((l) => l.kind !== 'part of').map((l) => `${l.label || t.links.named(l.kind)?.name || l.kind}: ${t.marks.text(l.to)}`),
    ];
    if (backs.length) out.push([clean(t.marks.text(m.id)), clean(backs.join(' · '))]);
  }
  return out;
}
export const deck = (t, room) => `#separator:tab\n#html:false\n#deck:${clean(t.marks.text(room))}\n${cards(t, room).map((c) => c.join('\t')).join('\n')}\n`;

export function install(t) {
  t.slots.commands.add({ id: 'anki.out', zone: 'room', order: 70, words: 'Export this room as an Anki deck',
    when: () => !!t.ui.chosen()?.context,
    run: () => { const r = t.ui.chosen().context, n = cards(t, r).length; if (!n) { t.ui.toast('No cards: group thoughts or link them first'); return; } t.ui.download(`${t.marks.text(r) || 'deck'}.anki.txt`, deck(t, r)); t.ui.toast(`${n} cards`); } });
}

export default class AnkiDeck extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
