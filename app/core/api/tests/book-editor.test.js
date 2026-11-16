// The Book editor through the whole API (app/plugins/book, stage 1): the room seen as Book is one
// column in reading order; a paragraph written after another lands right after it in its chapter
// (land → join); a paragraph made a heading gathers what follows; levels, moves, splits, joins
// and pasting as paragraphs are each one step; a 1,500-paragraph book lays out in under 50 ms.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../plugins/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const E = await load('book', 'editing.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t, off } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items); // (World.js does this when the slot changes)
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies').item;
  const text = (id) => t.marks.text(id);
  const order = () => C.flow(t, s.room).map(text);
  return { host, t, off, s, rule, text, order };
}

test('book editor: the room as one column, in reading order, headings numbered as they nest', () => {
  const { t, s, order } = setUp();
  const { items } = C.read(t, s.room);
  assert.deepEqual(items.filter((x) => x.t === 'heading').map((x) => [x.num, t.marks.text(x.mark), x.depth]),
    [['1', 'Winter', 1], ['2', 'Spring', 1], ['2.1', 'The garden', 2], ['2.2', 'Visitors', 2], ['3', 'Summer', 1]]);
  assert.equal(order()[0], 'Winter');
  assert.ok(order()[order().length - 1].startsWith('Check: when'), 'the thoughts not in the book come last');
  const lay = t.rules.layout(C.RULE, s.room);
  const rows = new Map(lay.map((r) => [r.mark, r]));
  assert.ok(lay.every((r) => r.width === C.WIDTHS.book), 'every row the column wide');
  const ys = C.flow(t, s.room).map((id) => rows.get(id).position.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), 'rows run down the page in reading order');
  const boxes = t.rules.draws(C.RULE, s.room).boxes;
  assert.ok(boxes.some((b) => b.style === 'title' && b.label === S.TEXT.title));
  assert.deepEqual(boxes.filter((b) => b.style === 'heading').map((b) => b.label), ['1', '2', '2.1', '2.2', '3']);
});

