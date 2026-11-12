// World: the saved world of rooms and thoughts, and everything that is true of it without a
// screen. It owns the world itself (saved as 'world3'), saving and undo, the ontologies (and the
// slot 'world.ontologies' for more), the rooms' look (Settings → Rooms' values, saved as 'look'),
// the global ontology settings ('ontologies'), the app's palette and the moments log
// ('moments': every change and every visit, moments.js; undo and the attention log are reads of
// it). Other features reach all of it only through the `world` service below, whose list is the
// whole of what it offers (README.md says the same in words).

import { whenMathsLoads } from './maths.js';
import { Feature } from 'folio';
import * as lib from './lib.js';
import * as traum from './traum.js';
import { loadWorld } from './model.js';
import { gather, forRooms, forPage, FALLBACK } from './ontologies/index.js';
import { setKinds } from './items/index.js';
import { formatsOf } from './formats.js';
import * as M from './moments.js';
import { lookPrefs, savedLook, LOOK, PALETTE } from './look.js';

const KEY = 'world3';  // where the world is saved (model.js)
const LOG = 'moments'; // where the moments log is saved (moments.js)
const DAY = 864e5;

export default class World extends Feature {
  start() {
    for (const old of ['world', 'attention']) if (this.storage.has(old)) this.storage.set(old, null); // older shapes: not kept
    this.world = loadWorld(this.storage.get(KEY));
    this.log = M.loadLog(this.storage.get(LOG));
    this.begin();
    if (M.compact(this.log, Date.now())) this.storage.set(LOG, this.log);
    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), for the palette, or null
    this.prefs = lookPrefs(this.storage.get('look'));
    // The global ontology settings ({ [ontology]: { key: value } }): what a new room starts with.
    this.globals = this.storage.get('ontologies') || {};
    // The app's colours (Renderer, Settings → Colour), and any change to them.
    this.palette = this.backdrop?.palette?.() || PALETTE;
    document.addEventListener('palette', (e) => { this.palette = e.detail; this.emit('world:palette', this.palette); });
    // A mode a plugin adds or takes away (switched on or off): 'world:modes' says so; a room seen
    // through a mode that is off is seen through the fallback until it is on again.
    this.defineSlot('world.ontologies', 'A way of seeing a room\'s thoughts: { id, name, note, groups, units, point, drop, … } (see world/ontologies/index.js).')
      .watch(() => this.emit('world:modes'));
    // More kinds of item, from plugins: ITEMS follows the slot, and 'world:kinds' says it changed
    // (a thought of a kind switched off shows as a stand-in and is kept as it is).
    const kinds = this.defineSlot('world.items', 'A kind of item: { kind, name, tidy(fields, h), text(th), node(th, el) } (see world/items/index.js).');
    kinds.watch((slot) => {
      setKinds(slot.items, (k, why) => console.warn(`World: the item kind "${k?.kind}" was skipped: ${why}`));
      this.emit('world:kinds');
    });
    // File formats, from plugins (Room files' .traum): one thing to ask (formats.js).
    const formats = formatsOf(this.defineSlot('world.formats', 'A file format: { id, name, accepts(file), importRoom?(o), importInto?(roomId, o), exportRoom?(id), canEdit?(), editRoom?(roomId, o), editGroup?(roomId, groupId, o), cancel?() } (see world/formats.js).'));

    // Carriers: what moves the six tables somewhere else and back (Law 8). The .traum file is the
    // world's own; a plugin adds one here (the account's sync) to be listed with it.
    const carriers = this.defineSlot('world.carriers', 'A carrier of the six tables: { id, name, moves: "text" | "moments" } (see world/README.md).');
    const TRAUM = Object.freeze({ id: 'traum', name: '.traum file', moves: 'text' });

