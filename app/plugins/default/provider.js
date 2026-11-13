// The default system as an AI provider (app/core/AI.md): id `default`, the id the framework
// reserves for our own system and tries first on every task. It speaks the HTTP bridge to its
// own engine (engine/, traumerei-engine), which the desktop app runs as this plugin's sidecar.
// Before the first answer it makes sure the models its machine tier uses are in the store
// (models.js: downloaded once, the person asked with the size) and that engine.json names them.
// Tasks it doesn't do yet fall back to the next provider (today Provoke's reader).
//
// Pure of the screen: the sidecar, the store and the machine come in, so the tests run it with fakes.

import { MODELS, pick, engineConfig } from './models.js';

export const ID = 'default';
export const VERSION = '0.1.0';
export const TASKS = Object.freeze(['embed']);
export const NAME = 'Träumerei (default)';
// memory: MB the engine holds with MiniLM in four copies (measured about 500 after loading).
const HINTS = Object.freeze({ where: 'local', speed: 'fast', memory: 500 });

// What engine.json should hold on a machine of this tier.
export const configFor = (tier) => engineConfig(Object.fromEntries(TASKS.map((task) => [task, pick(tier, task)]).filter(([, id]) => id)), tier);

// sidecar: t.ai.sidecar ({ provider(o), stop() }, or null off the desktop); store: t.store (or null);
// machine() → { tier } (t.ai.machine).
export function makeDefault({ sidecar, store, machine = () => ({ tier: 'every-pc' }) }) {
  if (!sidecar) {
    // The web copy: no program beside the app. Listed, so Settings → AI says why it's passed over.
    return { id: ID, name: NAME, version: VERSION, tasks: [...TASKS], hints: { ...HINTS, runs: 'sidecar' },
      available: () => false, run: async () => { throw new Error('the default system runs only in the desktop app'); } };
  }
  const base = sidecar.provider({ name: NAME, version: VERSION, tasks: TASKS, hints: HINTS });
  let readying = null, readyFor = null, refused = '', prepared = false;

  // The tier's models in the store and engine.json naming them: { ok } or { ok: false, reason }.
  async function prepare(tier) {
    if (!store) return { ok: false, reason: 'the plugin store is not there' };
    const config = configFor(tier);
    for (const task of TASKS) {
      const m = MODELS[pick(tier, task)];
      for (const f of Object.values(m?.files || {})) {
        const got = await store.files.download(f.url, f.name, { bytes: f.bytes, label: `${f.name} (for ${task})` });
        if (!got.ok) return { ok: false, reason: got.reason };
      }
    }
    const text = JSON.stringify(config);
    const have = await store.files.get('engine.json');
    if (!have || new TextDecoder().decode(have) !== text) await store.files.put('engine.json', text);
    return { ok: true };
  }
  const ready = () => {
    if (refused) return Promise.resolve({ ok: false, reason: refused });
    const tier = machine()?.tier || 'every-pc';
    if (!readying || readyFor !== tier) {
      readyFor = tier;
      readying = prepare(tier).then((r) => {
        prepared = r.ok;
        if (!r.ok) { readying = null; if (r.reason === 'Not now') refused = 'the models were not downloaded (asked once this session)'; }
        return r;
      }, (err) => { readying = null; return { ok: false, reason: String(err?.message || err) }; });
    }
    return readying;
  };

  return {
    ...base,
    // True once this session has the engine allowed and the models in place (Default.js warms
    // the open room's vectors only then, so warming never asks the person anything).
    prepared: () => prepared,
    // The person is asked to allow the engine first (the sidecar), then for the models.
    available: async () => (await base.available()) && (await ready()).ok,
    run: async (task, input, ctx) => {
      const r = await ready();
      if (!r.ok) throw new Error(r.reason);
      return base.run(task, input, ctx);
    },
  };
}
