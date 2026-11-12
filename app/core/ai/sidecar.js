// Sidecars: a program a plugin brings, run beside the desktop app (app/core/AI.md, Sidecars).
// The plugin's manifest declares it in its plugin block:
//
//   "sidecar": { "program": "engine.exe", "url": "https://…/engine.exe", "bytes": 12345678,
//                "checksum": "sha256:<64 hex>", "args": ["--port", "{port}", "--models", "{store}"],
//                "idle": 300 }
//
// The first time it is needed the person is asked, once per plugin (with the program's size and
// where it comes from); then the program is downloaded into the plugin's store, started by the
// shell (desktop/src-tauri/src/sidecar.rs: checksum checked, a free port on 127.0.0.1, no window),
// and stopped after `idle` seconds unused, on Revoke, or when the app closes. Nothing of this runs
// on the web copy. Pure of the screen: the shell, the store, the person's choices and the asking
// come in, so the tests run it as it is.

import { http } from './bridges.js';

const SUM = /^sha256:[0-9a-f]{64}$/i;
const NAME = /^(?!\.)[A-Za-z0-9._-]{1,128}$/;

// What is wrong with a sidecar declaration, in words, or ''.
export function invalidSpec(s) {
  if (!s || typeof s !== 'object') return 'it declares no sidecar';
  if (!NAME.test(String(s.program || ''))) return 'its sidecar needs a program: a plain file name';
  if (!/^https:\/\//.test(String(s.url || ''))) return 'its sidecar needs an https address to download the program from';
  if (!(s.bytes > 0)) return 'its sidecar must say how large the program is';
  if (!SUM.test(String(s.checksum || ''))) return 'its sidecar needs a checksum, "sha256:" and 64 hex digits';
  if (s.args && !(Array.isArray(s.args) && s.args.every((a) => typeof a === 'string'))) return 'its sidecar\'s args must be words';
  return '';
}

// invoke(cmd, args) → Promise (the shell's), or null off the desktop; store: the store service (or a function giving it);
// choices: { allowed(id), allow(id, on) }; ask({ id, name, program, bytes, host }) → Promise<bool>;
// healthy(port) → Promise<bool>; wait(ms); clock for the idle timer: { set(fn, ms), clear(handle) }.
export function makeSidecars({ invoke = null, store = null, choices, ask = async () => false,
  healthy = async (port) => { try { return (await fetch(`http://127.0.0.1:${port}/traumerei/ai/v1/health`)).ok; } catch { return false; } },
  wait = (ms) => new Promise((r) => setTimeout(r, ms)), clock = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h) }, startup = 15000 } = {}) {
  const live = new Map();   // id → { port, timer }
  const starting = new Map(); // id → Promise
  const refused = new Set(); // asked this time and said no: not asked again until Settings allows it

  const stop = async (id) => {
    const l = live.get(id);
    if (l) { clock.clear(l.timer); live.delete(id); }
    if (invoke) { try { await invoke('sidecar_stop', { plugin: id }); } catch { /* gone either way */ } }
  };
  const touch = (id, spec) => {
    const l = live.get(id);
    if (!l) return;
    clock.clear(l.timer);
    l.timer = clock.set(() => { stop(id); }, Math.max(10, Number(spec.idle) || 300) * 1000);
  };

  async function start(plugin) {
    const { id, name, spec } = plugin;
    if (!invoke) return { ok: false, reason: 'a program beside the app runs only in the desktop app' };
    const bad = invalidSpec(spec);
    if (bad) return { ok: false, reason: bad };
    if (live.has(id)) { touch(id, spec); return { ok: true, port: live.get(id).port }; }
    if (!choices.allowed(id)) {
      if (refused.has(id)) return { ok: false, reason: 'not allowed to run a program (Settings → AI)' };
      if (!(await ask({ id, name, program: spec.program, bytes: spec.bytes, host: new URL(spec.url).host }))) { refused.add(id); return { ok: false, reason: 'not allowed to run a program (Settings → AI)' }; }
      choices.allow(id, true);
    }
    const shop = typeof store === 'function' ? store() : store;
    if (!shop) return { ok: false, reason: 'the plugin store is not there' };
    const got = await shop.trusted(id).files.download(spec.url, spec.program, { bytes: spec.bytes, label: spec.program, asked: true });
    if (!got.ok) return { ok: false, reason: got.reason };
    let port;
    try { port = await invoke('sidecar_start', { plugin: id, program: spec.program, checksum: spec.checksum, args: spec.args || ['--port', '{port}'] }); } catch (err) { return { ok: false, reason: String(err?.message || err) }; }
    for (let waited = 0; !(await healthy(port)); waited += 250) {
      if (waited >= startup) { await stop(id); return { ok: false, reason: 'its program started but never answered' }; }
      await wait(250);
    }
    live.set(id, { port, timer: null });
    touch(id, spec);
    return { ok: true, port };
  }

  return Object.freeze({
    // One plugin's sidecar: { start() → { ok, port } | { ok: false, reason }, stop(), running, provider(o) }.
    for(plugin) {
      const run = () => { if (!starting.has(plugin.id)) starting.set(plugin.id, start(plugin).finally(() => starting.delete(plugin.id))); return starting.get(plugin.id); };
      return Object.freeze({
        start: run,
        stop: () => stop(plugin.id),
        get running() { return live.has(plugin.id); },
        get port() { return live.get(plugin.id)?.port ?? null; },
        // A provider that speaks the HTTP bridge to this sidecar, starting it when first needed.
        // Its id is the plugin's, so the person's allow in Settings → AI is per plugin.
        provider: (o) => ({
          id: plugin.id, name: o.name || plugin.name, version: String(o.version ?? '1'), tasks: [...(o.tasks || [])],
          hints: { where: 'local', speed: 'medium', ...o.hints, runs: 'sidecar', asks: true },
          available: async () => (await run()).ok,
          unload: () => stop(plugin.id),
          run: async (task, input, ctx) => {
            const r = await run();
            if (!r.ok) throw new Error(r.reason);
            touch(plugin.id, plugin.spec);
            return http({ id: plugin.id, tasks: o.tasks, url: `http://127.0.0.1:${r.port}` }).run(task, input, ctx);
          },
        }),
      });
    },
    stop,
    running: () => [...live.keys()],
    forget: (id) => refused.delete(id),
  });
}
