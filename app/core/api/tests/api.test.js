// Tests for the plugin API (v2.js): the list is exactly what app/core/API.md says, every name is
// really there in the world, the six kernel tables read and propose as KERNEL.md says, a plugin's
// additions are its own, and a plugin for another API can't connect. Version 1's flat names went
// in kernel phase 6: none of them is offered.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import * as M from '../../world/moments.js';
import { API_VERSION, surface, connect, kernel, SLOTS, TABLES, READERS, DIRECTIONS, ARCHIVE } from '../v2.js';

// Version 2, as API.md lists it. Changing the API means changing this and API.md together.
const V2 = {
  top: ['app', 'carriers', 'distance', 'gaps', 'links', 'marks', 'moments', 'parts', 'places', 'plugin', 'rules', 'slots', 'together', 'ui', 'version'],
  marks: ['delete', 'edit', 'get', 'in', 'make', 'ofKind', 'on', 'search', 'text'],
  places: ['home', 'in', 'loose', 'move', 'of', 'on', 'position', 'put', 'unplace'],
  rules: ['admit', 'draws', 'layout', 'list', 'moves'],
  links: ['count', 'fold', 'from', 'get', 'holders', 'kinds', 'link', 'members', 'named', 'on', 'order', 'standsFor', 'to', 'unlink'],
  carriers: ['check', 'land', 'list', 'read', 'replace', 'tables', 'text'],
  distance: ['all', 'declare', 'declared', 'of', 'on', 'readers', 'shut'],
  gaps: ['of', 'oldest', 'on', 'open', 'opened', 'progress', 'reopen', 'resolve'],
  moments: ['absorb', 'ahead', 'at', 'changed', 'clear', 'day', 'due', 'first', 'keep', 'kept', 'meet', 'next', 'note', 'of', 'on', 'outbox', 'placesAt', 'refuse', 'returns', 'revisit', 'seq', 'since'],
  slots: ['carriers', 'commands', 'editor', 'formats', 'kinds', 'linkKinds', 'more', 'rules'],
  ui: ['chosen', 'docks', 'download', 'frame', 'open', 'toast'],
  parts: ['arrows', 'groups', 'kinds', 'layout', 'lines', 'maths', 'model', 'pictures', 'relations', 'trains', 'twins', 'world'],
};
// The parts rules and views share, by name.
const PARTS = {
  model: ['DEFAULT_MODE', 'MESSY', 'addRoom', 'create', 'groupLabel', 'groupOf', 'groupsIn', 'groupsOf', 'hash', 'isGroup', 'isLeaf', 'isLooseGroup', 'itemsIn', 'join', 'kindOf', 'leave', 'members', 'parentOf', 'remove', 'replaceIn', 'room', 'roomItems', 'roomSetting', 'roomThoughts', 'search', 'seedRoomSettings', 'setOrder', 'setRoomSetting', 'setSpot', 'shut', 'spotOf', 'thoughtText', 'unsetSpot', 'update', 'view', 'within'],
  groups: ['inForeign', 'place', 'placedForeign', 'putAt', 'spot', 'spotsOf', 'trayForeign', 'unplace', 'unput', 'wait', 'waiting'],
  relations: ['RELATIONS', 'arrowsOf', 'cleanRelationList', 'cleanRelations', 'listText', 'relationEnds', 'relationEntry', 'relationName', 'relationShown', 'splitList', 'withRelation'],
  trains: ['STEP', 'setHeights', 'stepAfter'],
  lines: ['ENDS', 'ENDS_WORDS', 'HEAD', 'PAD', 'PAUSE', 'between', 'cleanEnds', 'facing', 'group', 'knot', 'labelSpot', 'layer', 'line', 'middle', 'path', 'sidePoint', 'slack', 'strand', 'svg'],
  arrows: ['arrowView'],
  maths: ['broken', 'maths'],
  layout: ['spiralPoint'],
  kinds: ['ITEMS', 'isKnown', 'kindFor'],
  twins: ['addTwin', 'isTwin', 'sides', 'twinOf'],
  pictures: ['keepOrShrink', 'shrinkPicture'],
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

test('version 2 is exactly the written list, and no v1 name is left', () => {
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib), lib });
  assert.equal(API_VERSION, 2);
  assert.equal(t.version, 2);
  assert.deepEqual(Object.keys(t).sort(), V2.top);
  for (const part of Object.keys(V2).filter((k) => k !== 'top')) assert.deepEqual(Object.keys(t[part]).sort(), V2[part], part);
  for (const part of Object.keys(PARTS)) assert.deepEqual(Object.keys(t.parts[part]).sort(), PARTS[part], part);
  for (const gone of ['world', 'save', 'write', 'load', 'data', 'model', 'groups', 'modes', 'items', 'commands', 'toast', 'docks', 'frame', 'open', 'floors']) assert.ok(!(gone in t), gone);
  assert.deepEqual(TABLES, ['marks', 'places', 'links', 'distance', 'gaps', 'moments']);
  assert.equal(t.ui.chosen(), null); // no room shows in a test
  assert.equal(t.ui.frame, null); // no frame in this app
  assert.deepEqual(Object.keys(SLOTS).sort(), V2.slots);
});

