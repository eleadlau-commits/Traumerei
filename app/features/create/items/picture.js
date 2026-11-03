// A picture: a small JPEG (a data: URL) and its caption.
export default {
  kind: 'picture',
  name: 'Picture',
  tidy(f, h) {
    const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
    return src ? { src, text: h.oneLine(f.text) } : null;
  },
  text: (th) => (th.text ? `[${th.text}]` : '[picture]'),
  node: (th, el) => el('figure', { class: 'create-picture', 'data-id': th.id },
    el('img', { src: th.src, alt: th.text || 'A picture', draggable: 'false' }),
    th.text ? el('figcaption', {}, th.text) : null),
};
