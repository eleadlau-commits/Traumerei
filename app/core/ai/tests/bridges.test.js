// The bridges (bridges.js) and Settings → AI (settings.js).

import { test, assert } from 'folio/testing';
import { worker, http, openai, f32ToBase64, base64ToF32, toWire, fromWire } from '../bridges.js';
import { makeAi } from '../service.js';
import { serve, memoryChoices } from '../Ai.js';
import { pane } from '../settings.js';

const items = [{ id: 'a', text: 'river' }, { id: 'b', text: 'stone' }];
const answer = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test('bridges: vectors as bytes go there and back exactly, little-endian', () => {
  const v = new Float32Array([0, 1.5, -2.25, 3e-8]);
  assert.deepEqual([...base64ToF32(f32ToBase64(v))], [...v]);
  assert.equal(f32ToBase64(new Float32Array([1])), 'AACAPw==');
  const back = fromWire(JSON.parse(JSON.stringify(toWire({ vectors: { dim: 2, data: v }, n: 1 }))));
  assert.ok(back.vectors.data instanceof Float32Array);
  assert.deepEqual([...back.vectors.data], [...v]);
  assert.equal(back.n, 1);
});

test('bridges: an OpenAI-style server embeds, through an engine providers share', async () => {
  const asked = [];
  const fetch = async (url, o) => { asked.push([url, JSON.parse(o.body)]); return answer({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] }); };
  const { provider, engine } = openai({ url: 'http://localhost:11434/v1/', model: 'nomic-embed-text', fetch });
  assert.equal(provider.engine, engine.id);
  assert.equal(engine.kind, 'openai');
  const ai = makeAi({ providers: () => [provider], engines: () => [engine] });
  const r = await ai.call('embed', { items });
  assert.ok(r.ok, r.reason);
  assert.deepEqual([...r.output.vectors.data], [1, 0, 0, 1]);
  assert.equal(asked[0][0], 'http://localhost:11434/v1/embeddings');
  assert.deepEqual(asked[0][1], { model: 'nomic-embed-text', input: ['river', 'stone'] });
  const bad = openai({ url: 'http://x', model: 'm', fetch: async () => answer({}, false, 500) });
  const r2 = await makeAi({ providers: () => [bad.provider], engines: () => [bad.engine] }).call('embed', { items });
  assert.match(r2.tried[0].reason, /answered 500/);
});

test('bridges: a sidecar speaks the HTTP protocol, vectors as base64, and runs only when allowed', async () => {
  const asked = [];
  const fetch = async (url, o) => {
    asked.push(url);
    if (url.endsWith('/health')) return answer({});
    const { version, input } = JSON.parse(o.body);
    return answer({ output: { vectors: { dim: 1, data: toWire(new Float32Array(input.items.map((_, i) => i + version))) } } });
  };
  const side = http({ id: 'side', version: '1', tasks: ['embed'], url: 'http://127.0.0.1:7777/', fetch });
  assert.equal(side.hints.runs, 'sidecar');
  const ai = makeAi({ providers: () => [side], desktop: true, settings: { allowed: (id) => id === 'side' } });
  const r = await ai.call('embed', { items });
  assert.ok(r.ok, r.reason);
  assert.deepEqual([...r.output.vectors.data], [1, 2]);
  assert.deepEqual(asked, ['http://127.0.0.1:7777/traumerei/ai/v1/health', 'http://127.0.0.1:7777/traumerei/ai/v1/embed']);
  const no = await makeAi({ providers: () => [side], desktop: true }).call('embed', { items });
  assert.match(no.tried[0].reason, /not allowed/);
});

test('bridges: a worker provider posts the protocol, hears parts, and is unloaded by the budget', async () => {
  const made = [];
  class FakeWorker {
    constructor(url, o) { this.url = url; this.o = o; this.posted = []; made.push(this); }
    postMessage(m) {
      this.posted.push(m);
      if (m.op !== 'run') return;
      setTimeout(() => { this.onmessage({ data: { id: m.id, part: { done: 0.5 } } }); this.onmessage({ data: { id: m.id, ok: true, output: { title: `${m.task} v${m.version}`, score: 0.7 } } }); }, 0);
    }
    terminate() { this.ended = true; }
  }
  const p = worker({ id: 'wasm-labeller', version: '2', tasks: ['label'], url: 'labeller.js', Worker: FakeWorker, hints: { memory: 1500 } });
  const q = worker({ id: 'other', version: '1', tasks: ['label'], url: 'other.js', Worker: FakeWorker, hints: { memory: 1500 } });
  const parts = [];
  const ai = makeAi({ providers: () => [p, q] });
  const r = await ai.call('label', { items }, { part: (x) => parts.push(x) });
  assert.ok(r.ok, r.reason);
  assert.equal(r.output.title, 'label v1');
  assert.deepEqual(parts, [{ done: 0.5 }]);
  assert.equal(made[0].url, 'labeller.js');
  assert.deepEqual(made[0].o, { type: 'module' });
  await ai.call('label', { items }, { only: 'other' });
  assert.ok(made[0].ended, 'the first was unloaded to make room for the second');
});

test('settings: the AI page lists each task\'s provider and fallbacks, and the person\'s choices change', () => {
  const el = (tag, attrs = {}, ...kids) => ({ tag, attrs, kids: kids.flat().filter((k) => k != null) });
  const walk = (n, out = []) => { if (n && typeof n === 'object') { out.push(n); for (const k of n.kids || []) walk(k, out); } return out; };
  const text = (n) => walk(n).flatMap((x) => x.kids.filter((k) => typeof k === 'string')).join(' ');
  const providers = [{ id: 'reader', name: 'Provoke reader', version: '1', tasks: ['link'], run: async () => ({}) },
    { id: 'cloudy', name: 'Cloudy', version: '1', tasks: ['link'], hints: { where: 'remote' }, run: async () => ({}) },
    { id: 'side', name: 'Side', version: '1', tasks: ['embed'], hints: { runs: 'sidecar' }, run: async () => ({}) }];
  const choices = memoryChoices();
  const ai = serve({ slot: (n) => (n === 'ai.providers' ? { items: providers } : { items: [] }), choices });
  let redrawn = 0;
  const node = pane({ ai, rooms: () => [{ id: 'r1', name: 'Thesis' }], el, redraw: () => redrawn++ });
  const words = text(node);
  assert.match(words, /Link: pairs of marks/);
  assert.match(words, /Now: Provoke reader\. Then: Cloudy\./);
  assert.match(words, /Cloudy \(cloud\)/);
  assert.match(words, /Thesis/);
  assert.match(words, /Side/);
  assert.match(words, /No provider does this yet/);
  const all = walk(node);
  const pick = (label) => all.find((n) => n.attrs?.['aria-label'] === label);
  pick('Provider for link').attrs.onchange({ target: { value: 'cloudy' } });
  assert.equal(choices.chosen('link'), 'cloudy');
  pick('Allow cloud providers (they send your words off this machine)').attrs.onchange({ target: { checked: true } });
  assert.ok(choices.cloud());
  pick('Thesis').attrs.onchange({ target: { checked: true } });
  assert.ok(choices.blocked('r1'));
  pick('Side').attrs.onchange({ target: { checked: true } });
  assert.ok(choices.allowed('side'));
  pick('Memory for AI models in MB').attrs.onchange({ target: { value: '4096' } });
  assert.equal(choices.memory(), 4096);
  assert.equal(redrawn, 5);
});