test('every name is the world\'s own, and the API can\'t be changed by a plugin', () => {
  const parts = surface(lib);
  assert.equal(parts.model.create, lib.model.create);
  assert.equal(parts.arrows.arrowView, lib.arrowview.arrowView);
  assert.equal(parts.layout.spiralPoint, lib.pessoa.spiralPoint);
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts, lib });
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.parts.model) && Object.isFrozen(t.slots.rules));
  assert.throws(() => { 'use strict'; t.parts.model.create = null; });
});

test('a name the world no longer has fails loudly, naming it', () => {
  const broken = { ...lib, model: { ...lib.model, view: undefined } };
  delete broken.model.view;
  assert.throws(() => surface(broken), /model has no "view"/);
});

test('what a plugin adds is its own, and can be taken away', () => {
  const app = fakeApp();
  const t = connect({ app, world, plugin: plugin('haiku'), parts: surface(lib), lib });
  const remove = t.slots.rules.add({ id: 'haiku' });
  t.slots.commands.add({ id: 'haiku.go', keys: ['Ctrl+Alt+H'] });
  t.slots.editor.add({ id: 'haiku-lines' });
  t.slots.more.add({ id: 'haiku-more' });
  t.slots.kinds.add({ kind: 'haiku' });
  t.slots.carriers.add({ id: 'haiku-cloud', name: 'Haiku cloud', moves: 'moments' });
  assert.deepEqual(app.slot('world.ontologies').items.map((e) => e.owner), ['haiku']);
  for (const slot of ['keys', 'rail.more', 'world.items', 'room.editor', 'world.carriers']) assert.equal(app.slot(slot).items[0].owner, 'haiku', slot);
  remove();
  assert.equal(app.slot('world.ontologies').items.length, 0);
});

test('the world the parts read is the one there is now; the app and the plugin say who they are', () => {
  const w = lib.model.emptyWorld();
  const own = { world: w, saved: 0, save() { this.saved++; return true; } };
  const t = connect({ app: fakeApp(), world: own, plugin: plugin('haiku'), parts: surface(lib), lib });
  assert.equal(t.parts.world(), w);
  const fresh = lib.model.emptyWorld();
  own.world = fresh; // read back from storage: a new world object
  assert.equal(t.parts.world(), fresh); // never a stale world (the lesson of PR #194)
  assert.ok(t.marks.make({ kind: 'line', content: 'into the fresh one', in: lib.model.MESSY }).ok);
  assert.equal(lib.model.roomItems(fresh, lib.model.MESSY).length, 1);
  assert.deepEqual(t.app, { name: 'Träumerei', version: '1.0.0' });
  assert.deepEqual(t.plugin, { id: 'haiku', name: 'Haiku' });
});

test('a plugin written for another API can\'t connect, and says why', () => {
  assert.throws(() => connect({ app: fakeApp(), world, plugin: plugin('later', 3), parts: surface(lib), lib }),
    /Later is written for plugin API 3; this app offers 2/);
  assert.throws(() => connect({ app: fakeApp(), world, plugin: plugin('older', 1), parts: surface(lib), lib }),
    /Older is written for plugin API 1, which is gone; this app offers 2/);
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
  const d = t.ui.docks;
  assert.deepEqual(Object.keys(d.right).sort(), ['close', 'isOpen', 'isShowing', 'open', 'show']);
  let closed = 0;
  await d.right.open({ key: 'time', body: null, onClose: () => closed++ });
  await d.left.open({ key: 'notes', body: null });
  await d.right.open({ key: 'gone-soon', body: null });
  await d.right.close('gone-soon');
  assert.ok(d.right.isOpen('time') && d.left.isOpen('notes'));
  for (const fn of leaving) fn(); // the plugin is switched off
  assert.equal(docks.right.open_.size, 0);
  assert.equal(docks.left.open_.size, 0);
  assert.equal(closed, 1); // its own onClose still runs
});

