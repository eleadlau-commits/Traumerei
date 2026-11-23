// Book (app/optional/extra/book): the room's clear-space finds nothing to push in a book. Every
// thought is a block of its own to it (room/clear.js, GAP apart); a block laid closer is pushed
// after every redraw, through the rule's drop, which can only refuse, so the push came back each
// time: a room of 1,500 thoughts took seconds to open and to keep one (Book 0.4.6). Here each
// layout (pages, facing pages, Pages: None, Book · blocks, a smaller and a larger type) of the
// sample with two notes on one paragraph and thoughts not yet in the book is handed to the
// clear-space as the room hands it, each mark's rows as one box, and must come back unmoved. And the
// clear-space's nudges inside a row, one a block, change nothing and cost no new layout each.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';
import { clearSpace } from '../../room/clear.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const B = await load('book', 'blocks.js');
const E = await load('book', 'editing.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  for (let i = 0; i < 12; i++) host.lib.model.create(host.w, s.room, { kind: 'line', text: `loose ${i} ${'word '.repeat(1 + (i * 5) % 30)}` }, host.tick());
  const extra = host.lib.model.create(host.w, s.room, { kind: 'line', text: 'A second note on the same paragraph.' }, host.tick());
  host.world.save();
  host.choose(s.room);
  E.noteOn(t, extra.id, s.paras[0]);
  const measure = (x, w) => t.ui.measure(x, w);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  const set = (o) => { const r = host.w.things[s.room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };
  return { host, t, s, measure, size, set };
}

// What the clear-space would move: each mark's rows as one box (the room measures a mark's
// pieces together), none fixed.
function pushed(rows) {
  const boxes = new Map();
  for (const r of rows) {
    const x0 = r.x - r.width / 2, y0 = r.y - r.height / 2, x1 = r.x + r.width / 2, y1 = r.y + r.height / 2;
    const b = boxes.get(r.mark);
    boxes.set(r.mark, b ? { x0: Math.min(b.x0, x0), y0: Math.min(b.y0, y0), x1: Math.max(b.x1, x1), y1: Math.max(b.y1, y1) } : { x0, y0, x1, y1 });
  }
  return Object.keys(clearSpace([...boxes].map(([id, b]) => ({ id, box: { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, fixed: false, at: 0 }))));
}

test('Book: the clear-space finds nothing to push, in every layout', () => {
  const { t, s, measure, size, set } = setUp();
  const notes = C.read(t, s.room).notes;
  assert.equal(notes.length, 2, 'two notes on one paragraph');
  const cases = [
    ['A4, one page under another', {}],
    ['facing pages', { grid: 'columns', count: '2' }],
    ['a strip of rows', { grid: 'rows', count: '2' }],
    ['Pages: None', { pages: 'none', grid: 'columns', count: '1' }],
    ['type 70%', { pages: 'a4', type: '70' }],
    ['type 125%', { type: '125' }],
  ];
  for (const [why, o] of cases) {
    set(o);
    const lay = P.shape(t, s.room, measure, size);
    assert.ok(lay.rows.length > 20, `${why}: laid out`);
    { const ids = pushed(lay.rows); assert.deepEqual(ids, [], `${why}: nothing pushed ` + JSON.stringify(ids.map((id) => [t.marks.text(id)?.slice(0, 20), lay.rows.filter((r) => r.mark === id).map((r) => [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)])]))); }
  }
  for (const type of ['70', '100', '125']) {
    set({ type });
    const lay = B.board(t, s.room, measure);
    { const ids = pushed(lay.rows); assert.deepEqual(ids, [], `Book · blocks, type ${type}%: nothing pushed ` + JSON.stringify(ids.map((id) => t.marks.text(id)?.slice(0, 20)))); }
  }
});

test('Book: a nudge inside its own row changes nothing, and a pass of them is quick', () => {
  const { host, t, s, measure, size } = setUp();
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === C.RULE).item;
  const ch = s.chapters[s.chapters.length - 1];
  for (let i = 0; i < 1500; i++) {
    const p = host.lib.model.create(host.w, s.room, { kind: 'line', text: `paragraph ${i} ${'word '.repeat(4 + (i * 7) % 40)}` }, host.tick());
    host.lib.model.join(host.w, ch, p.id);
  }
  host.world.save();
  rule.boxes(host.w, s.room); // drawn once, as the room does
  const lay = P.shape(t, s.room, measure, size);
  const before = JSON.stringify(t.links.members(ch));
  const rows = lay.rows.filter((r) => t.links.members(ch).includes(r.mark));
  const t0 = Date.now();
  for (const r of rows) rule.drop(host.w, s.room, r.mark, r.x, r.y + 6); // the clear-space's nudges, one a block
  const took = Date.now() - t0;
  assert.equal(JSON.stringify(t.links.members(ch)), before, 'nothing moved');
  assert.ok(took < 1000, `${rows.length} nudges in ${took} ms (a new layout each took seconds)`);
});
