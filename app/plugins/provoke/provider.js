// Provoke's reader as an AI provider (app/core/AI.md): the first provider, and every task's
// fallback until our own system is there. It does `link`, `group`, `label` and `embed` with the
// pure functions of reader.js, in the browser, on nothing but the words it is handed. It learns
// from the maker's verdicts on its own suggestions (ctx.verdicts(): their features and whether
// they were kept), as Provoke did before it was a provider.

import { read, learn, vectors, label, PRIOR, FEATURES } from './reader.js';

export const ID = 'provoke-reader';
export const VERSION = '1';
const DIM = 256; // embed: hashed into this many numbers

// Weights from the verdicts it can read: its own (or older ones, made before providers had names).
export function weightsFrom(verdicts) {
  const ex = { link: [], group: [] };
  for (const v of verdicts) {
    if (v.provider && v.provider !== ID) continue;
    if (v.features.length !== FEATURES.length) continue;
    (ex[v.act] || ex.link).push({ x: [...v.features], y: v.kept ? 1 : 0 });
  }
  return { link: learn(ex.link, PRIOR.link), group: learn(ex.group, PRIOR.group), seen: ex.link.length + ex.group.length };
}

// The vectors handed in, as one plain list per item (reader.js blends them into the likeness).
const dense = (input) => {
  const v = input.vectors;
  if (!v) return null;
  return input.items.map((_, i) => Array.from(v.data.subarray(i * v.dim, (i + 1) * v.dim)));
};

export function provider() {
  // A link call and a group call on the same marks share one reading.
  let memo = null;
  const reading = (input, verdicts) => {
    const key = JSON.stringify([input.items, input.vectors ? Array.from(input.vectors.data) : null, verdicts.map((v) => `${v.suggestion}${v.kept ? '+' : '-'}`)]);
    if (memo?.key === key) return memo.found;
    const w = weightsFrom(verdicts);
    const docs = input.items.map((x) => ({ id: x.id, text: x.text, at: x.at }));
    const found = read(docs, { weights: w, most: 1e9, dense: dense(input) });
    memo = { key, found };
    return found;
  };
  const most = (input, list) => list.slice(0, input.most || list.length);
  return {
    id: ID, name: 'Provoke reader', version: VERSION, tasks: ['link', 'group', 'label', 'embed'],
    hints: { where: 'local', runs: 'main', speed: 'fast', memory: 20, fallback: true },
    run: async (task, input, ctx) => {
      if (task === 'link' || task === 'group') {
        const found = reading(input, ctx.verdicts(null)).filter((p) => p.kind === task);
        const out = most(input, found).map((p) => {
          const r = { score: p.score, why: p.words.length ? `They share ${p.words.join(', ')}` : '', words: [...p.words], features: p.x.map((x) => +x.toFixed(4)) };
          return task === 'link' ? { from: p.marks[0], to: p.marks[1], ...r } : { marks: [...p.marks], title: p.title || '', ...r };
        });
        return task === 'link' ? { links: out } : { groups: out };
      }
      if (task === 'label') {
        const { vecs, df, surface } = vectors(input.items);
        const all = input.items.map((_, i) => i);
        const words = label(all, vecs, df, surface, all.length, 2);
        return words.length ? { title: words.join(' and '), score: 0.5 } : { title: input.items[0]?.text.split('\n')[0].slice(0, 40) || 'Together', score: 0.1 };
      }
      if (task === 'embed') {
        const { vecs } = vectors(input.items);
        const data = new Float32Array(input.items.length * DIM);
        vecs.forEach((v, i) => {
          for (const [f, x] of v) { const h = typeof f === 'number' ? f : [...f].reduce((s, c) => Math.imul(s ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0; data[i * DIM + (h % DIM)] += x; }
          let n = 0; for (let j = 0; j < DIM; j++) n += data[i * DIM + j] ** 2;
          n = Math.sqrt(n) || 1; for (let j = 0; j < DIM; j++) data[i * DIM + j] /= n;
        });
        return { vectors: { dim: DIM, data } };
      }
      throw new Error(`Provoke's reader does not do ${task}`);
    },
  };
}
