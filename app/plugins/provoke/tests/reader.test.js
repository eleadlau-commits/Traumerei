// Tests for Provoke's reader (reader.js): pure functions, no app. `python build.py test` runs them.

import { test, assert } from 'folio/testing';
import { stem, words, vectors, neighbours, communities, label, learn, score, read, PRIOR } from '../reader.js';

const ROOM = ['Bake the sourdough bread at dawn', 'Sourdough starter needs feeding daily', 'Knead bread dough for ten minutes', 'The oven must be hot for bread baking',
  'Practise the Chopin nocturne slowly', 'Schumann wrote Träumerei for piano', 'Piano pedalling in the nocturne', 'Chopin and Schumann were born in 1810',
  'call mum', 'buy stamps'];
const docs = ROOM.map((text, i) => ({ id: `m${i}`, text, at: i * 864e5 }));

test('stems and words: suffixes go, stop words and numbers stay out', () => {
  assert.deepEqual(['running', 'studies', 'planets', 'baking', 'nation'].map(stem), ['run', 'study', 'planet', 'bak', 'nation']);
  assert.deepEqual(words('The 1810 Träumerei, for piano!'), ['träumerei', 'piano']);
});

test('vectors are unit length, and the nearest neighbour of a thought shares its theme', () => {
  const { vecs } = vectors(docs);
  for (const v of vecs.slice(0, 8)) assert.ok(Math.abs(Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) - 1) < 1e-9);
  const near = neighbours(vecs, 3);
  for (let i = 0; i < 8; i++) assert.equal(Math.floor(near[i][0].j / 4), Math.floor(i / 4), `thought ${i}'s nearest is ${near[i][0].j}`);
});

test('Louvain finds two triangles joined by one thin edge, deterministically', () => {
  const e = [[0, 1, 1], [1, 2, 1], [0, 2, 1], [3, 4, 1], [4, 5, 1], [3, 5, 1], [2, 3, 0.1]];
  const c = communities(e, 6);
  assert.ok(c[0] === c[1] && c[1] === c[2] && c[3] === c[4] && c[4] === c[5] && c[0] !== c[3]);
  assert.deepEqual(communities(e, 6), c);
  const ring = [[0, 1, 1], [1, 2, 1], [2, 3, 1], [3, 0, 1], [4, 5, 1]]; // a four-ring is one community, not two pairs
  const r = communities(ring, 6);
  assert.ok(r[0] === r[1] && r[1] === r[2] && r[2] === r[3] && r[4] === r[5] && r[0] !== r[4]);
});

test('a cluster is named by the words it has and the room lacks', () => {
  const { vecs, df, surface } = vectors(docs);
  assert.deepEqual(label([0, 1, 2, 3], vecs, df, surface, docs.length), ['bread', 'sourdough']);
});

test('the reading: the two themes come back as groups, nothing for the stray errands, best first', () => {
  const found = read(docs);
  const groups = found.filter((p) => p.kind === 'group').map((p) => p.marks.join());
  assert.deepEqual(groups.sort(), ['m0,m1,m2,m3', 'm4,m5,m6,m7']);
  assert.ok(!found.some((p) => p.marks.includes('m8') || p.marks.includes('m9')));
  assert.ok(found.filter((p) => p.kind === 'link').every((p) => Math.floor(+p.marks[0].slice(1) / 4) === Math.floor(+p.marks[1].slice(1) / 4)));
  const scores = found.filter((p) => p.kind === 'link').map((p) => p.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
  assert.deepEqual(read(docs, { skip: (kind) => kind === 'group' }).filter((p) => p.kind === 'group'), []);
});

test('learning: no verdicts is the prior; refusals of weak likeness raise the bar, keeps lower it', () => {
  assert.deepEqual(learn([], PRIOR.link), PRIOR.link);
  const x = (sim) => [1, sim, 1, 1, 0, 0];
  const harsh = learn([0.2, 0.22, 0.25, 0.3].map((s) => ({ x: x(s), y: 0 })), PRIOR.link);
  const kind = learn([0.15, 0.16, 0.18].map((s) => ({ x: x(s), y: 1 })), PRIOR.link);
  assert.ok(score(harsh, x(0.25)) < score(PRIOR.link, x(0.25)));
  assert.ok(score(kind, x(0.15)) > score(PRIOR.link, x(0.15)));
  assert.ok(score(harsh, x(0.25)) < 0.5 && score(PRIOR.link, x(0.25)) >= 0.5);
});

test('a dense embedding blended in changes who is nearest', () => {
  const { vecs } = vectors(docs);
  const dense = docs.map((d, i) => (i === 8 || i === 9 ? [1, 0] : [0, 1]));
  const near = neighbours(vecs, 3, { dense, blend: 0.9 });
  assert.equal(near[8][0].j, 9);
});

test('a 1,500-thought room is read in under a second', () => {
  const big = Array.from({ length: 1500 }, (_, i) => ({ id: `b${i}`, text: `${['river', 'stone', 'light', 'garden', 'letter'][i % 5]} thought ${i} ${ROOM[i % ROOM.length]}`, at: i }));
  const start = performance.now();
  read(big);
  assert.ok(performance.now() - start < 1000, `${(performance.now() - start).toFixed(0)} ms`);
});
