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
  // In a .traum file (the roomfile feature): ## ^id passage: its title, then its body as written.
  traum: {
    read: ({ title, body }) => ({ kind: 'passage', title: title || '', body }),
    write: (th) => ({ title: th.title || '', body: th.body || '' }),
  },
  node: (th, el) => el('div', { class: 'room-passage', 'data-id': th.id },
    th.title ? el('div', { class: 'room-passage-title' }, maths(th.title)) : null,
    th.body ? el('div', { class: 'room-passage-body' }, maths(th.body)) : null),
};
