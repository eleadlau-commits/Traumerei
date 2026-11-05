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
  // In room Markdown (the roomfile feature's format.js): "### Title" and the paragraphs under it, blank lines
  // between them, until the next thing; a bare ### for no title. A paragraph with no ### above it
  // is a passage of its own. Lines that would read as something else get a backslash (h.escape).
  md: {
    order: 90, // last: whatever nothing else takes is a paragraph
    read(lines, i, h) {
      const m = /^###(?:\s+(.*?))?\s*$/.exec(lines[i]);
      const titled = !!m;
      let j = titled ? i + 1 : i;
      const body = [];
      while (j < lines.length) {
        const l = lines[j];
        const stop = h.structural(l) || (!titled && !l.trim());
        if (stop && !(h.mathOpen(body) && h.closesAhead(lines, j))) break;
        body.push(h.unescape(l));
        j++;
      }
      return { fields: { kind: 'passage', title: titled ? (m[1] || '') : '', body: body.join('\n') }, end: j };
    },
    write: (th, h) => [th.title ? `### ${th.title}` : '###', ...(th.body ? th.body.split('\n').map(h.escape) : [])].join('\n'),
  },
  // In a .traum file (the roomfile feature): ## ^id passage: its title, then its body as written.
  traum: {
    read: ({ title, body }) => ({ kind: 'passage', title: title || '', body }),
    write: (th) => ({ title: th.title || '', body: th.body || '' }),
  },
  node: (th, el) => el('div', { class: 'room-passage', 'data-id': th.id },
    th.title ? el('div', { class: 'room-passage-title' }, maths(th.title)) : null,
    th.body ? el('div', { class: 'room-passage-body' }, maths(th.body)) : null),
};
