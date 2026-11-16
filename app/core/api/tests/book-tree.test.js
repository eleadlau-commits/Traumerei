// The Book editor's contents, dragged (app/optional/book/treedrop.js): a line let go on another
// lands before it (its top third), after it (its foot) or into it (its middle), across chapters,
// never into itself or one it holds, never deeper than three levels, each drop one step.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const E = await load('book', 'editing.js');
const D = await load('book', 'treedrop.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items); // (World.js does this when the slot changes)
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  // The contents as the dock shows it: [number, title] per line.
  const tree = () => C.read(t, s.room).items.filter((x) => x.t === 'heading' || x.t === 'chapter').map((x) => `${x.num} ${C.titleOf(t, x.chapter)}`);
  const [winter, spring, garden, visitors, summer] = s.chapters;
  return { host, t, s, tree, winter, spring, garden, visitors, summer };
}

const START = ['1 Winter', '2 Spring', '2.1 The garden', '2.2 Visitors', '3 Summer'];

test('book tree: the part of a line says before, into or after', () => {
  assert.equal(D.zoneOf(101, 100, 30), 'before');
  assert.equal(D.zoneOf(115, 100, 30), 'into');
  assert.equal(D.zoneOf(128, 100, 30), 'after');
});

test('book tree: before and after a line, among its siblings', () => {
  const { t, tree, winter, summer } = setUp();
  assert.deepEqual(tree(), START);
  assert.ok(D.dropTo(t, summer, winter, 'before').ok);
  assert.deepEqual(tree(), ['1 Summer', '2 Winter', '3 Spring', '3.1 The garden', '3.2 Visitors']);
  assert.ok(D.dropTo(t, summer, winter, 'after').ok);
  assert.deepEqual(tree(), ['1 Winter', '2 Summer', '3 Spring', '3.1 The garden', '3.2 Visitors']);
  // Let go where it already is: nothing, and no step.
  assert.deepEqual(D.landing(t, summer, winter, 'after'), { ok: false });
  assert.deepEqual(D.landing(t, summer, summer, 'before'), { ok: false });
});

test('book tree: into a chapter, and out across holders, the words coming along', () => {
  const { t, s, tree, winter, spring, garden, summer } = setUp();
  const words = C.flow(t, s.room).filter((id) => E.holderOf(t, id) === summer || C.headed(t, id) === summer).length;
  assert.ok(D.dropTo(t, summer, winter, 'into').ok);
  assert.deepEqual(tree(), ['1 Winter', '1.1 Summer', '2 Spring', '2.1 The garden', '2.2 Visitors']);
  assert.equal(E.holderOf(t, summer), winter);
  assert.equal(t.links.members(winter).at(-1), summer, 'its last part');
  assert.equal(t.links.members(summer).length, words, 'its paragraphs come with it');
  assert.equal(t.links.holders(summer).filter((g) => t.marks.get(g)?.of === 'book-chapter' || t.marks.get(g)?.of === 'book').length, 1, 'in one holder only');
  // A section out of Spring, before Winter (a chapter of the book).
  assert.ok(D.dropTo(t, garden, winter, 'before').ok);
  assert.deepEqual(tree(), ['1 The garden', '2 Winter', '2.1 Summer', '3 Spring', '3.1 Visitors']);
  assert.equal(E.holderOf(t, garden), s.book);
  // The foot of a line with sections: its first section (the line under it).
  assert.ok(D.dropTo(t, garden, spring, 'after').ok);
  assert.deepEqual(tree(), ['1 Winter', '1.1 Summer', '2 Spring', '2.1 The garden', '2.2 Visitors']);
  const parts = t.links.members(spring);
  assert.ok(parts.indexOf(garden) > parts.indexOf(C.headOf(t, spring)) + 1, 'after Spring\'s own paragraphs');
  // A heading's thought stands for its chapter.
  assert.ok(D.dropTo(t, C.headOf(t, summer), spring, 'after').ok);
  assert.equal(E.holderOf(t, summer), spring);
});

test('book tree: never into itself or one it holds, never deeper than three levels', () => {
  const { t, tree, winter, spring, garden, visitors, summer } = setUp();
  assert.equal(D.landing(t, spring, spring, 'into').reason, 'A chapter does not go into itself.');
  assert.equal(D.landing(t, spring, garden, 'into').reason, 'A chapter does not go into one it holds.');
  assert.equal(D.landing(t, spring, visitors, 'before').reason, 'A chapter does not go into one it holds.');
  assert.ok(!D.dropTo(t, spring, garden, 'after').ok);
  assert.deepEqual(tree(), START, 'nothing moved');
  // Spring holds sections: two levels; into a section (level 2) it would make four.
  assert.ok(D.dropTo(t, winter, garden, 'into').ok, 'a plain chapter goes three deep');
  assert.deepEqual(tree(), ['1 Spring', '1.1 The garden', '1.1.1 Winter', '1.2 Visitors', '2 Summer']);
  assert.match(D.landing(t, summer, winter, 'into').reason, /three levels/);
  assert.match(D.landing(t, spring, summer, 'into').reason, /three levels/);
  assert.ok(D.landing(t, summer, winter, 'before').ok, 'beside the deepest is fine');
});

test('book tree: each drop one step, undone in one', () => {
  const { host, t, tree, winter, garden, summer } = setUp();
  D.dropTo(t, garden, winter, 'into');
  assert.deepEqual(tree(), ['1 Winter', '1.1 The garden', '2 Spring', '2.1 Visitors', '3 Summer']);
  host.world.undo();
  assert.deepEqual(tree(), START);
  D.dropTo(t, summer, winter, 'before');
  host.world.undo();
  assert.deepEqual(tree(), START);
});

test('book tree: a paragraph moved into a chapter lands at the end of its own words', () => {
  const { t, s, spring, garden, summer } = setUp();
  const p = t.links.members(summer).at(-1);
  assert.ok(E.moveInto(t, p, spring).ok);
  const parts = t.links.members(spring);
  assert.equal(parts.indexOf(p), parts.indexOf(garden) - 1, 'before its first section');
  assert.equal(E.holderOf(t, p), spring);
  assert.ok(s.room);
});
