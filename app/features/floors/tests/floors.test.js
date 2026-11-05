// Tests for the floor rule: a fixed board for every floor, full floors spilling onto a new floor,
// moving and resizing within the board, and the check before a smaller size.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, loadWorld, addRoom, addPage, pageCount, roomAt, lock, archive, restore, MESSY } from '../../world/model.js';
import { PRESETS, preset, place, settle, move, resize, toFloor, outside, spot, removeFloor } from '../rule.js';

bind(lib); // the world's rules, as floors gets them from the world service

const M = { cols: 8, rows: 5 };
const S = { cols: 6, rows: 4 };
const made = (w, name, page = 0, cell = null, board = M) => { const r = addRoom(w, name, 1, { page }); place(w, r.id, board, cell); return r; };

test('three presets, Medium 8 × 5 by default', () => {
  assert.deepEqual(PRESETS.map((p) => [p.id, p.cols, p.rows]), [['small', 6, 4], ['medium', 8, 5], ['large', 10, 6]]);
  assert.equal(preset('nonsense').id, 'medium');
  assert.equal(preset('large').cols, 10);
});

test('a room goes in the cell asked for, or the first free one', () => {
  const w = emptyWorld();
  const a = made(w, 'A', 0, { col: 4, row: 3 });
  assert.deepEqual([a.col, a.row], [4, 3]);
  const b = made(w, 'B', 0, { col: 1, row: 1 }); // Messy's
  assert.deepEqual([b.col, b.row], [2, 0]);
  const c = made(w, 'C', 0, { col: 8, row: 0 }); // off the board
  assert.deepEqual([c.col, c.row], [3, 0]);
});

test('a full floor sends a room placed for you onto a new floor, without searching the others', () => {
  const w = emptyWorld();
  addPage(w); // an empty Floor 2 is not searched
  for (let i = 0; i < 36; i++) made(w, `R${i}`); // Floor 1: Messy (4 cells) and 36 more
  assert.equal(spot(w, { id: 'x', size: 1 }, 0, M), null);
  const r = addRoom(w, 'Algebra', 1, { page: 0 });
  const out = place(w, r.id, M);
  assert.deepEqual(out, { page: 2, from: 0, spilled: true });
  assert.equal(r.page, 2);
  assert.deepEqual([r.col, r.row], [0, 0]);
  assert.equal(pageCount(w), 3);
});

test('a 2 × 2 room needs a free 2 × 2 block on its floor', () => {
  const w = emptyWorld();
  for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
    if (col < 2 && row < 2) continue; // Messy
    if ((col + row) % 2 === 0) made(w, `c${col}${row}`, 0, { col, row }); // a checkerboard leaves no 2 × 2 block
  }
  const big = addRoom(w, 'Big', 1, {});
  big.size = 2;
  assert.ok(place(w, big.id, M).spilled);
  assert.equal(big.page, 1);
});

test('dragging and resizing stay on the board', () => {
  const w = emptyWorld();
  const a = made(w, 'A', 0, { col: 3, row: 0 });
  assert.ok(move(w, a.id, 7, 4, M));
  assert.ok(!move(w, a.id, 8, 0, M)); // past the right edge
  assert.ok(!move(w, a.id, 0, 5, M)); // past the bottom edge
  assert.ok(!move(w, a.id, 1, 1, M)); // Messy's
  assert.ok(!resize(w, a.id, 2, M));  // would leave the board
  assert.equal(a.size || 1, 1);
  assert.ok(move(w, a.id, 6, 3, M));
  assert.ok(resize(w, a.id, 2, M));
  assert.equal(roomAt(w, 7, 4).id, a.id);
  lock(w, a.id);
  assert.ok(!move(w, a.id, 3, 0, M));
  assert.ok(!resize(w, a.id, 1, M));
});