test('without docks there are none, and a tab needs a key', async () => {
  const none = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), lib });
  assert.equal(none.ui.docks, null);
  const t = connect({ app: fakeApp(), world, plugin: plugin('time'), parts: surface(lib), lib, docks: { left: fakeDock(), right: null } });
  assert.equal(t.ui.docks.right, null);
  let refused = null;
  try { await t.ui.docks.left.open({ body: null }); } catch (err) { refused = err.message; }
  assert.equal(refused, 'A dock tab needs a key');
});

test('rules, a command\'s keys, the frame and going somewhere, for a plugin', () => {
  const joyce = { id: 'joyce' }, russell = { id: 'russell' };
  const w = lib.model.emptyWorld();
  const own = { world: w, ontologies: [joyce, russell], globals: { joyce: { gap: 2 } }, ontology: (id) => (id === 'russell' ? russell : joyce), save() { return true; } };
  const shown = [], went = [], leaving = [];
  const frame = { show: (o, x) => shown.push(['show', o.id, x.idle]), update: (o, x) => shown.push(['update', o.id, x.idle]),
    hide: (o) => shown.push(['hide', o.id]), hint: (s) => shown.push(['hint', s]), clearHint: () => shown.push(['clear']) };
  const keys = { label: (id) => (id === 'haiku.go' ? 'Ctrl+Alt+H' : '') };
  const services = { create: { open: () => went.push('rooms') }, rooms: { openRoom: (id) => went.push(id) } };
  const t = connect({ app: fakeApp(), world: own, plugin: plugin('haiku'), parts: surface(lib), lib, keys, frame,
    service: (name) => services[name] || null, gone: (fn) => leaving.push(fn) });
  assert.equal(t.slots.rules.get('russell'), russell);
  assert.equal(t.slots.rules.get('nowhere'), joyce);
  assert.deepEqual(t.slots.rules.all.map((o) => o.id), ['joyce', 'russell']);
  assert.deepEqual(t.slots.rules.settings, { joyce: { gap: 2 } });
  assert.equal(t.slots.commands.label('haiku.go'), 'Ctrl+Alt+H');
  assert.equal(t.slots.commands.label('other'), '');
  t.ui.frame.show({ idle: 'Haiku' });
  t.ui.frame.update({ idle: 'Five' });
  t.ui.frame.hint('Saved a haiku');
  t.ui.open.rooms();
  t.ui.open.room('messy');
  assert.deepEqual(went, ['rooms', 'rooms', 'messy']);
  for (const fn of leaving) fn(); // switched off: its frame goes too
  assert.deepEqual(shown, [['show', 'haiku', 'Haiku'], ['update', 'haiku', 'Five'], ['hint', 'Saved a haiku'], ['hide', 'haiku']]);
});

test('without keys, a frame or the rooms page, those parts do nothing quietly', () => {
  const t = connect({ app: fakeApp(), world, plugin: plugin('haiku'), parts: surface(lib), lib });
  assert.equal(t.slots.commands.label('anything'), '');
  assert.equal(t.ui.frame, null);
  t.ui.open.rooms();
  t.ui.open.room('messy');
});

// ---- The six tables (v2.js's kernel), over a small world ----

