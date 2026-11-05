// A line: a passing thought, written until Enter. Ctrl+Enter puts a new line inside it.
import { maths } from '../maths.js';

export default {
  kind: 'line',
  name: 'Thought',
  tidy(f, h) {
    const text = h.lines(String(f.text ?? '').split('\n').map(h.oneLine).join('\n'));
    return text ? { text } : null;
  },
  text: (th) => th.text || '',
  // In a .traum file (the roomfile feature): its words are the object's body (## ^id line, then the
  // words). A title on the header (## ^id line: words) is read as its first line.
  traum: {
    read: ({ title, body }) => ({ kind: 'line', text: [title, body].filter(Boolean).join('\n') }),
    write: (th) => ({ body: th.text }),
  },
  node: (th, el) => el('span', { class: 'room-thought', 'data-id': th.id }, maths(th.text)),
};
