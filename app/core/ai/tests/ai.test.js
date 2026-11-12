// The AI framework (app/core/AI.md): tasks and their schemas, picking a provider with fallback,
// the privacy policy, the shared services (scheduler, cache, budget, each swappable), feedback,
// the exam harness, and t.ai as a plugin sees it. The hard rule: a provider is handed reads only.

import { test, assert } from 'folio/testing';
import { TASKS, invalid, schemaOf, BUDGETS } from '../tasks.js';
import { makeAi, makeScheduler, makeBudget, makeCache, hashOf, DEFAULT_SYSTEM } from '../service.js';
import { serve, memoryChoices } from '../Ai.js';
import { exam, verdictCases, compare } from '../exam.js';
import { makeHost } from '../../api/tests/host.js';

const items = (n = 3) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, text: `thought ${i}` }));
const embedder = (id, o = {}) => ({ id, version: '1', tasks: ['embed'], hints: { where: 'local', speed: 'fast', ...o.hints },
  run: o.run || (async (task, input) => ({ vectors: { dim: 2, data: new Float32Array(input.items.flatMap((x, i) => [i, 1])) } })), ...o.extra });
const host = (providers, settings = {}, more = {}) => makeAi({ providers: () => providers, settings, ...more });

test('ai: the first tasks are there, each versioned, with schemas as plain data and a speed budget', () => {
  assert.deepEqual(Object.keys(TASKS).sort(), ['assign', 'embed', 'gap', 'group', 'judge', 'label', 'link', 'search', 'suggest']);
  for (const name of Object.keys(TASKS)) {
    const s = schemaOf(name);
    assert.equal(s.version, 1, name);
    assert.ok(s.input.type === 'object' && s.output.type === 'object', name);
    assert.deepEqual(JSON.parse(JSON.stringify(s)), s, `${name} is plain data`);
    assert.ok(BUDGETS[name], `${name} has a budget`);
  }
  assert.equal(schemaOf('nothing'), null);
});

test('ai: the checker reads the schemas, the binary layout included', () => {
  assert.equal(invalid(TASKS.link.input, { items: items() }), null);
  assert.match(invalid(TASKS.link.input, { items: [{ id: 'a' }] }), /needs text/);
  assert.match(invalid(TASKS.judge.output, { score: 2 }), /at most 1/);
  assert.match(invalid(TASKS.gap.output, { gaps: [{ mark: 'a', direction: 'sideways', says: 'x', score: 0.5 }] }), /one of/);
  assert.equal(invalid(TASKS.embed.output, { vectors: { dim: 2, data: new Float32Array(4) } }), null);
  assert.match(invalid(TASKS.embed.output, { vectors: { dim: 2, data: [0, 1] } }), /Float32Array/);
});

test('ai: a task runs on a provider and comes back with who made it, frozen', async () => {
  const ai = host([embedder('a')]);
  const r = await ai.call('embed', { items: items() });
  assert.ok(r.ok, r.reason);
  assert.deepEqual(r.provider, { id: 'a', version: '1' });
  assert.equal(r.version, 1);
  assert.equal(r.output.vectors.data.length, 6);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.output));
  assert.match((await ai.call('dream', {})).reason, /No such task/);
  assert.match((await ai.call('embed', { things: [] })).reason, /needs items/);
  assert.match((await host([]).call('embed', { items: items() })).reason, /No provider/);
});

test('ai: falls back when a provider is missing, unavailable, failing, answers wrongly or is over budget', async () => {
  const providers = [
    embedder('gone', { extra: { available: () => false } }),
    embedder('broken', { run: async () => { throw new Error('model crashed'); } }),
    embedder('liar', { run: async () => ({ vectors: { dim: 2, data: new Float32Array(1) } }) }),
    embedder('huge', { hints: { memory: 99999 } }),
    embedder('works', { hints: { speed: 'slow' } }),
  ];
  const ai = host(providers, { choice: () => 'nowhere' });
  const r = await ai.call('embed', { items: items() });
  assert.equal(r.provider.id, 'works');
  assert.deepEqual(r.tried.map((t) => t.id), ['gone', 'broken', 'liar', 'huge']);
  assert.match(r.tried[1].reason, /model crashed/);
  assert.match(r.tried[2].reason, /dim numbers/);
  assert.match(r.tried[3].reason, /over budget/);
});

