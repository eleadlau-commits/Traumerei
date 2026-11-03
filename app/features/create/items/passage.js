// A passage: a title and a paragraph, or a small article.
import { maths } from '../maths.js';

export default {
  kind: 'passage',
  name: 'Passage',
  tidy(f, h) {
    const title = h.oneLine(f.title), body = h.lines(f.body);
    return title || body ? { title, body } : null;
  },
  text: (th) => [th.title, th.body].filter(Boolean).join(' — '),
  node: (th, el) => el('div', { class: 'create-passage', 'data-id': th.id },
    th.title ? el('div', { class: 'create-passage-title' }, maths(th.title)) : null,
    th.body ? el('div', { class: 'create-passage-body' }, maths(th.body)) : null),
};
