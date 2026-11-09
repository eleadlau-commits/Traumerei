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
  return Object.freeze({
    // Resolves with the chosen File (name, text()), or null when none is chosen.
    open(accept = '') {
      if (typeof document === 'undefined') return Promise.resolve(null);
      if (!pickers.has(accept)) pickers.set(accept, picker(accept));
      return pickers.get(accept).pick();
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
