// Provoke's reader: what a room's thoughts have in common, found in the browser with no model and
// no network. Pure functions of plain data; nothing here knows the app.
//
//   vectors(docs)          each thought as a sparse vector: TF-IDF over word stems, plus hashed
//                          character trigrams at half weight (so "river" meets "rivers", and words
//                          of any language meet their own inflections)
//   neighbours(vecs, k)    the k most alike for each thought, through an inverted index (only
//                          features under a document-frequency cap are walked, so a 1,500-thought
//                          room is read in well under a second)
//   communities(edges, n)  groups in the neighbour graph, by local moving on modularity (the first
//                          phase of Louvain), deterministic
//   label(members, docs)   a cluster's name: its most telling words (class-based TF-IDF)
//   learn(examples, prior) logistic regression pulled toward a prior: with no verdicts it is the
//                          prior; each kept or refused suggestion moves it
//   read(docs, options)    all of it: proposals of links and groups, each with its features and score
//
// A document is { id, text, at?, grouped? } (grouped: it is a part of some group already).

const STOP = new Set(('a an and are as at be been but by can could did do does for from had has have he her his i if in into is it its '
  + 'me my no not of on or our she so than that the their them then there these they this those to too up us was we were what when '
  + 'which who why will with would you your about all also any just more most much one only other some such very how out over '
  + 'der die das und ist nicht ein eine zu mit von den dem le la les et est un une des du que qui pas pour dans').split(' '));

// A word's stem: a light suffix stripper (English first; other languages lean on the trigrams).
export function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  for (const s of ['ational', 'ization', 'fulness', 'iveness', 'ations', 'ation', 'ments', 'ment', 'ness', 'ings', 'ing', 'edly', 'ed', 'ly', 'es', 's']) {
    if (w.length - s.length >= 3 && w.endsWith(s)) {
      w = w.slice(0, -s.length);
      if (s === 'ing' || s === 'ed' || s === 'ings') { if (/(.)\1$/.test(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1); }
      return w;
    }
  }
  return w;
}

export const words = (text) => (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));

const HASH = 1 << 14;
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % HASH; }

// Feature keys: 'w:<stem>' (word) and numbers (trigram buckets). Returns { vecs, df, surface }.
// vecs[i]: Map(feature → weight), unit length. surface: stem → its most used spelling.
export function vectors(docs) {
  const n = docs.length;
  const raw = [], df = new Map(), seen = new Map();
  for (const d of docs) {
    const tf = new Map();
    for (const w of words(d.text)) {
      const s = 'w:' + stem(w);
      tf.set(s, (tf.get(s) || 0) + 1);
      const sp = seen.get(s) || new Map(); sp.set(w, (sp.get(w) || 0) + 1); seen.set(s, sp);
      const padded = ` ${w} `;
      for (let i = 0; i + 3 <= padded.length; i++) { const g = hash(padded.slice(i, i + 3)); tf.set(g, (tf.get(g) || 0) + 1); }
    }
    for (const f of tf.keys()) df.set(f, (df.get(f) || 0) + 1);
    raw.push(tf);
  }
  const vecs = raw.map((tf) => {
    const v = new Map();
    let nw = 0, ng = 0;
    for (const [f, c] of tf) {
      const idf = Math.log((1 + n) / (1 + df.get(f))) + 1;
      const x = (1 + Math.log(c)) * idf;
      v.set(f, x);
      if (typeof f === 'string') nw += x * x; else ng += x * x;
    }
    // Words and trigrams are each made unit length, then trigrams weigh half: a shared word counts
    // more than a shared spelling.
    nw = Math.sqrt(nw) || 1; ng = Math.sqrt(ng) || 1;
    const norm = Math.sqrt(1 + 0.25);
    for (const [f, x] of v) v.set(f, (typeof f === 'string' ? x / nw : (0.5 * x) / ng) / norm);
    return v;
  });
  const surface = new Map();
  for (const [s, sp] of seen) surface.set(s, [...sp].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0]);
  return { vecs, df, surface };
}

