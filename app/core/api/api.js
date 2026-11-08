// The traumerei plugin API, version 1: everything a plugin may use of the app, in one list.
// app/core/API.md says the same in words; tests/api.test.js holds the list, so a change to it is
// always deliberate (change API.md and the test with it).
//
// `surface(lib)` is the part that needs no app: the world's rules and the shared parts, chosen
// from the world service's lib (world/lib.js). A plugin's tests call it with the same modules.
// `connect(...)` (Api.js) adds the world itself, saving, the plugin's own data and the places to
// plug in, each owned by the plugin, so switching it off takes everything it added away.

import { ui } from 'folio';

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
export const MODEL = ['own', 'shut', 'hash', 'roomSetting', 'setRoomSetting', 'isGroup', 'isLeaf', 'create',
  'join', 'members', 'itemsIn', 'within', 'groupOf', 'groupsIn', 'roomItems', 'thoughtText', 'view'];
export const GROUPS = ['placedForeign', 'trayForeign', 'inForeign', 'waiting', 'wait', 'spot', 'putAt', 'place', 'unplace'];
export const RELATIONS = ['arrowsOf', 'cleanRelationList', 'relationEntry', 'relationEnds', 'listText'];
export const LINES = ['svg', 'layer', 'group', 'line', 'knot', 'slack', 'strand', 'path', 'middle', 'between',
  'labelSpot', 'sidePoint', 'facing', 'PAD', 'ENDS', 'ENDS_WORDS', 'cleanEnds', 'PAUSE', 'HEAD'];

export function surface(lib) {
  return {
    model: pick(lib.model, MODEL, 'model'),
    groups: pick(lib.groups, GROUPS, 'groups'),
    relations: pick(lib.relations, RELATIONS, 'relations'),
    lines: pick(lib.lines, LINES, 'lines'),
    arrows: pick(lib.arrowview, ['arrowView'], 'arrowview'),
    maths: pick(lib.maths, ['maths'], 'maths'),
    layout: pick(lib.pessoa, ['spiralPoint'], 'pessoa'),
  };
}

// The places to plug in that core features own, by the name a plugin uses → their slot.
export const PLACES = {
  modes: 'world.ontologies', // a way of seeing a room (world/ontologies/index.js says its shape)
  items: 'world.items',      // a kind of item: a passage, a picture, a PDF page (world/items/index.js)
  keys: 'keys',              // a key and what it does (keys/README.md)
  more: 'rail.more',         // an entry under ⋯ More (frame/README.md)
};

// The API one plugin gets. app: the Folio app; world: the world service; plugin: the Feature
// asking (its id owns what it adds); parts: surface(world.lib), made once.
export function connect({ app, world, plugin, parts }) {
  const wanted = plugin.manifest?.plugin?.api ?? API_VERSION;
  if (wanted > API_VERSION) {
    throw new Error(`${plugin.manifest?.name || plugin.id} is written for plugin API ${wanted}; this app offers ${API_VERSION}`);
  }
  const owner = plugin.id;
  const place = (slot) => Object.freeze({
    add: (item) => app.slot(slot).add(item, owner), // returns a function that takes it away again
  });
  const places = {};
  for (const [name, slot] of Object.entries(PLACES)) places[name] = place(slot);
  return Object.freeze({
    version: API_VERSION,
    app: Object.freeze({ name: app.config.name, version: app.config.version }),
    plugin: Object.freeze({ id: owner, name: plugin.manifest?.name || owner }),
    get world() { return world.world; },
    save: () => world.save(),
    data: (roomId) => parts.model.own(world.world, roomId, owner),
    ...parts,
    ...places,
    toast: (text) => ui.toast(text),
  });
}
