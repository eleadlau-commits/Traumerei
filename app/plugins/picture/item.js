// A picture: a small JPEG (a data: URL) and its caption, as an item kind (world/items/index.js
// says the shape). `picture(parts)` makes the kind from what it needs of the plugin API: maths
// (a caption's LaTeX drawn) and shrinkPicture (a file made small enough to keep). Tests pass the
// same parts from surface(lib).

export const ACCEPT = 'image/*';

export function picture({ maths, shrinkPicture }) {
  return {
    kind: 'picture',
    name: 'Picture',
    tidy(f, h) {
      const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
      return src ? { src, text: h.oneLine(f.text) } : null;
    },
    text: (th) => (th.text ? `[${th.text}]` : '[picture]'),
    label: (th) => th.text || 'A picture',
    // In a .traum file (the roomfile plugin): ## ^id picture: its caption, then its address on one
    // line: a data:image/… URL, or https://… (kept as url until the room fetches it).
    traum: {
      read: ({ title, body }) => {
        const at = String(body || '').trim();
        return at.startsWith('data:') ? { kind: 'picture', src: at, text: title || '' } : { kind: 'picture', url: at, text: title || '' };
      },
      write: (th) => ({ title: th.text || '', body: th.src }),
    },
    node: (th, el) => el('figure', { class: 'room-picture', 'data-id': th.id },
      el('img', { src: th.src, alt: th.text || 'A picture', draggable: 'false' }),
      th.text ? el('figcaption', {}, maths(th.text)) : null),
    // Made from a file: picked from Add (Alt+I), or pasted or dropped on the room; then captioned.
    fields: [
      { key: 'src', type: 'image', label: 'The picture' },
      { key: 'text', type: 'line', label: 'A caption (optional)' },
    ],
    add: { note: 'a file, with a caption', keys: ['Alt+I'], file: ACCEPT },
    takes: (file) => !!file?.type?.startsWith('image/'),
    fromFile: async (file) => ({ src: await shrinkPicture(file), text: '' }),
    step: 270,
  };
}
