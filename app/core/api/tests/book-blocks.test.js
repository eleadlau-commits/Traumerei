// Book · blocks (app/plugins/book/blocks.js, stage 3): the book as a board of blocks in reading
// order, chapters and sections as outlines around them; a block let go between others moves there
// as one { join, at, from } step, onto an outline's label to the end of that chapter, into the tray
// out of the book; let go where it was, nothing; a 1,500-paragraph book in under 50 ms.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../plugins/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const B = await load('book', 'blocks.js');
const C = await load('book', 'column.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === B.BLOCKS).item;
  const measure = (text, width) => t.ui.measure(text, width);
  const lay = () => B.board(t, s.room, measure);
  const centre = (c) => ({ x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 });
  return { host, t, s, rule, lay, centre, text: (id) => t.marks.text(id) };
}

test('book blocks: a sibling rule right after Book, claiming the book\'s groups', () => {
  const { t } = setUp();
  const ids = t.rules.list().map((r) => r.id);
  assert.equal(ids[ids.indexOf(C.RULE) + 1], B.BLOCKS, 'Tab from Book lands on Book · blocks');
  assert.equal(t.rules.list().find((r) => r.id === B.BLOCKS).name, 'Book · blocks');
});

test('book blocks: blocks in reading order, a row at a time; chapters and sections outlined, notes in their frame', () => {
  const { t, s, lay } = setUp();
  const L = lay();
  const pos = new Map();
  for (const r of L.rows) if (!pos.has(r.mark)) pos.set(r.mark, r);
  const flow = C.flow(t, s.room);
  assert.ok(flow.every((id) => pos.has(id)), 'every paragraph, heading and stray has a block');
  const key = (id) => [pos.get(id).y, pos.get(id).x];
  for (let i = 1; i < flow.length; i++) {
    const [y0, x0] = key(flow[i - 1]), [y1, x1] = key(flow[i]);
    assert.ok(y1 > y0 || (y1 === y0 && x1 > x0), `reading order at ${i}`);
  }
  assert.ok(L.rows.every((r) => r.mark === s.note || r.width <= B.BOARD.block || C.headed(t, r.mark)), 'blocks a fixed width');
  const outlines = L.boxes.filter((b) => b.style === 'quiet');
  assert.deepEqual(outlines.map((b) => b.label), ['1', '2', '2.1', '2.2', '3']);
  const garden = L.outlines.find((o) => o.id === s.chapters[2]), spring = L.outlines.find((o) => o.id === s.chapters[1]);
  assert.ok(garden.x > spring.x && garden.y > spring.y && garden.y + garden.h < spring.y + spring.h, 'a section inside its chapter');
  // The margin note sits in its paragraph's frame, under it.
  const of = L.cells.get(s.paras[1]), note = pos.get(s.note);
  assert.ok(note.y > pos.get(s.paras[1]).y && note.y < of.y1 && note.x > of.x0 && note.x < of.x1);
  // The open gap is a dashed frame; the strays are in the tray.
  assert.ok(L.boxes.some((b) => b.style === 'shelf' && b.note === 'to write'));
  const strays = flow.slice(-2);
  assert.ok(strays.every((id) => pos.get(id).y > L.tray.y && pos.get(id).y < L.tray.y + L.tray.h));
  // Laid out by the kernel as the rule says (no rows below the rest).
  const k = t.rules.layout(B.BLOCKS, s.room);
  assert.equal(k.find((r) => r.mark === flow[3]).position.y, pos.get(flow[3]).y);
});

test('book blocks: a block let go between two others moves there, into another chapter, one step', () => {
  const { host, t, s, rule, lay, text } = setUp();
  const [winter, , , , summer] = s.chapters;
  const a = t.links.members(winter)[1]; // Winter's first paragraph
  const before = t.links.members(summer).slice();
  // Let go just left of Summer's second paragraph's centre: before it.
  const L = lay();
  const c = L.cells.get(t.links.members(summer)[2]);
  const p = B.dropAt(t, s.room, a, c.x0 + 4, (c.y0 + c.y1) / 2, L);
  assert.deepEqual(p, { mark: a, join: summer, at: 2, from: winter });
  rule.drop(host.w, s.room, a, c.x0 + 4, (c.y0 + c.y1) / 2);
  host.world.save();
  assert.deepEqual(t.links.members(summer).map(text), [before[0], before[1], a, ...before.slice(2)].map(text));
  assert.ok(!t.links.members(winter).includes(a), 'it left Winter');
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.equal(t.links.members(winter)[1], a, 'one Ctrl+Z puts it back');
  assert.deepEqual(t.links.members(summer), before);
});

