// Tests for the plugin API (v1.js): the list is exactly what app/core/API.md says, every name
// is really there in the world, a plugin's additions are its own, and a plugin for a newer API
// can't connect.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { API_VERSION, surface, connect, PLACES } from '../v1.js';

// Version 1, as API.md lists it. Changing the API means changing this and API.md together.
const V1 = {
  top: ['app', 'arrows', 'commands', 'data', 'docks', 'editor', 'floors', 'formats', 'frame', 'groups', 'items', 'kinds', 'layout', 'lines', 'load', 'maths', 'model', 'modes', 'more', 'open', 'pictures', 'plugin', 'relations', 'save', 'toast', 'trains', 'twins', 'version', 'world', 'write'],
  model: ['DEFAULT_MODE', 'MESSY', 'addRoom', 'create', 'groupLabel', 'groupOf', 'groupsIn', 'groupsOf', 'hash', 'isGroup', 'isLeaf', 'itemsIn', 'join', 'kindOf', 'members', 'own', 'remove', 'room', 'roomItems', 'roomSetting', 'roomThoughts', 'search', 'seedRoomSettings', 'setOrder', 'setRoomSetting', 'shut', 'thoughtText', 'update', 'view', 'within'],
  groups: ['inForeign', 'place', 'placedForeign', 'putAt', 'spot', 'trayForeign', 'unplace', 'wait', 'waiting'],
  relations: ['RELATIONS', 'arrowsOf', 'cleanRelationList', 'cleanRelations', 'listText', 'relationEnds', 'relationEntry', 'relationName', 'relationShown', 'splitList', 'withRelation'],
  trains: ['STEP', 'setHeights', 'stepAfter'],
  lines: ['ENDS', 'ENDS_WORDS', 'HEAD', 'PAD', 'PAUSE', 'between', 'cleanEnds', 'facing', 'group', 'knot', 'labelSpot', 'layer', 'line', 'middle', 'path', 'sidePoint', 'slack', 'strand', 'svg'],
  arrows: ['arrowView'],
  maths: ['broken', 'maths'],
  layout: ['spiralPoint'],
  kinds: ['ITEMS', 'isKnown', 'kindFor'],
  twins: ['addTwin', 'isTwin', 'sides', 'twinOf'],
  pictures: ['keepOrShrink'],
  modes: ['add', 'all', 'get', 'settings'],
  commands: ['add', 'label'],
  more: ['add'],
  editor: ['add'],
  items: ['add'],
  formats: ['add'],
  open: ['room', 'rooms'],
  floors: ['place'],
};

// A small stand-in for the Folio app: slots that remember who added what.
function fakeApp() {
  const slots = new Map();
  return {
    config: { name: 'Träumerei', version: '1.0.0' },
    slots,
    slot(name) {
      if (!slots.has(name)) {
        const items = [];
        slots.set(name, { items, add(item, owner) { const e = { item, owner }; items.push(e); return () => items.splice(items.indexOf(e), 1); } });
      }
      return slots.get(name);
    },
  };
}
const world = { world: lib.model.emptyWorld(), saved: 0, save() { this.saved++; return true; } };
const plugin = (id, api = 1) => ({ id, manifest: { name: id[0].toUpperCase() + id.slice(1), plugin: { api, minApp: '1.0.0' } } });

test('version 1 is exactly the written list', () => {
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib) });
  assert.equal(API_VERSION, 1);
  assert.deepEqual(Object.keys(t).sort(), V1.top);
  for (const part of Object.keys(V1).filter((k) => k !== 'top')) assert.deepEqual(Object.keys(t[part]).sort(), V1[part], part);
  assert.equal(t.frame, null); // no frame in this app
  assert.deepEqual(Object.keys(PLACES).sort(), ['commands', 'editor', 'formats', 'items', 'modes', 'more']);
});

test('every name is the world\'s own, and the API can\'t be changed by a plugin', () => {
  const parts = surface(lib);
  assert.equal(parts.model.create, lib.model.create);
  assert.equal(parts.arrows.arrowView, lib.arrowview.arrowView);
  assert.equal(parts.layout.spiralPoint, lib.pessoa.spiralPoint);
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts });
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.model) && Object.isFrozen(t.modes));
  assert.throws(() => { 'use strict'; t.model.create = null; });
});

test('a name the world no longer has fails loudly, naming it', () => {
  const broken = { ...lib, model: { ...lib.model, view: undefined } };
  delete broken.model.view;
  assert.throws(() => surface(broken), /model has no "view"/);
});

test('what a plugin adds is its own, and can be taken away', () => {
  const app = fakeApp();
  const t = connect({ app, world, plugin: plugin('haiku'), parts: surface(lib) });
  const remove = t.modes.add({ id: 'haiku' });
  t.commands.add({ id: 'haiku.go', keys: ['Ctrl+Alt+H'] });
  t.editor.add({ id: 'haiku-lines' });
  t.more.add({ id: 'haiku-more' });
  t.items.add({ kind: 'haiku' });
  assert.deepEqual(app.slot('world.ontologies').items.map((e) => e.owner), ['haiku']);
  assert.equal(app.slot('keys').items[0].owner, 'haiku');
  assert.equal(app.slot('rail.more').items[0].owner, 'haiku');
  assert.equal(app.slot('world.items').items[0].owner, 'haiku');
  assert.equal(app.slot('room.editor').items[0].owner, 'haiku');
  remove();
  assert.equal(app.slot('world.ontologies').items.length, 0);
});

