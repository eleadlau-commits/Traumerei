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
  // In room Markdown (the roomfile feature's format.js): "- words", and each further line indented under it.
  md: {
    order: 20,
    read(lines, i) {
      const m = /^-(?:\s+(.*))?$/.exec(lines[i]);
      if (!m) return null;
      const out = [m[1] || ''];
      let j = i + 1;
      while (j < lines.length) {
        if (/^\s+\S/.test(lines[j])) { out.push(lines[j].trim()); j++; continue; }
        // Blank lines stay inside when an indented line follows them.
        let k = j;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k > j && k < lines.length && /^\s+\S/.test(lines[k])) { for (; j < k; j++) out.push(''); continue; }
        break;
      }
      return { fields: { kind: 'line', text: out.join('\n') }, end: j };
    },
    write: (th) => th.text.split('\n').map((l, k) => (k ? (l ? '  ' + l : '') : '- ' + l)).join('\n'),
  },
  // In a .traum file (the roomfile feature): its words are the object's body (## ^id line, then the
  // words). A title on the header (## ^id line: words) is read as its first line.
  traum: {
    read: ({ title, body }) => ({ kind: 'line', text: [title, body].filter(Boolean).join('\n') }),
    write: (th) => ({ body: th.text }),
  },
  node: (th, el) => el('span', { class: 'room-thought', 'data-id': th.id }, maths(th.text)),
};
