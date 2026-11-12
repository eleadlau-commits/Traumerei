// Kernel phase 9's gate: Provoke, a reader plugin over the frozen v2 API.
//   - a suggestion is a mark with an open gap to the maker;
//   - Keep and Refuse are moments (one step each): Keep resolves the gap by the link it made,
//     Refuse by judgement; what was judged is never suggested again, and the verdicts teach it;
//   - nothing in Provoke touches a table directly: its files import only Folio and themselves,
//     and it works with the rule kit (t.parts) taken away.
// The conformance suite (corpus.test.js) runs it as well.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../plugins/${id}/${file}`, import.meta.url).href); }
}
async function source(id, file) {
  for (const u of [`../../${id}/${file}`, `../../../plugins/${id}/${file}`]) {
    try { const url = new URL(u, import.meta.url); if (url.protocol === 'file:') return (await import('node:fs')).readFileSync(url, 'utf8'); const r = await fetch(url); if (r.ok) return r.text(); } catch { /* the other folder */ }
  }
  return null;
}
const P = await load('provoke', 'Provoke.js');

const THEMES = ['Bake the sourdough bread at dawn', 'Sourdough starter needs feeding daily', 'Knead bread dough for ten minutes', 'The oven must be hot for bread baking',
  'Practise the Chopin nocturne slowly', 'Schumann wrote Träumerei for piano', 'Piano pedalling in the nocturne', 'Chopin and Schumann were born in 1810', 'call mum',
  'Saturn rings are made of ice and dust', 'A telescope shows Saturn rings tonight'];

// A host whose study room holds the themed thoughts (and no train), with Provoke on.
function setup() {
  const host = makeHost({ thoughts: 0 });
  const L = host.lib.model;
  for (const id of L.roomItems(host.w, host.room).map((m) => m.id)) L.remove(host.w, id);
  const ids = THEMES.map((text) => L.create(host.w, host.room, { kind: 'line', text }, host.tick()).id);
  host.world.save();
  host.choose(host.room);
  const { t, off } = host.plug('provoke', P.install);
  return { host, t, off, ids };
}

test('provoke: every suggestion is a mark with an open gap to the maker, about thoughts in the room, laid in one step', async () => {
  const { host, t, ids } = setup();
  const steps = host.world.saved;
  const r = await P.provoke(t, host.room);
  assert.ok(r.ok && r.made >= 3, JSON.stringify(r));
  assert.equal(host.world.saved, steps + 1);
  const all = P.suggestions(t);
  assert.equal(all.length, r.made);
  for (const s of all) {
    assert.equal(t.marks.get(s.id).kind, 'suggestion');
    assert.equal(s.gap.direction, 'to maker');
    assert.equal(s.gap.state, 'open');
    assert.ok(s.subjects.length >= 2 && s.subjects.every((m) => ids.includes(m)));
    const desk = t.places.home(s.id);
    assert.ok(desk !== host.room && t.marks.get(desk).kind === 'room', 'suggestions sit in a room of their own');
  }
  const groups = all.filter((s) => s.act === 'group').map((s) => [...s.subjects].sort().join());
  assert.deepEqual(groups.sort(), [ids.slice(0, 4), ids.slice(4, 8)].map((g) => [...g].sort().join()).sort());
  assert.ok(!all.some((s) => s.subjects.includes(ids[8])), 'the stray errand is left alone');
  assert.ok(all.some((s) => s.act === 'link' && [...s.subjects].sort().join() === [ids[9], ids[10]].sort().join()), 'the Saturn pair is a link');
  assert.deepEqual(P.about(t, host.room).map((s) => s.id).sort(), all.map((s) => s.id).sort());
  assert.deepEqual(brokenLaws(host.w), []);
});

