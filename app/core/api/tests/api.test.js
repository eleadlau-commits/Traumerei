// Tests for the plugin API (v2.js over v1.js): the list is exactly what app/core/API.md says,
// every name is really there in the world, the six kernel tables read and propose as KERNEL.md
// says, a plugin's additions are its own, and a plugin for a newer API can't connect.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { API_VERSION, surface, connect, kernel, PLACES, TABLES, READERS, DIRECTIONS, ARCHIVE } from '../v2.js';
import { API_VERSION as V1_VERSION } from '../v1.js';

// Version 2, as API.md lists it: the six tables, the slots and ui, over every v1 name. Changing
// the API means changing this and API.md together.
const V2 = {
  top: ['app', 'arrows', 'commands', 'data', 'distance', 'docks', 'editor', 'floors', 'formats', 'frame', 'gaps', 'groups', 'items', 'kinds', 'layout', 'lines', 'links', 'load', 'marks', 'maths', 'model', 'modes', 'moments', 'more', 'open', 'pictures', 'places', 'plugin', 'relations', 'save', 'slots', 'toast', 'trains', 'twins', 'ui', 'version', 'world', 'write'],
  marks: ['delete', 'edit', 'get', 'in', 'make', 'ofKind', 'on', 'search', 'text'],
  places: ['in', 'loose', 'move', 'of', 'on', 'position', 'put', 'unplace'],
  links: ['from', 'holders', 'kinds', 'link', 'members', 'on', 'order', 'to', 'unlink'],
  distance: ['declare', 'of', 'on'],
  gaps: ['of', 'oldest', 'on', 'open', 'opened', 'progress', 'reopen', 'resolve'],
  moments: ['ahead', 'day', 'due', 'note', 'of', 'on', 'revisit', 'since'],
  slots: ['commands', 'editor', 'formats', 'kinds', 'more', 'rules'],
  ui: ['toast'],
};
// Version 1's names, still offered beneath v2 until kernel phase 6.
const V1 = {
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
  pictures: ['keepOrShrink', 'shrinkPicture'],
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
const plugin = (id, api = 2) => ({ id, manifest: { name: id[0].toUpperCase() + id.slice(1), plugin: { api, minApp: '1.0.0' } } });

test('version 2 is exactly the written list, with every v1 name beneath it', () => {
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib), lib });
  assert.equal(API_VERSION, 2);
  assert.equal(V1_VERSION, 1);
  assert.equal(t.version, 2);
  assert.deepEqual(Object.keys(t).sort(), V2.top);
  for (const part of Object.keys(V2).filter((k) => k !== 'top')) assert.deepEqual(Object.keys(t[part]).sort(), V2[part], part);
  for (const part of Object.keys(V1)) assert.deepEqual(Object.keys(t[part]).sort(), V1[part], part);
  assert.deepEqual(TABLES, ['marks', 'places', 'links', 'distance', 'gaps', 'moments']);
  assert.equal(t.slots.rules, t.modes); // the same places, named for what they are to the kernel
  assert.equal(t.slots.kinds, t.items);
  assert.equal(t.ui.toast, t.toast);
  assert.equal(t.frame, null); // no frame in this app
  assert.deepEqual(Object.keys(PLACES).sort(), ['commands', 'editor', 'formats', 'items', 'modes', 'more']);
});

test('every name is the world\'s own, and the API can\'t be changed by a plugin', () => {
  const parts = surface(lib);
  assert.equal(parts.model.create, lib.model.create);
  assert.equal(parts.arrows.arrowView, lib.arrowview.arrowView);
  assert.equal(parts.layout.spiralPoint, lib.pessoa.spiralPoint);
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts, lib });
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
  const t = connect({ app, world, plugin: plugin('haiku'), parts: surface(lib), lib });
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
  const t = connect({ app: fakeApp(), world: own, plugin: plugin('haiku'), parts: surface(lib), lib });
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
  assert.throws(() => connect({ app: fakeApp(), world, plugin: plugin('later', 3), parts: surface(lib), lib }),
    /Later is written for plugin API 3; this app offers 2/);
  assert.equal(connect({ app: fakeApp(), world, plugin: plugin('older', 1), parts: surface(lib), lib }).version, 2); // a v1 plugin still connects
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
  const t = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), lib, docks, gone: (fn) => leaving.push(fn) });
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
  const none = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), lib });
  assert.equal(none.docks, null);
  const t = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), lib, docks: { left: fakeDock(), right: null } });
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
  const t = connect({ app: fakeApp(), world: own, plugin: me, parts: surface(lib), lib, keys, frame,
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
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib), lib });
  assert.equal(t.commands.label('anything'), '');
  assert.equal(t.frame, null);
  t.open.rooms();
  t.open.room('messy');
  t.floors.place('r1');
});

