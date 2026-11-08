// Word linker: a reader by rule. In the open room it finds thoughts that share two or more
// uncommon words and links each such pair as "echoes" (one step, Ctrl+Z takes them all back);
// the Links section shows them, to keep or take away. A corpus plugin (kernel phase 8): written
// against app/core/API.md alone. Saves nothing.
import { Feature } from 'folio';

const STOP = new Set('a an and are as at be but by for from has have i in is it its not of on or so that the this to was were will with you your we our they them their there what when which who why how all any can do does if into no one out up then than too very just about'.split(' '));
export const wordsOf = (text) => new Set((String(text).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter((w) => !STOP.has(w)));

// The pairs of marks sharing at least `least` words that are in under half of the marks.
export function pairs(t, room, least = 2) {
  const marks = (t.marks.in(room) || []).filter((m) => m.kind !== 'group').map((m) => ({ id: m.id, words: wordsOf(t.marks.text(m.id)) }));
  const df = new Map();
  for (const m of marks) for (const w of m.words) df.set(w, (df.get(w) || 0) + 1);
  const rare = (w) => df.get(w) < Math.max(2, marks.length / 2);
  const out = [];
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
    const shared = [...marks[i].words].filter((w) => marks[j].words.has(w) && rare(w));
    if (shared.length >= least) out.push({ from: marks[i].id, to: marks[j].id, words: shared });
  }
  return out;
}

export function install(t) {
  t.slots.linkKinds.add({ kind: 'echoes', name: 'Echoes', note: 'the two share uncommon words (found by the word linker)', both: true });
  t.slots.commands.add({ id: 'word-linker.run', zone: 'room', order: 72, words: 'Link thoughts that share uncommon words',
    when: () => !!t.ui.chosen()?.context,
    run: () => {
      const found = pairs(t, t.ui.chosen().context);
      const made = t.together(() => found.filter((p) => t.links.link(p.from, p.to, 'echoes', null, { note: p.words.join(', ') }).ok).length);
      t.ui.toast(made ? `${made} echoes linked` : 'No new echoes');
    } });
}

export default class WordLinker extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
