// The plugin store: where each plugin keeps what is its own on this computer (app/core/API.md,
// t.store). Small state goes in Folio's storage, in an area of its own per plugin; large files (a
// model) go to the backend for where the app runs (backends.js: the Windows app's data folder, or
// the browser's private file system), held to a quota. None of it is ever in a .traum file:
// the file is the six tables (Law 8), and this is what a plugin keeps outside them.
//
// It offers the `store` service (README.md). Saved data: each plugin's small state, in the
// storage area `store.<plugin id>`; files in the backend, under plugins/<plugin id>/.

import { Feature, ui } from 'folio';
import { makeStore, size, QUOTA } from './keeper.js';
import { pick } from './backends.js';

const { el } = ui;

export default class Store extends Feature {
  start() {
    const backend = pick();
    const store = makeStore({ backend, area: (id) => this.app.storage.area(`store.${id}.`), quota: () => QUOTA, ask: (o) => this.ask(o) });
    this.provide('store', Object.freeze({
      for: (id) => store.for(id),
      // For the app's own features only (never handed to a plugin): a download it already asked the person about.
      trusted: (id) => store.for(id, { trusted: true }),
      backend: backend.name,
      // For Settings → Plugins: what a plugin keeps, and taking it all away.
      used: async (id) => { try { return await store.for(id).files.used(); } catch { return 0; } },
      clear: async (id) => { const s = store.for(id); await s.files.clear(); s.clear(); },
      size,
    }));
  }

  // Asks the person before a download, with its size. Resolves true when they agree.
  ask({ id, label, bytes }) {
    const name = this.app.features.get(id)?.manifest.name || id;
    return new Promise((done) => {
      let answer = false;
      const d = ui.dialog({ title: 'Download for a plugin', size: 'box', onClose: () => done(answer) });
      const yes = el('button', { type: 'button', class: 'word', onclick: () => { answer = true; d.close(); } }, `Download ${size(bytes)}`);
      d.setContent(
        el('p', {}, `${name} would like to download ${label} (${size(bytes)}) and keep it on this computer, in its own store.`),
        el('p', { class: 'hint small' }, 'It is downloaded once. Settings → Plugins shows what each plugin keeps, and Clear takes it away.'),
        el('div', { class: 'row' }, yes, el('button', { type: 'button', class: 'word', onclick: () => d.close() }, 'Not now')));
      d.open();
      requestAnimationFrame(() => yes.focus());
    });
  }
}
