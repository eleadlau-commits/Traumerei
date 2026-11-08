// The gate of kernel phase 3 for files (KERNEL.md, Law 8 on its way): every sample room read in
// and written out, then read in again and written out again, gives the same bytes, now that a
// room's floor, the Archive and every thought's room are rows of the places table. A world saved
// before the table and read back gives the same file too.

import { test, assert } from 'folio/testing';
import russell from '../../russell/rules.js';
import { proust } from '../../proust/rules.js';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
import { bind as bindProust } from '../../proust/world.js';
import { bind } from '../world.js';
import { emptyWorld, loadWorld, archive, restore, addPage, toPage, floorOf } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { parse } from '../grammar.js';
import { importRoom, exportRoom } from '../traum.js';
import { SAMPLES } from './samples.js';

bindRussell(surface(lib));
bindProust(surface(lib));
bind(surface(lib));
const ontologies = gather([russell, proust]);
const read = (w, text) => importRoom(w, parse(text), { ontologies, now: 1000 });
const write = (w, id) => exportRoom(w, id, { ontologies });

test('every sample room round-trips byte for byte: in, out, in again, out again', () => {
  assert.ok(Object.keys(SAMPLES).length >= 5);
  for (const [name, text] of Object.entries(SAMPLES)) {
    const w = emptyWorld(1);
    const once = write(w, read(w, text).room.id);
    const v = emptyWorld(1);
    const twice = write(v, read(v, once).room.id);
    assert.equal(twice, once, `${name}: the second trip changed the file`);
  }
});

test('where a room is does not leak into its file: another floor, the Archive and back, a reload', () => {
  for (const [name, text] of Object.entries(SAMPLES)) {
    const w = emptyWorld(1);
    const { room } = read(w, text);
    const once = write(w, room.id);
    addPage(w, 2);
    assert.ok(toPage(w, room.id, 1));
    assert.equal(write(w, room.id), once, `${name}: on another floor`);
    assert.ok(archive(w, room.id, 3));
    assert.equal(write(w, room.id), once, `${name}: in the Archive`);
    assert.ok(restore(w, room.id));
    assert.equal(floorOf(w, room.id), 1);
    const back = loadWorld(JSON.parse(JSON.stringify(w)));
    assert.equal(write(back, room.id), once, `${name}: saved and loaded`);
  }
});
