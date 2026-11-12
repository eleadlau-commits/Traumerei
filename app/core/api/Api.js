// Plugin API: offers the `traumerei` service, the one way a plugin reaches the app (v2.js holds
// the list; app/core/API.md says it in words, app/core/KERNEL.md the tables behind it). A plugin connects once, in its start():
//
//   const t = this.use('traumerei')?.connect(this);
//
// and gets its own copy of the API, so everything it adds is its own and goes when it is
// switched off. No saved data.

import { Feature, ui } from 'folio';
import { API_VERSION, surface, connect } from './v2.js';
import { files as fileSeam, desktop, link, roundTrip } from './files.js';

// A file handed to the person: words or a Blob, saved under a name (the browser's download).
function download(name, content, type) {
  if (typeof document === 'undefined') return false;
  const blob = content instanceof Blob ? content : new Blob([String(content ?? '')], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

export default class Api extends Feature {
  start() {
    const world = this.use('world');
    // Kinds of link a plugin brings (cites, contradicts): the API reads them when a link is proposed.
    this.defineSlot('links.kinds', 'A kind of link: { kind, name, note?, both?, admit?(from, to, reads) } (app/core/API.md).');
    const parts = surface(world.lib);
    const app = this.app;
    const docks = this.use('docks');   // the left and right docks (the docks feature), or null
    const keys = this.use('keys');     // the key map (the keys feature), or null
    const frame = this.use('frame');   // the top bar and status bar (the frame feature), or null
    const floors = this.use('floors'); // where rooms sit on the rooms page (the floors feature), or null
    const ai = this.use('ai');         // the AI framework (the ai feature, app/core/AI.md), or null
    const store = this.use('store');   // what each plugin keeps on this computer (the store feature), or null
    // The rooms page starts after the plugins it shows (it uses Time and Search), so it is
    // looked up when a plugin first goes somewhere, not here.
    const service = (name) => app.use(name);
    const room = () => app.slot('rooms.room')?.items?.[0] || null; // the open room (the room feature's slot item), looked up when asked
    const files = fileSeam({ download, picker: (accept) => ui.filePicker(accept) }); // open and save files, browser or desktop
    const events = { on: (name, fn) => this.on(name, fn) }; // what a plugin subscribes to, heard through this feature
    // What to undo when a plugin is switched off, by plugin: the dock tabs it opened.
    this.leaving = new Map();
    const gone = (id) => (fn) => { if (!this.leaving.has(id)) this.leaving.set(id, []); this.leaving.get(id).push(fn); };
    this.provide('traumerei', Object.freeze({
      version: API_VERSION,
      connect: (plugin) => connect({ app, world, plugin, parts, lib: world.lib, events, toast: ui.toast, files, link, roundTrip, desktop: desktop(), docks, keys, frame, floors, service, room, gone: gone(plugin.id), ai, store }),
      // For the app, not plugins: closes what a plugin opened, once it is switched off.
      release: (id) => this.release(id),
    }));
  }

  release(id) {
    for (const fn of this.leaving.get(id) || []) {
      try { fn(); } catch (err) { this.app.report(id, err, 'closing what it opened'); }
    }
    this.leaving.delete(id);
  }
}