test('ai: the order is the one chosen in Settings, then our own system, then local before remote and fast before slow', () => {
  const ps = [embedder('slow', { hints: { speed: 'slow' } }), embedder('cloud', { hints: { where: 'remote', speed: 'fast' } }), embedder('fast'), embedder(DEFAULT_SYSTEM, { hints: { speed: 'slow' } })];
  assert.deepEqual(host(ps).order('embed'), [DEFAULT_SYSTEM, 'fast', 'slow', 'cloud']);
  assert.deepEqual(host(ps, { choice: () => 'slow' }).order('embed'), ['slow', DEFAULT_SYSTEM, 'fast', 'cloud']);
  assert.deepEqual(host([embedder('reader', { hints: { fallback: true } }), embedder('model', { hints: { speed: 'slow' } })]).order('embed'), ['model', 'reader']);
});

test('ai: cloud providers are off by default, and a room can keep everything on this machine', async () => {
  const ps = [embedder('cloud', { hints: { where: 'remote' } })];
  const off = await host(ps).call('embed', { items: items() }, { context: 'r1' });
  assert.ok(!off.ok);
  assert.match(off.tried[0].reason, /cloud providers are off/);
  let cloud = true;
  const ai = host(ps, { cloud: () => cloud, blocked: (c) => c === 'secret' });
  assert.ok((await ai.call('embed', { items: items() }, { context: 'r1' })).ok);
  assert.match((await ai.call('embed', { items: items() }, { context: 'secret' })).tried[0].reason, /keeps everything on this machine/);
  assert.match((await ai.call('embed', { items: items() })).tried[0].reason, /needs to know whose room/);
  assert.equal(ai.first('embed', 'secret'), null);
  cloud = false;
  assert.equal(ai.first('embed', 'r1'), null);
});

test('ai: a sidecar runs only in the desktop app, once the person allows it', async () => {
  const ps = [embedder('side', { hints: { runs: 'sidecar' } })];
  assert.match((await host(ps, { allowed: () => true }).call('embed', { items: items() })).tried[0].reason, /desktop app/);
  assert.match((await host(ps, {}, { desktop: true }).call('embed', { items: items() })).tried[0].reason, /not allowed/);
  assert.ok((await host(ps, { allowed: (id) => id === 'side' }, { desktop: true }).call('embed', { items: items() })).ok);
});

test('ai: results are cached by content hash, task, provider and version', async () => {
  let runs = 0;
  const p = embedder('a', { run: async (t, input) => { runs++; return { vectors: { dim: 1, data: new Float32Array(input.items.length) } }; } });
  const ai = host([p]);
  await ai.call('embed', { items: items() });
  const again = await ai.call('embed', { items: items() });
  assert.ok(again.cached);
  assert.equal(runs, 1);
  await ai.call('embed', { items: items(2) });
  assert.equal(runs, 2);
  p.version = '2';
  await ai.call('embed', { items: items() });
  assert.equal(runs, 3, 'a new version is not served the old answers');
  await ai.call('embed', { items: items() }, { fresh: true });
  assert.equal(runs, 4);
  assert.equal(hashOf({ a: 1, b: [1, 2] }), hashOf({ b: [1, 2], a: 1 }));
  assert.ok(hashOf({ a: new Float32Array([1]) }) !== hashOf({ a: new Float32Array([2]) }));
  const c = makeCache({ most: 2 }); c.set('x', 1); c.set('y', 2); c.get('x'); c.set('z', 3);
  assert.equal(c.get('y'), undefined);
  assert.equal(c.get('x'), 1);
});

test('ai: the scheduler runs by priority, cancels what has not started, and batches embeds', async () => {
  const seen = [];
  const s = makeScheduler({ together: 1 });
  const job = (name, priority, extra = {}) => s.run({ provider: 'p', task: 'label', priority, input: {}, go: async () => { seen.push(name); return name; }, ...extra });
  const ctl = new AbortController();
  const all = [job('idle', 2), job('now', 0), job('cancelled', 1, { signal: ctl.signal }).catch((e) => e.message), job('soon', 1)];
  ctl.abort();
  const out = await Promise.all(all);
  assert.deepEqual(seen, ['now', 'soon', 'idle']);
  assert.equal(out[2], 'Cancelled');

  let calls = 0;
  const p = embedder('a', { run: async (t, input) => { calls++; return { vectors: { dim: 1, data: new Float32Array(input.items.map((x) => Number(x.id.slice(1)))) } }; } });
  const ai = host([p]);
  const [a, b] = await Promise.all([ai.call('embed', { items: [{ id: 'm1', text: 'a' }] }), ai.call('embed', { items: [{ id: 'm2', text: 'b' }, { id: 'm3', text: 'c' }] })]);
  assert.equal(calls, 1, 'one run for both');
  assert.deepEqual([...a.output.vectors.data], [1]);
  assert.deepEqual([...b.output.vectors.data], [2, 3]);
});

