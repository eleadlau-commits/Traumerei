// A slot is a named place where features add things: buttons in the top bar, views, sections
// in Settings, or rules that other features apply (such as "how to name a session").
//
// The feature that defines a slot decides what its items look like. The slot keeps the items
// in order and contains their mistakes: if one item throws, it is reported against the
// feature that added it and skipped, and every other item still works.

export class Slot {
  constructor(app, name) {
    this.app = app;
    this.name = name;
    this.owner = null; // the feature that defined this slot, or 'folio' for the framework's own
    this.description = '';
    this.entries = []; // [{ item, owner }]
  }

  // Adds an item. Items are kept in ascending `order` (default 50), then in the order added.
  // Returns a function that removes the item again.
  add(item, owner = null) {
    this.entries.push({ item, owner });
    this.entries.sort((a, b) => (a.item.order ?? 50) - (b.item.order ?? 50));
    return () => this.remove(item);
  }

  remove(item) {
    this.entries = this.entries.filter((e) => e.item !== item);
  }

  removeOwner(owner) {
    this.entries = this.entries.filter((e) => e.owner !== owner);
  }

  get items() {
    return this.entries.map((e) => e.item);
  }

  get size() {
    return this.entries.length;
  }

  ownerOf(item) {
    return this.entries.find((e) => e.item === item)?.owner ?? null;
  }

  // Runs fn(item) for one item, reporting a failure against the feature that added it.
  // Returns fn's result, or `fallback` if it threw.
  run(item, fn, fallback = undefined) {
    try {
      return fn(item);
    } catch (err) {
      this.app.report(this.ownerOf(item), err, `in "${this.name}"`);
      return fallback;
    }
  }

  // Runs fn(item) for every item.
  each(fn) {
    for (const { item } of [...this.entries]) this.run(item, fn);
  }

  // fn(item) for every item, keeping results that aren't null, undefined or false.
  map(fn) {
    const out = [];
    this.each((item) => {
      const result = fn(item);
      if (result != null && result !== false) out.push(result);
    });
    return out;
  }

  // The first result of fn(item) that isn't null, undefined or an empty string.
  first(fn) {
    for (const { item } of [...this.entries]) {
      const result = this.run(item, fn);
      if (result != null && result !== '') return result;
    }
    return undefined;
  }

  // True if fn(item) is true for any item. An item that throws counts as false.
  some(fn) {
    return this.entries.some(({ item }) => this.run(item, fn, false) === true);
  }
}
