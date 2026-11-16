// Bold and italic: Ctrl+B and Ctrl+I while writing a thought make the chosen words (or the word at
// the caret) bold or italic, and the look is kept in the thought (a span: material of the mark,
// carried in .traum files). The room comes out as Markdown with them (⋯ More). A corpus plugin
// (open core, step 2): written against app/core/API.md alone.
import { Feature } from 'folio';

// The word around a place in a text: [from, to].
export function wordAt(text, i) {
  const w = (c) => !!c && /[\p{L}\p{N}_'’]/u.test(c);
  let a = i, b = i;
  while (w(text[a - 1])) a--;
  while (w(text[b])) b++;
  return [a, b];
}

export function install(t) {
  t.slots.spans.add({ kind: 'bold', name: 'Bold', class: 'bold', md: ['**', '**'] });
  t.slots.spans.add({ kind: 'italic', name: 'Italic', class: 'italic', md: ['*', '*'] });
  const style = (kind) => () => {
    const c = t.ui.text.caret();
    if (!c) return;
    const [a, b] = c.from === c.to ? wordAt(c.text, c.from) : [c.from, c.to];
    if (a === b) return;
    t.ui.text.style(kind, a, b);
  };
  t.slots.commands.add({ id: 'bold-italic.bold', keys: ['Ctrl+B'], words: 'bold', zone: 'editing', run: style('bold') });
  t.slots.commands.add({ id: 'bold-italic.italic', keys: ['Ctrl+I'], words: 'italic', zone: 'editing', run: style('italic') });
  // The open room as Markdown: each thought a paragraph, its spans written as ** and *.
  t.slots.more.add({
    id: 'bold-italic.markdown', label: 'Markdown with bold and italic', icon: 'export', order: 80,
    visible: () => !!t.ui.chosen(),
    run: () => {
      const room = t.ui.chosen()?.context;
      if (!room) return;
      const text = t.marks.in(room).filter((m) => m.kind === 'line').sort((a, b) => a.at - b.at).map((m) => t.marks.markdown(m.id)).join('\n\n');
      t.ui.files.save(`${t.marks.get(room)?.name || 'room'}.md`, `${text}\n`, 'text/markdown');
    },
  });
}

export default class BoldItalic extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
