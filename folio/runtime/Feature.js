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
//
// A feature can be switched off while the app runs (Settings, or app.stopFeature). Folio then
// takes away its slot items, services and event listeners itself, and calls stop(). What else it
// made is its own to undo in stop(), unless it made it through attach() (a node put on the page)
// or listenTo() (a listener on the window, the document or a node), which are undone for it.

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

  // Override this to undo what start() made that Folio doesn't know of (timers, say). Called when
  // the feature is switched off while the app runs; then attach() and listenTo() are undone.
  stop() {}

  // ---- Things on the page, undone when it stops ----

  // Puts `node` in `parent` (Folio's root by default) and returns it; it is taken away on stop.
  attach(node, parent = document.getElementById('folio-root') || document.body) {
    parent.append(node);
    this.whenStopped(() => node.remove());
    return node;
  }

  // target.addEventListener(type, fn, options), taken away on stop. Returns a function that takes
  // it away now.
  listenTo(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    const off = () => target.removeEventListener(type, fn, options);
    this.whenStopped(off);
    return off;
  }

  // fn runs when the feature stops (after stop()).
  whenStopped(fn) {
    (this.folioStops ||= []).push(fn);
  }

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
