// Plugin API: offers the `traumerei` service, the one way a plugin reaches the app (v1.js holds
// the list, app/core/API.md says it in words). A plugin connects once, in its start():
//
//   const t = this.use('traumerei')?.connect(this);
//
// and gets its own copy of the API, so everything it adds is its own and goes when it is
// switched off. No saved data.

import { Feature, ui } from 'folio';
import { API_VERSION, surface, connect } from './v1.js';

export default class Api extends Feature {
  start() {
    const world = this.use('world');
    const parts = surface(world.lib);
    const app = this.app;
    const docks = this.use('docks'); // the left and right docks (the docks feature), or null
    // What to undo when a plugin is switched off, by plugin: the dock tabs it opened.
    this.leaving = new Map();
    const gone = (id) => (fn) => { if (!this.leaving.has(id)) this.leaving.set(id, []); this.leaving.get(id).push(fn); };
    this.provide('traumerei', Object.freeze({
      version: API_VERSION,
      connect: (plugin) => connect({ app, world, plugin, parts, toast: ui.toast, docks, gone: gone(plugin.id) }),
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
