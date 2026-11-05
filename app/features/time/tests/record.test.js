import { test, assert } from 'folio/testing';
import { snapshot, note, prune, stateAt, writtenOn, firstDay, emptyRecord, DAY } from '../record.js';
import { dayOf } from '../days.js';

const t = new Date(2026, 10, 5, 12).getTime(); // 5 Nov, noon
const world = (extra = {}) => ({ things: {
  messy: { id: 'messy', kind: 'room', parent: null, name: 'Messy thoughts', col: 0, row: 0, size: 2 },
  a: { id: 'a', kind: 'room', parent: null, name: 'A', col: 2, row: 0, page: 0 },
  tw: { id: 'tw', kind: 'room', parent: null, name: 'Twin', size: 3 },
  s1: { id: 's1', kind: 'room', parent: 'tw', name: 'Left' },
  x: { id: 'x', kind: 'line', parent: 'a', at: 1 },
  ...extra,
} });

test('a snapshot holds the squares on the rooms page, not the sides or thoughts', () => {
  const s = snapshot(world());
  assert.deepEqual(Object.keys(s).sort(), ['a', 'messy', 'tw']);
  assert.equal(s.a.col, 2);
  assert.equal(s.a.archived, false);
});

test('each day keeps only what changed', () => {
  const rec = emptyRecord();
  note(rec, snapshot(world()), ['a'], t - DAY);
  assert.deepEqual(Object.keys(rec.days[dayOf(t - DAY)].set).sort(), ['a', 'messy', 'tw']);
  const w = world();
  w.things.a.name = 'Renamed';
  delete w.things.tw;
  note(rec, snapshot(w), [], t);
  const d = rec.days[dayOf(t)];
  assert.deepEqual(Object.keys(d.set), ['a']);
  assert.deepEqual(d.gone, ['tw']);
  assert.equal(d.written, undefined);
  assert.equal(stateAt(rec, dayOf(t - DAY)).a.name, 'A');
  assert.equal(stateAt(rec).a.name, 'Renamed');
  assert.ok(!stateAt(rec).tw);
  assert.deepEqual(writtenOn(rec, t - DAY), ['a']);
});

test('a day with no change holds nothing, and written rooms add up', () => {
  const rec = emptyRecord();
  note(rec, snapshot(world()), [], t - DAY);
  note(rec, snapshot(world()), [], t);
  assert.ok(!rec.days[dayOf(t)]);
  note(rec, snapshot(world()), ['a'], t);
  note(rec, snapshot(world()), ['messy', 'a'], t + 1000);
  assert.deepEqual(rec.days[dayOf(t)].written, ['a', 'messy']);
});

test('old days fold into the base; forever keeps them', () => {
  const rec = emptyRecord();
  note(rec, snapshot(world()), ['a'], t - 40 * DAY);
  const w = world(); w.things.a.name = 'B';
  note(rec, snapshot(w), [], t - 5 * DAY);
  prune(rec, 0, t);
  assert.equal(Object.keys(rec.days).length, 2);
  prune(rec, 30, t);
  assert.equal(Object.keys(rec.days).length, 1);
  assert.equal(rec.base.day, dayOf(t - 29 * DAY));
  assert.equal(rec.base.rooms.a.name, 'A');
  assert.equal(firstDay(rec), dayOf(t - 29 * DAY));
  assert.equal(stateAt(rec).a.name, 'B');
});
