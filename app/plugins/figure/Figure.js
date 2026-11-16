// Figure: a kind of mark, a picture with a caption, that flows among paragraphs (inline: a rule
// laying a column, such as Page flow, sets it between them at its own height). The picture is kept
// in the mark as a data address, shrunk on the way in; the caption is its words. A corpus plugin
// (open core, step 5): written against app/core/API.md alone. Saves nothing outside the tables.
import { Feature } from 'folio';

const MAX = 900; // the longest side kept, in pixels

// A picture file as { src, ratio } (height over width), shrunk to MAX on its longest side.
export async function fromFile(file) {
  const src = await new Promise((done, fail) => { const r = new FileReader(); r.onload = () => done(r.result); r.onerror = fail; r.readAsDataURL(file); });
  if (typeof Image === 'undefined') return { src, ratio: 0.6, caption: file.name || '' };
  const img = await new Promise((done, fail) => { const i = new Image(); i.onload = () => done(i); i.onerror = fail; i.src = src; });
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/jpeg', 0.86), ratio: +(img.height / img.width).toFixed(4), caption: (file.name || '').replace(/\.[a-z0-9]+$/i, '') };
}

export const KIND = {
  kind: 'figure', name: 'Figure',
  tidy: (f, h) => {
    const src = typeof f.src === 'string' && /^data:image\//.test(f.src) ? f.src : '';
    const caption = h.oneLine(f.caption ?? f.text ?? '');
    if (!src && !caption) return null;
    const ratio = Number.isFinite(+f.ratio) && +f.ratio > 0 ? Math.min(4, +f.ratio) : 0.6;
    return { src, caption, ratio };
  },
  text: (th) => th.caption || 'Figure',
  node: (th, el) => el('figure', { class: 'figure-kind' },
    th.src ? el('img', { src: th.src, alt: th.caption || '', style: 'width:100%;display:block' }) : null,
    el('figcaption', { class: 'label' }, th.caption || '')),
  fields: [{ key: 'src', type: 'image', label: 'Picture' }, { key: 'caption', type: 'line', label: 'Caption' }],
  add: { note: 'A picture with a caption', file: 'image/*' },
  fromFile,
  // It flows among paragraphs: the picture at the width it is given, and a line for its caption.
  inline: true,
  height: (th, width) => Math.round((th.src ? width * (th.ratio || 0.6) : 0) + 34),
};

export function install(t) { t.slots.kinds.add(KIND); }

export default class Figure extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