test('ui.open.mark goes into the room a mark is at home in and asks the room for the view on it', () => {
  const { room, a, c, locked, service } = smallWorld();
  const went = [], looked = [];
  const services = { create: { open: () => went.push('rooms') }, rooms: { openRoom: (id) => went.push(id) } };
  const t = connect({ app: fakeApp(), world: service, plugin: plugin('desk'), parts: surface(lib), lib,
    service: (name) => services[name] || null, room: () => ({ go: (id, r) => looked.push([id, r]) }) });
  assert.equal(t.ui.open.mark(c.id), true);
  assert.equal(t.ui.open.mark(a.id), true); // in a train: still at home in the room
  assert.equal(t.ui.open.mark(locked.id), true); // a room: into it, no mark to look at
  assert.equal(t.ui.open.mark('nowhere'), false);
  assert.deepEqual(went, ['rooms', room.id, 'rooms', room.id, 'rooms', locked.id]);
  assert.deepEqual(looked, [[c.id, room.id], [a.id, room.id]]);
});


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
  // A rule that draws relations (as Proust does), and one arrow of its own from a up to c.
  lib.relations.arrowsOf({ of: 'proust', store: 'proust-links', isNode: (x, r, id) => !!x.things[id] && lib.model.isLeaf(x.things[id]), nodes: (x, r) => lib.model.roomItems(x, r), loops: true, noun: 'link' });
  lib.links.set(w, lib.links.relId('proust-links', a.id, c.id), { from: a.id, to: c.id, kind: 'relation', rule: 'proust-links', label: 'calls up', note: 'why' });
  const locked = lib.model.addRoom(w, 'Vault', 8000);
  lib.model.lock(w, locked.id);
  // The moments log begins on this world, and knows of two visits (as the world service reads it).
  const log = M.emptyLog(1000, M.stateOf(w));
  M.visit(log, room.id, 9000);
  M.visit(log, room.id, 99000);
  const moments = { get log() { return log; }, of: (id) => M.of(log, id), since: (t) => M.since(log, t), changed: (id) => M.changed(log, id), at: (t) => M.stateAt(log, t), first: () => M.first(log), get keep() { return log.keep; }, setKeep: (d) => { log.keep = d; },
    outbox: (seq) => (seq == null ? M.whole(M.stateOf(w), 1) : M.outbox(log, seq)), absorb: (list) => M.absorb(log, M.stateOf(w), list) };
  const service = { world: w, lib, saved: 0, save() { this.saved++; return true; }, ontologies: [{ id: 'joyce' }, { id: 'pessoa', lays: true }, { id: 'proust', lays: true }], moments };
  return { w, room, train, a, b, c, loose, locked, service, log };
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

test('rules: each mode read as the kernel sees it: layout from the rows, admit in words, moves, draws; frozen', () => {
  const { w, room, train, a, b, c, locked, service } = smallWorld();
  service.ontologies = lib.ontologies.BUILT_IN;
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.rules.list().map((r) => r.id), ['joyce', 'pessoa']);
  const at = k.rules.layout('joyce', room.id);
  assert.ok(Object.isFrozen(at) && at.some((p) => p.mark === a.id && p.rule === 'joyce'));
  assert.deepEqual(at.find((p) => p.mark === a.id).position, lib.ontologies.BUILT_IN[0].point(w, room.id, a.id));
  assert.deepEqual(k.rules.admit('pessoa', { kind: 'place', mark: c.id, context: room.id, position: { x: 1, y: 2 } }), { ok: true });
  assert.match(k.rules.admit('pessoa', { kind: 'place', mark: c.id, context: locked.id }).reason, /locked|not in that context/);
  assert.equal(k.rules.admit('nowhere', {}).ok, false);
  assert.ok(k.rules.moves('joyce', room.id, a.id).some((m) => m.id === 'group'));
  assert.deepEqual(k.rules.draws('joyce', room.id).lines.find((l) => l.includes(a.id)), lib.model.members(w, train.id).map((m) => m.id));
  assert.deepEqual(k.rules.layout('nowhere', room.id), []);
});

