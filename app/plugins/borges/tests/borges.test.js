// Tests for Borges (rules.js): the rooms page's own rule, rooms on cells, never a room's mode; its
// drop goes through places.put, which the floor rule (core's floors feature) allows or refuses.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v2.js';
import { bind } from '../world.js';
import { emptyWorld, addRoom, addPage, floorOf, MESSY } from '../../world/model.js';
import { gather, missing, forRooms, forPage } from '../../world/ontologies/index.js';
import { place, move, toFloor } from '../../floors/rule.js';
import rule from '../rules.js';

const M = { cols: 8, rows: 5 };
let W = null; // the world the stand-in places.put writes to, as the app's tables would
bind({ parts: surface(lib), places: { put: (id, context, _rule, { col, row }) => {
  const page = +context.slice(6);
  return { ok: floorOf(W, id) === page ? move(W, id, col, row, M) : toFloor(W, id, page, M, { col, row }) === true };
} } });
const C = (w, r) => lib.model.cellOf(w, r.id) || {};
const made = (w, name, page = 0, cell = null) => { const r = addRoom(w, name, 1, { page }); place(w, r.id, M, cell); return r; };

test('Borges: the rooms page ontology, rooms on cells, never a room\'s', () => {
  assert.deepEqual(missing(rule), []);
  const all = gather([rule]);
  assert.equal(forPage(all).id, 'borges');
  assert.ok(!forRooms(all).some((x) => x.id === 'borges'));
  const w = W = emptyWorld();
  addPage(w);
  const a = made(w, 'A', 0, { col: 4, row: 3 });
  assert.deepEqual(rule.units(w, 0).map((r) => r.name).sort(), ['A', 'Messy thoughts']);
  assert.deepEqual(rule.point(w, 0, a.id), { x: 4, y: 3 });
  assert.equal(rule.drop(w, 0, a.id, 0, 0), false);      // Messy's cells
  assert.equal(rule.drop(w, 0, a.id, 6, 2), true);
  assert.deepEqual([C(w, a).col, C(w, a).row], [6, 2]);
  assert.equal(rule.drop(w, 0, a.id, 8, 0), false);      // off the board
  assert.equal(rule.drop(w, 1, a.id, 2, 1), true);       // onto Floor 2
  assert.deepEqual([floorOf(w, a.id), C(w, a).col, C(w, a).row], [1, 2, 1]);
});

test('Borges\'s rule: a room\'s shape says how many ontologies it holds', () => {
  const w = W = emptyWorld();
  const one = made(w, 'One', 0, { col: 4, row: 0 });
  const twin = addRoom(w, 'Twin', 1, { page: 0 });
  twin.size = 'twin';
  place(w, twin.id, M, { col: 6, row: 0 });
  assert.deepEqual(rule.shape(w, one.id), { w: 1, h: 1, holds: 1 });
  assert.deepEqual(rule.shape(w, twin.id), { w: 2, h: 1, holds: 2 });
  assert.deepEqual(rule.shape(w, MESSY), { w: 2, h: 2, holds: 'all' });
});