// The k nearest neighbours of every vector, as [[{ j, sim }…]…], most alike first. A feature in
// more than `cap` of the documents is left out of the walk (it tells little and costs most).
export function neighbours(vecs, k = 8, { cap = Math.max(8, Math.ceil(vecs.length * 0.12)), dense = null, blend = 0.5 } = {}) {
  const n = vecs.length;
  const post = new Map();
  vecs.forEach((v, i) => { for (const [f, x] of v) { let p = post.get(f); if (!p) post.set(f, (p = [])); p.push(i, x); } });
  const unit = dense ? dense.map((v) => { const a = Float32Array.from(v || []); const l = Math.sqrt(dot(a, a)) || 1; return a.map((x) => x / l); }) : null;
  const out = new Array(n);
  const acc = new Float64Array(n);
  const touched = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const [f, x] of vecs[i]) {
      const p = post.get(f);
      if (p.length / 2 > cap) continue;
      for (let q = 0; q < p.length; q += 2) {
        const j = p[q];
        if (j === i) continue;
        if (acc[j] === 0) touched[m++] = j;
        acc[j] += x * p[q + 1];
      }
    }
    // With embeddings every other thought is a candidate (meaning may share no word); without,
    // only those the index reached.
    const best = [];
    const consider = (j, sim) => {
      if (best.length < k) { best.push({ j, sim }); if (best.length === k) best.sort((a, b) => b.sim - a.sim); }
      else if (sim > best[k - 1].sim) { best[k - 1] = { j, sim }; best.sort((a, b) => b.sim - a.sim); }
    };
    if (unit) {
      for (let j = 0; j < n; j++) if (j !== i) consider(j, (1 - blend) * acc[j] + blend * dot(unit[i], unit[j]));
      for (let q = 0; q < m; q++) acc[touched[q]] = 0;
    } else {
      for (let q = 0; q < m; q++) { const j = touched[q]; consider(j, acc[j]); acc[j] = 0; }
    }
    out[i] = best.sort((a, b) => b.sim - a.sim || a.j - b.j);
  }
  return out;
}

const dot = (a, b) => { let d = 0; const l = Math.min(a.length, b.length); for (let i = 0; i < l; i++) d += a[i] * b[i]; return d; };

// Communities in a weighted graph (edges: [i, j, w], undirected), by Louvain: each node in turn
// joins the neighbouring community it gains most modularity by, until nothing moves; then each
// community becomes one node and the moving starts again, until no community merges. Deterministic.
// Returns the community of each node.
export function communities(edges, n, { rounds = 20 } = {}) {
  let comm = Array.from({ length: n }, (_, i) => i);
  let graph = { n, edges, loops: new Float64Array(n) };
  for (let level = 0; level < 8; level++) {
    const moved = localMoving(graph, rounds);
    const ids = new Map();
    for (const c of moved) if (!ids.has(c)) ids.set(c, ids.size);
    if (ids.size === graph.n) break;
    comm = comm.map((c) => ids.get(moved[c]));
    const loops = new Float64Array(ids.size), agg = new Map();
    for (let i = 0; i < graph.n; i++) loops[ids.get(moved[i])] += graph.loops[i];
    for (const [i, j, w] of graph.edges) {
      const a = ids.get(moved[i]), b = ids.get(moved[j]);
      if (a === b) loops[a] += w;
      else { const key = a < b ? a * ids.size + b : b * ids.size + a; agg.set(key, (agg.get(key) || 0) + w); }
    }
    graph = { n: ids.size, loops, edges: [...agg].map(([key, w]) => [Math.floor(key / ids.size), key % ids.size, w]) };
  }
  return comm;
}

function localMoving({ n, edges, loops }, rounds) {
  const adj = Array.from({ length: n }, () => []);
  let total = 0;
  for (const [i, j, w] of edges) { adj[i].push(j, w); adj[j].push(i, w); total += w; }
  for (let i = 0; i < n; i++) total += loops[i];
  const comm = Array.from({ length: n }, (_, i) => i);
  if (!total) return comm;
  const m2 = 2 * total;
  const deg = adj.map((a, i) => { let s = 2 * loops[i]; for (let q = 1; q < a.length; q += 2) s += a[q]; return s; });
  const tot = deg.slice();
  for (let round = 0; round < rounds; round++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      if (!adj[i].length) continue;
      const own = comm[i];
      const links = new Map();
      for (let q = 0; q < adj[i].length; q += 2) { const c = comm[adj[i][q]]; links.set(c, (links.get(c) || 0) + adj[i][q + 1]); }
      tot[own] -= deg[i];
      let best = own, gain = (links.get(own) || 0) - (tot[own] * deg[i]) / m2;
      for (const [c, kin] of links) {
        const g = kin - (tot[c] * deg[i]) / m2;
        if (g > gain + 1e-12) { gain = g; best = c; }
      }
      tot[best] += deg[i];
      if (best !== own) { comm[i] = best; moved++; }
    }
    if (!moved) break;
  }
  return comm;
}

// A cluster's name: the words it has that the rest of the room has least (class-based TF-IDF).
export function label(members, vecs, df, surface, n, most = 2) {
  const score = new Map();
  for (const i of members) for (const [f, x] of vecs[i]) if (typeof f === 'string') score.set(f, (score.get(f) || 0) + x);
  const ranked = [...score].map(([f, s]) => [f, (s / members.length) * Math.log(1 + n / df.get(f))])
    .filter(([f]) => [...members].filter((i) => vecs[i].has(f)).length >= Math.min(2, members.length))
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return ranked.slice(0, most).map(([f]) => surface.get(f) || f.slice(2));
}

