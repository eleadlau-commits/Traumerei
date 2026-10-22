// The running app. It loads the features the compiler listed, starts them in order, and
// connects them through slots, services and events.
//
// Its promise: a feature that is missing, switched off, or broken never stops the rest.
//   - A feature whose `requires` aren't running is skipped, with the reason shown in Settings.
//   - A feature whose code fails to load, or whose start() throws, is switched off and
//     everything it added is removed again.
//   - A slot item or event listener that throws later is reported and skipped.
//
// Events the app sends to every feature:
//   'app:ready'    every feature has started
//   'app:resume'   the app came back to the screen
//   'app:tick'     once a minute while the app is on screen
//   'app:online' / 'app:offline'

import { Feature } from './Feature.js';
import { Slot } from './Slot.js';
import { Storage } from './Storage.js';
import { Events } from './Events.js';
import { Platform } from './Platform.js';
import { Shell } from './Shell.js';
import { toast } from './ui.js';

const STATUS_WORDS = {
  disabled: 'switched off',
  failed: 'not working',
  skipped: 'not available',
  'not-for-platform': 'not available here',
};

export class App {
  // config:   { id, name, version, build, framework, test }
  // registry: [{ id, name, description, version, requires, uses, platforms, path }] in start order
  // options:  { seed(app) } — test builds only: fills in sample data before features start
  constructor(config, registry, options = {}) {
    this.config = config;
    this.registry = registry;
    this.options = options;
    this.platform = new Platform();
    this.storage = new Storage(config.id, () => toast("Couldn't save that change on this device."));
    this.events = new Events(this);
    this.slots = new Map();
    this.services = new Map(); // name → { service, owner }
    this.features = new Map(); // id → { manifest, status, reason, problem, instance }
    this.problems = [];
    this.shell = null;
    this.pending = false;
  }

  // ---- Starting ----

  async start() {
    const html = document.documentElement;
    html.dataset.folio = 'starting';
    this.catchStrayErrors();
    this.shell = new Shell(this);

    if (this.options.seed) {
      try {
        await this.options.seed(this);
      } catch (err) {
        this.report('seed', err, 'adding test data');
      }
    }

    const disabled = new Set(this.storage.area('folio').get('disabled', []));
    // Load every feature's code at once. A file that fails to load only affects its own feature.
    const modules = await Promise.allSettled(
      this.registry.map((f) => import(new URL(f.path, document.baseURI).href)));

    for (const [i, manifest] of this.registry.entries()) {
      const record = { manifest, status: 'skipped', reason: '', problem: null, instance: null };
      this.features.set(manifest.id, record);

      if (!(manifest.platforms || ['web', 'android', 'ios']).includes(this.platform.name)) {
        record.status = 'not-for-platform';
        record.reason = `Only in the ${manifest.platforms.join(' and ')} version`;
        continue;
      }
      if (disabled.has(manifest.id)) {
        record.status = 'disabled';
        continue;
      }
      const missing = (manifest.requires || []).find((id) => this.features.get(id)?.status !== 'active');
      if (missing) {
        const dep = this.features.get(missing);
        record.reason = dep
          ? `Needs ${dep.manifest.name}, which is ${STATUS_WORDS[dep.status] || 'not running'}`
          : `Needs "${missing}", which isn't installed`;
        continue;
      }

      const loaded = modules[i];
      if (loaded.status === 'rejected') {
        this.fail(record, loaded.reason, 'loading its code');
        continue;
      }
      const FeatureClass = loaded.value.default;
      if (typeof FeatureClass !== 'function' || !(FeatureClass.prototype instanceof Feature)) {
        this.fail(record, new Error('its main file must export a class that extends Feature'), 'loading its code');
        continue;
      }
      try {
        record.instance = new FeatureClass(this, manifest);
        await record.instance.start();
        record.status = 'active';
      } catch (err) {
        this.fail(record, err, 'starting');
      }
    }

    html.dataset.folioActive = [...this.features.values()].filter((f) => f.status === 'active').map((f) => f.manifest.id).join(',');
    this.listenToDevice();
    this.emit('app:ready');
    this.shell.ready = true;
    this.shell.render();
    this.registerOfflineSupport();
    html.dataset.folio = 'ready';
  }

  fail(record, err, where) {
    const id = record.manifest.id;
    this.removeEverythingFrom(id);
    record.status = 'failed';
    record.reason = err?.message || String(err);
    this.report(id, err, where);
  }

  // Removes every slot item, listener and service a feature added (used when it fails to start).
  removeEverythingFrom(owner) {
    for (const slot of this.slots.values()) slot.removeOwner(owner);
    this.events.removeOwner(owner);
    for (const [name, entry] of this.services) if (entry.owner === owner) this.services.delete(name);
  }

  // ---- Slots ----

  slot(name) {
    let slot = this.slots.get(name);
    if (!slot) this.slots.set(name, (slot = new Slot(this, name)));
    return slot;
  }

  defineSlot(name, owner, description = '') {
    const slot = this.slot(name);
    if (slot.owner && slot.owner !== owner) console.warn(`Slot "${name}" is defined by both ${slot.owner} and ${owner}.`);
    slot.owner = owner;
    slot.description = description;
    return slot;
  }

  // ---- Services ----

  provide(name, service, owner) {
    const existing = this.services.get(name);
    if (existing && existing.owner !== owner) console.warn(`Service "${name}" from ${existing.owner} is replaced by ${owner}.`);
    this.services.set(name, { service, owner });
  }

  use(name) {
    return this.services.get(name)?.service ?? null;
  }

  // ---- Events ----

  on(name, fn, owner) {
    return this.events.on(name, fn, owner);
  }

  emit(name, data) {
    this.events.emit(name, data);
  }

  // ---- Screen ----

  // Redraws the top bar and the current view. Many calls in a row cause only one redraw.
  refresh() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      try {
        this.shell?.render();
      } catch (err) {
        this.report(null, err, 'drawing the screen');
      }
    });
  }

  // ---- Problems ----

  // Records a problem without stopping anything. Shown in Settings → About.
  report(owner, err, where = '') {
    const message = err?.message || String(err);
    console.error(`[${owner || 'app'}] ${message}${where ? ` (${where})` : ''}`, err);
    this.problems.push({ feature: owner, message, where, at: Date.now() });
    const record = owner && this.features.get(owner);
    if (record && record.status === 'active') record.problem = message;
    document.documentElement.dataset.folioProblems = String(this.problems.length);
  }

  catchStrayErrors() {
    window.addEventListener('error', (e) => this.report(null, e.error || e.message, 'uncaught'));
    window.addEventListener('unhandledrejection', (e) => this.report(null, e.reason, 'uncaught'));
  }

  // ---- Device ----

  listenToDevice() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.emit('app:resume');
      this.refresh();
    });
    setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      this.emit('app:tick');
      this.refresh();
    }, 60000);
    window.addEventListener('online', () => { this.emit('app:online'); this.refresh(); });
    window.addEventListener('offline', () => { this.emit('app:offline'); this.refresh(); });
  }

  // Lets the web version open without internet. Not needed inside the Android/iPhone app.
  registerOfflineSupport() {
    if (this.platform.native || this.config.test) return;
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
