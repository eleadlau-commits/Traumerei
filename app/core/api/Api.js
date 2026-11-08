// Plugin API: offers the `traumerei` service, the one way a plugin reaches the app (api.js holds
// the list, app/core/API.md says it in words). A plugin connects once, in its start():
//
//   const t = this.use('traumerei')?.connect(this);
//
// and gets its own copy of the API, so everything it adds is its own and goes when it is
// switched off. No saved data.

import { Feature, ui } from 'folio';
import { API_VERSION, surface, connect } from './api.js';

export default class Api extends Feature {
  start() {
    const world = this.use('world');
    const parts = surface(world.lib);
    const app = this.app;
    this.provide('traumerei', Object.freeze({
      version: API_VERSION,
      connect: (plugin) => connect({ app, world, plugin, parts, toast: ui.toast }),
    }));
  }
}
