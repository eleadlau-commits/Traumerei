// The traumerei plugin API, version 2: the app named after the kernel's six primitives.
// app/core/KERNEL.md says what the six tables and eight laws are; app/core/API.md says this API
// in words; tests/api.test.js holds the list, so a change here is always deliberate (change
// API.md and the test with it).
//
// Phases 0 and 1 of the kernel plan: five namespaces are a thin layer over the world as it is
// today (v1.js, world/model.js), and moments reads the world's log (world/moments.js). Each read
// gives frozen rows; each propose goes through the world's own checks and lands as one step in
// the log (its rows are the moments), or returns a refusal with its reason in words. Where a table does not exist yet (gaps, forward
// moments) the read is empty and the propose refuses, naming the phase that brings it. Nothing
// here touches the screen.

import { connect as connectV1, surface, PLACES, API_VERSION as V1 } from './v1.js';

export const API_VERSION = 2;
export const TABLES = Object.freeze(['marks', 'places', 'links', 'distance', 'gaps', 'moments']);

// The readers a context can be declared for (KERNEL.md: distance).
export const READERS = Object.freeze(['me now', 'me later', 'others', 'machine']);
// The directions a gap can have (KERNEL.md: gaps).
export const DIRECTIONS = Object.freeze(['to world', 'from world', 'to maker']);
// The kinds of link there are now; more kinds are a slot in phase 2.
export const LINK_KINDS = Object.freeze(['part of', 'relation']);

const row = (o) => Object.freeze(o);
const rows = (list) => Object.freeze(list.map(row));
const landed = (id) => row({ ok: true, id });
const refuse = (reason) => row({ ok: false, reason });
const later = (what, phase) => refuse(`${what} arrives in kernel phase ${phase}; until then this is a name, not a table`);
const FLOOR = (n) => `floor:${n || 0}`;
export const ARCHIVE = 'archive';