// -- Learning from verdicts. A suggestion's features are numbers in a fixed order (FEATURES); its
// verdict 1 (kept) or 0 (refused). The weights are the prior's until verdicts come, then a
// logistic regression with an L2 pull toward the prior (MAP): a handful of verdicts bends it, many
// overrule it. --
export const FEATURES = Object.freeze(['bias', 'likeness', 'shared', 'mutual', 'size', 'apart']);
export const PRIOR = Object.freeze({ link: [-2.4, 9, 0.5, 0.6, 0, -0.15], group: [-2, 8, 0.3, 0, 0.15, -0.1] });

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const score = (w, x) => sigmoid(w.reduce((s, wi, i) => s + wi * (x[i] ?? 0), 0));

export function learn(examples, prior, { pull = 1, rate = 0.5, steps = 300 } = {}) {
  const w = prior.slice();
  if (!examples.length) return w;
  for (let s = 0; s < steps; s++) {
    const g = w.map((wi, i) => pull * (wi - prior[i]));
    for (const { x, y } of examples) {
      const e = score(w, x) - y;
      for (let i = 0; i < w.length; i++) g[i] += e * (x[i] ?? 0);
    }
    const step = rate / (1 + examples.length * 0.1);
    for (let i = 0; i < w.length; i++) w[i] -= step * g[i];
  }
  return w;
}

// -- The whole reading. Returns proposals, best first:
//   { kind: 'link', marks: [a, b], words: [shared words], x: features, score }
//   { kind: 'group', marks: [...], title, words, x, score }
// options: k, weights ({ link, group } learned), skip(kind, ids) → true for what was proposed
// before or is already so, most (how many of each kind), dense (an embedding per document). --
export function read(docs, { k = 8, weights = PRIOR, skip = () => false, most = 6, dense = null, day = 864e5 } = {}) {
  const n = docs.length;
  if (n < 2) return [];
  const { vecs, df, surface } = vectors(docs);
  const near = neighbours(vecs, k, { dense });
  const isNear = (i, j) => near[i].some((e) => e.j === j);
  const sharedWords = (i, j) => [...vecs[i].keys()].filter((f) => typeof f === 'string' && vecs[j].has(f) && df.get(f) <= Math.max(2, n / 3))
    .sort((a, b) => vecs[i].get(b) * vecs[j].get(b) - vecs[i].get(a) * vecs[j].get(a)).map((f) => surface.get(f) || f.slice(2));
  const apart = (i, j) => (docs[i].at && docs[j].at ? Math.log10(1 + Math.abs(docs[i].at - docs[j].at) / day) : 0);

  // Links: each pair that are among each other's nearest, or one of them very near.
  const links = [];
  const edges = [];
  for (let i = 0; i < n; i++) for (const { j, sim } of near[i]) {
    if (sim <= 0) continue;
    const mutual = isNear(j, i);
    if (i < j || !mutual) edges.push([i, j, sim]);
    if (!(i < j) && mutual) continue;
    const ids = [docs[i].id, docs[j].id];
    if (sim < 0.12 || skip('link', ids)) continue;
    const said = sharedWords(i, j);
    const x = [1, sim, Math.min(said.length, 5), mutual ? 1 : 0, 0, apart(i, j)];
    links.push({ kind: 'link', marks: ids, words: said.slice(0, 4), x, score: score(weights.link, x) });
  }
  // Groups: communities of thoughts not yet part of a group, three to twelve strong.
  const strong = edges.filter(([, , s]) => s >= 0.15);
  const comm = communities(strong, n);
  const by = new Map();
  comm.forEach((c, i) => { if (!docs[i].grouped && strong.some(([a, b]) => a === i || b === i)) by.set(c, [...(by.get(c) || []), i]); });
  const groups = [];
  for (const members of by.values()) {
    if (members.length < 3 || members.length > 12) continue;
    const ids = members.map((i) => docs[i].id);
    if (skip('group', ids)) continue;
    let s = 0, c = 0;
    for (const [a, b, w] of strong) if (members.includes(a) && members.includes(b)) { s += w; c++; }
    const cohesion = c ? s / c : 0;
    const title = label(members, vecs, df, surface, n);
    if (!title.length) continue;
    const x = [1, cohesion, Math.min(title.length, 5), 0, Math.log2(members.length), 0];
    groups.push({ kind: 'group', marks: ids, title: title.join(' and '), words: title, x, score: score(weights.group, x) });
  }
  const best = (list) => list.filter((p) => p.score >= 0.5).sort((a, b) => b.score - a.score || (a.marks.join() < b.marks.join() ? -1 : 1)).slice(0, most);
  return [...best(groups), ...best(links)];
}
