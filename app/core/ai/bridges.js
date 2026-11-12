// The three standard bridges (app/core/AI.md, Bridges), as ready-made providers a plugin adds:
//
// - worker({ … source | url }): a provider whose work runs in a Web Worker: JS, or WebAssembly
//   with its JS glue, sandboxed off the page. The worker speaks the message protocol below.
// - http({ … url }): a provider behind a local connection: a sidecar process beside the desktop
//   app (runs: 'sidecar', needs the person's permission) or any server speaking the protocol.
// - openai({ … url, model }): embed through an OpenAI-style server (Ollama, llama.cpp's server, …),
//   with the engine it shares.
//
// Worker protocol. The page posts { id, op: 'run', task, version, input } and { id, op: 'cancel' };
// the worker answers { id, part } (any number, streamed), then { id, ok: true, output } or
// { id, ok: false, reason }. Vectors travel as Float32Array: the worker transfers its answers' buffers;
// the page's inputs are copied.
//
// HTTP protocol. POST <url>/traumerei/ai/v1/<task> with JSON { version, input }; the answer is
// JSON { output } or { reason } (any status but 2xx is a failure). Vectors, in both directions,
// are { dim, data: { float32: <base64 of little-endian float32> } }. GET <url>/traumerei/ai/v1/health
// answering 2xx means available.

// ---- Vectors as bytes ----
const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
export function f32ToBase64(data) {
  const bytes = new Uint8Array(data.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i++) view.setFloat32(i * 4, data[i], true);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToF32(text) {
  const s = atob(text);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  if (little) return new Float32Array(bytes.buffer);
  const view = new DataView(bytes.buffer), out = new Float32Array(bytes.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = view.getFloat32(i * 4, true);
  return out;
}
// Every Float32Array in a value written as { float32: base64 }, and back.
export const toWire = (v) => (v instanceof Float32Array ? { float32: f32ToBase64(v) } : Array.isArray(v) ? v.map(toWire)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toWire(x)])) : v);
export const fromWire = (v) => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.float32 === 'string' && Object.keys(v).length === 1 ? base64ToF32(v.float32)
  : Array.isArray(v) ? v.map(fromWire) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fromWire(x)])) : v);

const base = (o) => ({ id: o.id, name: o.name || o.id, version: String(o.version ?? '1'), tasks: [...(o.tasks || [])], ...(o.engine ? { engine: o.engine } : {}) });

// A provider in a Web Worker. o: { id, name?, version, tasks, hints?, source (the worker's code) | url, Worker? }.
export function worker(o) {
  const Make = o.Worker || globalThis.Worker;
  let w = null, seq = 0;
  const waiting = new Map();
  const start = () => {
    if (w) return w;
    if (!Make) throw new Error('This place has no workers');
    const url = o.url || URL.createObjectURL(new Blob([o.source], { type: 'text/javascript' }));
    w = new Make(url, { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data || {};
      const job = waiting.get(m.id);
      if (!job) return;
      if ('part' in m) { job.part(m.part); return; }
      waiting.delete(m.id);
      if (m.ok) job.resolve(m.output); else job.reject(new Error(m.reason || 'the worker failed'));
    };
    w.onerror = (e) => { for (const job of waiting.values()) job.reject(new Error(e.message || 'the worker failed')); waiting.clear(); };
    return w;
  };
  return {
    ...base(o), hints: { where: 'local', runs: 'worker', ...o.hints },
    load: async () => { start(); },
    unload: async () => { if (w) { w.terminate(); w = null; } for (const job of waiting.values()) job.reject(new Error('Unloaded')); waiting.clear(); },
    run: (task, input, ctx) => new Promise((resolve, reject) => {
      const id = ++seq;
      const ww = start();
      waiting.set(id, { resolve, reject, part: ctx.part });
      ctx.signal?.addEventListener?.('abort', () => { if (waiting.delete(id)) { ww.postMessage({ id, op: 'cancel' }); reject(new Error('Cancelled')); } }, { once: true });
      ww.postMessage({ id, op: 'run', task, version: ctx.version, input });  // inputs are copied (the caller and the cache keep theirs)
    }),
  };
}

// A provider behind a local connection. o: { id, name?, version, tasks, hints?, url, fetch? }.
// A sidecar is local (its data stays on this machine) and runs only with the person's permission;
// a server elsewhere must say hints.where 'remote'.
export function http(o) {
  const get = o.fetch || globalThis.fetch;
  const root = String(o.url).replace(/\/$/, '');
  return {
    ...base(o), hints: { where: 'local', runs: 'sidecar', ...o.hints },
    available: async () => { try { return (await get(`${root}/traumerei/ai/v1/health`)).ok; } catch { return false; } },
    run: async (task, input, ctx) => {
      const res = await get(`${root}/traumerei/ai/v1/${task}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: ctx.version, input: toWire(input) }), signal: ctx.signal || undefined });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.reason || `it answered ${res.status}`);
      return fromWire(body.output);
    },
  };
}

// Embed through an OpenAI-style server: POST <url>/v1/embeddings { model, input: [texts] }.
// o: { id?, name?, version?, url, model, where? ('local' unless said), memory?, fetch? }.
// Returns { provider, engine }: add both (the engine is shared by every provider on that server).
export function openai(o) {
  const get = o.fetch || globalThis.fetch;
  const root = String(o.url).replace(/\/$/, '').replace(/\/v1$/, '');
  const engine = { id: `openai:${root}`, name: `OpenAI-style server at ${root}`, kind: 'openai', memory: o.memory || 0 };
  const provider = {
    ...base({ id: o.id || `openai-embed:${o.model}`, name: o.name || `${o.model} (embeddings)`, version: o.version || o.model, tasks: ['embed'] }),
    engine: engine.id, hints: { where: o.where || 'local', runs: 'main', speed: 'medium' },
    run: async (task, input, ctx) => {
      const res = await get(`${root}/v1/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: o.model, input: input.items.map((x) => x.text) }), signal: ctx.signal || undefined });
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      const { data } = await res.json();
      const rows = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((d) => d.embedding);
      const dim = rows[0]?.length || 0;
      if (!dim || rows.length !== input.items.length) throw new Error('the server gave the wrong number of vectors');
      const out = new Float32Array(rows.length * dim);
      rows.forEach((r, i) => out.set(r, i * dim));
      return { vectors: { dim, data: out } };
    },
  };
  return { provider, engine };
}
