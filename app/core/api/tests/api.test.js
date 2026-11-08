// Tests for the plugin API (api.js): the list is exactly what app/core/API.md says, every name
// is really there in the world, a plugin's additions are its own, and a plugin for a newer API
// can't connect.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { API_VERSION, surface, connect, PLACES } from '../api.js';

// Version 1, as API.md lists it. Changing the API means changing this and API.md together.
const V1 = {
  top: ['app', 'arrows', 'data', 'groups', 'items', 'keys', 'layout', 'lines', 'maths', 'model', 'modes', 'more', 'plugin', 'relations', 'save', 'toast', 'version', 'world'],
  model: ['create', 'groupOf', 'groupsIn', 'hash', 'isGroup', 'isLeaf', 'itemsIn', 'join', 'members', 'own', 'roomItems', 'roomSetting', 'setRoomSetting', 'shut', 'thoughtText', 'view', 'within'],
  groups: ['inForeign', 'place', 'placedForeign', 'putAt', 'spot', 'trayForeign', 'unplace', 'wait', 'waiting'],
  relations: ['arrowsOf', 'cleanRelationList', 'listText', 'relationEnds', 'relationEntry'],
  lines: ['ENDS', 'ENDS_WORDS', 'HEAD', 'PAD', 'PAUSE', 'between', 'cleanEnds', 'facing', 'group', 'knot', 'labelSpot', 'layer', 'line', 'middle', 'path', 'sidePoint', 'slack', 'strand', 'svg'],
  arrows: ['arrowView'],
  maths: ['maths'],
  layout: ['spiralPoint'],
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
  assert.deepEqual(Object.keys(PLACES).sort(), ['items', 'keys', 'modes', 'more']);
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
  t.keys.add({ id: 'haiku.go', keys: ['Ctrl+Alt+H'] });
  t.more.add({ id: 'haiku-more' });
  t.items.add({ kind: 'haiku' });
  assert.deepEqual(app.slot('world.ontologies').items.map((e) => e.owner), ['haiku']);
  assert.equal(app.slot('keys').items[0].owner, 'haiku');
  assert.equal(app.slot('rail.more').items[0].owner, 'haiku');
  assert.equal(app.slot('world.items').items[0].owner, 'haiku');
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
