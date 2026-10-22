// Named events that features send to each other, e.g. "timetable:changed".
// A listener that throws is reported against its feature; the other listeners still run.

export class Events {
  constructor(app) {
    this.app = app;
    this.listeners = new Map(); // name → [{ fn, owner }]
  }

  on(name, fn, owner = null) {
    const list = this.listeners.get(name) || [];
    const entry = { fn, owner };
    list.push(entry);
    this.listeners.set(name, list);
    return () => {
      const current = this.listeners.get(name) || [];
      this.listeners.set(name, current.filter((e) => e !== entry));
    };
  }

  emit(name, data) {
    for (const { fn, owner } of [...(this.listeners.get(name) || [])]) {
      try {
        const result = fn(data);
        if (result?.catch) result.catch((err) => this.app.report(owner, err, `handling "${name}"`));
      } catch (err) {
        this.app.report(owner, err, `handling "${name}"`);
      }
    }
  }

  removeOwner(owner) {
    for (const [name, list] of this.listeners) {
      this.listeners.set(name, list.filter((e) => e.owner !== owner));
    }
  }
}
