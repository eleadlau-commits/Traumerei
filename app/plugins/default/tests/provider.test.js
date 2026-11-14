// Tests for the default system's provider (provider.js) and its model table (models.js), with a
// fake sidecar and a fake store: no engine, no network. `python build.py test` runs them. The live
// exam against Provoke's reader is exam.mjs (engine.yml runs it with the real engine and model).

import { test, assert } from 'folio/testing';
import { makeDefault, configFor, ID, TASKS } from '../provider.js';
import { MODELS, PICK, pick } from '../models.js';
import { THOUGHTS, sameTopic, unitRows } from './cases.js';

const TIERS = ['every-pc', 'mid', 'gpu'];
const PLAIN = /^(?!\.)[A-Za-z0-9._-]{1,128}$/; // a file name the store and the engine accept

// A fake of t.ai.sidecar: provider(o) as app/core/ai/sidecar.js makes it (its id is the plugin's).
function fakeSidecar({ allowed = true } = {}) {
  const log = [];
  return {
    log,
    provider: (o) => ({
      id: 'default', name: o.name, version: String(o.version), tasks: [...o.tasks],
      hints: { where: 'local', speed: 'medium', ...o.hints, runs: 'sidecar', asks: true },
      available: async () => { log.push('start'); return allowed; },
      unload: async () => { log.push('stop'); },
      run: async (task, input) => { log.push(`run ${task}`); const dim = 2; return { vectors: { dim, data: new Float32Array(input.items.length * dim).fill(Math.SQRT1_2) } }; },
    }),
    stop: async () => {},
  };
}
// A fake of t.store: downloads succeed unless `answer` says otherwise; files kept in a Map.
function fakeStore({ answer = null } = {}) {
  const kept = new Map();
  const store = {
    answer, asked: [], kept,
    files: {
      download: async (url, name, { bytes }) => { store.asked.push({ url, name, bytes }); if (store.answer) return store.answer; kept.set(name, new Uint8Array(bytes)); return { ok: true, bytes }; },
      get: async (name) => kept.get(name) || null,
      put: async (name, data) => { kept.set(name, typeof data === 'string' ? new TextEncoder().encode(data) : data); return true; },
    },
  };
  return store;
}
const ctx = { version: 1, context: null, signal: null, part: () => {}, verdicts: () => [] };
const items = [{ id: 'a', text: 'bread' }, { id: 'b', text: 'logic' }];

test('the provider is `default`, does embed, and is local', () => {
  const p = makeDefault({ sidecar: fakeSidecar(), store: fakeStore() });
  assert.equal(p.id, ID);
  assert.equal(ID, 'default');
  assert.deepEqual(p.tasks, ['embed']);
  assert.equal(p.hints.where, 'local');
  assert.equal(p.hints.runs, 'sidecar');
});

test('on the web copy it is listed but never available, so the reader answers', async () => {
  const p = makeDefault({ sidecar: null, store: fakeStore() });
  assert.equal(p.id, 'default');
  assert.equal(await p.available(), false);
  let threw = false;
  try { await p.run('embed', { items }, ctx); } catch { threw = true; }
  assert.ok(threw);
});

test('first use: the engine is allowed first, then the tier\'s model files download, then engine.json names them', async () => {
  const sidecar = fakeSidecar(), store = fakeStore();
  const p = makeDefault({ sidecar, store, machine: () => ({ tier: 'mid' }) });
  assert.equal(p.prepared(), false);
  assert.equal(await p.available(), true);
  assert.equal(p.prepared(), true);
  assert.equal(sidecar.log[0], 'start');
  const m = MODELS[pick('mid', 'embed')];
  assert.deepEqual(store.asked.map((a) => a.name), Object.values(m.files).map((f) => f.name));
  assert.deepEqual(store.asked.map((a) => a.bytes), Object.values(m.files).map((f) => f.bytes));
  const written = JSON.parse(new TextDecoder().decode(store.kept.get('engine.json')));
  assert.deepEqual(written, configFor('mid'));
  const out = await p.run('embed', { items }, ctx);
  assert.equal(out.vectors.data.length, items.length * out.vectors.dim);
  assert.equal(store.asked.length, Object.keys(m.files).length); // not downloaded again
});

test('not allowed to run the engine: not available, and nothing is downloaded', async () => {
  const store = fakeStore();
  const p = makeDefault({ sidecar: fakeSidecar({ allowed: false }), store });
  assert.equal(await p.available(), false);
  assert.equal(store.asked.length, 0);
});

test('"Not now" to a model download is not asked again this session', async () => {
  const store = fakeStore({ answer: { ok: false, reason: 'Not now' } });
  const p = makeDefault({ sidecar: fakeSidecar(), store });
  assert.equal(await p.available(), false);
  assert.equal(await p.available(), false);
  assert.equal(store.asked.length, 1);
  let reason = '';
  try { await p.run('embed', { items }, ctx); } catch (err) { reason = err.message; }
  assert.match(reason, /asked once/);
});

test('a failed download is tried again next time', async () => {
  const store = fakeStore({ answer: { ok: false, reason: 'The download failed: offline' } });
  const p = makeDefault({ sidecar: fakeSidecar(), store });
  assert.equal(await p.available(), false);
  store.answer = null;
  assert.equal(await p.available(), true);
});

test('every tier picks a model for every task, and the table is complete', () => {
  for (const tier of TIERS) for (const task of TASKS) assert.ok(MODELS[PICK[tier][task]], `${tier} has no ${task} model`);
  assert.equal(pick('nonsense', 'embed'), pick('every-pc', 'embed'));
  assert.equal(pick('gpu', 'label'), null);
  for (const [id, m] of Object.entries(MODELS)) {
    assert.ok(m.dim > 0 && m.maxTokens > 0 && m.licence, id);
    for (const f of Object.values(m.files)) {
      assert.match(f.name, PLAIN);
      assert.match(f.url, /^https:\/\/huggingface\.co\/[^/]+\/[^/]+\/resolve\/[0-9a-f]{40}\//, `${f.name} must pin a revision`);
      assert.ok(f.bytes > 0, `${f.name} needs its size`);
      assert.match(f.sha256, /^[0-9a-f]{64}$/, `${f.name} needs its sha256`);
    }
  }
});

test('contract: engine.json is format traumerei-engine/1 with the fields the engine reads', () => {
  for (const tier of TIERS) {
    const c = configFor(tier);
    assert.equal(c.format, 'traumerei-engine/1');
    const e = c.embed;
    for (const k of ['name', 'model', 'model_sha256', 'tokenizer', 'tokenizer_sha256', 'pooling', 'max_tokens', 'workers']) assert.ok(k in e, `embed.${k}`);
    assert.ok(['mean', 'cls'].includes(e.pooling));
    assert.match(e.model, PLAIN);
    assert.match(e.tokenizer, PLAIN);
    assert.ok(e.workers >= 1 && e.workers <= 4);
  }
  assert.ok(configFor('every-pc').embed.workers <= configFor('mid').embed.workers);
});

test('the exam\'s marks: same-topic neighbours and unit rows', () => {
  const dim = 6;
  const topics = [...new Set(THOUGHTS.map((x) => x.topic))];
  const data = new Float32Array(THOUGHTS.length * dim);
  THOUGHTS.forEach((x, i) => { data[i * dim + topics.indexOf(x.topic)] = 1; });
  assert.equal(sameTopic(THOUGHTS, { dim, data }), 1);
  assert.ok(unitRows({ dim, data }));
  assert.ok(!unitRows({ dim, data: new Float32Array(dim * 2) }));
});