test('a room dragged onto a full floor stays; onto one with space it goes to the first free spot', () => {
  const w = emptyWorld();
  const r = made(w, 'R');
  const p = addPage(w);
  for (let i = 0; i < 40; i++) made(w, `F${i}`, p);
  assert.equal(toFloor(w, r.id, p, M), 'full');
  assert.equal(r.page, undefined);
  const q = addPage(w);
  assert.equal(toFloor(w, r.id, q, M), true);
  assert.deepEqual([r.page, r.col, r.row], [q, 0, 0]);
  assert.equal(toFloor(w, MESSY, q, M), false);
  assert.equal(toFloor(w, r.id, 0, M, { col: 5, row: 3 }), true); // in the cell asked for
  assert.deepEqual([r.page, r.col, r.row], [undefined, 5, 3]);
});

test('a room restored from the Archive goes back to its own floor, or a new one', () => {
  const w = emptyWorld();
  const p = addPage(w);
  const r = made(w, 'Old', p);
  archive(w, r.id);
  assert.equal(place(w, r.id, M), null); // archived: nowhere
  restore(w, r.id);
  assert.deepEqual(place(w, r.id, M), { page: p, from: p, spilled: false });
});

test('rooms from old saved data are placed again on the board without overlaps', () => {
  const w = loadWorld({ v: 3, things: {
    messy: { id: 'messy', kind: 'room', parent: null, at: 0, name: 'Messy thoughts' },
    r1: { id: 'r1', kind: 'room', parent: null, at: 1, name: 'One', col: 1, row: 0 }, // on Messy
    r2: { id: 'r2', kind: 'room', parent: null, at: 2, name: 'Two' },                 // no cell
    r3: { id: 'r3', kind: 'room', parent: null, at: 3, name: 'Three', col: 12, row: 9 }, // off the board
    r4: { id: 'r4', kind: 'room', parent: null, at: 4, name: 'Four', col: 5, row: 2 },
  } });
  assert.deepEqual(settle(w, 0, M), []);
  const seen = new Set();
  for (const id of ['messy', 'r1', 'r2', 'r3', 'r4']) {
    const r = w.things[id];
    assert.ok(r.col + (r.size || 1) <= 8 && r.row + (r.size || 1) <= 5, id);
    for (let c = 0; c < (r.size || 1); c++) for (let d = 0; d < (r.size || 1); d++) {
      const k = `${r.col + c},${r.row + d}`;
      assert.ok(!seen.has(k), k);
      seen.add(k);
    }
  }
  assert.deepEqual([w.things.r4.col, w.things.r4.row], [5, 2]); // a room in a good cell stays
});

test('a smaller size is refused while a room sits outside it', () => {
  const w = emptyWorld();
  const p = addPage(w);
  const r = made(w, 'Wide', p, { col: 7, row: 0 });
  assert.deepEqual(outside(w, S), [p]);
  assert.deepEqual(outside(w, M), []);
  assert.deepEqual(outside(w, preset('large')), []);
  move(w, r.id, 2, 2, M);
  assert.deepEqual(outside(w, S), []);
});

test('near: a room placed near a cell takes the free spot nearest it, else spills', () => {
  const w = emptyWorld();
  const a = made(w, 'A', 0, { col: 5, row: 2 });
  const b = addRoom(w, 'B', 1);
  place(w, b.id, M, { col: 5, row: 2 }, { near: true });
  assert.deepEqual([b.col, b.row], [6, 2], 'beside A, on its right');
  assert.ok(a.col === 5);
  const S2 = { cols: 2, rows: 1 };
  const w2 = emptyWorld();
  const x = addRoom(w2, 'X', 1, { page: 1 }); place(w2, x.id, S2, { col: 0, row: 0 });
  const y = addRoom(w2, 'Y', 1, { page: 1 }); place(w2, y.id, S2, { col: 1, row: 0 });
  const z = addRoom(w2, 'Z', 1, { page: 1 });
  const out = place(w2, z.id, S2, { col: 0, row: 0 }, { near: true });
  assert.ok(out.spilled, 'a full floor spills to a new one');
});

