// The traumerei plugin API, version 1: the compatibility surface. Version 2 (v2.js) names the
// app after the kernel's six primitives and is layered over this file; v1's names stay offered
// until the kernel phase that replaces them (phase 6), then this file goes. app/core/API.md says
// the API in words; tests/api.test.js holds both lists, so a change is always deliberate.
//
// `surface(lib)` is the part that needs no app: the world's rules and the shared parts, chosen
// from the world service's lib (world/lib.js). A plugin's tests call it with the same modules.
// `connect(...)` (Api.js) adds the world itself, saving, the plugin's own data and the places to
// plug in, each owned by the plugin, so switching it off takes everything it added away.

export const API_VERSION = 1;

// Picks names from a module, failing loudly if one is missing (a rename in world shows here).
function pick(from, names, where) {
  const out = {};
  for (const name of names) {
    if (!(name in from)) throw new Error(`Plugin API: world's ${where} has no "${name}"`);
    out[name] = from[name];
  }
  return Object.freeze(out);
}

// The rules a plugin may use, by part. Each name is a plain function of the world (or a
// constant) from the world feature's README.
export const MODEL = ['own', 'parentOf', 'shut', 'hash', 'roomSetting', 'setRoomSetting', 'isGroup', 'isLeaf', 'create',
  'join', 'members', 'itemsIn', 'within', 'groupOf', 'groupsIn', 'roomItems', 'thoughtText', 'view', 'setOrder', 'groupLabel',
  'room', 'roomThoughts', 'kindOf', 'update', 'remove', 'groupsOf', 'addRoom', 'seedRoomSettings', 'search', 'MESSY', 'DEFAULT_MODE',
  'leave', 'replaceIn'];
export const GROUPS = ['placedForeign', 'trayForeign', 'inForeign', 'waiting', 'wait', 'spot', 'putAt', 'place', 'unplace'];
export const RELATIONS = ['arrowsOf', 'cleanRelationList', 'relationEntry', 'relationEnds', 'listText', 'relationName', 'splitList',
  'cleanRelations', 'relationShown', 'withRelation', 'RELATIONS'];
// A train's rhythm (Joyce's, in the core): how far down the next thought goes, the measured
// heights it reads, and the steps it starts from.
export const TRAINS = ['stepAfter', 'setHeights', 'STEP'];
// The kinds of item there are now (ITEMS is kept up to date as plugins add kinds), and the kind a
// thought is drawn as (a quiet stand-in for a kind whose plugin is off).
export const KINDS = ['ITEMS', 'kindFor', 'isKnown'];
// A Twin: two sides, each a room, side by side.
export const TWINS = ['isTwin', 'twinOf', 'sides', 'addTwin'];
export const LINES = ['svg', 'layer', 'group', 'line', 'knot', 'slack', 'strand', 'path', 'middle', 'between',
  'labelSpot', 'sidePoint', 'facing', 'PAD', 'ENDS', 'ENDS_WORDS', 'cleanEnds', 'PAUSE', 'HEAD'];

export function surface(lib) {
  return {
    model: pick(lib.model, MODEL, 'model'),
    groups: pick(lib.groups, GROUPS, 'groups'),
    relations: pick(lib.relations, RELATIONS, 'relations'),
    lines: pick(lib.lines, LINES, 'lines'),
    arrows: pick(lib.arrowview, ['arrowView'], 'arrowview'),
    maths: pick(lib.maths, ['maths', 'broken'], 'maths'),
    kinds: pick(lib.items, KINDS, 'items'),
    twins: pick(lib.twin, TWINS, 'twin'),
    pictures: pick(lib.picture, ['shrinkPicture', 'keepOrShrink'], 'picture'),
    layout: pick(lib.pessoa, ['spiralPoint'], 'pessoa'),
    trains: pick(lib.joyce, TRAINS, 'joyce'),
  };
}

// The places to plug in that core features own, by the name a plugin uses → their slot.
export const PLACES = {
  modes: 'world.ontologies', // a way of seeing a room (world/ontologies/index.js says its shape)
  items: 'world.items',      // a kind of item: a passage, a picture, a PDF page (world/items/index.js)
  commands: 'keys',          // a named action, with its keys if it has any (keys/README.md)
  more: 'rail.more',         // an entry under ⋯ More (frame/README.md)
  editor: 'room.editor',     // a section in the Editor for the chosen thing (room/README.md)
  formats: 'world.formats',  // a file format: rooms in and out, and edited as text (world/formats.js)
};