test('ai: a cancelled call says so and tries no other provider', async () => {
  const ctl = new AbortController();
  ctl.abort();
  const r = await host([embedder('a'), embedder('b')]).call('embed', { items: items() }, { signal: ctl.signal });
  assert.equal(r.reason, 'Cancelled');
});

test('ai: the budget keeps two large models from loading together; the least recently used goes', async () => {
  const log = [];
  const big = (id) => ({ id, memory: 1500, load: () => log.push(`load ${id}`), unload: () => log.push(`unload ${id}`) });
  const b = makeBudget({ memory: () => 2048 });
  const l1 = await b.acquire(big('a'));
  assert.ok(l1.ok);
  const busy = await b.acquire(big('b'));
  assert.ok(!busy.ok, 'a is still working');
  l1.release();
  const l2 = await b.acquire(big('b'));
  assert.ok(l2.ok);
  assert.deepEqual(log, ['load a', 'unload a', 'load b']);
  assert.deepEqual(b.loaded(), ['b']);
  assert.ok(!(await b.acquire({ id: 'giant', memory: 5000 })).ok);
});

test('ai: providers on one engine share its budget; a missing engine is passed over', async () => {
  const loads = [];
  const engine = { id: 'llama', memory: 1200, load: () => loads.push('llama') };
  const p = (id, eng) => ({ ...embedder(id), engine: eng });
  const ai = makeAi({ providers: () => [p('x', 'nowhere'), p('a', 'llama'), p('b', 'llama')], engines: () => [engine] });
  const r = await ai.call('embed', { items: items() });
  assert.equal(r.provider.id, 'a');
  assert.match(r.tried[0].reason, /engine nowhere/);
  await ai.call('embed', { items: items(1) }, { only: 'b' });
  assert.deepEqual(loads, ['llama'], 'the engine loads once for both');
});

test('ai: the scheduler, cache and budget can each be replaced by a plugin', async () => {
  const hits = [];
  const services = [{ id: 'mine', replaces: 'cache', make: (d) => ({ get: (k) => { hits.push('get'); return d.cache.get(k); }, set: (k, v) => { hits.push('set'); d.cache.set(k, v); } }) }];
  const ai = makeAi({ providers: () => [embedder('a')], services: () => services });
  await ai.call('embed', { items: items() });
  assert.deepEqual(hits, ['get', 'set']);
});

test('ai: a verdict goes back to the provider that made the result', () => {
  const heard = [];
  const ai = host([{ ...embedder('a'), verdict: (v) => heard.push(v) }, embedder('b')]);
  assert.ok(ai.verdict({ provider: 'a', version: '1', task: 'link', kept: true }));
  assert.ok(!ai.verdict({ provider: 'b', task: 'link', kept: false }), 'b does not listen');
  assert.equal(heard.length, 1);
  assert.ok(Object.isFrozen(heard[0]));
});

test('ai: the exam scores a provider on the maker\'s verdicts and holds it to the speed budget', async () => {
  const keeper = { id: 'keeper', version: '1', tasks: ['judge'], run: async (t, input) => ({ score: input.says.includes('good') ? 0.9 : 0.1 }) };
  const coin = { id: 'coin', version: '1', tasks: ['judge'], run: async () => ({ score: 0.6 }) };
  let clock = 0;
  const slowpoke = { id: 'slow', version: '1', tasks: ['judge'], run: async (t, input) => { clock += 5000; return { score: input.says.includes('good') ? 0.9 : 0.1 }; } };
  const ai = host([keeper, coin, slowpoke]);
  const cases = verdictCases([
    { act: 'link', kept: true, says: 'good pair', items: items(2) },
    { act: 'link', kept: false, says: 'poor pair', items: items(2) },
    { act: 'group', kept: true, says: 'good group', items: items(3) },
    { act: 'link', kept: false, says: 'lost', items: [] },
  ]);
  assert.equal(cases.length, 3);
  const now = () => clock;
  const k = await exam(ai, { provider: 'keeper', task: 'judge', cases, now });
  assert.equal(k.score, 1);
  assert.ok(k.passed);
  const c = await compare(ai, { a: 'keeper', b: 'coin', task: 'judge', cases, now });
  assert.equal(c.better, 'keeper');
  assert.ok(Math.abs(c.b.score - 2 / 3) < 1e-9);
  const s = await exam(ai, { provider: 'slow', task: 'judge', cases, now });
  assert.equal(s.score, 1);
  assert.equal(s.over, 3);
  assert.ok(!s.passed, 'right but too slow');
});

