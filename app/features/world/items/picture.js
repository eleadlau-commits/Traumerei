// A picture: a small JPEG (a data: URL) and its caption.
import { maths } from '../maths.js';

export default {
  kind: 'picture',
  name: 'Picture',
  tidy(f, h) {
    const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
    return src ? { src, text: h.oneLine(f.text) } : null;
  },
  text: (th) => (th.text ? `[${th.text}]` : '[picture]'),
  // In room Markdown (the roomfile feature's format.js): ![caption](data:image/… or https://…). An https picture
  // keeps its address (url) until Create fetches it; one it can't becomes a line saying so.
  md: {
    order: 10,
    read(lines, i) {
      const m = /^!\[(.*)\]\((\S+)\)\s*$/.exec(lines[i]);
      if (!m) return null;
      const at = m[2];
      return { fields: at.startsWith('data:') ? { kind: 'picture', src: at, text: m[1] } : { kind: 'picture', url: at, text: m[1] }, end: i + 1 };
    },
    write: (th) => `![${th.text || ''}](${th.src})`,
  },
  node: (th, el) => el('figure', { class: 'create-picture', 'data-id': th.id },
    el('img', { src: th.src, alt: th.text || 'A picture', draggable: 'false' }),
    th.text ? el('figcaption', {}, maths(th.text)) : null),
};