test('book editor: a paragraph written after another lands right after it, in its chapter, in the same step', () => {
  const { host, t, s, rule, text } = setUp();
  const winter = s.chapters[0];
  const [, second] = t.links.members(winter).slice(1);
  const made = t.marks.make({ content: 'A new paragraph.', in: s.room }).id; // as the room keeps it
  const p = t.rules.layout(C.RULE, s.room).find((r) => r.mark === second).position;
  assert.deepEqual(rule.land(host.w, s.room, made, p.x, p.y), []);
  assert.deepEqual(t.links.members(winter).map(text).slice(2, 4), [text(second), 'A new paragraph.']);
  // After a heading: first in its chapter, under the heading.
  const m2 = t.marks.make({ content: 'Opening line.', in: s.room }).id;
  const h = t.rules.layout(C.RULE, s.room).find((r) => r.mark === s.heads[2]).position;
  rule.land(host.w, s.room, m2, h.x, h.y);
  assert.deepEqual(t.links.members(s.chapters[2]).map(text).slice(0, 2), ['The garden', 'Opening line.']);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('book editor: a paragraph made a heading gathers what follows; again, it is a paragraph', () => {
  const { t, s, text } = setUp();
  const winter = s.chapters[0];
  const [, a, b, c] = t.links.members(winter);
  const ch = E.makeHeading(t, s.room, b);
  assert.ok(ch);
  assert.deepEqual(t.links.members(winter), [s.heads[0], a, ch]);
  assert.deepEqual(t.links.members(ch), [b, c]);
  assert.equal(C.headed(t, b), ch);
  assert.equal(C.read(t, s.room).items.find((x) => x.mark === b).num, '1.1');
  assert.ok(E.unmakeHeading(t, ch));
  assert.deepEqual(t.links.members(winter), [s.heads[0], a, b, c]);
  assert.equal(t.marks.get(ch), null);
});

test('book editor: levels and moves, each one step, refused in words where they cannot go', () => {
  const { t, s, text, order } = setUp();
  const [winter, spring, garden, visitors, summer] = s.chapters;
  assert.equal(E.demote(t, winter).ok, false);
  assert.ok(E.demote(t, spring).ok);
  assert.deepEqual(t.links.holders(spring), [winter]);
  assert.ok(E.promote(t, spring).ok);
  assert.deepEqual(t.links.holders(spring), [s.book]);
  assert.deepEqual(t.links.members(s.book), [winter, spring, summer]);
  // Promote a section: what followed it comes under it.
  assert.ok(E.promote(t, garden).ok);
  assert.deepEqual(t.links.members(s.book), [winter, spring, garden, summer]);
  assert.ok(t.links.members(garden).includes(visitors));
  assert.equal(E.promote(t, winter).ok, false);
  // Moves: a chapter past its neighbour; a paragraph out of its chapter and into the next.
  E.moveOne(t, s.room, s.heads[0], 1);
  assert.deepEqual(t.links.members(s.book).slice(0, 2), [spring, winter]);
  const last = t.links.members(winter).at(-1);
  E.moveOne(t, s.room, last, 1);
  assert.equal(t.links.holders(last)[0], s.book, 'out of its chapter at the end');
  E.moveOne(t, s.room, last, 1);
  assert.equal(t.links.holders(last)[0], garden, 'into the next chapter, first after its heading');
  assert.equal(t.links.members(garden)[1], last);
  void order; void text;
});

test('book editor: split at the caret, join to the one before, paste as paragraphs', () => {
  const { t, s, text } = setUp();
  const winter = s.chapters[0];
  const [, a] = t.links.members(winter);
  const words = text(a);
  const cut = words.indexOf(' In December');
  const b = E.split(t, s.room, a, words, cut);
  assert.ok(b);
  assert.deepEqual(t.links.members(winter).slice(1, 3).map(text), ['The lamp is lit at four.', words.slice(cut + 1)]);
  assert.equal(E.before(t, b), a);
  assert.equal(E.before(t, a), null, 'never into a heading');
  assert.equal(E.split(t, s.room, a, 'x', 1), null, 'nothing to split off');
  const made = E.pasteParagraphs(t, s.room, 'One.\n\nTwo,\nstill two.\n\n\nThree.', b);
  assert.deepEqual(made.map(text), ['One.', 'Two,\nstill two.', 'Three.']);
  assert.deepEqual(t.links.members(winter).slice(3, 6), made);
});

test('book editor: a 1,500-paragraph book lays out in under 50 ms', () => {
  const host = makeHost({ thoughts: 0 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const { model } = host.lib;
  const room = model.addRoom(host.w, 'Big', host.tick(), {}, C.RULE);
  const b = model.create(host.w, room.id, { kind: 'group', of: 'book', title: 'Big', family: true, x: 0, y: 0 }, host.tick());
  for (let c = 0; c < 30; c++) {
    const ch = model.create(host.w, room.id, { kind: 'group', of: 'book-chapter', title: `C${c}`, family: true, x: 0, y: 0 }, host.tick());
    model.join(host.w, b.id, ch.id);
    for (let i = 0; i < 50; i++) model.join(host.w, ch.id, model.create(host.w, room.id, { kind: 'line', text: `paragraph ${c}.${i} ${'word '.repeat(20 + (i % 40))}` }, host.tick()).id);
  }
  host.world.save();
  t.rules.layout(C.RULE, room.id); // measured once (the measure keeps what it measured)
  model.update(host.w, model.roomThoughts(host.w, room.id)[7].id, { text: 'changed' }, host.tick());
  const t0 = performance.now();
  const lay = t.rules.layout(C.RULE, room.id);
  const ms = performance.now() - t0;
  assert.equal(lay.length, 1500);
  assert.ok(ms < 50, `laid out in ${ms.toFixed(1)} ms`);
});