test('provoke: Keep makes the link or group and resolves the gap by it; Refuse resolves by judgement; one step each', async () => {
  const { host, t } = setup();
  await P.provoke(t, host.room);
  const all = P.suggestions(t);
  const link = all.find((s) => s.act === 'link'), group = all.find((s) => s.act === 'group');
  assert.ok(link && group);
  let steps = host.world.saved;
  const k = P.keep(t, link.id);
  assert.ok(k.ok, k.reason);
  assert.equal(host.world.saved, steps + 1);
  const row = t.links.get(k.by);
  assert.equal(row.kind, 'resonates');
  assert.deepEqual([row.from, row.to].sort(), [...link.subjects].sort());
  assert.deepEqual([t.gaps.of(link.id).state, t.gaps.of(link.id).resolvedBy], ['resolved', k.by]);
  assert.equal(P.keep(t, link.id).ok, false); // judged once
  steps = host.world.saved;
  const g = P.keep(t, group.id);
  assert.ok(g.ok, g.reason);
  assert.equal(host.world.saved, steps + 1);
  const made = t.links.get(g.by).to;
  assert.equal(t.marks.get(made).kind, 'group');
  assert.deepEqual([...t.links.members(made)].sort(), [...group.subjects].sort());
  const other = P.suggestions(t).find((s) => s.gap.state === 'open');
  steps = host.world.saved;
  assert.ok(P.refuse(t, other.id).ok);
  assert.equal(host.world.saved, steps + 1);
  assert.equal(t.gaps.of(other.id).resolvedBy, 'judgement');
  const kinds = t.moments.of(other.id).map((m) => m.kind);
  assert.ok(kinds.includes('resolved'), `the refusal is a moment: ${kinds}`);
  assert.equal(P.weights(t).seen, 3);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('provoke: what was judged is never suggested again, and refusals teach it to say less', async () => {
  const { host, t } = setup();
  await P.provoke(t, host.room);
  const first = P.suggestions(t).map((s) => `${s.act}:${[...s.subjects].sort()}`);
  for (const s of P.suggestions(t)) P.refuse(t, s.id);
  // Refusing everything, round after round: nothing comes back twice, and it falls silent.
  const seen = new Set(first);
  let rounds = 0;
  for (; rounds < 6; rounds++) {
    for (const s of P.suggestions(t)) if (s.gap.state === 'open') P.refuse(t, s.id);
    const before = P.suggestions(t).length;
    if ((await P.provoke(t, host.room)).made === 0) break;
    for (const s of P.suggestions(t).slice(before)) { const k = `${s.act}:${[...s.subjects].sort()}`; assert.ok(!seen.has(k), `suggested again: ${k}`); seen.add(k); }
  }
  assert.ok(rounds < 6, 'it falls silent');
  const w = P.weights(t);
  assert.ok(w.link[0] < -2.4 || w.group[0] < -2, 'refusals lower the bias');
});

test('provoke: a suggestion whose thoughts went is cleared on the next reading; locked rooms are not read', async () => {
  const { host, t, ids } = setup();
  await P.provoke(t, host.room);
  const link = P.suggestions(t).find((s) => s.act === 'link');
  for (const m of link.subjects) t.marks.delete(m);
  assert.equal(P.keep(t, link.id).ok, false);
  await P.provoke(t, host.room);
  assert.ok(!t.marks.get(link.id), 'the stale suggestion went');
  assert.deepEqual(brokenLaws(host.w), []);
  assert.ok(t.distance.declare(host.room, 'others').ok);
  assert.equal((await P.provoke(t, host.room)).ok, false);
  assert.ok(ids.length);
});

test('provoke: nothing in it touches a table directly', async () => {
  for (const file of ['Provoke.js', 'reader.js', 'provider.js']) {
    const src = await source('provoke', file);
    if (src == null) continue; // (served without its source)
    const imports = [...src.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
    assert.deepEqual(imports.filter((i) => i !== 'folio' && i !== './reader.js' && i !== './provider.js'), [], `${file} imports only Folio and itself`);
    assert.ok(!/\.parts\b|\.things\b|\bworld\(\)/.test(src.replace(/^\s*\/\/.*$/gm, '')), `${file} reaches past the tables' proposes`);
  }
  // And it runs with the rule kit taken away: everything it does is a read or a propose.
  const { host, t } = setup();
  const bare = new Proxy(t, { get: (o, k) => { if (k === 'parts') throw new Error('Provoke reached for the rule kit'); return o[k]; } });
  const r = await P.provoke(bare, host.room);
  assert.ok(r.ok && r.made > 0);
  assert.ok(P.keep(bare, P.suggestions(bare)[0].id).ok);
});

test('provoke: a local model\'s embeddings are asked for once per text', async () => {
  const asked = [];
  const fetcher = async (url, o) => { const { input } = JSON.parse(o.body); asked.push(...input); return { ok: true, json: async () => ({ embeddings: input.map((x) => [x.length, 1]) }) }; };
  const embed = P.ollama({ url: 'http://localhost:11434/', model: 'm' }, fetcher);
  assert.deepEqual(await embed(['ab', 'c']), [[2, 1], [1, 1]]);
  await embed(['ab', 'def']);
  assert.deepEqual(asked, ['ab', 'c', 'def']);
  const { host, t } = setup();
  const r = await P.provoke(t, host.room, { embed });
  assert.ok(r.ok);
  const broken = await P.provoke(t, host.room, { embed: async () => { throw new Error('no server'); } });
  assert.ok(broken.ok, 'without the model it reads as before');
});

test('provoke: it reads through the AI framework; its reader is the first provider, and every suggestion says who made it', async () => {
  const { host, t } = setup();
  for (const task of ['link', 'group', 'label', 'embed']) assert.ok(t.ai.providers(task).some((p) => p.id === 'provoke-reader'), task);
  assert.equal(t.ai.first('link'), 'provoke-reader');
  await P.provoke(t, host.room);
  for (const s of P.suggestions(t)) {
    assert.equal(s.mark.by, 'provoke-reader@1');
    assert.equal(s.mark.task, s.act);
  }
  const label = await t.ai.call('label', { items: P.suggestions(t).find((s) => s.act === 'group').subjects.map((id) => t.ai.item(id)) });
  assert.ok(label.ok && label.output.title, label.reason);
  const embed = await t.ai.call('embed', { items: [t.ai.item(host.ids?.[0] || P.suggestions(t)[0].subjects[0])] });
  assert.ok(embed.ok && embed.output.vectors.dim === 256);
});

test('provoke: our own system, once there, comes first; verdicts go back to the provider that made the suggestion', async () => {
  const { host, t, ids } = setup();
  const heard = [];
  host.plug('default-system', (d) => d.slots.providers.add({ id: 'default', name: 'Our own system', version: '0.1', tasks: ['link'],
    run: async () => ({ links: [{ from: ids[0], to: ids[9], score: 0.9, why: 'a test', features: [1, 2] }] }), verdict: (v) => heard.push(v) }));
  assert.equal(t.ai.first('link'), 'default');
  await P.provoke(t, host.room);
  const mine = P.suggestions(t).filter((s) => s.mark.by === 'default@0.1');
  assert.equal(mine.length, 1);
  assert.ok(P.suggestions(t).some((s) => s.act === 'group' && s.mark.by === 'provoke-reader@1'), 'groups still come from the reader');
  assert.ok(P.keep(t, mine[0].id).ok);
  assert.deepEqual(heard.map((v) => [v.provider, v.version, v.task, v.kept, v.suggestion]), [['default', '0.1', 'link', true, mine[0].id]]);
  const v = t.ai.verdicts('link').find((x) => x.suggestion === mine[0].id);
  assert.ok(v.kept && v.provider === 'default');
});

test('provoke: a local model named in its settings becomes an embed provider, and its vectors reach the reading', async () => {
  const host = makeHost({ thoughts: 0 });
  const saved = { model: { url: 'http://localhost:11434', model: 'nomic-embed-text' } };
  const storage = { get: (k, d) => saved[k] ?? d, set: (k, v) => { saved[k] = v; } };
  const asked = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, o) => { const { input } = JSON.parse(o.body); asked.push(url); return { ok: true, json: async () => ({ data: input.map((x, i) => ({ index: i, embedding: [x.length, 1] })) }) }; };
  try {
    const L = host.lib.model;
    for (const text of THEMES) L.create(host.w, host.room, { kind: 'line', text }, host.tick());
    host.world.save();
    const { t } = host.plug('provoke', (t) => P.install(t, { storage }));
    assert.equal(t.ai.first('embed', host.room), 'provoke-ollama');
    assert.ok((await P.provoke(t, host.room)).ok);
    assert.deepEqual([...new Set(asked)], ['http://localhost:11434/v1/embeddings']);
  } finally { globalThis.fetch = real; }
});
