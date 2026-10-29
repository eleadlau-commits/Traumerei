// Saved data, kept on the device in localStorage.
//
// Every feature gets its own area (`this.storage`), named after its folder. Keys in one area
// can't clash with another's, so features can't overwrite each other's data, and deleting a
// feature folder leaves everyone else's data untouched.
//
// Values are stored as JSON, so objects, arrays, numbers and strings all round-trip.
//
// For copying saved data somewhere else (such as an account), the whole app's data can be read
// with snapshot(), written back with restore(), and watched for changes with watch(fn).

export class Area {
  constructor(prefix, onFail = () => {}, onChange = () => {}) {
    this.prefix = prefix;
    this.onFail = onFail;
    this.onChange = onChange;
  }

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // Saves a value (null or undefined removes it). Returns false if the device refused,
  // for example because storage is full or blocked.
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(this.prefix + key);
      else localStorage.setItem(this.prefix + key, JSON.stringify(value));
      this.onChange(this.prefix + key);
      return true;
    } catch {
      this.onFail(key);
      return false;
    }
  }

  remove(key) {
    return this.set(key, null);
  }

  has(key) {
    try {
      return localStorage.getItem(this.prefix + key) != null;
    } catch {
      return false;
    }
  }

  keys() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
      }
    } catch { /* storage blocked: nothing to list */ }
    return out;
  }

  // Removes everything in this area, except the record of which `once` steps have run.
  clear() {
    for (const k of this.keys()) if (!k.startsWith('__once.')) this.remove(k);
  }

  // Runs fn the first time only (per device), e.g. to bring over data saved by an older
  // version of the app. Returns true if it ran now.
  once(name, fn) {
    const flag = `__once.${name}`;
    if (this.has(flag)) return false;
    fn();
    this.set(flag, Date.now());
    return true;
  }
}

export class Storage extends Area {
  constructor(appId, onFail) {
    const watchers = new Set();
    super(`${appId}.`, onFail, (key) => {
      if (!this.quiet) for (const fn of watchers) try { fn(key); } catch (e) { console.error(e); }
    });
    this.appId = appId;
    this.watchers = watchers;
    this.quiet = false; // true while restore() writes, so watchers don't hear their own data
  }

  // The private area for one feature (or for the framework itself, 'folio').
  area(name) {
    return new Area(`${this.appId}.${name}.`, this.onFail, this.onChange);
  }

  // Calls fn(fullKey) whenever any area saves or removes a key. Returns a function that stops it.
  watch(fn) {
    this.watchers.add(fn);
    return () => this.watchers.delete(fn);
  }

  // Everything the app has saved, as { 'area.key': raw JSON text }, leaving out the areas named
  // in `skip` and every `once` record (those belong to the device).
  snapshot(skip = []) {
    const out = {};
    const skipped = skip.map((name) => `${name}.`);
    for (const k of this.keys()) {
      if (skipped.some((s) => k.startsWith(s)) || /(^|\.)__once\./.test(k)) continue;
      const raw = this.raw(this.prefix + k);
      if (raw != null) out[k] = raw;
    }
    return out;
  }

  // Replaces what snapshot(skip) would return with `data`: keys missing from it are removed.
  // Watchers aren't told. Returns false if the device refused.
  restore(data, skip = []) {
    this.quiet = true;
    try {
      for (const k of Object.keys(this.snapshot(skip))) if (!(k in data)) localStorage.removeItem(this.prefix + k);
      for (const [k, raw] of Object.entries(data)) localStorage.setItem(this.prefix + k, raw);
      return true;
    } catch {
      this.onFail('restore');
      return false;
    } finally {
      this.quiet = false;
    }
  }

  // Reads a key exactly as stored, outside any area. Only for importing data saved before
  // the app used Folio.
  raw(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  rawJSON(key, fallback = null) {
    try {
      const raw = this.raw(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  removeRaw(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* nothing to do */ }
  }
}
