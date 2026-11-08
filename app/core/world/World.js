// World: the saved world of rooms and thoughts, and everything that is true of it without a
// screen. It owns the world itself (saved as 'world3'), saving and undo, the ontologies (and the
// slot 'world.ontologies' for more), the rooms' look (Settings → Rooms' values, saved as 'look'),
// the global ontology settings ('ontologies'), the app's palette and the attention log
// ('attention'). Other features reach all of it only through the `world` service below, whose
// list is the whole of what it offers (README.md says the same in words).

import { Feature } from 'folio';
import * as lib from './lib.js';
import { loadWorld } from './model.js';
import { gather, forRooms, forPage, FALLBACK } from './ontologies/index.js';
import { visit, loadLog } from './attention.js';
import { lookPrefs, savedLook, LOOK, PALETTE } from './look.js';

const KEY = 'world3'; // where the world is saved (model.js)
const UNDO = 60;      // how many steps back Ctrl+Z goes

export default class World extends Feature {
  start() {
    if (this.storage.has('world')) this.storage.set('world', null); // an older shape: not kept
    this.world = loadWorld(this.storage.get(KEY));
    this.begin();
    this.backdrop = this.use('backdrop'); // the picture behind (Renderer), for the palette, or null
    this.prefs = lookPrefs(this.storage.get('look'));
    // The global ontology settings ({ [ontology]: { key: value } }): what a new room starts with.
    this.globals = this.storage.get('ontologies') || {};
    // The app's colours (Renderer, Settings → Colour), and any change to them.
    this.palette = this.backdrop?.palette?.() || PALETTE;
    document.addEventListener('palette', (e) => { this.palette = e.detail; this.emit('world:palette', this.palette); });
    this.log = loadLog(this.storage.get('attention'));
    this.defineSlot('world.ontologies', 'A way of seeing a room\'s thoughts: { id, name, note, groups, units, point, drop, … } (see world/ontologies/index.js).');

    const w = this;
    this.provide('world', {
      lib,                                          // the rules, by module (lib.js)
      get world() { return w.world; },              // the world itself (model.js)
      load: () => { w.world = loadWorld(w.storage.get(KEY)); return w.world; },
      begin: () => w.begin(),
      save: () => w.save(),
      settled: () => w.snap() === w.lastSnap,
      fold: () => { w.lastSnap = w.snap(); },
      writeSoon: (say = true) => w.writeSoon(say),
      write: () => w.storage.set(KEY, w.world),
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
      get attention() { return w.log; },
      visit: (roomId) => { w.log = loadLog(w.storage.get('attention')); visit(w.log, roomId); w.storage.set('attention', w.log); },
    });
  }

  // A fresh undo history.
  begin() {
    this.undoStack = [];
    this.redoStack = [];
    this.lastSnap = this.snap();
  }

  snap() { const w = this.world; return JSON.stringify({ things: w.things, own: w.own, pages: w.pages }); }

  // After a change: a change to the thoughts or rooms (not just where the view is) is a step Ctrl+Z
  // can take back. The world is written down soon. True when it was a step.
  save() {
    const now = this.snap();
    let step = false;
    if (now !== this.lastSnap) {
      this.undoStack.push(this.lastSnap);
      if (this.undoStack.length > UNDO) this.undoStack.shift();
      this.redoStack = [];
      this.lastSnap = now;
      step = true;
    }
    this.writeSoon(true);
    return step;
  }

  // Written down in a moment; a later call takes the place of an earlier one. say: then sends
  // 'world:saved' (a quiet "Saved" shows).
  writeSoon(say) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.storage.set(KEY, this.world); if (say) this.emit('world:saved'); }, 250);
  }

  // A step back (or forward). False when there is none; otherwise the world is as it was, written
  // down, and 'world:changed' is sent.
  undo(back) {
    const from = back ? this.undoStack : this.redoStack, to = back ? this.redoStack : this.undoStack;
    if (!from.length) return false;
    to.push(this.lastSnap);
    this.lastSnap = from.pop();
    const { things, own = {}, pages = 1 } = JSON.parse(this.lastSnap);
    Object.assign(this.world, { things, own, pages });
    clearTimeout(this.saveTimer);
    this.storage.set(KEY, this.world);
    this.emit('world:changed', { undone: back });
    return true;
  }

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
