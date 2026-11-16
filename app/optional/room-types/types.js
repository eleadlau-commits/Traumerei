// Room types: the types made here, kept in t.store under 'types' ({ id: markdown }) and each
// registered as a rule (t.slots.rules.add). No screen: the page (RoomTypes.js) and the tests use it.
import { read } from './file.js';
import { ruleOf } from './rule.js';

// An empty room, to try a type's code once before it is saved.
const NONE = Object.freeze({ marks: { in: () => [], get: () => null, text: () => '', ofKind: () => [], search: () => [] }, places: { of: () => [], home: () => null, in: () => [], loose: () => [], position: () => null },
  links: { from: () => [], to: () => [], get: () => null, members: () => [], holders: () => [], standsFor: () => [], kinds: () => [], named: () => null, count: () => 0 },
  distance: { of: () => null, declared: () => null, all: () => [], shut: () => false, readers: () => [] }, gaps: { of: () => null, opened: () => [], oldest: () => null, progress: () => ({ open: 0, resolved: 0, of: 0 }) },
  moments: { of: () => [], changed: () => null, ahead: () => [], returns: () => [], next: () => null } });

export function makeTypes(t) {
  const kept = () => (t.store ? t.store.get('types', {}) : {}) || {};
  const live = new Map(); // id → { file, off, errors: [] }
  const add = (file) => {
    const errors = [];
    const off = t.slots.rules.add(ruleOf(file, (hook, err) => { errors.unshift(`${hook}: ${err.message}`); errors.length = Math.min(errors.length, 5); }));
    live.set(file.id, { file, off, errors });
  };
  const take = (id) => { live.get(id)?.off?.(); live.delete(id); };

  // The problem with a file as a type, in words, or ''. was: the id it had before an edit.
  function check(file, was = null) {
    if (file.errors.length) return file.errors[0];
    const other = (t.slots.rules.all || []).find((r) => r.id === file.id);
    if (other && !live.has(file.id)) return `A room type called ${other.name} is already here; give this one another name`;
    if (live.has(file.id) && file.id !== was) return `${file.name} is already made here; edit that one`;
    try {
      const r = ruleOf(file, (hook, err) => { throw err; });
      const out = r.arrange(NONE, 'none');
      if (!Array.isArray(out)) return 'arrange must return a list of { mark, x, y }';
      if (r.draw) { const d = r.draw(NONE, 'none'); if (d != null && !Array.isArray(d)) return 'draw must return a list of { x, y, w, h, label? }'; }
    } catch (err) { return `On an empty room the code fails: ${err.message}`; }
    return '';
  }

  return {
    // Registers every kept type (a broken one is left out and listed by problems()).
    start() { for (const [id, md] of Object.entries(kept())) { const f = read(md); if (!f.errors.length && f.id === id) add(f); } },
    stop() { for (const id of [...live.keys()]) take(id); },
    // [{ id, name, md, errors }] made here, in name order.
    made: () => Object.entries(kept()).map(([id, md]) => ({ id, md, name: read(md).name || id, errors: live.get(id)?.errors || [], on: live.has(id) })).sort((a, b) => a.name.localeCompare(b.name)),
    has: (id) => live.has(id),
    md: (id) => kept()[id] ?? null,
    check: (md, was = null) => check(read(md), was),
    // Saves a type from its Markdown: refused with a reason, or { ok, id }; an edit (was) is taken
    // away and added anew, so a room in it lays out by the new code.
    save(md, was = null) {
      const file = read(md);
      const why = check(file, was);
      if (why) return { ok: false, reason: why };
      if (!t.store) return { ok: false, reason: 'Nothing can be kept on this computer here' };
      const all = { ...kept() };
      if (was && was !== file.id) { delete all[was]; take(was); }
      all[file.id] = String(md);
      t.store.set('types', all);
      take(file.id);
      add(file);
      return { ok: true, id: file.id };
    },
    remove(id) { const all = { ...kept() }; delete all[id]; t.store?.set('types', all); take(id); return { ok: true }; },
    file: (id) => (kept()[id] != null ? read(kept()[id]) : null),
  };
}