test('places: a home row per mark and a row per rule, rooms on floors or in the archive, loose means no rule row', () => {
  const { w, room, train, a, b, c, loose, locked, service } = smallWorld();
  const k = kernel({ lib, world: service });
  const home = (mark, context = room.id, position = null) => ({ mark, context, rule: null, position });
  assert.deepEqual(k.places.of(a.id), [home(a.id), { mark: a.id, context: room.id, rule: 'joyce', position: { group: train.id, index: 0 } }]);
  assert.deepEqual(k.places.of(c.id), [home(c.id), { mark: c.id, context: room.id, rule: 'pessoa', position: { x: 300, y: 400 } }]);
  assert.deepEqual(k.places.of(train.id), [home(train.id), { mark: train.id, context: room.id, rule: 'joyce', position: { x: 10, y: 20 } }]);
  assert.deepEqual(k.places.of(loose.id), [home(loose.id)]);
  assert.equal(k.places.home(loose.id), room.id);
  assert.deepEqual(ids(k.places.loose(room.id)), [loose.id]);
  assert.deepEqual(ids(k.places.in(room.id, 'joyce')).sort(), [train.id, a.id, b.id].sort());
  assert.equal(k.places.in(room.id).filter((p) => p.rule != null).length, 4);
  assert.equal(k.places.in(room.id).filter((p) => p.rule == null).length, lib.model.children(w, room.id).length);
  assert.deepEqual(k.places.position(a.id, room.id, 'joyce'), { group: train.id, index: 0 });
  assert.equal(k.places.position(a.id, room.id, 'pessoa'), null);
  assert.deepEqual(k.places.of(room.id), [home(room.id, 'floor:0')]); // no cell yet: no 'borges' row (loose under that rule)
  lib.model.setCell(w, room.id, 3, 1);
  assert.deepEqual(k.places.of(room.id), [home(room.id, 'floor:0'), { mark: room.id, context: 'floor:0', rule: 'borges', position: { col: 3, row: 1 } }]);
  lib.model.archive(w, room.id, 9999);
  assert.deepEqual(k.places.of(room.id), [home(room.id, ARCHIVE, { at: 9999, floor: 0 })]);
  lib.model.restore(w, room.id);
  // A room is put on a floor or in the Archive, nowhere else.
  assert.equal(k.places.put(room.id, locked.id).ok, false);
  assert.ok(k.places.put(room.id, ARCHIVE).ok);
  assert.ok(k.places.put(room.id, 'floor:0').ok);
  assert.equal(k.places.home(room.id), 'floor:0');
  // Proposals: lay the loose thought under Pessoa; unplace it again; move it to another room.
  assert.ok(k.places.put(loose.id, room.id, 'pessoa', { x: 1, y: 2 }).ok);
  assert.deepEqual(k.places.position(loose.id, room.id, 'pessoa'), { x: 1, y: 2 });
  assert.ok(k.places.unplace(loose.id, room.id).ok);
  assert.deepEqual(k.places.of(loose.id).filter((p) => p.rule !== 'tray'), [home(loose.id)]); // unplaced (it waits in the tray), never lost (Law 2)
  assert.equal(k.places.put(loose.id, locked.id).ok, false);
  assert.equal(k.places.move(loose.id, locked.id, 'messy').reason, 'The mark is not in that context');
  assert.ok(k.places.move(loose.id, room.id, 'messy').ok);
  assert.equal(lib.model.parentOf(w, loose.id), 'messy');
  assert.ok(w.things[loose.id]); // Law 2: moving never loses a mark
});