const DOCK = ['open', 'close', 'show', 'isOpen', 'isShowing'];

// One dock (the docks service's left or right) for one plugin: what it opens is noted, so it
// can all be closed when the plugin is switched off (gone(fn) is told how).
function dockFor(dock, gone) {
  if (!dock) return null;
  const mine = new Set();
  gone(() => { for (const key of mine) dock.close(key, true); mine.clear(); });
  return Object.freeze({
    open: async (o = {}) => {
      if (!o.key) throw new Error('A dock tab needs a key');
      const handle = await dock.open({ ...o, onClose: () => { mine.delete(o.key); o.onClose?.(); } });
      if (handle) mine.add(o.key);
      return handle;
    },
    close: (key, force) => dock.close(key, force),
    show: (key) => dock.show(key),
    isOpen: (key) => dock.isOpen(key),
    isShowing: (key) => dock.isShowing(key),
  });
}

// The API one plugin gets. app: the Folio app; world: the world service; plugin: the Feature
// asking (its id owns what it adds); parts: surface(world.lib), made once; toast: Folio's
// ui.toast (passed in, so this file imports nothing and runs in Node too); docks: the docks
// service ({ left, right }), or null; keys, frame, floors: those core services, or null;
// service(name): any other core service, looked up when it is needed (the rooms page starts
// after the plugins it shows); gone(fn): fn runs when the plugin is switched off.
// offers: the API version the app offers (v2.js passes its own; a plugin asking for a newer one
// can't connect).
export function connect({ app, world, plugin, parts, toast = () => {}, docks = null, keys = null, frame = null,
  floors = null, service = () => null, gone = () => {}, offers = API_VERSION }) {
  const wanted = plugin.manifest?.plugin?.api ?? offers;
  if (wanted > offers) {
    throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}; this app offers ${offers}`);
  }
  const owner = plugin.id;
  const add = (slot) => (item) => app.slot(slot).add(item, owner); // returns a function that takes it away again
  const places = {};
  for (const [name, slot] of Object.entries(PLACES)) places[name] = Object.freeze({ add: add(slot) });
  // Two places say a little more than add: the modes there are, and a command's keys as words.
  places.modes = Object.freeze({
    add: add(PLACES.modes),
    get: (id) => world.ontology(id),          // the mode with this id (the default mode when it is off or unknown)
    get all() { return world.ontologies; },    // every mode there is now
    get settings() { return world.globals; },  // each mode's settings for new rooms: { [mode id]: { key: value } }
  });
  places.commands = Object.freeze({
    add: add(PLACES.commands),
    label: (id) => keys?.label(id) || '',      // a command's keys as words ("Ctrl+K"), or ''
  });
  if (frame) gone(() => frame.hide(plugin));
  return Object.freeze({
    version: offers,
    app: Object.freeze({ name: app.config.name, version: app.config.version }),
    plugin: Object.freeze({ id: owner, name: plugin.manifest?.name || owner }),
    get world() { return world.world; },
    save: () => world.save(),
    write: () => world.write(),
    load: () => { world.load(); world.begin(); return world.world; },
    data: (roomId) => parts.model.own(world.world, roomId, owner),
    ...parts,
    ...places,
    docks: docks ? Object.freeze({ left: dockFor(docks.left, gone), right: dockFor(docks.right, gone) }) : null,
    // The top bar and the status bar, for a page the plugin shows (frame/README.md).
    frame: frame ? Object.freeze({
      show: (o) => frame.show(plugin, o),
      update: (o) => frame.update(plugin, o),
      hide: () => frame.hide(plugin),
      hint: (text) => frame.hint(text),
      clearHint: () => frame.clearHint(),
    }) : null,
    // Going somewhere: the rooms page, or into a room (from anywhere, Home too).
    open: Object.freeze({
      rooms: () => { service('create')?.open(); },
      room: (id) => { service('create')?.open(); service('rooms')?.openRoom(id); },
    }),
    // Where a new room goes on the rooms page: `cell` if it is free, else its floor's first free
    // cell, else a new floor.
    floors: Object.freeze({ place: (id, cell = null) => floors?.place(id, cell) }),
    toast: (text) => toast(text),
  });
}
