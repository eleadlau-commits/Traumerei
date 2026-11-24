// Files in and out: the one seam between the app and where it runs (t.ui.files).
//
// In a browser, open() is a hidden file input and save() a download. In the desktop app (Tauri,
// seen by window.__TAURI_INTERNALS__) open() is the same input, which the webview shows as Windows'
// Open dialog, and save() asks the shell (its save_file command, desktop/src-tauri/src/main.rs) for
// Windows' Save dialog and writes the file where the person chose. arrived(fn) hears files the
// person opened from Windows (a double-clicked .traum): the shell queues them (take_opened) and
// pokes the page through window.__traumereiOpened.

const shell = () => (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) || null;

// True inside the desktop app.
export const desktop = () => !!shell();

// Opens an https address in the person's browser: a new tab, or (the desktop app, whose window
// shows only Träumerei) the default browser through the shell's open_link. False for any other address.
export function link(url) {
  url = String(url);
  if (!/^https:\/\//.test(url)) return false;
  const s = shell();
  if (s) { s.invoke('open_link', { url }).catch(() => {}); return true; }
  if (typeof window === 'undefined') return false;
  window.open(url, '_blank', 'noopener');
  return true;
}

// A trip through the person's browser and back, for what can't happen inside the desktop app's
// window (signing in with Google). The shell opens a port on this computer (sign_in_port), urlFor(port)
// is opened in the default browser, and once the browser comes back to http://127.0.0.1:<port>/…
// the shell (sign_in_wait) hands over that path and query. Resolves with it ('/done?…'), or null:
// in a browser, for an address that isn't https, or when nobody came back within five minutes.
export async function roundTrip(urlFor) {
  const s = shell();
  if (!s || typeof urlFor !== 'function') return null;
  try {
    const port = await s.invoke('sign_in_port');
    if (!link(urlFor(port))) return null;
    return (await s.invoke('sign_in_wait')) || null;
  } catch { return null; }
}

// A picked file's type, from its name, for the File the page gets (the shell hands bytes only).
const TYPES = { pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', traum: 'text/plain', bib: 'text/plain', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', epub: 'application/epub+zip' };
const typeFor = (name) => TYPES[String(name).split('.').pop().toLowerCase()] || '';

// download(name, content, type): the browser's download; picker(accept): Folio's ui.filePicker.
export function files({ download, picker }) {
  const pickers = new Map();
  const hearing = new Set();
  // Takes the files the shell holds and hands each to everyone hearing, as a File.
  const pull = async () => {
    const s = shell();
    if (!s || !hearing.size) return;
    let got = [];
    try { got = (await s.invoke('take_opened')) || []; } catch { return; }
    for (const [name, bytes] of got) {
      const file = new File([new Uint8Array(bytes)], name, { type: 'text/plain' });
      for (const fn of [...hearing]) fn(file);
    }
  };
  const input = (accept) => {
    if (typeof document === 'undefined') return Promise.resolve(null);
    if (!pickers.has(accept)) pickers.set(accept, picker(accept));
    return pickers.get(accept).pick();
  };
  return Object.freeze({
    // Resolves with the chosen File (name, text()), or null when none is chosen. In the desktop
    // app (since 1.1.4) Windows' Open dialog comes from the shell (pick_file), which remembers the
    // file, and the File also carries `path`, for show() and hash() later.
    async open(accept = '') {
      const s = shell();
      if (!s) return input(accept);
      let got;
      try { got = await s.invoke('pick_file', { accept: String(accept) }); } catch { return input(accept); } // an older shell: the webview's own dialog
      if (!got) return null;
      const [path, name] = got;
      try {
        const bytes = await s.invoke('read_picked', { path });
        const file = new File([bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes)], name, { type: typeFor(name) });
        Object.defineProperty(file, 'path', { value: path, enumerable: true });
        return file;
      } catch { return null; }
    },
    // Since 1.1.4, the desktop app only, and only for a path open() handed out here (on this
    // computer, in any session): opens the file in its own app ({ page } is passed on where a
    // viewer could take it; today none is, so `page` comes back false), or with { reveal: true }
    // (and always for a program) shows it in its folder in Explorer. → { ok, how: 'opened' |
    // 'revealed', page: false } or { ok: false, reason }.
    async show(path, { page = null, reveal = false } = {}) {
      const s = shell();
      if (!s) return { ok: false, reason: 'Files on this computer open only in the desktop app' };
      try { const how = await s.invoke('show_file', { path: String(path), reveal: !!reveal }); return { ok: true, how, page: false }; }
      catch (err) { return { ok: false, reason: String(err?.message || err) }; }
    },
    // Since 1.1.4, the same paths only: { sha256: 'sha256:<hex>', bytes }, never the contents;
    // null in a browser or for a path refused.
    async hash(path) {
      const s = shell();
      if (!s) return null;
      try { const [sha256, bytes] = await s.invoke('hash_file', { path: String(path) }); return { sha256, bytes }; } catch { return null; }
    },
    // Hands the person a file: content words or a Blob (a zip, a picture). Resolves true once it
    // is saved (a browser download always is), false when the person cancels or it can't be written.
    async save(name, content, type = 'text/plain') {
      const s = shell();
      if (!s) return !!download(String(name), content, type);
      const bytes = content instanceof Blob ? [...new Uint8Array(await content.arrayBuffer())] : [...new TextEncoder().encode(String(content ?? ''))];
      try { return !!(await s.invoke('save_file', { name: String(name), bytes })); } catch { return false; }
    },
    // fn(file) hears each file opened from Windows, the one the app started with first (once the
    // page has loaded). Never in a browser. Returns a function that stops hearing.
    arrived(fn) {
      if (!shell() || typeof fn !== 'function') return () => {};
      hearing.add(fn);
      window.__traumereiOpened = pull;
      const go = () => setTimeout(pull, 0);
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
      return () => hearing.delete(fn);
    },
  });
}