test('ai: the service keeps the person\'s choices, and plugins add providers through the API', async () => {
  const h = makeHost({ thoughts: 3 });
  const { t, off } = h.plug('mine', (t) => { t.slots.providers.add({ id: 'mine', name: 'Mine', version: '1', tasks: ['label'], run: async () => ({ title: 'River', score: 0.8 }) }); });
  assert.deepEqual(t.ai.providers('label').map((p) => p.id), ['mine']);
  assert.ok(t.ai.tasks().some((x) => x.name === 'suggest' && x.version === 1));
  const r = await t.ai.call('label', { items: [t.ai.item(h.ids[0])] });
  assert.ok(r.ok && r.output.title === 'River', r.reason);
  h.choices.choose('label', 'other');
  assert.equal(h.choices.chosen('label'), 'other');
  assert.equal(t.ai.first('label'), 'mine', 'a chosen provider that is not there falls back');
  off();
  assert.deepEqual(t.ai.providers('label'), [], 'switched off, its provider goes');
  const choices = memoryChoices({ cloud: true });
  assert.ok(serve({ slot: () => null, choices }).choices.cloud());
});

test('ai: a provider is handed the reads, never a way to write (the hard rule)', async () => {
  const h = makeHost({ thoughts: 3 });
  let seen = null;
  const { t } = h.plug('peek', (t) => { t.slots.providers.add({ id: 'peek', version: '1', tasks: ['label'], run: async (task, input, ctx) => { seen = ctx; return { title: 'x', score: 0.5 }; } }); });
  const before = JSON.stringify(h.w);
  await t.ai.call('label', { items: [t.ai.item(h.ids[0])] }, { context: h.room });
  assert.ok(seen && Object.isFrozen(seen));
  assert.equal(seen.context, h.room);
  assert.ok(typeof seen.reads.marks.get === 'function');
  for (const ns of Object.values(seen.reads)) for (const name of ['make', 'edit', 'delete', 'link', 'unlink', 'put', 'move', 'open', 'resolve', 'declare', 'due']) assert.equal(ns[name], undefined, name);
  assert.equal(seen.reads.marks.text(h.ids[0]), t.marks.text(h.ids[0]));
  assert.equal(JSON.stringify(h.w), before, 'nothing in the world changed');
});

test('ai: verdicts are read from the tables: a suggestion\'s gap resolved by a link is kept, by judgement refused', () => {
  const h = makeHost({ thoughts: 4 });
  const { t } = h.plug('sugg', (t) => {
    t.slots.kinds.add({ kind: 'suggestion', name: 'Suggestion', tidy: (f) => ({ ...f }), text: (m) => m.says || '', node: () => null });
    t.slots.linkKinds.add({ kind: 'provokes', name: 'Provokes' });
    t.slots.linkKinds.add({ kind: 'resonates', name: 'Resonates', both: true });
  });
  const make = (says, by, task) => {
    const s = t.marks.make({ kind: 'suggestion', in: h.other, content: { says, act: 'link', by, task, features: '1 0.5' } });
    t.links.link(s.id, h.ids[0], 'provokes'); t.links.link(s.id, h.ids[1], 'provokes');
    t.gaps.open(s.id, 'to maker');
    return s.id;
  };
  const a = make('pair one', 'reader@3', 'link');
  const b = make('pair two', 'reader@3', 'link');
  make('still open', 'reader@3', 'link');
  const kept = t.links.link(h.ids[0], h.ids[1], 'resonates');
  t.gaps.resolve(a, kept.id);
  t.gaps.resolve(b, 'judgement');
  const v = t.ai.verdicts('link');
  assert.equal(v.length, 2);
  assert.deepEqual(v.map((x) => x.kept), [true, false]);
  assert.equal(v[0].provider, 'reader');
  assert.equal(v[0].version, '3');
  assert.deepEqual(v[0].features, [1, 0.5]);
  assert.deepEqual(v[0].items.map((x) => x.id).sort(), [h.ids[0], h.ids[1]].sort());
  assert.deepEqual(t.ai.verdicts('group'), []);
});

