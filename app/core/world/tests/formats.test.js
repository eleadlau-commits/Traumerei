// Tests for file formats (formats.js): the formats plugins add, asked as one thing.

import { test, assert } from 'folio/testing';
import { Slot } from 'folio/Slot.js';
import { formatsOf } from '../formats.js';

const fakeApp = () => ({ problems: [], report(owner, err) { this.problems.push([owner, err.message]); } });
const file = (name) => ({ name });

test('with no formats, nothing comes in or goes out, and nothing throws', async () => {
  const f = formatsOf(new Slot(fakeApp(), 'world.formats'));
  assert.equal(f.any, false);
  assert.equal(f.isRoomFile(file('a.traum')), false);
  assert.equal(await f.importRoom({ file: file('a.traum') }), null);
  assert.equal(await f.importInto('r', { file: file('a.traum') }), false);
  assert.equal(f.canExport, false);
  assert.equal(f.canEdit, false);
  assert.equal(await f.editRoom('r', {}), false);
  f.exportRoom('r');
  f.cancel();
});

test('a file goes to the format that accepts it; export and editing to the first that can', async () => {
  const slot = new Slot(fakeApp(), 'world.formats');
  const done = [];
  slot.add({ id: 'traum', name: 'Room file', accepts: (x) => x.name.endsWith('.traum'),
    importRoom: async (o) => ({ id: 'new', from: o.file?.name || 'picked' }), importInto: async () => true,
    exportRoom: (id) => done.push(`traum ${id}`), canEdit: () => true, editRoom: async () => true, cancel: () => done.push('cancel') }, 'roomfile');
  slot.add({ id: 'opml', name: 'Outline', accepts: (x) => x.name.endsWith('.opml'), importRoom: async () => ({ id: 'outline' }) }, 'opml');
  const f = formatsOf(slot);
  assert.equal(f.any, true);
  assert.deepEqual(f.list, [{ id: 'traum', name: 'Room file' }, { id: 'opml', name: 'Outline' }]);
  assert.equal(f.isRoomFile(file('x.opml')), true);
  assert.equal(f.isRoomFile(file('x.pdf')), false);
  assert.deepEqual(await f.importRoom({ file: file('a.opml') }), { id: 'outline' });
  assert.deepEqual(await f.importRoom({}), { id: 'new', from: 'picked' }); // no file: the first that can asks for one
  assert.equal(await f.importRoom({ file: file('a.pdf') }), null);
  assert.equal(await f.importInto('r', { file: file('a.opml') }), false); // Outline can't bring things into a room
  f.exportRoom('r1');
  f.cancel();
  assert.deepEqual(done, ['traum r1', 'cancel']);
  assert.equal(f.canEdit, true);
  assert.equal(await f.editRoom('r', {}), true);
});

test('a format that throws is reported against its plugin and treated as saying no', async () => {
  const app = fakeApp();
  const slot = new Slot(app, 'world.formats');
  slot.add({ id: 'bad', accepts: () => { throw new Error('broken accepts'); }, importRoom: () => { throw new Error('broken import'); },
    importInto: async () => { throw new Error('broken later'); } }, 'bad-plugin');
  const f = formatsOf(slot);
  assert.equal(f.isRoomFile(file('a.traum')), false);
  assert.equal(await f.importRoom({}), null);
  assert.equal(await f.importInto('r', {}), false);
  assert.deepEqual(app.problems.map((p) => p.join(': ')), ['bad-plugin: broken accepts', 'bad-plugin: broken import', 'bad-plugin: broken later']);
});

test('formats follow the slot as plugins come and go', () => {
  const slot = new Slot(fakeApp(), 'world.formats');
  const f = formatsOf(slot);
  const remove = slot.add({ id: 'traum', accepts: () => true, exportRoom() {} }, 'roomfile');
  assert.equal(f.canExport, true);
  remove();
  assert.equal(f.any, false);
  assert.equal(f.canExport, false);
});