test('book blocks: let go where it was, or nudged inside its own block, nothing changes', () => {
  const { t, s, lay, centre } = setUp();
  const L = lay();
  const winter = s.chapters[0];
  for (const id of t.links.members(winter).slice(1)) {
    const c = centre(L.cells.get(id));
    assert.equal(B.dropAt(t, s.room, id, c.x, c.y, L), null);
    assert.equal(B.dropAt(t, s.room, id, c.x + 30, c.y - 20, L), null, 'a clear-space nudge');
  }
  // Just right of the block before it: the same place it has.
  const [, p1, p2] = t.links.members(winter);
  const c1 = L.cells.get(p1);
  assert.equal(B.dropAt(t, s.room, p2, c1.x1 - 2, (c1.y0 + c1.y1) / 2, L), null);
});

test('book blocks: onto an outline\'s label, to the end of that chapter; a heading moves its chapter; into the tray, out of the book', () => {
  const { t, s, lay } = setUp();
  const [winter, spring, , , summer] = s.chapters;
  const L = lay();
  const a = t.links.members(winter)[1];
  const o = L.outlines.find((x) => x.id === summer);
  const p = B.dropAt(t, s.room, a, o.x + o.w - 40, o.y + 6, L);
  assert.deepEqual(p, { mark: a, join: summer, at: t.links.members(summer).length, from: winter });
  // Winter's heading let go after Summer: the whole chapter moves to the end of the book.
  const last = L.outlines.find((x) => x.id === s.book);
  const h = B.dropAt(t, s.room, s.heads[0], 0, o.y + o.h + 4, L);
  assert.ok(o.y + o.h + 4 < last.y + last.h);
  assert.deepEqual(h, { mark: winter, join: s.book, at: 2 });
  // Never into itself or a chapter it holds.
  const g = L.outlines.find((x) => x.id === s.chapters[2]);
  const inside = B.dropAt(t, s.room, s.heads[1], g.x + 40, g.top + 10, L);
  assert.ok(!inside || inside.join !== s.chapters[2] && inside.join !== spring);
  // Into the tray: out of the book (the plugin unlinks it, one step); a stray there: nothing.
  const T = L.tray;
  assert.deepEqual(B.dropAt(t, s.room, a, T.x + T.w - 20, T.y + T.h - 10, L), { leave: winter, mark: a });
  const stray = C.flow(t, s.room).at(-1);
  assert.equal(B.dropAt(t, s.room, stray, T.x + T.w - 20, T.y + T.h - 10, L), null);
  // A stray let go in a chapter joins it, with nothing to leave.
  const c = L.cells.get(t.links.members(summer)[1]);
  assert.deepEqual(B.dropAt(t, s.room, stray, c.x1 - 4, (c.y0 + c.y1) / 2, L), { mark: stray, join: summer, at: 2 });
  // A margin note stays a note.
  assert.equal(B.dropAt(t, s.room, s.note, c.x1 - 4, (c.y0 + c.y1) / 2, L), null);
});

test('book blocks: into the tray through the rule: one step out of the book', async () => {
  const { host, t, s, rule, lay } = setUp();
  const winter = s.chapters[0];
  const a = t.links.members(winter)[1];
  const T = lay().tray;
  rule.drop(host.w, s.room, a, T.x + 30, T.y + T.h - 10);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(!t.links.holders(a).length, 'out of the book');
  assert.ok(C.flow(t, s.room).slice(-3).includes(a), 'in the tray');
  t.ui.undo?.();
  assert.deepEqual(brokenLaws(host.w), []);
});

test('book blocks: a 1,500-paragraph book arranges in under 50 ms', () => {
  const host = makeHost({ thoughts: 0 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const { model } = host.lib;
  const room = model.addRoom(host.w, 'Big', host.tick(), {}, B.BLOCKS);
  const b = model.create(host.w, room.id, { kind: 'group', of: 'book', title: 'Big', family: true, x: 0, y: 0 }, host.tick());
  for (let c = 0; c < 30; c++) {
    const ch = model.create(host.w, room.id, { kind: 'group', of: 'book-chapter', title: `C${c}`, family: true, x: 0, y: 0 }, host.tick());
    model.join(host.w, b.id, ch.id);
    for (let i = 0; i < 50; i++) model.join(host.w, ch.id, model.create(host.w, room.id, { kind: 'line', text: `paragraph ${c}.${i} ${'word '.repeat(20 + (i % 40))}` }, host.tick()).id);
  }
  host.world.save();
  t.rules.layout(B.BLOCKS, room.id);
  model.update(host.w, model.roomThoughts(host.w, room.id)[7].id, { text: 'changed' }, host.tick());
  const t0 = performance.now();
  const lay = t.rules.layout(B.BLOCKS, room.id);
  const ms = performance.now() - t0;
  t.rules.draws(B.BLOCKS, room.id);
  const both = performance.now() - t0;
  assert.equal(lay.length, 1500);
  assert.ok(ms < 50, `arranged in ${ms.toFixed(1)} ms`);
  assert.ok(both < 120, `arranged and drawn in ${both.toFixed(1)} ms`);
});
