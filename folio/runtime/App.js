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
  safe: 'off in safe mode',
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
    this.safe = this.safeMode();
    // Load every feature's code at once. A file that fails to load only affects its own feature.
    const modules = await Promise.allSettled(
      this.registry.map((f) => import(new URL(f.path, document.baseURI).href)));
    this.modules = new Map(this.registry.map((f, i) => [f.id, modules[i]])); // for starting one again later

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
      if (this.safe && manifest.plugin) {
        record.status = 'safe';
        record.reason = 'Off in safe mode';
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

      await this.run(record, modules[i]);
    }

    html.dataset.folioActive = [...this.features.values()].filter((f) => f.status === 'active').map((f) => f.manifest.id).join(',');
    this.listenToDevice();
    this.emit('app:ready');
    this.shell.ready = true;
    this.shell.render();
    this.registerOfflineSupport();
    html.dataset.folio = 'ready';
  }

  // Starts one feature from its loaded code. True when it runs.
  async run(record, loaded) {
    const { manifest } = record;
    if (loaded.status === 'rejected') {
      this.fail(record, loaded.reason, 'loading its code');
      return false;
    }
    const FeatureClass = loaded.value.default;
    if (typeof FeatureClass !== 'function' || !(FeatureClass.prototype instanceof Feature)) {
      this.fail(record, new Error('its main file must export a class that extends Feature'), 'loading its code');
      return false;
    }
    try {
      record.instance = new FeatureClass(this, manifest);
      record.problem = null;
      record.reason = '';
      await record.instance.start();
      record.status = 'active';
      return true;
    } catch (err) {
      this.fail(record, err, 'starting');
      return false;
    }
  }

  // ---- Switching features on and off while the app runs ----

  // Safe mode: every plugin (a feature with a "plugin" block) stays off for this start, whatever
  // was chosen. Asked for by ?safe in the address, by "Start in safe mode" (startSafe), or by
  // holding Shift while the app starts.
  safeMode() {
    let asked = false;
    try { asked = sessionStorage.getItem('folio-safe') === '1'; sessionStorage.removeItem('folio-safe'); } catch { /* private window */ }
    return asked || new URLSearchParams(location.search).has('safe') || !!window.__folioShift;
  }

  // Starts again in safe mode, or (safe false) normally.
  restart(safe = false) {
    try { if (safe) sessionStorage.setItem('folio-safe', '1'); } catch { /* private window */ }
    const url = new URL(location.href);
    url.searchParams.delete('safe');
    if (url.href !== location.href) location.replace(url.href); else location.reload();
  }

  // The running features that need `id`, directly or through another, in the order they started.
  dependents(id) {
    const out = new Set([id]);
    for (const [fid, f] of this.features) {
      if (f.status === 'active' && (f.manifest.requires || []).some((r) => out.has(r))) out.add(fid);
    }
    out.delete(id);
    return [...out];
  }

  // Switches a running feature off (and every running feature that needs it, last started first),
  // and remembers it is off. Its data stays. Returns the ids switched off.
  stopFeature(id) {
    const record = this.features.get(id);
    if (!record || record.status !== 'active') return [];
    const order = [id, ...this.dependents(id)].reverse();
    for (const fid of order) {
      const f = this.features.get(fid);
      try { f.instance?.stop(); } catch (err) { this.report(fid, err, 'stopping'); }
      for (const fn of (f.instance?.folioStops || []).splice(0)) {
        try { fn(); } catch (err) { this.report(fid, err, 'stopping'); }
      }
      // Off first, so whatever its going sets off (a slot watcher) already sees it is off.
      if (fid === id) { f.status = 'disabled'; f.reason = ''; } else { f.status = 'skipped'; f.reason = `Needs ${record.manifest.name}, which is switched off`; }
      this.removeEverythingFrom(fid);
      f.instance = null;
      f.problem = null;
      this.emit('app:stopped', fid);
    }
    this.setOff(id, true);
    this.changedFeatures();
    return order;
  }

  // Switches a feature on again while the app runs, then every feature that was waiting for it.
  // Returns the ids that started; a feature that fails says why (its record's reason).
  async startFeature(id) {
    this.setOff(id, false);
    const started = [];
    const record = this.features.get(id);
    if (!record || record.status === 'active') return started;
    if (record.status === 'disabled' || record.status === 'safe') { record.status = 'skipped'; record.reason = ''; }
    // Everything not running that could now start, in the order of the registry (which keeps
    // what a feature requires before it), as long as each is wanted and its needs are running.
    const off = new Set(this.storage.area('folio').get('disabled', []));
    for (const manifest of this.registry) {
      const f = this.features.get(manifest.id);
      if (!f || f.status === 'active' || f.status === 'not-for-platform') continue;
      if (manifest.id !== id && (f.status !== 'skipped' || off.has(manifest.id))) continue; // only what was waiting
      const missing = (manifest.requires || []).find((r) => this.features.get(r)?.status !== 'active');
      if (missing) {
        if (manifest.id === id) { const dep = this.features.get(missing); f.reason = `Needs ${dep?.manifest.name || missing}, which is ${STATUS_WORDS[dep?.status] || 'not running'}`; }
        continue;
      }
      if (await this.run(f, this.modules.get(manifest.id))) { started.push(manifest.id); this.emit('app:started', manifest.id); }
    }
    this.changedFeatures();
    return started;
  }

  setOff(id, off) {
    const area = this.storage.area('folio');
    const all = new Set(area.get('disabled', []));
    if (off) all.add(id); else all.delete(id);
    area.set('disabled', [...all]);
  }

  changedFeatures() {
    document.documentElement.dataset.folioActive = [...this.features.values()].filter((f) => f.status === 'active').map((f) => f.manifest.id).join(',');
    this.emit('app:features');
  }

  fail(record, err, where) {
    const id = record.manifest.id;
    for (const fn of (record.instance?.folioStops || []).splice(0)) { try { fn(); } catch { /* it failed already */ } }
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
