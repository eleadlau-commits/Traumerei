// Tests for Pictures (item.js): a whole item kind, made from a file and written in its fields,
// and a room with pictures that goes out as a .traum file and comes back the same whether the
// plugin is on or off.

import { test, assert } from 'folio/testing';
import { ui } from 'folio';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v2.js';
import { picture } from '../item.js';
import { ITEMS, BUILT_IN, setKinds, lacks, kindFor } from '../../world/items/index.js';
import { emptyWorld, create, addRoom, roomItems, thoughtText, MESSY } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { landTables, tablesOf } from '../../world/model.js';
import * as X from '../../world/traum.js';

const t = surface(lib);
const shrunk = [];
const kind = picture({ maths: t.maths.maths, shrinkPicture: async (file) => { shrunk.push(file.name); return 'data:image/jpeg;base64,SMALL'; } });
const SRC = 'data:image/jpeg;base64,AAAA';

// Each test sets the kinds it needs, and puts back what was there (the tests share one page).
const withKinds = (kinds, fn) => async () => {
  const before = Object.values(ITEMS).filter((k) => !BUILT_IN.includes(k));
  setKinds(kinds);
  try { await fn(); } finally { setKinds(before); }
};

test('Pictures is a whole item kind, made from a file and written in its fields', withKinds([kind], async () => {
  assert.deepEqual(lacks(kind), []);
  assert.equal(ITEMS.picture, kind);
  assert.deepEqual(kind.fields.map((f) => [f.key, f.type]), [['src', 'image'], ['text', 'line']]);
  assert.deepEqual(kind.add.keys, ['Alt+I']);
  assert.equal(kind.add.file, 'image/*');
  assert.ok(kind.takes({ type: 'image/png' }));
  assert.equal(kind.takes({ type: 'text/plain' }), false);
  assert.deepEqual(await kind.fromFile({ name: 'dusk.png', type: 'image/png' }), { src: 'data:image/jpeg;base64,SMALL', text: '' });
  assert.deepEqual(shrunk, ['dusk.png']);
  assert.equal(kind.step, 270);
}));

test('a picture needs an image; its caption is its words', withKinds([kind], () => {
  const w = emptyWorld(1);
  assert.equal(create(w, MESSY, { kind: 'picture', src: 'javascript:x' }), null);
  const th = create(w, MESSY, { kind: 'picture', src: SRC, text: '  dusk  ' }, 2);
  assert.equal(th.text, 'dusk');
  assert.equal(thoughtText(w, th), '[dusk]');
  assert.equal(kind.label(th), 'dusk');
  assert.equal(kind.label({ src: SRC }), 'A picture');
  const node = kind.node(th, ui.el);
  assert.equal(node.querySelector('img').getAttribute('src'), SRC);
  assert.equal(node.querySelector('figcaption').textContent, 'dusk');
}));

// A room with a line and a picture, written out.
function roomWithPicture() {
  const w = emptyWorld(1);
  const r = addRoom(w, 'Sketches', 1, {}, 'pessoa');
  create(w, r.id, { kind: 'line', text: 'a thought' }, 2);
  create(w, r.id, { kind: 'picture', src: SRC, text: 'dusk' }, 3);
  return { w, r };
}
// A room out as .traum text, and a text read into a fresh world (the carrier: Law 8, no plugin).
const exportRoom = (w, id) => X.write(tablesOf(w, id), { root: id });
const readBack = (text) => {
  const w = emptyWorld(1);
  const got = X.read(text);
  const out = landTables(w, got.tables, got.root, { now: 5 });
  return { w, room: { id: out.id }, report: got.report };
};

test('a room with pictures goes out and comes back the same, with Pictures on', withKinds([kind], () => {
  const { w, r } = roomWithPicture();
  const once = exportRoom(w, r.id);
  assert.match(once, /\nsrc: data:image\/jpeg;base64,AAAA\n\ndusk\n/);
  const back = readBack(once);
  assert.deepEqual(back.report, []);
  assert.equal(exportRoom(back.w, back.room.id), once);
  assert.deepEqual(roomItems(back.w, back.room.id).map((th) => th.kind), ['line', 'picture']);
}));

test('with Pictures off, a picture is kept as it is, shows as a stand-in, and goes out and back the same', withKinds([kind], () => {
  const { w, r } = roomWithPicture();
  const on = exportRoom(w, r.id);
  setKinds([]); // Pictures is switched off
  const pic = roomItems(w, r.id).find((th) => th.kind === 'picture');
  assert.equal(pic.src, SRC); // nothing lost
  assert.ok(kindFor('picture').missing);
  assert.equal(kindFor('picture').fields, undefined); // nothing to write in: the room offers no sheet for it
  assert.ok(kindFor('picture').node(pic, ui.el).classList.contains('st-off'));
  assert.equal(exportRoom(w, r.id), on); // the same rows: a carrier needs no plugin
  setKinds([kind]); // on again: the same thought is a picture again
  assert.equal(thoughtText(w, pic), '[dusk]');
  assert.equal(exportRoom(w, r.id), on);
}));

test('a file read while Pictures is off keeps its pictures as they were written, and writes them back out', withKinds([kind], () => {
  const { w, r } = roomWithPicture();
  const on = exportRoom(w, r.id);
  setKinds([]);
  const back = readBack(on);
  assert.deepEqual(back.report, []);
  assert.equal(exportRoom(back.w, back.room.id), on);
}));
