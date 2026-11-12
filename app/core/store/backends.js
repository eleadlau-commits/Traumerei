// Part of the store feature: where a plugin's large files live. Three backends with one shape,
// { name, list(id), read(id, name), write(id, name, bytes, { append, quota }), remove(id, name), clear(id) }:
//   desktop  the Windows app's store commands (desktop/src-tauri/src/store.rs): %APPDATA%\…\plugins\<id>\
//   opfs     the browser's origin private file system: plugins/<id>/
//   memory   kept in memory (tests, and a browser without OPFS)
// list resolves with [{ name, bytes }] by name; read with a Uint8Array or null; write with the
// bytes the plugin keeps afterwards, or rejects over the quota.

export const NAME = /^(?!\.)[A-Za-z0-9._-]{1,128}$/;
export const ID = /^[a-z][a-z0-9-]{0,63}$/;
const over = (after, quota) => new Error(`over its quota: it would keep ${Math.ceil(after / 1048576)} MB of ${Math.floor(quota / 1048576)} MB`);

export function memory() {
  const all = new Map(); // id → Map(name → Uint8Array)
  const of = (id) => { if (!all.has(id)) all.set(id, new Map()); return all.get(id); };
  const used = (id) => [...of(id).values()].reduce((s, b) => s + b.length, 0);
  return {
    name: 'memory',
    list: async (id) => [...of(id)].map(([name, b]) => ({ name, bytes: b.length })).sort((a, b) => (a.name < b.name ? -1 : 1)),
    read: async (id, name) => of(id).get(name)?.slice() || null,
    write: async (id, name, bytes, { append = false, quota }) => {
      const had = of(id).get(name) || new Uint8Array(0);
      const next = append ? concat(had, bytes) : bytes.slice();
      const after = used(id) - had.length + next.length;
      if (after > quota) throw over(after, quota);
      of(id).set(name, next);
      return after;
    },
    remove: async (id, name) => of(id).delete(name),
    clear: async (id) => { all.delete(id); },
  };
}

export function opfs(root = () => navigator.storage.getDirectory()) {
  const dir = async (id, make = false) => {
    try { return await (await (await root()).getDirectoryHandle('plugins', { create: make })).getDirectoryHandle(id, { create: make }); } catch { return null; }
  };
  const list = async (id) => {
    const d = await dir(id);
    if (!d) return [];
    const out = [];
    for await (const [name, h] of d.entries()) if (h.kind === 'file') out.push({ name, bytes: (await h.getFile()).size });
    return out.sort((a, b) => (a.name < b.name ? -1 : 1));
  };
  return {
    name: 'opfs',
    list,
    read: async (id, name) => {
      const d = await dir(id);
      try { return d ? new Uint8Array(await (await (await d.getFileHandle(name)).getFile()).arrayBuffer()) : null; } catch { return null; }
    },
    write: async (id, name, bytes, { append = false, quota }) => {
      const files = await list(id);
      const had = files.find((f) => f.name === name)?.bytes || 0;
      const after = files.reduce((s, f) => s + f.bytes, 0) - (append ? 0 : had) + bytes.length;
      if (after > quota) throw over(after, quota);
      const h = await (await dir(id, true)).getFileHandle(name, { create: true });
      const w = await h.createWritable({ keepExistingData: append });
      if (append) await w.seek(had);
      await w.write(bytes);
      await w.close();
      return after;
    },
    remove: async (id, name) => { const d = await dir(id); try { await d?.removeEntry(name); return !!d; } catch { return false; } },
    clear: async (id) => { try { await (await (await root()).getDirectoryHandle('plugins')).removeEntry(id, { recursive: true }); } catch { /* nothing there */ } },
  };
}

export function desktop(shell) {
  return {
    name: 'desktop',
    list: async (id) => (await shell.invoke('store_list', { plugin: id })).map(([name, bytes]) => ({ name, bytes })),
    read: async (id, name) => {
      try { return new Uint8Array(await shell.invoke('store_read', { plugin: id, name })); } catch (err) { if (String(err).includes('missing')) return null; throw err; }
    },
    write: async (id, name, bytes, { append = false, quota }) =>
      shell.invoke('store_write', bytes, { headers: { plugin: id, name, append: append ? '1' : '0', quota: String(quota) } }),
    remove: (id, name) => shell.invoke('store_delete', { plugin: id, name }),
    clear: (id) => shell.invoke('store_clear', { plugin: id }),
  };
}

function concat(a, b) { const out = new Uint8Array(a.length + b.length); out.set(a); out.set(b, a.length); return out; }

// The backend for where the app runs: the desktop app's, else OPFS when the browser has it, else memory.
export function pick() {
  const shell = typeof window !== 'undefined' ? window.__TAURI_INTERNALS__ : null;
  if (shell) return desktop(shell);
  if (typeof navigator !== 'undefined' && navigator.storage?.getDirectory) return opfs();
  return memory();
}
