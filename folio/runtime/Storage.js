// Saved data, kept on the device in localStorage.
//
// Every feature gets its own area (`this.storage`), named after its folder. Keys in one area
// can't clash with another's, so features can't overwrite each other's data, and deleting a
// feature folder leaves everyone else's data untouched.
//
// Values are stored as JSON, so objects, arrays, numbers and strings all round-trip.

export class Area {
  constructor(prefix, onFail = () => {}) {
    this.prefix = prefix;
    this.onFail = onFail;
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
    super(`${appId}.`, onFail);
    this.appId = appId;
  }

  // The private area for one feature (or for the framework itself, 'folio').
  area(name) {
    return new Area(`${this.appId}.${name}.`, this.onFail);
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
