// The base class for every feature. A feature folder's main file exports one class:
//
//   import { Feature } from 'folio';
//
//   export default class Notes extends Feature {
//     start() {
//       this.add('settings', { title: 'Notes', render: () => ... });
//     }
//   }
//
// start() runs once, after every feature this one `requires` has started. Everything a
// feature needs is reached through `this`, so it never has to touch another feature's code.

import * as ui from './ui.js';
import { getText } from './net.js';

export class Feature {
  constructor(app, manifest) {
    this.app = app;
    this.id = manifest.id;
    this.manifest = manifest;
    // This feature's own saved data. See Storage.js.
    this.storage = app.storage.area(manifest.id);
  }

  // Override this. It may be async.
  start() {}

  // ---- Slots: places to add things ----

  // Adds an item to a slot. Returns a function that removes it again.
  add(slotName, item) {
    return this.app.slot(slotName).add(item, this.id);
  }

  // Creates a new slot that other features can add to. Describe what an item looks like.
  defineSlot(name, description = '') {
    return this.app.defineSlot(name, this.id, description);
  }

  slot(name) {
    return this.app.slot(name);
  }

  // ---- Services: objects one feature offers to others ----

  provide(name, service) {
    this.app.provide(name, service, this.id);
  }

  // Another feature's service, or null if that feature isn't installed or didn't start.
  // Always handle null: that's what keeps the app working when a folder is deleted.
  use(name) {
    return this.app.use(name);
  }

  // ---- Events ----

  on(name, fn) {
    return this.app.on(name, fn, this.id);
  }

  emit(name, data) {
    this.app.emit(name, data);
  }

  // ---- Screen ----

  // Asks the app to redraw the top bar and the current view.
  refresh() {
    this.app.refresh();
  }

  // A copy of <template id="name"> from this feature's templates.html.
  template(name) {
    const t = document.getElementById(`${this.id}--${name}`);
    if (!t) throw new Error(`No template "${name}" in ${this.id}/templates.html`);
    return t.content.cloneNode(true);
  }

  toast(message) {
    ui.toast(message);
  }

  // ---- Platform ----

  // True inside the Android or iPhone app, false in the web version.
  get native() {
    return this.app.platform.native;
  }

  plugin(name) {
    return this.app.platform.plugin(name);
  }

  // Downloads text from another website (see net.js): through the phone in the Android app,
  // so sites that block web pages still work; an ordinary fetch on the web.
  getText(url) {
    return getText(url, this.app.platform);
  }
}
