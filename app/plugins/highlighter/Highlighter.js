import { Feature } from 'folio';
import { KIND, thoughtsIn, carriesMarkUp, rangeAtCaret, capitals, countLine, fileName } from './rules.js';

// Written from app/core/API.md alone (the API 3 freeze check); see README.md.
export function install(t) {
  // 1. The span: ==words== in Markdown, drawn with the one look's `highlight`.
  t.slots.spans.add({ kind: KIND, name: 'Highlight', class: 'highlight', md: ['==', '=='] });

  // 2. Ctrl+Shift+H while writing: mark-up on, or off where it is all marked up already.
  t.slots.commands.add({
    id: 'highlighter.toggle', keys: ['Ctrl+Shift+H'], words: 'Highlight', zone: 'editing',
    run: () => {
      const c = t.ui.text.caret();
      if (!c) return;
      const range = rangeAtCaret(c);
      if (!range) return t.ui.toast('Nothing to highlight here');
      t.ui.text.style(KIND, range[0], range[1]);
    },
  });

  // 3. Words in capitals, read-only and kept fast.
  t.slots.decorators.add({ id: 'highlighter.caps', decorate: (text) => capitals(text) });

  // 4. The strip: how many thoughts in the open room carry mark-up. Counted once per seq.
  let cache = { seq: null, context: null, n: 0 };
  const count = (context) => {
    const seq = t.moments.seq();
    if (cache.seq !== seq || cache.context !== context) {
      cache = { seq, context, n: thoughtsIn(t, context).filter(carriesMarkUp).length };
    }
    return cache.n;
  };
  t.slots.strip.add({
    id: 'highlighter.count',
    text: (context) => countLine(count(context)),
    title: () => 'Thoughts with a highlight in this room',
  });

  // 5. The bar: hand the open room out as Markdown, highlights as ==…==.
  const exportRoom = async (context) => {
    if (!context) return t.ui.toast('Open a room first');
    const marks = thoughtsIn(t, context).slice().sort((a, b) => a.at - b.at);
    const title = t.marks.text(context) || 'Room';
    const body = marks.map((m) => t.marks.markdown(m.id)).filter(Boolean).join('\n\n');
    const name = fileName(title);
    const saved = await t.ui.files.save(name, `# ${title}\n\n${body}\n`, 'text/markdown');
    if (saved) t.ui.toast(`Saved ${name}`);
  };
  t.slots.bar.add({
    id: 'highlighter.export', label: 'Markdown',
    title: () => 'Hand this room out as Markdown, with its highlights',
    run: (context) => exportRoom(context),
  });
  t.slots.commands.add({
    id: 'highlighter.export', keys: ['Ctrl+Alt+Shift+H'], words: 'Export the room as Markdown', zone: 'room',
    run: () => exportRoom(t.ui.chosen()?.context),
  });
  return { exportRoom };
}

export default class Highlighter extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
