// The models the default system downloads, and which one each machine tier uses. One table, so
// the plugin, its tests and the engine workflow (.github/workflows/engine.yml) read the same
// files, sizes and checksums. A model is downloaded into the plugin's store on first use (the
// person is asked, with its size); the engine checks each file's sha256 before loading it.
//
// Every url pins a revision, so a file can't change under its checksum.

// all-MiniLM-L6-v2 (sentence-transformers, Apache-2.0): 6 layers, 384 numbers per thought,
// quantised to 8 bits for any x86-64 CPU with AVX2. Chosen in the step-1 thread: 2.2 ms a thought
// on a 4-core 2.1 GHz CPU, and the best of five on a test of same-topic neighbours.
const MINILM_REV = '1110a243fdf4706b3f48f1d95db1a4f5529b4d41'; // main on 13 Nov 2026, read by engine.yml
const MINILM = `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/${MINILM_REV}`;

export const MODELS = Object.freeze({
  'minilm-l6-v2-int8': Object.freeze({
    task: 'embed', dim: 384, pooling: 'mean', maxTokens: 128, memory: 500, licence: 'Apache-2.0',
    files: Object.freeze({
      model: Object.freeze({ name: 'minilm-l6-v2-int8.onnx', url: `${MINILM}/onnx/model_quint8_avx2.onnx`, bytes: 23046789,
        sha256: 'b941bf19f1f1283680f449fa6a7336bb5600bdcd5f84d10ddc5cd72218a0fd21' }),
      tokenizer: Object.freeze({ name: 'minilm-l6-v2.tokenizer.json', url: `${MINILM}/tokenizer.json`, bytes: 466247,
        sha256: 'be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037' }),
    }),
  }),
});

// Which model each tier uses, per task. Every tier runs the same small embedder: it is light
// enough for a PC without a GPU, and one model means one set of vectors whatever the machine.
export const PICK = Object.freeze({
  'every-pc': Object.freeze({ embed: 'minilm-l6-v2-int8' }),
  mid: Object.freeze({ embed: 'minilm-l6-v2-int8' }),
  gpu: Object.freeze({ embed: 'minilm-l6-v2-int8' }),
});

// How many copies of the embedder the engine runs side by side, by tier. Four is about 25% faster
// than one on every core, but each copy holds about 100 MB: a small machine gets two.
export const WORKERS = Object.freeze({ 'every-pc': 2, mid: 4, gpu: 4 });

// The model for a task on a machine of this tier (an unknown tier counts as every-pc).
export const pick = (tier, task) => MODELS[(PICK[tier] || PICK['every-pc'])[task]] ? (PICK[tier] || PICK['every-pc'])[task] : null;

// engine.json, format traumerei-engine/1 (README, "engine.json"): what the engine loads, for the
// models picked, on a machine of this tier.
export function engineConfig(picked, tier = 'every-pc') {
  const out = { format: 'traumerei-engine/1' };
  for (const [task, id] of Object.entries(picked)) {
    const m = MODELS[id];
    if (!m || task !== 'embed') continue;
    out.embed = { name: id, model: m.files.model.name, model_sha256: m.files.model.sha256, tokenizer: m.files.tokenizer.name,
      tokenizer_sha256: m.files.tokenizer.sha256, pooling: m.pooling, max_tokens: m.maxTokens, workers: WORKERS[tier] || WORKERS['every-pc'] };
  }
  return out;
}
