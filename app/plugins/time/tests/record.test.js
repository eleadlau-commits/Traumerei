import { test, assert } from 'folio/testing';
import { snapshot, homes, cellsOf, pastBoard, earliest, DAY } from '../record.js';
import { dayOf } from '../days.js';

const t = new Date(2026, 10, 5, 12).getTime(); // 5 Nov, noon
const things = (extra = {}) => ({
  messy: { id: 'messy', kind: 'room', parent: null, name: 'Messy thoughts', col: 0, row: 0, size: 2, at: 0 },
  a: { id: 'a', kind: 'room', parent: null, name: 'A', col: 2, row: 0, page: 0, at: 0 },
  tw: { id: 'tw', kind: 'room', parent: null, name: 'Twin', size: 3, at: 0 },
  s1: { id: 's1', kind: 'room', parent: 'tw', name: 'Left', at: 0 },
  x: { id: 'x', kind: 'line', parent: 'a', at: 1 },
  ...extra,
});
const m = { isLeaf: (th) => ['line', 'passage', 'picture'].includes(th.kind) };

// The fixtures say where each thing is with `parent` (and a room's `page`), as the place rows
// would: a home row per thing.
const placesOf = (set) => Object.values(set).flatMap((th) => { const context = th.parent ?? (th.archived ? 'archive' : `floor:${th.page || 0}`); return [{ mark: th.id, context }, ...(th.col != null ? [{ mark: th.id, context, rule: 'borges', position: { col: th.col, row: th.row } }] : [])]; });

// A stand-in for the API's moments table: the things at each day's end, and when each was written.
function moments(byDay, written = {}, first = null) {
  const days = Object.keys(byDay).map(Number).sort((a, b) => a - b);
  return {
    at: (time) => { let s = {}; for (const d of days) if (d <= time) s = byDay[d]; return Object.values(s); },
    placesAt: (time) => { let s = {}; for (const d of days) if (d <= time) s = byDay[d]; return placesOf(s); },
    changed: (id) => written[id] ?? null,
    first: () => first,
  };
}

test('a snapshot holds the squares on the rooms page, not the sides or thoughts', () => {
  const s = snapshot(things(), homes(placesOf(things())), cellsOf(placesOf(things())));
  assert.deepEqual(Object.keys(s).sort(), ['a', 'messy', 'tw']);
  assert.equal(s.a.col, 2);
  assert.equal(s.a.archived, false);
});

test('a past day shows the rooms as they were at its end, how many thoughts each held, and which were written in', () => {
  const d0 = dayOf(t - DAY), d1 = dayOf(t);
  const then = things({ y: { id: 'y', kind: 'line', parent: 's1', at: t - DAY } });
  const now = things({ y: { id: 'y', kind: 'line', parent: 's1', at: t - DAY, edited: t }, z: { id: 'z', kind: 'line', parent: 'a', at: t } });
  now.a = { ...now.a, name: 'Renamed' };
  delete now.tw; delete now.s1; delete now.y;
  const mo = moments({ [d0 + DAY - 1]: then, [d1 + DAY - 1]: now }, { x: 1, y: t - DAY, z: t }, t - 3 * DAY);
  const past = pastBoard(m, { things: now }, mo, d0);
  assert.equal(past.rooms.a.name, 'A');
  assert.deepEqual(Object.keys(past.rooms).sort(), ['a', 'messy', 'tw']);
  assert.deepEqual(past.counts, { a: 1, tw: 1 });
  assert.deepEqual(past.written, ['tw']); // y, in the Twin's side, was written that day
  const today = pastBoard(m, { things: now }, mo, d1);
  assert.equal(today.rooms.a.name, 'Renamed');
  assert.ok(!today.rooms.tw);
  assert.deepEqual(today.written, ['a']);
  assert.deepEqual(today.counts, { a: 2 });
});

test('the first day is the log\'s first, or an older thought\'s', () => {
  const w = { things: things() };
  assert.equal(earliest(w, moments({}, {}, t - 3 * DAY), t), dayOf(1)); // x was made at 1
  w.things.x.at = t;
  assert.equal(earliest(w, moments({}, {}, t - 3 * DAY), t), dayOf(t - 3 * DAY));
  assert.equal(earliest(w, moments({}, {}, null), t), dayOf(t));
});