test('links: part-of rows with order and relation rows with their names; join, leave and reorder', () => {
  const { w, room, train, a, b, c, loose, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.links.kinds(), ['part of', 'stands for', 'relation']);
  assert.deepEqual(k.links.members(train.id), [a.id, b.id]);
  assert.deepEqual(k.links.holders(a.id), [train.id]);
  assert.deepEqual(k.links.from(a.id), [
    { id: `part:${train.id}:${a.id}`, from: a.id, to: train.id, kind: 'part of', order: 0 },
    { id: `rel:proust-links:${a.id}:${c.id}`, from: a.id, to: c.id, kind: 'relation', rule: 'proust-links', label: 'calls up', note: 'why' },
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
  // Relations go through the rule that draws them (its loops rule, its words), as rows of the table.
  assert.match(k.links.link(a.id, c.id, 'relation').reason, /needs the rule/);
  assert.match(k.links.link(b.id, c.id, 'relation', 'recalls', { rule: 'nowhere' }).reason, /No rule/);
  assert.equal(k.links.link(b.id, c.id, 'relation', 'recalls', { rule: 'proust-links', note: 'because' }).ok, true);
  assert.deepEqual(k.links.get(`rel:proust-links:${b.id}:${c.id}`), { id: `rel:proust-links:${b.id}:${c.id}`, from: b.id, to: c.id, kind: 'relation', rule: 'proust-links', label: 'recalls', note: 'because' });
  assert.match(k.links.link(b.id, c.id, 'relation', 'recalls', { rule: 'proust-links' }).reason, /already there/);
  assert.ok(k.links.unlink(`rel:proust-links:${a.id}:${c.id}`).ok);
  assert.deepEqual(k.links.to(c.id, 'relation').map((l) => l.from), [b.id]);
  assert.equal(k.links.unlink(`rel:proust-links:${a.id}:${c.id}`).reason, 'No such link');
  // A fold: a new mark stands for the folded ones, which stay in the world but show nowhere (Law 2).
  assert.match(k.links.link(a.id, b.id, 'stands for').reason, /fold/);
  const folded = k.links.fold(room.id, [a.id, b.id]);
  assert.ok(folded.ok);
  assert.deepEqual(k.links.standsFor(folded.id), [a.id, b.id]);
  assert.deepEqual(k.links.members(train.id), [folded.id]);
  assert.ok(k.marks.get(a.id) && !k.marks.in(room.id).some((m) => m.id === a.id), 'kept, but shown nowhere');
  assert.equal(k.links.from(folded.id, 'stands for').length, 2);
  assert.ok(k.links.unlink(`for:${folded.id}:${b.id}`).ok); // b comes back, loose
  assert.deepEqual(k.links.standsFor(folded.id), [a.id]);
  assert.ok(k.places.loose(room.id).some((m) => m.id === b.id));
  assert.equal(k.links.link(a.id, c.id, 'about').reason, 'No such kind of link: about. A plugin declares one with slots.linkKinds.add({ kind, name })');
});

test('distance: a table of readers, inherited down; Lock is a room for others; every reader can be declared', () => {
  const { w, room, locked, a, service } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(READERS, ['me now', 'me later', 'others', 'machine']);
  assert.deepEqual(k.distance.readers(), READERS);
  assert.equal(k.distance.of(room.id), 'me now');
  assert.equal(k.distance.of(locked.id), 'others');
  assert.equal(k.distance.of('nowhere'), null);
  assert.equal(k.distance.of(a.id), 'me now');
  assert.deepEqual(k.distance.all(), [{ context: locked.id, reader: 'others' }]);
  assert.ok(k.distance.declare(room.id, 'others').ok && lib.model.shut(w, room.id) && k.distance.shut(a.id), 'a mark inherits its room\'s reader');
  assert.equal(k.distance.of(a.id), 'others');
  assert.ok(k.distance.declare(room.id, 'me now').ok && !lib.model.shut(w, room.id) && k.distance.declared(room.id) === null);
  assert.equal(k.distance.declare(room.id, 'everyone').ok, false);
  assert.ok(k.distance.declare(room.id, 'me later').ok && !k.distance.shut(a.id) && k.distance.of(a.id) === 'me later');
  assert.ok(k.distance.declare('floor:0', 'machine').ok && k.distance.of(a.id) === 'machine' && k.distance.shut(room.id), 'a floor\'s reader reaches every room on it');
  assert.equal(k.distance.declare(a.id, 'others').ok, false, 'a line is not a context');
  assert.ok(Object.isFrozen(k.distance.all()[0]));
});

test('gaps: one row per mark, open or resolved, landing as steps; a mark with gapped parts reads a derived gap', () => {
  const { a, b, c, train, room, locked, service } = smallWorld();
  const w = service.world;
  const k = kernel({ lib, world: service });
  assert.deepEqual(DIRECTIONS, ['to world', 'from world', 'to maker']);
  assert.equal(k.gaps.of(a.id), null);
  assert.deepEqual(k.gaps.opened(), []);
  assert.equal(k.gaps.oldest(), null);
  assert.deepEqual(k.gaps.progress(a.id), { open: 0, resolved: 0, of: 0 });
  assert.equal(k.gaps.open(a.id, 'sideways').ok, false);
  assert.equal(k.gaps.open('nothing', 'to maker').ok, false);
  assert.equal(k.gaps.resolve(a.id).ok, false); // nothing open
  assert.equal(service.saved, 0);
  // Open: a row, a step; a second open on the same mark refuses (Law 5).
  assert.ok(k.gaps.open(a.id, 'from world').ok && service.saved === 1);
  assert.deepEqual({ ...k.gaps.of(a.id), openedAt: 0 }, { id: `gap:${a.id}`, mark: a.id, direction: 'from world', state: 'open', openedAt: 0 });
  assert.ok(Object.isFrozen(k.gaps.of(a.id)));
  assert.match(k.gaps.open(a.id, 'to maker').reason, /One open gap/);
  assert.ok(k.gaps.open(b.id, 'to world').ok);
  assert.deepEqual(k.gaps.opened().map((r) => r.mark), [a.id, b.id]);
  assert.deepEqual(k.gaps.opened(room.id).map((r) => r.mark), [a.id, b.id]);
  assert.deepEqual(k.gaps.opened(locked.id), []);
  assert.equal(k.gaps.oldest().mark, a.id);
  // The train holds a and b (part of): its gap is derived, open, with progress; it cannot be opened or resolved itself.
  assert.deepEqual(k.gaps.progress(train.id), { open: 2, resolved: 0, of: 2 });
  assert.equal(k.gaps.of(train.id).state, 'open');
  assert.ok(k.gaps.of(train.id).derived);
  assert.match(k.gaps.open(train.id, 'from world').reason, /derived/);
  assert.match(k.gaps.resolve(train.id).reason, /2 of 2 parts/);
  // c is above a by a relation (a → c): its gap is derived too.
  assert.deepEqual(k.gaps.progress(c.id), { open: 1, resolved: 0, of: 1 });
  // Resolve by a link that exists, or by judgement; by a link that does not refuses.
  assert.equal(k.gaps.resolve(a.id, 'rel:nowhere').ok, false);
  assert.ok(k.gaps.resolve(a.id, lib.links.relId('proust-links', a.id, c.id)).ok);
  assert.equal(k.gaps.of(a.id).resolvedBy, lib.links.relId('proust-links', a.id, c.id));
  assert.ok(k.gaps.resolve(b.id).ok && k.gaps.of(b.id).resolvedBy === 'judgement');
  assert.deepEqual(k.gaps.progress(train.id), { open: 0, resolved: 2, of: 2 });
  assert.equal(k.gaps.of(train.id).state, 'resolved');
  assert.equal(k.gaps.of(c.id).state, 'resolved');
  assert.deepEqual(k.gaps.opened(), []);
  // Reopen keeps the direction; a locked room's marks refuse; the rows are in the moments table.
  assert.ok(k.gaps.reopen(a.id).ok && k.gaps.of(a.id).state === 'open' && k.gaps.of(a.id).direction === 'from world');
  assert.equal(k.gaps.reopen(a.id).ok, false);
  const inVault = lib.model.create(w, locked.id, { kind: 'line', text: 'shut' }, 10000);
  assert.ok(inVault == null || k.gaps.open(inVault.id, 'to maker').ok === false);
  assert.ok(w.gaps[`gap:${a.id}`].state === 'open');
});
test('moments: the log read by mark, since a time and by day; a mark older than the log keeps its made and edited times', () => {
  const { w, room, a, b, locked, service, log } = smallWorld();
  const k = kernel({ lib, world: service });
  assert.deepEqual(k.moments.of(a.id), [{ time: 4000, kind: 'made', mark: a.id }]);
  const before = M.stateOf(JSON.parse(JSON.stringify(w)));
  lib.model.update(w, a.id, { text: 'first, again' }, 4500);
  M.record(log, before, M.stateOf(w), 4500); // as the world service does on save()
  assert.deepEqual(k.moments.of(a.id).map((m) => [m.kind, m.time, m.step]), [['made', 4000, undefined], ['edited', 4500, 3]]);
  assert.deepEqual(k.moments.of(room.id).map((m) => [m.kind, m.time]), [['made', 2000], ['visited', 9000], ['visited', 99000]]);
  assert.deepEqual(k.moments.since(9000).map((m) => m.time), [9000, 99000]);
  assert.equal(k.moments.day(new Date(5000)).length, k.moments.since(0).length); // all on the day of the epoch, locally
  assert.ok(k.moments.since(0).every(Object.isFrozen));
  assert.equal(k.moments.changed(a.id), 4500);
  assert.equal(k.moments.changed(room.id), 2000); // older than the log: its made time
  assert.equal(k.moments.first(), 1000);
  assert.deepEqual(k.moments.at(4000).find((m) => m.id === a.id).text, 'first'); // replayed from the log's base
  assert.equal(k.moments.at(5000).find((m) => m.id === a.id).text, 'first, again');
  assert.equal(k.moments.kept(), 365);
  assert.equal(k.moments.keep(-1).ok, false);
  assert.ok(k.moments.keep(30).ok);
  assert.equal(k.moments.kept(), 30);
  // a carrier: the rows since a seq, the whole world, and rows taken in
  assert.equal(k.moments.seq(), 3);
  assert.deepEqual(k.moments.outbox(2).map((m) => [m.kind, m.mark]), [['edited', a.id]]);
  assert.ok(k.moments.outbox(null).length > 5 && k.moments.outbox(null).every((m) => m.kind === 'made' || m.kind === 'linked' || m.kind === 'moved' || m.kind === 'declared' || m.kind === 'arranged'));
  assert.ok(k.moments.outbox(null).some((m) => m.kind === 'linked' && m.link), 'the whole world carries its links as rows');
  const taken = k.moments.absorb([{ kind: 'edited', table: 'marks', mark: a.id, time: 6000, after: { ...w.things[a.id], text: 'from afar' } }]);
  assert.deepEqual(taken, { ok: true, id: 'moments', landed: 1 });
  assert.equal(k.marks.text(a.id), 'from afar');
  assert.equal(k.moments.absorb('no').ok, false);
  // moments ahead (phase 7): asked for, come back, answered; each a saved step or a refusal
  assert.deepEqual(k.moments.ahead(), []);
  const saved = service.saved;
  assert.deepEqual(k.moments.due(a.id, 10000), { ok: true, id: `ahead:${a.id}` });
  assert.ok(k.moments.revisit(b.id, 20000, 'look again').ok);
  assert.ok(k.moments.note(room.id, 'start from the second draft').ok);
  assert.equal(service.saved, saved + 3);
  assert.deepEqual(ids(k.moments.ahead()), [a.id, b.id, room.id]); // soonest first, the next-visit note last
  assert.deepEqual(ids(k.moments.ahead(room.id)), [a.id, b.id, room.id].filter((m) => m === room.id || lib.places.home(w, m) === room.id));
  assert.ok(Object.isFrozen(k.moments.next(a.id)) && k.moments.next(a.id).kind === 'due');
  assert.equal(k.moments.due(a.id, 'soon').ok, false);
  assert.equal(k.moments.note(a.id, '  ').ok, false);
  assert.equal(k.moments.due('nope', 1).ok, false);
  assert.equal(k.moments.due(locked.id, 1).ok, false, 'a locked mark is not asked to come back');
  assert.match(k.moments.refuse(a.id).reason, /not come back/);
  lib.ahead.come(w, 15000);
  assert.deepEqual(ids(k.moments.returns()), [a.id]);
  assert.ok(k.moments.refuse(a.id).ok);
  assert.deepEqual(k.moments.returns(), []);
  assert.equal(k.moments.next(a.id).state, 'refused');
  assert.match(k.moments.meet(a.id).reason, /Answered already/);
  assert.ok(k.moments.clear(b.id).ok);
  assert.equal(k.moments.next(b.id), null);
});

test('subscribing to a table hears the rows that land in its table, and stops when the plugin is switched off', () => {
  const { service, a, room } = smallWorld();
  const listeners = new Map();
  const events = { on: (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]); return () => listeners.set(name, listeners.get(name).filter((f) => f !== fn)); } };
  const leaving = [];
  const k = kernel({ lib, world: service, events, gone: (fn) => leaving.push(fn) });
  const heard = [];
  const off = k.marks.on((change) => heard.push(change));
  k.links.on((change) => heard.push(change));
  const landed = (rows, undone = false) => { for (const fn of listeners.get('world:moments')) fn({ rows, undone }); };
  landed([{ seq: 1, time: 1, kind: 'edited', table: 'marks', mark: a.id, step: 1 }, { seq: 2, time: 1, kind: 'linked', table: 'links', mark: room.id, step: 1 }]);
  landed([{ seq: 3, time: 2, kind: 'moved', table: 'places', mark: a.id, step: 3 }]); // nobody listens to places
  landed([{ seq: 4, time: 3, kind: 'edited', table: 'marks', mark: a.id, step: 1 }, { seq: 5, time: 3, kind: 'undone', table: 'moments', step: 1 }], true);
  assert.deepEqual(heard.map((h) => [h.table, h.undone, h.rows.map((r) => r.kind)]), [['marks', false, ['edited']], ['links', false, ['linked']], ['marks', true, ['edited']]]);
  assert.ok(Object.isFrozen(heard[0]) && Object.isFrozen(heard[0].rows[0]));
  off();
  landed([{ seq: 6, time: 4, kind: 'edited', table: 'marks', mark: a.id, step: 6 }, { seq: 7, time: 4, kind: 'arranged', table: 'links', context: room.id, step: 6 }]);
  assert.equal(heard.length, 4); // only links is still listening
  for (const fn of leaving) fn();
  assert.equal(listeners.get('world:moments').length, 0);
  assert.equal(kernel({ lib, world: service }).marks.on(() => {})(), undefined); // no events: nothing to hear, quietly
});