// ---- The six tables (v2.js's kernel), over a small world ----

// A world with one room holding a train of two thoughts, a Pessoa-laid thought, a loose one, a
// Proust link, and a second, locked room; and a stand-in world service around it.
function smallWorld() {
  const w = lib.model.emptyWorld(1000);
  const room = lib.model.addRoom(w, 'Study', 2000);
  const train = lib.model.create(w, room.id, { kind: 'group', of: 'joyce', x: 10, y: 20 }, 3000);
  const a = lib.model.create(w, train.id, { kind: 'line', text: 'first' }, 4000);
  const b = lib.model.create(w, train.id, { kind: 'line', text: 'second' }, 5000);
  const c = lib.model.create(w, room.id, { kind: 'line', text: 'laid alone' }, 6000);
  lib.groups.putAt(w, room.id, 'pessoa', c.id, 300, 400);
  const loose = lib.model.create(w, room.id, { kind: 'line', text: 'loose' }, 7000);
  lib.model.own(w, room.id, 'proust-links')[a.id] = { parents: [c.id], rel: { [c.id]: 'calls up' }, labels: { [c.id]: 'why' } };
  const locked = lib.model.addRoom(w, 'Vault', 8000);
  lib.model.lock(w, locked.id);
  const service = { world: w, lib, saved: 0, save() { this.saved++; return true; }, ontologies: [{ id: 'joyce' }, { id: 'pessoa', lays: true }, { id: 'proust', lays: true }], attention: { [room.id]: [9000, 9500] } };
  return { w, room, train, a, b, c, loose, locked, service };
}
const ids = (list) => list.map((r) => r.mark ?? r.id);

