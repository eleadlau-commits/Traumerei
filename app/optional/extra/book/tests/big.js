// A big book for the speed budgets (tests/speed.mjs --world): the sample, then 30 chapters of 50
// paragraphs each, every paragraph in the book, so 1,550 thoughts laid out on pages. sample.js's
// own room is padded with thoughts not yet in the book instead; this one times a book written.

import { sampleWorld as sample } from './sample.js';

export function sampleWorld(lib, chapters = 30, paras = 50) {
  const o = sample(lib);
  const { model, links: L } = lib;
  let t = 1_790_000_000_000;
  for (let c = 1; c <= chapters; c++) {
    const ch = model.create(o.w, o.room, { kind: 'group', of: 'book-chapter', title: `Part ${c}`, family: true, x: 0, y: 0 }, t++);
    model.join(o.w, o.book, ch.id);
    const h = model.create(o.w, o.room, { kind: 'line', text: `Part ${c}` }, t++);
    model.join(o.w, ch.id, h.id);
    L.set(o.w, L.kindId('heads', h.id, ch.id), { from: h.id, to: ch.id, kind: 'heads' });
    for (let k = 0; k < paras; k++) {
      const p = model.create(o.w, o.room, { kind: 'line', text: `Paragraph ${c}.${k + 1} ${'word '.repeat(5 + (k * 7) % 40)}`.trim() }, t++);
      model.join(o.w, ch.id, p.id);
    }
  }
  return o;
}