// ---- Six tables over the world as it is ----
// lib: the world's rules (world.lib); world: the world service (its .world is w). Pure of the
// screen; the tests call it with the same modules.
export function kernel({ lib, world, events = null, gone = () => {} }) {
  const { model, groups } = lib;
  const w = () => world.world;
  const rules = () => (world.ontologies?.length ? world.ontologies.map((o) => o.id) : ['joyce', 'pessoa']);
  const lays = (rule) => !!world.ontologies?.find((o) => o.id === rule)?.lays;
  const thing = (id) => w().things[id] || null;
  const kindOf = (th) => model.kindOf(th);
  const save = () => { world.save?.(); };

  // A propose lands as one saved step and says so, or says why not.
  const land = (ok, id, why) => { if (!ok) return refuse(why); save(); return landed(id); };

  // Changes to a table are heard from the moments log ('world:moments': the rows that landed):
  // a listener is told once per landing with the rows of its table, and whether it was an undo.
  // Without a log (an older world service) every save and undo is heard instead.
  const on = (table) => (fn) => {
    if (!events) return () => {};
    const tell = (data) => {
      if (!data?.rows) { fn(row({ table, rows: rows([]), undone: !!data?.undone })); return; }
      const mine = data.rows.filter((r) => r.table === table || (table === 'moments' && r.kind !== undefined));
      if (mine.length) fn(row({ table, rows: rows(mine.map((r) => ({ ...r }))), undone: !!data.undone }));
    };
    const offs = world.moments ? [events.on('world:moments', tell)] : [events.on('world:saved', tell), events.on('world:changed', tell)];
    const off = () => { for (const o of offs) o(); };
    gone(off);
    return off;
  };

  // -- marks: today, a mark row is a thought object, frozen (its shape: world/model.js). --
  const marks = Object.freeze({
    get: (id) => (thing(id) ? row({ ...thing(id) }) : null),
    in: (context) => rows(model.children(w(), context ?? null).map((th) => ({ ...th }))),
    ofKind: (kind) => rows(Object.values(w().things).filter((th) => kindOf(th) === kind).map((th) => ({ ...th }))),
    text: (id) => (thing(id) ? model.thoughtText(w(), thing(id)) : ''),
    search: (words, most) => rows(model.search(w(), words, most).map((th) => ({ ...th }))),
    make: ({ kind = 'line', content = '', in: context = null, at = {} } = {}) => {
      if (context == null && kind !== 'room') return refuse('A mark needs a context to be made in');
      const made = kind === 'room'
        ? model.addRoom(w(), content, undefined, at)
        : model.create(w(), context, { kind, text: content, title: at.title, x: at.x, y: at.y });
      return land(!!made, made?.id, 'The context is locked, cannot hold this kind, or the mark would be empty');
    },
    edit: (id, fields = {}) => {
      if (!thing(id)) return refuse('No such mark');
      if (['kind', 'parent', 'members', 'id'].some((k) => k in fields)) return refuse('A mark\'s kind, context, members and id change only through places and links');
      if (model.update(w(), id, fields)) return land(true, id);
      if (!thing(id)) { save(); return row({ ok: true, id, removed: true }); } // left empty, so it went (Law 2: by the maker's hand)
      return refuse('The mark is locked');
    },
    delete: (id) => {
      if (!thing(id)) return refuse('No such mark');
      if (id === model.MESSY) return refuse('Messy thoughts stays');
      model.remove(w(), id);
      return land(!thing(id), id, 'The mark is locked');
    },
    on: on('marks'),
  });

  // -- places: where a mark sits in a context, under a rule. No row in a context: loose there. --
  function placesOf(id) {
    const th = thing(id);
    if (!th) return [];
    const out = [];
    if (kindOf(th) === 'room') {
      if (th.parent != null) out.push({ mark: id, context: th.parent, rule: 'twin', position: { side: th.side ?? 0 } });
      else if (th.archived) out.push({ mark: id, context: ARCHIVE, rule: null, position: null });
      else out.push({ mark: id, context: FLOOR(th.page), rule: 'borges', position: th.col == null ? null : { col: th.col, row: th.row } });
      return out;
    }
    const context = th.parent;
    for (const rule of rules()) {
      if (model.isGroup(th) && th.of === rule) { // its own rule's group: where it was put, unless loose
        if (!th.loose) out.push({ mark: id, context, rule, position: Number.isFinite(th.x) ? { x: th.x, y: th.y } : null });
        continue;
      }
      const g = model.groupOf(w(), id, rule); // held by one of the rule's groups: a train, a chapter
      if (g) { out.push({ mark: id, context, rule, position: { group: g.id, index: model.members(w(), g.id).findIndex((m) => m.id === id) } }); continue; }
      const spot = groups.spot(w(), context, rule, id); // laid by the rule itself
      if (spot) out.push({ mark: id, context, rule, position: { x: spot.x, y: spot.y } });
    }
    return out;
  }
  const places = Object.freeze({
    of: (mark) => rows(placesOf(mark)),
    in: (context, rule = null) => rows(model.children(w(), context).flatMap((th) => placesOf(th.id).filter((p) => p.context === context && (rule == null || p.rule === rule)))),
    loose: (context) => rows(model.children(w(), context).filter((th) => !placesOf(th.id).some((p) => p.context === context)).map((th) => ({ ...th }))),
    position: (mark, context, rule) => placesOf(mark).find((p) => p.context === context && p.rule === rule)?.position ?? null,
    put: (mark, context, rule = null, position = null) => {
      const th = thing(mark);
      if (!th || !thing(context)) return refuse('No such mark or context');
      if (kindOf(th) === 'room') return refuse('Rooms are placed on floors by the rooms page until phase 3');
      if (th.parent !== context && !model.move(w(), mark, context, position?.x ?? 0, position?.y ?? 0, { loose: rule == null })) return refuse('The mark cannot go into that context: one of them is locked, or it would go inside itself');
      if (rule && position && Number.isFinite(position.x)) {
        if (!groups.putAt(w(), context, rule, mark, position.x, position.y)) return refuse('The context is locked');
      }
      return land(true, mark);
    },
    move: (mark, from, to) => {
      const th = thing(mark);
      if (!th || th.parent !== from) return refuse('The mark is not in that context');
      return land(groups.moveLoose(w(), mark, to), mark, 'The mark cannot go to that context: it is locked, missing, or a Twin itself');
    },
    unplace: (mark, context) => {
      const th = thing(mark);
      if (!th || th.parent !== context) return refuse('The mark is not in that context');
      let any = false;
      for (const rule of rules()) any = groups.unplace(w(), context, rule, mark, { lays: lays(rule) }) || any;
      return land(any || groups.wait(w(), context, mark), mark, 'The context is locked');
    },
    on: on('places'),
  });

  // -- links: part of (a member to its group, with order) and relation (an arrow, with its name). --
  function linkRows(roomId) {
    const out = [];
    for (const g of model.groupsIn(w(), roomId)) {
      // order: as the group reads (a train by time; a rule that keeps its order, as given)
      model.members(w(), g.id).forEach((m, i) => out.push({ id: `part:${g.id}:${m.id}`, from: m.id, to: g.id, kind: 'part of', order: i }));
    }
    for (const [store, data] of Object.entries(w().own[roomId] || {})) {
      for (const [child, arrows] of Object.entries(data || {})) {
        if (!Array.isArray(arrows?.parents)) continue;
        for (const parent of arrows.parents) {
          out.push({ id: `rel:${store}:${child}:${parent}`, from: child, to: parent, kind: 'relation', label: arrows.rel?.[parent] || '', note: arrows.labels?.[parent] || '', rule: store });
        }
      }
    }
    return out;
  }
  const roomOf = (id) => { const th = thing(id); return th && kindOf(th) !== 'room' ? th.parent : null; };
  const pick = (mark, kind, side) => { const r = roomOf(mark); return r == null ? [] : linkRows(r).filter((l) => l[side] === mark && (kind == null || l.kind === kind)); };
  const links = Object.freeze({
    from: (mark, kind = null) => rows(pick(mark, kind, 'from')),
    to: (mark, kind = null) => rows(pick(mark, kind, 'to')),
    members: (group) => Object.freeze(model.members(w(), group).map((th) => th.id)),
    holders: (mark) => Object.freeze(model.groupsOf(w(), mark).map((g) => g.id)),
    kinds: () => LINK_KINDS,
    link: (from, to, kind, label = '') => {
      if (kind === 'part of') {
        if (!model.isGroup(thing(to))) return refuse('Only a group can hold a part');
        return land(model.join(w(), to, from), `part:${to}:${from}`, 'The part cannot join: it is in another context, locked, or would hold its own group');
      }
      if (kind === 'relation') return later('Drawing a relation through the API', 2);
      return refuse(`No such kind of link: ${kind}`);
    },
    unlink: (id) => {
      const [kind, ...parts] = String(id).split(':');
      if (kind === 'part') {
        const [group, member] = parts;
        if (!model.isGroup(thing(group))) return refuse('No such group');
        return land(model.leave(w(), group, member), id, 'Not a part of that group');
      }
      if (kind === 'rel') return later('Removing a relation through the API', 2);
      return refuse('No such link');
    },
    order: (group, ids) => land(model.setOrder(w(), group, ids), group, 'Not a group, or not its parts'),
    on: on('links'),
  });

  // -- distance: a context's reader. Lock is the only way yet: locked is others, else me now. --
  const distance = Object.freeze({
    of: (context) => { const r = model.room(w(), context); return r ? (r.locked ? 'others' : 'me now') : null; },
    declare: (context, reader) => {
      if (!READERS.includes(reader)) return refuse(`A reader is one of ${READERS.join(', ')}`);
      if (!model.room(w(), context)) return refuse('Only a room can be declared for a reader until phase 6');
      if (reader === 'me later' || reader === 'machine') return later(`Declaring a room for ${reader}`, 6);
      return land(model.lock(w(), context, reader === 'others'), context, 'No such room');
    },
    on: on('distance'),
  });

  // -- gaps: nothing is open yet. --
  const gaps = Object.freeze({
    of: () => null,
    opened: () => rows([]),
    oldest: () => null,
    progress: () => row({ open: 0, resolved: 0, of: 0 }),
    open: (mark, direction) => (DIRECTIONS.includes(direction) ? later('Opening a gap', 5) : refuse(`A direction is one of ${DIRECTIONS.join(', ')}`)),
    resolve: () => later('Resolving a gap', 5),
    reopen: () => later('Reopening a gap', 5),
    on: on('gaps'),
  });

  // -- moments: the log (world/moments.js), read by mark, from a time, by day. A mark the log does
  // not know of (older than the history kept) still has its made and edited times. --
  const log = () => world.moments;
  const momentRow = (r) => ({ time: r.time, kind: r.kind, ...(r.mark != null ? { mark: r.mark } : { context: r.context }), ...(r.step != null ? { step: r.step } : {}) });
  function fallback(th) {
    const out = [{ time: th.at, kind: 'made', mark: th.id }];
    if (th.edited) out.push({ time: th.edited, kind: 'edited', mark: th.id });
    if (!log() && kindOf(th) === 'room') for (const t of world.attention?.[th.id] || []) out.push({ time: t, kind: 'visited', context: th.id });
    return out;
  }
  const byTime = (a, b) => a.time - b.time || (a.seq || 0) - (b.seq || 0);
  function momentsOf(id) {
    const th = thing(id);
    const known = log() ? log().of(id).map(momentRow) : [];
    if (!th) return known;
    return known.some((m) => m.kind === 'made') ? known : [...fallback(th).filter((m) => !known.length || m.kind === 'made'), ...known];
  }
  const all = () => (log() ? log().since(0).map(momentRow) : Object.values(w().things).flatMap(fallback)).sort(byTime);
  const moments = Object.freeze({
    of: (mark) => rows(momentsOf(mark).sort(byTime)),
    since: (time) => rows(all().filter((m) => m.time >= +time)),
    day: (date) => {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = start.getTime() + 24 * 3600e3;
      return rows(all().filter((m) => m.time >= start.getTime() && m.time < end));
    },
    ahead: () => rows([]),
    due: () => later('A due moment', 7),
    revisit: () => later('A return', 7),
    note: () => later('A note on a mark', 7),
    on: on('moments'),
  });

  return Object.freeze({ marks, places, links, distance, gaps, moments });
}

// The API one plugin gets: v1's names (the compatibility surface) and v2's six tables beside
// them. Same arguments as v1's connect, plus lib (world.lib) and events ({ on }, or null).
export function connect(o) {
  const base = connectV1({ ...o, offers: API_VERSION });
  const tables = kernel({ lib: o.lib || o.world.lib, world: o.world, events: o.events || null, gone: o.gone });
  return Object.freeze({
    ...base,
    // (a spread reads a getter once: the world is read afresh each time, as v1 does, since it is
    // replaced when it is read back from storage, and a plugin writing to an old one loses it)
    get world() { return base.world; },
    ...tables,
    // The places to plug in, named for what they are to the kernel: rules (modes), kinds (items).
    slots: Object.freeze({ rules: base.modes, kinds: base.items, commands: base.commands, more: base.more, editor: base.editor, formats: base.formats }),
    ui: Object.freeze({ toast: base.toast }),
  });
}

export { surface, PLACES, V1 };