test('marks: frozen rows read off the world; make, edit and delete land as saved steps or refuse in words', () => {
  const { w, room, train, a, b, c, loose, locked, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.equal(k.marks.get(a.id).text, 'first');
  assert.ok(Object.isFrozen(k.marks.get(a.id)));
  assert.ok(k.marks.get(a.id) !== w.things[a.id]); // a copy: the world changes only through proposals
  assert.equal(k.marks.get('nowhere'), null);
  assert.deepEqual(ids(k.marks.in(room.id)), [train.id, a.id, b.id, c.id, loose.id]); // in the order they were made
  assert.deepEqual(ids(k.marks.ofKind('room')).sort(), ['messy', room.id, locked.id].sort());
  assert.equal(k.marks.text(a.id), 'first');
  assert.deepEqual(ids(k.marks.search('laid')), [c.id]);
  const made = k.marks.make({ kind: 'line', content: 'new', in: room.id });
  assert.ok(made.ok && w.things[made.id].text === 'new' && service.saved === 1);
  assert.deepEqual(k.marks.make({ content: 'homeless' }), { ok: false, reason: 'A mark needs a context to be made in' });
  assert.equal(k.marks.make({ content: 'shut out', in: locked.id }).ok, false);
  assert.ok(k.marks.edit(a.id, { text: 'first, changed' }).ok && w.things[a.id].text === 'first, changed');
  assert.equal(k.marks.edit(a.id, { parent: locked.id }).ok, false);
  assert.ok(k.marks.edit(loose.id, { text: '' }).removed && !w.things[loose.id]); // left empty: gone, as the maker asked
  assert.equal(k.marks.delete('messy').reason, 'Messy thoughts stays');
  assert.equal(k.marks.delete(locked.id).ok, false); // Law 2: a locked room is not deleted behind its lock
  assert.ok(k.marks.delete(c.id).ok && !w.things[c.id]);
  const steps = service.saved;
  assert.equal(k.marks.delete('nowhere').ok, false);
  assert.equal(service.saved, steps); // a refusal is not a step
});

test('places: a row per context and rule, rooms on floors or in the archive, loose means no row', () => {
  const { w, room, train, a, b, c, loose, locked, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.places.of(a.id), [{ mark: a.id, context: room.id, rule: 'joyce', position: { group: train.id, index: 0 } }]);
  assert.deepEqual(k.places.of(c.id), [{ mark: c.id, context: room.id, rule: 'pessoa', position: { x: 300, y: 400 } }]);
  assert.deepEqual(k.places.of(train.id), [{ mark: train.id, context: room.id, rule: 'joyce', position: { x: 10, y: 20 } }]);
  assert.deepEqual(k.places.of(loose.id), []);
  assert.deepEqual(ids(k.places.loose(room.id)), [loose.id]);
  assert.deepEqual(ids(k.places.in(room.id, 'joyce')).sort(), [train.id, a.id, b.id].sort());
  assert.equal(k.places.in(room.id).length, 4);
  assert.deepEqual(k.places.position(a.id, room.id, 'joyce'), { group: train.id, index: 0 });
  assert.equal(k.places.position(a.id, room.id, 'pessoa'), null);
  assert.deepEqual(k.places.of(room.id), [{ mark: room.id, context: 'floor:0', rule: 'borges', position: null }]);
  lib.model.archive(w, room.id, 9999);
  assert.deepEqual(k.places.of(room.id), [{ mark: room.id, context: ARCHIVE, rule: null, position: null }]);
  lib.model.restore(w, room.id);
  // Proposals: lay the loose thought under Pessoa; unplace it again; move it to another room.
  assert.ok(k.places.put(loose.id, room.id, 'pessoa', { x: 1, y: 2 }).ok);
  assert.deepEqual(k.places.position(loose.id, room.id, 'pessoa'), { x: 1, y: 2 });
  assert.ok(k.places.unplace(loose.id, room.id).ok);
  assert.deepEqual(k.places.of(loose.id), []);
  assert.equal(k.places.put(loose.id, locked.id).ok, false);
  assert.equal(k.places.move(loose.id, locked.id, 'messy').reason, 'The mark is not in that context');
  assert.ok(k.places.move(loose.id, room.id, 'messy').ok);
  assert.equal(w.things[loose.id].parent, 'messy');
  assert.ok(w.things[loose.id]); // Law 2: moving never loses a mark
});

test('links: part-of rows with order and relation rows with their names; join, leave and reorder', () => {
  const { w, room, train, a, b, c, loose, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.links.kinds(), ['part of', 'relation']);
  assert.deepEqual(k.links.members(train.id), [a.id, b.id]);
  assert.deepEqual(k.links.holders(a.id), [train.id]);
  assert.deepEqual(k.links.from(a.id), [
    { id: `part:${train.id}:${a.id}`, from: a.id, to: train.id, kind: 'part of', order: 0 },
    { id: `rel:proust-links:${a.id}:${c.id}`, from: a.id, to: c.id, kind: 'relation', label: 'calls up', note: 'why', rule: 'proust-links' },
  ]);
  assert.equal(k.links.from(a.id, 'relation').length, 1);
  assert.deepEqual(k.links.to(train.id, 'part of').map((l) => l.order), [0, 1]);
  assert.deepEqual(k.links.to(c.id, 'relation').map((l) => l.from), [a.id]);
  assert.deepEqual(k.links.from(room.id), []);
  assert.ok(k.links.link(loose.id, train.id, 'part of').ok);
  assert.deepEqual(k.links.members(train.id), [a.id, b.id, loose.id]);
  // A train reads in the order its thoughts were written; a rule that keeps its own order
  // (Russell's chapters) reads in the order it was given, and its part-of rows say so.
  assert.ok(k.links.order(train.id, [loose.id, a.id, b.id]).ok);
  assert.deepEqual(k.links.members(train.id), [a.id, b.id, loose.id]);
  lib.model.declareOrder('kept-test', { order: 'kept' });
  const chapter = lib.model.create(w, room.id, { kind: 'group', of: 'kept-test', x: 0, y: 0 }, 7500);
  for (const id of [a.id, b.id]) k.links.link(id, chapter.id, 'part of');
  assert.ok(k.links.order(chapter.id, [b.id, a.id]).ok);
  assert.deepEqual(k.links.members(chapter.id), [b.id, a.id]);
  assert.deepEqual(k.links.to(chapter.id).map((l) => [l.from, l.order]), [[b.id, 0], [a.id, 1]]);
  lib.model.declareOrder('kept-test', {});
  assert.ok(k.links.unlink(`part:${train.id}:${loose.id}`).ok);
  assert.deepEqual(k.links.members(train.id), [a.id, b.id]);
  assert.ok(w.things[loose.id]); // Law 2: leaving a group loses nothing
  assert.equal(k.links.link(a.id, c.id, 'part of').reason, 'Only a group can hold a part');
  assert.match(k.links.link(a.id, c.id, 'relation').reason, /phase 2/);
  assert.match(k.links.unlink(`rel:proust-links:${a.id}:${c.id}`).reason, /phase 2/);
  assert.equal(k.links.link(a.id, c.id, 'stands for').ok, false);
});

test('distance: a room\'s reader is others when locked, me now otherwise; declaring it locks and unlocks', () => {
  const { w, room, locked, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(READERS, ['me now', 'me later', 'others', 'machine']);
  assert.equal(k.distance.of(room.id), 'me now');
  assert.equal(k.distance.of(locked.id), 'others');
  assert.equal(k.distance.of('nowhere'), null);
  assert.ok(k.distance.declare(room.id, 'others').ok && w.things[room.id].locked);
  assert.ok(k.distance.declare(room.id, 'me now').ok && !w.things[room.id].locked);
  assert.equal(k.distance.declare(room.id, 'everyone').ok, false);
  assert.match(k.distance.declare(room.id, 'machine').reason, /phase 6/);
});

test('gaps: empty reads and refusals that name the phase, until the table exists', () => {
  const { a, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(DIRECTIONS, ['to world', 'from world', 'to maker']);
  assert.equal(k.gaps.of(a.id), null);
  assert.deepEqual(k.gaps.opened(), []);
  assert.equal(k.gaps.oldest(), null);
  assert.deepEqual(k.gaps.progress(a.id), { open: 0, resolved: 0, of: 0 });
  assert.match(k.gaps.open(a.id, 'to maker').reason, /phase 5/);
  assert.equal(k.gaps.open(a.id, 'sideways').ok, false);
  assert.match(k.gaps.resolve(a.id).reason, /phase 5/);
  assert.equal(service.saved, 0);
});

test('moments: made, edited and visited times read as one log, by mark, since a time and by day', () => {
  const { w, room, a, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.moments.of(a.id), [{ time: 4000, kind: 'made', mark: a.id }]);
  lib.model.update(w, a.id, { text: 'first, again' }, 4500);
  assert.deepEqual(k.moments.of(a.id).map((m) => m.kind), ['made', 'edited']);
  assert.deepEqual(k.moments.of(room.id).map((m) => [m.kind, m.time]), [['made', 2000], ['visited', 9000], ['visited', 9500]]);
  assert.deepEqual(k.moments.since(9000).map((m) => m.time), [9000, 9500]);
  assert.equal(k.moments.day(new Date(5000)).length, k.moments.since(0).length); // all on the day of the epoch, locally
  assert.deepEqual(k.moments.ahead(), []);
  assert.match(k.moments.due(a.id, 10000).reason, /phase 7/);
  assert.match(k.moments.revisit(a.id, 10000).reason, /phase 7/);
});

test('subscribing to a table hears saves and undos, and stops when the plugin is switched off', () => {
  const { service } = smallWorld();
  const listeners = new Map();
  const events = { on: (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]); return () => listeners.set(name, listeners.get(name).filter((f) => f !== fn)); } };
  const leaving = [];
  const k = kernel({ lib, world: service, events, gone: (fn) => leaving.push(fn) });
  const heard = [];
  const off = k.marks.on((change) => heard.push(change));
  k.links.on((change) => heard.push(change));
  for (const fn of listeners.get('world:saved')) fn();
  for (const fn of listeners.get('world:changed')) fn({ undone: true });
  assert.deepEqual(heard, [{ table: 'marks', undone: false }, { table: 'links', undone: false }, { table: 'marks', undone: true }, { table: 'links', undone: true }]);
  off();
  for (const fn of listeners.get('world:saved')) fn();
  assert.equal(heard.length, 5); // only links is still listening
  for (const fn of leaving) fn();
  assert.equal(listeners.get('world:saved').length, 0);
  assert.equal(kernel({ lib, world: service }).marks.on(() => {})(), undefined); // no events: nothing to hear, quietly
});
