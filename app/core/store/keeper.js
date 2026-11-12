// Part of the store feature (keeper.js): one plugin's store, from the backend (backends.js) and the app's
// storage. Pure of the screen: asking the person comes in as `ask`, so the tests run it as it is.
//
// for(id) → {
//   get(key, fallback?), set(key, value), remove(key), keys()      small state, local only
//   files: { quota, used(), list(), get(name), put(name, data), append(name, data), remove(name),
//            clear(), download(url, name, { bytes, label?, signal?, progress? }) }
// }

import { NAME, ID } from './backends.js';

export const QUOTA = 4 * 1024 ** 3; // bytes a plugin may keep in files unless the app says otherwise
const CHUNK = 8 * 1024 * 1024;      // what a download writes at a time

const bytesOf = async (data) => {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new Error('put takes bytes, a Blob or words');
};

// The size in words: 274 MB, 1.2 GB.
export const size = (n) => (n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// backend: backends.js; area(id) → { get(key, fallback), set(key, value) } (Folio storage);
// quota(id) → bytes; ask({ id, name, label, bytes }) → Promise<bool> (the person agrees to a download);
// fetcher: fetch.
export function makeStore({ backend, area, quota = () => QUOTA, ask = async () => false, fetcher = (...a) => globalThis.fetch(...a) }) {
  const name = (n) => { if (!NAME.test(String(n))) throw new Error(`"${n}" isn't a file name a plugin may use (letters, digits, dot, dash, underscore)`); return String(n); };
  return {
    for(id) {
      if (!ID.test(String(id))) throw new Error(`"${id}" isn't a plugin id`);
      const small = area(id);
      const limit = () => quota(id);
      const list = () => backend.list(id);
      const used = async () => (await list()).reduce((s, f) => s + f.bytes, 0);
      const files = Object.freeze({
        get quota() { return limit(); },
        used, list,
        get: (n) => backend.read(id, name(n)),
        put: async (n, data) => backend.write(id, name(n), await bytesOf(data), { append: false, quota: limit() }),
        append: async (n, data) => backend.write(id, name(n), await bytesOf(data), { append: true, quota: limit() }),
        remove: (n) => backend.remove(id, name(n)),
        clear: () => backend.clear(id),
        // A large file (a model) from the web into the store, the first time it is needed. The
        // person is asked first, with its size; a file already there at that size is kept.
        // Resolves with { ok: true, bytes, kept? } or { ok: false, reason }.
        async download(url, n, { bytes, label = '', signal = null, progress = () => {} } = {}) {
          n = name(n);
          if (!/^https:\/\//.test(String(url))) return { ok: false, reason: 'A download must come from an https address' };
          if (!(bytes > 0)) return { ok: false, reason: 'Say how large the file is, so the person can be asked' };
          const have = (await list()).find((f) => f.name === n);
          if (have && have.bytes === bytes) return { ok: true, bytes, kept: true };
          if ((await used()) - (have?.bytes || 0) + bytes > limit()) return { ok: false, reason: `It needs ${size(bytes)}, more than this plugin may keep (${size(limit())})` };
          if (!(await ask({ id, name: n, label: label || n, bytes }))) return { ok: false, reason: 'Not now' };
          let got = 0;
          try {
            const res = await fetcher(url, { signal });
            if (!res.ok || !res.body) throw new Error(`the server said ${res.status}`);
            const reader = res.body.getReader();
            let buf = [], held = 0, first = true;
            const flush = async () => {
              if (!held && !first) return;
              const chunk = new Uint8Array(held); let at = 0;
              for (const b of buf) { chunk.set(b, at); at += b.length; }
              await backend.write(id, n, chunk, { append: !first, quota: limit() });
              first = false; buf = []; held = 0;
            };
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buf.push(value); held += value.length; got += value.length;
              if (got > bytes) throw new Error('it is larger than it said');
              if (held >= CHUNK) await flush();
              progress(got / bytes);
            }
            await flush();
            if (got !== bytes) throw new Error(`it came to ${size(got)}, not ${size(bytes)}`);
            return { ok: true, bytes: got };
          } catch (err) {
            try { await backend.remove(id, n); } catch { /* nothing was written */ }
            return { ok: false, reason: signal?.aborted ? 'Cancelled' : `The download failed: ${err.message}` };
          }
        },
      });
      return Object.freeze({
        get: (key, fallback = null) => small.get(String(key), fallback),
        set: (key, value) => { small.set(String(key), value ?? null); },
        remove: (key) => { small.set(String(key), null); },
        clear: () => { for (const k of small.keys?.() || []) small.set(k, null); },
        keys: () => (small.keys ? small.keys().filter((k) => !k.startsWith('__')) : []),
        files,
      });
    },
  };
}
