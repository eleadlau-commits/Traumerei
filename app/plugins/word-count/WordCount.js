// Word count: an Editor section that counts the chosen thought's words and characters; for a
// group, its parts' too. A corpus plugin (kernel phase 8): written against app/core/API.md alone.
// Saves nothing.
import { Feature, ui } from 'folio';

export const words = (text) => (String(text || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;
export function count(t, mark) {
  const parts = t.links.members(mark);
  const ids = parts.length ? parts : [mark];
  const text = ids.map((id) => t.marks.text(id)).join(' ');
  return { words: words(text), chars: text.replace(/\s/g, '').length, parts: parts.length };
}

export function install(t) {
  t.slots.editor.add({ id: 'word-count', order: 90, when: (x) => !!t.marks.get(x.id), render: (x) => {
    const c = count(t, x.id);
    return ui.el('p', { class: 'hint small' }, `${c.words} ${c.words === 1 ? 'word' : 'words'}, ${c.chars} characters${c.parts ? ` in ${c.parts} parts` : ''}`);
  } });
}

export default class WordCount extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