test('ai: budgets come in two tiers, measured warm, with the load held apart', async () => {
  const { TIERS, LOAD_BUDGET, tierOf } = await import('../tasks.js');
  assert.equal(TIERS.interactive, BUDGETS);
  for (const task of Object.keys(TASKS)) assert.ok(TIERS.background[task].perItem > TIERS.interactive[task].perItem, task);
  assert.equal(tierOf('now'), 'interactive');
  assert.equal(tierOf('idle'), 'background');
  let clock = 0;
  let calls = 0;
  // Slow once (loading), then quick: passes; a steady 1 s a call passes background only.
  const loader = { id: 'loader', version: '1', tasks: ['judge'], run: async () => { clock += calls++ ? 1 : 2000; return { score: 0.9 }; } };
  const steady = { id: 'steady', version: '1', tasks: ['judge'], run: async () => { clock += 1000; return { score: 0.9 }; } };
  const ai = host([loader, steady]);
  const cases = [{ input: { act: 'link', items: items(2) }, mark: () => 1 }, { input: { act: 'link', items: items(2) }, mark: () => 1 }];
  const now = () => clock;
  const l = await exam(ai, { provider: 'loader', task: 'judge', cases, now });
  assert.equal(l.load.ms, 2000);
  assert.ok(!l.load.over && l.over === 0 && l.passed, 'a slow load alone does not fail it');
  const cold = await exam(ai, { provider: 'steady', task: 'judge', cases, now });
  assert.ok(!cold.passed && cold.tier === 'interactive');
  const bg = await exam(ai, { provider: 'steady', task: 'judge', cases, now, tier: 'background' });
  assert.ok(bg.passed, 'fine when nobody waits');
  assert.ok(LOAD_BUDGET.background > LOAD_BUDGET.interactive);
});

test('ai: the machine tier passes over a provider that needs more, and the person may say otherwise', async () => {
  const { detect, fits } = await import('../machine.js');
  assert.equal((await detect({ hardwareConcurrency: 2, deviceMemory: 4 })).tier, 'every-pc');
  assert.equal((await detect({ hardwareConcurrency: 8, deviceMemory: 8 })).tier, 'mid');
  assert.equal((await detect({ hardwareConcurrency: 8, deviceMemory: 8, gpu: { requestAdapter: async () => ({ isFallbackAdapter: false }) } })).tier, 'gpu');
  assert.equal((await detect({ hardwareConcurrency: 8, deviceMemory: 8, gpu: { requestAdapter: async () => ({ isFallbackAdapter: true }) } })).tier, 'mid');
  assert.equal((await detect({ hardwareConcurrency: 8, gpu: { requestAdapter: async () => { throw new Error('no'); } } })).tier, 'mid');
  assert.ok(fits(undefined, 'every-pc') && fits('mid', 'gpu') && !fits('gpu', 'mid'));
  const big = embedder('big', { hints: { tier: 'gpu' } });
  const small = embedder('small', { hints: { tier: 'every-pc' } });
  const choices = memoryChoices({ detected: { tier: 'every-pc', cores: 2, memory: 4, gpu: false } });
  const ai = serve({ slot: (name) => (name === 'ai.providers' ? { items: [big, small] } : { items: [] }), choices });
  assert.equal(ai.machine().tier, 'every-pc');
  assert.equal(ai.first('embed'), 'small');
  assert.match(ai.barred('big'), /needs a gpu machine; this one is every-pc/);
  const r = await ai.call('embed', { items: items() });
  assert.equal(r.provider.id, 'small');
  choices.setMachine('gpu');
  assert.ok(ai.machine().chosen && ai.machine().tier === 'gpu' && ai.machine().detected === 'every-pc');
  assert.equal(ai.first('embed'), 'big');
  choices.setMachine('nonsense');
  assert.equal(ai.machine().tier, 'every-pc');
});