    // KaTeX loads the first time some words hold mathematics (maths.js): then rooms draw again.
    whenMathsLoads(() => this.emit('world:maths'));
    const w = this;
    this.provide('world', {
      lib,                                          // the rules, by module (lib.js)
      formats,                                      // the file formats plugins add (formats.js)
      get world() { return w.world; },              // the world itself (model.js)
      // (A change not yet written down is written first, so reading afresh never loses it.)
      load: () => { w.flush(); w.world = loadWorld(w.storage.get(KEY)); w.log = M.loadLog(w.storage.get(LOG)); return w.world; },
      begin: () => w.begin(),
      save: () => w.save(),
      settled: () => w.snap() === w.lastSnap,
      fold: () => w.fold(),
      writeSoon: (say = true) => w.writeSoon(say),
      write: () => w.write(),
      undo: (back = true) => w.undo(back),
      get ontologies() { return w.ontologies; },
      ontology: (id) => w.ontology(id),
      get roomsPage() { return forPage(w.all); },   // the rooms page's own ontology (Borges), or null
      get prefs() { return w.prefs; },
      setLook: (key, value) => w.setLook({ ...w.prefs, [key]: value }),
      resetLook: () => w.setLook(LOOK),
      get globals() { return w.globals; },
      setGlobal: (of, key, value) => { (w.globals[of] ||= {})[key] = value; w.storage.set('ontologies', w.globals); },
      resetGlobals: () => { w.globals = {}; w.storage.set('ontologies', w.globals); },
      get palette() { return w.palette; },
      refreshPalette: () => { w.palette = w.backdrop?.palette?.() || w.palette; return w.palette; },
      get attention() { return w.visits(); },
      visit: (roomId) => w.visit(roomId),
      moments: this.momentsService(),
      carriers: Object.freeze({
        list: () => [TRAUM, ...carriers.items.filter((c) => c && typeof c.id === 'string')],
        // The six tables of a room, a group with its parts, or (null) the whole world, with each
        // mark's history from the log (tables.js).
        tables: (root = null) => lib.model.tablesOf(w.world, root, { log: w.log }),
        // …as .traum text (ids: 'short' to take out, 'real' to edit in place), and text read back:
        // { tables, root, report }, or null when it is not traum/3 (traum.js).
        write: (root = null, { ids = 'short' } = {}) => traum.write(lib.model.tablesOf(w.world, root, { log: w.log }), { root, ids }),
        read: (text) => traum.read(text),
        // A file read lands as new marks (a new room on floor `page`, or poured `into` a room); its
        // history lands as told moments. The caller saves (one step). { id, ids } or { why }.
        land: (got, o = {}) => {
          const out = lib.model.landTables(w.world, got.tables, got.root, o);
          if (out.told?.length) M.tell(w.log, out.told);
          return out;
        },
        // Edited text (real ids) written over the room or group it was taken from. The caller saves.
        replace: (root, got) => lib.model.replaceTables(w.world, root, got.tables, got.root),
      }),
    });
  }

  // The moments log read: the world's history, for Timeline, the daily record, the scrub, sync
  // and the API's moments table. Every read gives rows or states of its own; nothing here writes.
  momentsService() {
    const w = this;
    return Object.freeze({
      get log() { return w.log; },                                // the log itself (moments.js), read only
      of: (mark) => M.of(w.log, mark),                            // a mark's rows, oldest first
      changed: (mark) => M.changed(w.log, mark),                  // when a mark last changed, or null
      since: (time) => M.since(w.log, time),                      // every row from a time on
      day: (date) => M.day(w.log, date),                          // a day's rows
      changedOn: (date) => M.changedOn(w.log, date),              // marks changed on a day → their context then
      at: (time) => M.stateAt(w.log, time),                       // { things, links, places, own } as they were at a time
      first: () => M.first(w.log),                                // the first time the log knows of
      get keep() { return w.log.keep; },                          // days of history kept (0: forever)
      setKeep: (days) => { w.log.keep = days; M.compact(w.log, Date.now()); w.storage.set(LOG, w.log); },
      // For a carrier (the account's sync): the rows since a seq as another copy can take them
      // (null: the whole world, as made now), and rows from another copy taken in (the latest
      // word on a thing wins; written down at once).
      outbox: (seq) => (seq == null ? M.whole(M.stateOf(w.world), Date.now()) : M.outbox(w.log, seq)),
      absorb: (rows) => w.absorb(rows),
    });
  }

  // The log and the world agree: what the log does not know of (the world's first state, or a
  // world that arrived without its log) lands as one step. Undo starts from here.
  begin() {
    const now = Date.now();
    const state = M.stateOf(this.world);
    if (!this.log.base && !this.log.rows.length) this.log = M.emptyLog(now, state);
    else this.land(M.record(this.log, M.stateAt(this.log), state, now));
    this.lastSnap = this.snap();
    this.last = JSON.parse(this.lastSnap);
    this.lit = null;
    this.come(now); // what was due while the app was shut comes back now
  }

  // Moments ahead whose time has come are back (ahead.js): the world's doing, landed in the log
  // with no step, so Ctrl+Z neither takes them back nor loses its place. `how` makes the change
  // to the world (by default: every timed row due by `now` comes back). The next one is waited
  // for on a timer, a day at most at a time. Returns the marks that came back.
  come(now = Date.now(), how = (w) => lib.ahead.come(w, now)) {
    clearTimeout(this.aheadTimer);
    const { came, rows, last } = M.arrive(this.log, this.last, this.world, how, now);
    if (came.length) {
      this.land(rows);
      this.last = last;
      this.lastSnap = JSON.stringify(last);
      this.writeSoon(false);
    }
    const at = lib.ahead.next(this.world);
    if (at != null && typeof setTimeout === 'function') this.aheadTimer = setTimeout(() => this.come(), Math.min(Math.max(at - Date.now(), 1e3), DAY));
    return came;
  }

  snap() { return JSON.stringify(M.stateOf(this.world)); }

  // Rows that landed in the log: anyone listening to the moments table hears of them.
  land(rows, undone) {
    if (!rows?.length) return rows;
    this.lit = null;
    this.emit('world:moments', { rows, undone: !!undone });
    return rows;
  }

  // After a change: a change to the thoughts or rooms (not just where the view is) is a step Ctrl+Z
  // can take back, and its rows land in the log. The world is written down soon. True when it was
  // a step.
  save() {
    const snap = this.snap();
    let step = false;
    if (snap !== this.lastSnap) {
      lib.model.touch(this.world); // a change: every rule lays out afresh (rules.js)
      const next = JSON.parse(snap);
      step = this.land(M.record(this.log, this.last, next, Date.now())).length > 0;
      this.lastSnap = snap;
      this.last = next;
    }
    this.writeSoon(true);
    return step;
  }

  // The change since the last step joins that step (a push from clear space goes with what caused
  // it): its rows land under the same step.
  fold() {
    const snap = this.snap();
    if (snap === this.lastSnap) return;
    const next = JSON.parse(snap);
    this.land(M.fold(this.log, this.last, next, Date.now()));
    this.lastSnap = snap;
    this.last = next;
  }

  write() { this.unwritten = false; this.storage.set(KEY, this.world); this.storage.set(LOG, this.log); }

  // A write waiting in writeSoon done now (before the world is read afresh from storage).
  flush() { if (!this.unwritten) return; clearTimeout(this.saveTimer); this.write(); this.emit('world:saved'); }

  // Written down in a moment; a later call takes the place of an earlier one. say: then sends
  // 'world:saved' (a quiet "Saved" shows).
  writeSoon(say) {
    this.unwritten = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.write(); if (say) this.emit('world:saved'); }, 250);
  }

  // A step back (or forward), read off the log. False when there is none; otherwise the world is
  // as it was, written down, and 'world:changed' is sent.
  undo(back) {
    const rows = M.undo(this.log, this.world, back, Date.now());
    if (!rows) return false;
    this.lastSnap = this.snap();
    this.last = JSON.parse(this.lastSnap);
    clearTimeout(this.saveTimer);
    this.write();
    this.land([...rows, this.log.rows[this.log.rows.length - 1]], back);
    this.emit('world:changed', { undone: back });
    return true;
  }

  // Rows from another copy of the world land here (moments.js absorb); the world is written down.
  // Returns the rows that landed.
  absorb(rows) {
    const state = M.stateOf(this.world);
    const landed = M.absorb(this.log, state, rows);
    if (!landed.length) return landed;
    this.lastSnap = this.snap();
    this.last = JSON.parse(this.lastSnap);
    this.write();
    return this.land(landed);
  }

  // Going into a room is a moment; the attention log ({ [roomId]: [times] }) is read off the log.
  // A return waiting on the room, or on a mark in it, comes back (ahead.js).
  visit(roomId) {
    const now = Date.now();
    const row = M.visit(this.log, roomId, now);
    if (row) { this.land([row]); this.storage.set(LOG, this.log); }
    this.come(now, (w) => [...lib.ahead.come(w, now), ...lib.ahead.opened(w, roomId, now)]);
  }
  visits() { return (this.lit ||= M.visits(this.log)); }

  // The ontologies there are (ontologies/index.js), and the one a room is seen through: a room
  // whose ontology is missing (its feature switched off, say) is seen through Pessoa.
  // The rooms page's own (Borges, roomsPage) is never a room's: it is only in `all`.
  get all() {
    return gather(this.slot('world.ontologies').items, (o, lacks) => console.warn('World: an ontology was skipped; it lacks', lacks.join(', '), o));
  }
  get ontologies() { return forRooms(this.all); }
  ontology(id) {
    const all = this.ontologies;
    return all.find((o) => o.id === id) || all.find((o) => o.id === FALLBACK);
  }

  setLook(prefs) {
    this.prefs = lookPrefs(prefs);
    this.storage.set('look', savedLook(this.prefs));
    this.emit('world:look', this.prefs);
  }
}
