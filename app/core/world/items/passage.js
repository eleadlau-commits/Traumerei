// A passage: a title and a paragraph, or a small article.
import { maths } from '../maths.js';

export default {
  kind: 'passage',
  name: 'Passage',
  tidy(f, h) {
    const title = h.oneLine(f.title), text = h.lines(f.text ?? f.body); // (its words were `body` before phase 6)
    return title || text ? { title, text } : null;
  },
  text: (th) => [th.title, th.text].filter(Boolean).join(' — '),
  fields: [
    { key: 'title', type: 'line', label: 'Title' },
    { key: 'text', type: 'text', label: 'A paragraph, or a small article' },
  ],
  add: { note: 'a title and a body', keys: ['Alt+P'] },
  step: 190,
  node: (th, el) => el('div', { class: 'room-passage', 'data-id': th.id },
    th.title ? el('div', { class: 'room-passage-title' }, maths(th.title)) : null,
    th.text ? el('div', { class: 'room-passage-body' }, maths(th.text)) : null),
};