test('deleting a floor archives its rooms and moves the floors below up one', () => {
  const w = emptyWorld();
  addPage(w); addPage(w); addPage(w); // floors 0..3
  const a = made(w, 'A', 1);
  const b = made(w, 'B', 2);
  const c = made(w, 'C', 3);
  const gone = made(w, 'Gone', 1); archive(w, gone.id);
  const out = removeFloor(w, 1, 5);
  assert.deepEqual(out.archived.map((r) => r.name), ['A']);
  assert.equal(a.archived, 5);
  assert.equal(a.page || 0, 0);        // restored, it goes to the floor above
  assert.equal(gone.page || 0, 0);
  assert.equal(b.page, 1);
  assert.equal(c.page, 2);
  assert.equal(pageCount(w), 3);
  assert.equal(w.pages, 3);
});

test('Floor 1, a missing floor and a floor with a locked room stay', () => {
  const w = emptyWorld();
  addPage(w);
  const r = made(w, 'Shut', 1);
  lock(w, r.id);
  assert.equal(removeFloor(w, 0).error, 'first');
  assert.equal(removeFloor(w, 5).error, 'none');
  assert.equal(removeFloor(w, 1).error, 'locked');
  assert.equal(r.page, 1);
  assert.equal(pageCount(w), 2);
});

test('an empty last floor just goes', () => {
  const w = emptyWorld();
  addPage(w);
  assert.deepEqual(removeFloor(w, 1).archived, []);
  assert.equal(pageCount(w), 1);
});

test('Borges: the rooms page ontology, rooms on cells, never a room\'s', async () => {
  const { borges } = await import('../borges.js');
  const { gather, missing, forRooms, forPage } = await import('../../world/ontologies/index.js');
  const o = borges(() => M);
  assert.deepEqual(missing(o), []);
  const all = gather([o]);
  assert.equal(forPage(all).id, 'borges');
  assert.ok(!forRooms(all).some((x) => x.id === 'borges'));
  const w = emptyWorld();
  addPage(w);
  const a = made(w, 'A', 0, { col: 4, row: 3 });
  assert.deepEqual(o.units(w, 0).map((r) => r.name).sort(), ['A', 'Messy thoughts']);
  assert.deepEqual(o.point(w, 0, a.id), { x: 4, y: 3 });
  assert.equal(o.drop(w, 0, a.id, 0, 0), false);      // Messy's cells
  assert.equal(o.drop(w, 0, a.id, 6, 2), true);
  assert.deepEqual([a.col, a.row], [6, 2]);
  assert.equal(o.drop(w, 0, a.id, 8, 0), false);      // off the board
  assert.equal(o.drop(w, 1, a.id, 2, 1), true);       // onto Floor 2
  assert.deepEqual([a.page, a.col, a.row], [1, 2, 1]);
});

test('Borges\'s rule: a room\'s shape says how many ontologies it holds, and rooms never overlap', async () => {
  const { borges } = await import('../borges.js');
  const o = borges(() => M);
  const w = emptyWorld();
  const one = made(w, 'One', 0, { col: 4, row: 0 });
  const twin = addRoom(w, 'Twin', 1, { page: 0 });
  twin.size = 'twin';
  place(w, twin.id, M, { col: 3, row: 0 });            // would cover One's cell: goes to the first free spot
  assert.deepEqual([twin.col, twin.row], [2, 0]);
  assert.deepEqual(roomAt(w, 3, 0)?.id, twin.id);      // two cells wide, one high
  assert.equal(roomAt(w, 2, 1), null);
  assert.deepEqual(o.shape(w, one.id), { w: 1, h: 1, holds: 1 });
  assert.deepEqual(o.shape(w, twin.id), { w: 2, h: 1, holds: 2 });
  assert.deepEqual(o.shape(w, MESSY), { w: 2, h: 2, holds: 'all' });
  assert.equal(move(w, twin.id, 7, 4, M), false);      // its second cell would be off the board
  assert.equal(move(w, twin.id, 6, 4, M), true);
  assert.equal(resize(w, one.id, 'twin', M), true);    // One at (4, 0) grows to (5, 0)
  assert.equal(resize(w, one.id, 2, M), true);
  assert.equal(resize(w, twin.id, 2, M), false);       // (6, 4) 2 × 2 would leave the board
  assert.equal(twin.size, 'twin');
});
