// A whole host for plugins, with no screen: a world with its moments log, the slots, the
// carriers and the API's connect(), as the app wires them (world/World.js, api/Api.js), so a
// plugin's install(t) can be run, driven, switched off and on again in a test. The conformance
// suite (corpus.test.js) runs every plugin through it. Not shipped (tests/).

import * as lib from '../../world/lib.js';
import * as M from '../../world/moments.js';
import { surface, connect } from '../v2.js';
import { serve, memoryChoices } from '../../ai/Ai.js';

const CORE_RULES = () => [lib.joyce.default, lib.pessoa.default];

export function makeHost({ thoughts = 12, now = 1_700_000_000_000 } = {}) {
  let clock = now;
  const tick = () => (clock += 1000);
  const w = lib.model.emptyWorld(tick());
  const room = lib.model.addRoom(w, 'Study', tick());
  const other = lib.model.addRoom(w, 'Elsewhere', tick());
  const ids = [];
  const train = lib.model.create(w, room.id, { kind: 'group', of: 'joyce', x: 0, y: 0 }, tick());
  for (let i = 0; i < thoughts; i++) {
    const th = lib.model.create(w, i < 3 ? train.id : room.id, { kind: 'line', text: `thought ${i} ${i % 2 ? 'river stone' : 'river light'}` }, tick());
    ids.push(th.id);
  }
  lib.model.create(w, other.id, { kind: 'line', text: 'far river' }, tick());

  // Slots that keep who added what, as Folio's do.
  const slots = new Map();
  const app = {
    config: { name: 'Träumerei', version: '1.0.0' },
    slot(name) {
      if (!slots.has(name)) {
        const entries = [];
        slots.set(name, { entries, get items() { return entries.map((e) => e.item); }, add(item, owner) { const e = { item, owner }; entries.push(e); return () => { const i = entries.indexOf(e); if (i >= 0) entries.splice(i, 1); }; } });
      }
      return slots.get(name);
    },
  };
  const listeners = new Map();
  const events = { on: (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]); return () => listeners.set(name, (listeners.get(name) || []).filter((f) => f !== fn)); } };
  const emit = (name, o) => { for (const fn of listeners.get(name) || []) fn(o); };

  // The state last written down is a copy, as World.js keeps it (the tables are changed in place:
  // holding them would diff nothing, and the log would hear no moment).
  const snap = () => JSON.parse(JSON.stringify(M.stateOf(w)));
  const log = M.emptyLog(clock, M.stateOf(w));
  let last = snap();
  const ontologies = () => [...CORE_RULES(), ...app.slot('world.ontologies').items];
  const world = {
    get world() { return w; },
    lib,
    saved: 0,
    save() {
      const next = snap();
      const rows = M.record(log, last, next, tick());
      last = next;
      this.saved++;
      if (rows?.length) emit('world:moments', { rows, undone: false });
      return true;
    },
    get ontologies() { return ontologies(); },
    ontology: (id) => ontologies().find((o) => o.id === id) || lib.pessoa.default,
    globals: {},
    moments: { get log() { return log; }, of: (id) => M.of(log, id), since: (t) => M.since(log, t), changed: (id) => M.changed(log, id), at: (t) => M.stateAt(log, t), first: () => M.first(log), get keep() { return log.keep; }, setKeep: (d) => { log.keep = d; },
      outbox: (seq) => (seq == null ? M.whole(M.stateOf(w), 1) : M.outbox(log, seq)), absorb: (list) => M.absorb(log, M.stateOf(w), list) },
    carriers: Object.freeze({
      list: () => [{ id: 'traum', name: '.traum file', moves: 'text' }, ...app.slot('world.carriers').items],
      tables: (root = null) => lib.model.tablesOf(w, root, { log }),
      write: (root = null, { ids = 'short' } = {}) => lib.traum.write(lib.model.tablesOf(w, root, { log }), { root, ids }),
      read: (text) => lib.traum.read(text),
      land: (got, o = {}) => { const out = lib.model.landTables(w, got.tables, got.root, o); if (out.told?.length) M.tell(log, out.told); return out; },
      replace: (root, got) => lib.model.replaceTables(w, root, got.tables, got.root),
    }),
  };
  const parts = surface(lib);
  // The AI framework, over the same slots, with the person's choices kept in memory.
  const choices = memoryChoices();
  const ai = serve({ slot: (name) => app.slot(name), choices });
  const toasts = [];
  let chosen = null;
  const leaving = new Map();
  const roomNow = () => (chosen ? { id: () => chosen.context, chosen: () => chosen.mark } : null);

  // Connects a plugin (by id) and runs its install(t); returns { t, off } where off() takes away
  // everything it added, as switching it off in Settings does.
  function plug(id, install) {
    const plugin = { id, manifest: { name: id, plugin: { api: 2, minApp: '1.0.0' } } };
    const gone = (fn) => { if (!leaving.has(id)) leaving.set(id, []); leaving.get(id).push(fn); };
    const t = connect({ app, world, plugin, parts, lib, events, toast: (s) => toasts.push(s), room: roomNow, gone, ai });
    install(t, { attach() {}, whenStopped: (fn) => gone(fn), listenTo() {} });
    const off = () => {
      for (const s of slots.values()) for (let i = s.entries.length - 1; i >= 0; i--) if (s.entries[i].owner === id) s.entries.splice(i, 1);
      for (const fn of leaving.get(id) || []) fn();
      leaving.delete(id);
    };
    return { t, off };
  }
  const added = (id) => [...slots.entries()].flatMap(([slot, s]) => s.entries.filter((e) => e.owner === id).map((e) => ({ slot, item: e.item })));
  return { ai, choices, w, room: room.id, other: other.id, train: train.id, ids, app, world, log, plug, added, toasts, choose: (context, mark = null) => { chosen = context ? { context, mark } : null; }, lib, tick };
}

// The eight laws, as checks over the world's tables (KERNEL.md). Returns the broken ones in words.
export function brokenLaws(w) {
  const out = [];
  const things = w.things || {};
  const has = (id) => !!things[id];
  for (const [id, r] of Object.entries(w.links || {})) {
    if (!has(r.from) || !has(r.to)) out.push(`Law 1: link ${id} joins a mark there is not`);
    if (!lib.links.isKind(r.kind)) out.push(`Law 4: link ${id} has no kind`);
  }
  for (const [id, r] of Object.entries(w.places || {})) if (!has(r.mark) || !has(r.context)) out.push(`Law 1: place ${id} names a mark there is not`);
  for (const [id, th] of Object.entries(things)) {
    if (Array.isArray(th.members)) out.push(`Law 4: ${id} keeps a members list (structure is links)`);
    const k = lib.model.kindOf(th);
    if (k !== 'room' && k !== 'context' && !lib.model.parentOf(w, id)) out.push(`Law 2: ${id} is in no context`);
  }
  for (const [mark, g] of Object.entries(w.gaps || {})) if (!has(g.mark || mark)) out.push(`Law 5: a gap on ${mark}, which is not a mark`);
  return out;
}

// Every value in an object frozen, deeply (a rule's reads must not write: Law 3).
export function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deepFreeze(v); }
  return o;
}

// A room of n thoughts, for the speed budgets.
export function bigRoom(host, n = 1500) {
  const { w, lib: L } = host;
  const r = L.model.addRoom(w, 'Big', host.tick());
  for (let i = 0; i < n; i++) L.model.create(w, r.id, { kind: 'line', text: `big ${i}` }, host.tick());
  host.world.save();
  return r.id;
}