test('the world, saving and the plugin\'s own data in a room', () => {
  const w = lib.model.emptyWorld();
  const own = { world: w, saved: 0, save() { this.saved++; return true; } };
  const t = connect({ app: fakeApp(), world: own, plugin: plugin('haiku'), parts: surface(lib) });
  assert.equal(t.world, w);
  assert.deepEqual(t.app, { name: 'Träumerei', version: '1.0.0' });
  assert.deepEqual(t.plugin, { id: 'haiku', name: 'Haiku' });
  const room = lib.model.MESSY;
  t.data(room).lines = 3;
  assert.equal(lib.model.own(w, room, 'haiku').lines, 3);   // kept with the room, under the plugin's id
  assert.equal(t.data(room), t.data(room));
  t.save();
  assert.equal(own.saved, 1);
});

test('a plugin written for a newer API can\'t connect, and says why', () => {
  assert.throws(() => connect({ app: fakeApp(), world, plugin: plugin('later', 2), parts: surface(lib) }),
    /Later is written for plugin API 2; this app offers 1/);
});

// A stand-in dock: remembers what is open, and closes it when asked.
function fakeDock() {
  const open = new Map();
  return {
    open: async (o) => { open.set(o.key, o); return { close: () => { open.delete(o.key); o.onClose?.(); } }; },
    close: async (key) => { const o = open.get(key); open.delete(key); o?.onClose?.(); return true; },
    show: (key) => open.has(key), isOpen: (key) => open.has(key), isShowing: (key) => open.has(key),
    open_: open,
  };
}

test('a plugin\'s dock tabs are its own, and all close when it is switched off', async () => {
  const docks = { left: fakeDock(), right: fakeDock() };
  const leaving = [];
  const t = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), docks, gone: (fn) => leaving.push(fn) });
  assert.deepEqual(Object.keys(t.docks.right).sort(), ['close', 'isOpen', 'isShowing', 'open', 'show']);
  let closed = 0;
  await t.docks.right.open({ key: 'time', body: null, onClose: () => closed++ });
  await t.docks.left.open({ key: 'notes', body: null });
  await t.docks.right.open({ key: 'gone-soon', body: null });
  await t.docks.right.close('gone-soon');
  assert.ok(t.docks.right.isOpen('time') && t.docks.left.isOpen('notes'));
  for (const fn of leaving) fn(); // the plugin is switched off
  assert.equal(docks.right.open_.size, 0);
  assert.equal(docks.left.open_.size, 0);
  assert.equal(closed, 1); // its own onClose still runs
});

test('without docks there are none, and a tab needs a key', async () => {
  const none = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib) });
  assert.equal(none.docks, null);
  const t = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), docks: { left: fakeDock(), right: null } });
  assert.equal(t.docks.right, null);
  let refused = null;
  try { await t.docks.left.open({ body: null }); } catch (err) { refused = err.message; }
  assert.equal(refused, 'A dock tab needs a key');
});

test('modes, a command\'s keys, the frame, going somewhere and placing a room, for a plugin', () => {
  const joyce = { id: 'joyce' }, russell = { id: 'russell' };
  const w = lib.model.emptyWorld();
  const own = { world: w, ontologies: [joyce, russell], globals: { joyce: { gap: 2 } }, ontology: (id) => (id === 'russell' ? russell : joyce),
    loaded: 0, begun: 0, written: 0, load() { this.loaded++; return w; }, begin() { this.begun++; }, write() { this.written++; }, save() { return true; } };
  const shown = [], went = [], placed = [], leaving = [];
  const frame = { show: (o, x) => shown.push(['show', o.id, x.idle]), update: (o, x) => shown.push(['update', o.id, x.idle]),
    hide: (o) => shown.push(['hide', o.id]), hint: (s) => shown.push(['hint', s]), clearHint: () => shown.push(['clear']) };
  const keys = { label: (id) => (id === 'haiku.go' ? 'Ctrl+Alt+H' : '') };
  const services = { create: { open: () => went.push('rooms') }, rooms: { openRoom: (id) => went.push(id) } };
  const me = plugin('haiku');
  const t = connect({ app: fakeApp(), world: own, plugin: me, parts: surface(lib), keys, frame,
    floors: { place: (id, cell) => placed.push([id, cell]) }, service: (name) => services[name] || null, gone: (fn) => leaving.push(fn) });
  assert.equal(t.modes.get('russell'), russell);
  assert.equal(t.modes.get('nowhere'), joyce);
  assert.deepEqual(t.modes.all.map((o) => o.id), ['joyce', 'russell']);
  assert.deepEqual(t.modes.settings, { joyce: { gap: 2 } });
  assert.equal(t.commands.label('haiku.go'), 'Ctrl+Alt+H');
  assert.equal(t.commands.label('other'), '');
  t.frame.show({ idle: 'Haiku' });
  t.frame.update({ idle: 'Five' });
  t.frame.hint('Saved a haiku');
  t.open.rooms();
  t.open.room('messy');
  t.floors.place('r1', { col: 1, row: 2 });
  assert.equal(t.load(), w);
  t.write();
  assert.deepEqual([own.loaded, own.begun, own.written], [1, 1, 1]);
  assert.deepEqual(went, ['rooms', 'rooms', 'messy']);
  assert.deepEqual(placed, [['r1', { col: 1, row: 2 }]]);
  for (const fn of leaving) fn(); // switched off: its frame goes too
  assert.deepEqual(shown, [['show', 'haiku', 'Haiku'], ['update', 'haiku', 'Five'], ['hint', 'Saved a haiku'], ['hide', 'haiku']]);
});

test('without keys, a frame, floors or the rooms page, those parts do nothing quietly', () => {
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib) });
  assert.equal(t.commands.label('anything'), '');
  assert.equal(t.frame, null);
  t.open.rooms();
  t.open.room('messy');
  t.floors.place('r1');
});
