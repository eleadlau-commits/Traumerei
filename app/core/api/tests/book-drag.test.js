// Book: dragging on the pages (app/optional/book/flowdrop.js). A paragraph let go between two rows
// moves there as one { join, at, from } step, within or across chapters; onto a heading, first in
// that chapter; a heading carries its chapter, never into itself; under the last page, out of the
// book; into the outer margin, a margin note, and a note back into the flow a paragraph again;
// let go where it is or nudged in its own row, nothing; the same on spreads, a grid and Pages: None;
// a drop on a 1,500-paragraph book is quick.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const F = await load('book', 'flowdrop.js');
const S = await load('book', 'tests/sample.js');

const later = () => new Promise((r) => setTimeout(r, 5));
const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === C.RULE).item;
  const measure = (text, width) => t.ui.measure(text, width);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  const lay = () => P.shape(t, s.room, measure, size);
  const row = (L, id) => L.rows.find((r) => r.mark === id);
  const top = (r) => r.y - r.height / 2 + 2, bottom = (r) => r.y + r.height / 2 - 2;
  const drop = (id, x, y, L = lay()) => F.flowDrop(t, s.room, id, x, y, L);
  return { host, t, s, rule, lay, row, top, bottom, drop, text: (id) => t.marks.text(id) };
}

test('book drag: a paragraph let go after another in its chapter moves there, one step', () => {
  const { host, t, s, rule, lay, row, bottom, drop } = setUp();
  const winter = s.chapters[0];
  const [h, p1, p2, p3] = t.links.members(winter);
  const L = lay(), r3 = row(L, p3);
  assert.deepEqual(drop(p1, r3.x, bottom(r3), L), { mark: p1, join: winter, at: 3 });
  rule.drop(host.w, s.room, p1, r3.x, bottom(r3));
  host.world.save();
  assert.deepEqual(t.links.members(winter), [h, p2, p3, p1]);
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.deepEqual(t.links.members(winter), [h, p1, p2, p3], 'one Ctrl+Z puts it back');
});

test('book drag: across chapters, before the row by its top half; onto a heading, first in that chapter', () => {
  const { host, t, s, rule, lay, row, top, bottom, drop } = setUp();
  const [winter, , , , summer] = s.chapters;
  const a = t.links.members(winter)[1];
  const L = lay();
  const second = row(L, t.links.members(summer)[2]);
  assert.deepEqual(drop(a, second.x, top(second), L), { mark: a, join: summer, at: 2, from: winter });
  // Onto Summer's heading, either half: first in Summer, under the heading.
  const h = row(L, s.heads[4]);
  assert.deepEqual(drop(a, h.x, top(h), L), { mark: a, join: summer, at: 1, from: winter });
  assert.deepEqual(drop(a, h.x, bottom(h), L), { mark: a, join: summer, at: 1, from: winter });
  rule.drop(host.w, s.room, a, second.x, top(second));
  host.world.save();
  assert.equal(t.links.members(summer)[2], a);
  assert.ok(!t.links.members(winter).includes(a), 'it left Winter');
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.equal(t.links.members(winter)[1], a);
});

test('book drag: a heading carries its chapter, at its level; never into itself or a section it holds', () => {
  const { host, t, s, rule, lay, row, top, drop } = setUp();
  const [winter, spring, garden, , summer] = s.chapters;
  const L = lay();
  const h = row(L, s.heads[4]); // Summer's heading, its top half: before Summer
  assert.deepEqual(drop(s.heads[0], h.x, top(h), L), { mark: winter, join: s.book, at: 1 });
  // Into the gap above Summer's heading (its page's top): before Summer, not into Spring.
  const q = P.placeOf(L, L.pageOf.get(s.heads[4]));
  assert.deepEqual(drop(s.heads[0], q.x, q.y + 40, L), { mark: winter, join: s.book, at: 1 });
  rule.drop(host.w, s.room, s.heads[0], h.x, top(h));
  host.world.save();
  assert.deepEqual(t.links.members(s.book), [spring, winter, summer]);
  assert.equal(t.links.members(winter)[0], s.heads[0], 'with its heading and paragraphs');
  host.world.undo();
  assert.deepEqual(t.links.members(s.book), [winter, spring, summer]);
  // Spring's heading let go among its own sections' paragraphs: nothing.
  for (const id of t.links.members(garden).slice(1)) {
    const r = row(L, id);
    assert.equal(drop(s.heads[1], r.x, r.y, L), null, 'not into a section it holds');
  }
  const own = row(L, t.links.members(spring)[1]);
  assert.equal(drop(s.heads[1], own.x, own.y, L), null, 'not into itself');
});

test('book drag: under the last page, out of the book (one step); a stray let go in the flow joins', async () => {
  const { host, t, s, rule, lay, row, bottom, drop } = setUp();
  const winter = s.chapters[0];
  const a = t.links.members(winter)[2];
  const L = lay();
  const below = P.belowGrid(L) + 60;
  assert.deepEqual(drop(a, 0, below, L), { later: 'leave', mark: a });
  const stray = C.flow(t, s.room).at(-1);
  assert.equal(drop(stray, 0, below, L), null, 'a stray there already: nothing');
  const r = row(L, t.links.members(winter)[1]);
  assert.deepEqual(drop(stray, r.x, bottom(r), L), { mark: stray, join: winter, at: 2 }, 'no from: it was in no chapter');
  rule.drop(host.w, s.room, a, 0, below);
  await later();
  assert.ok(!t.links.holders(a).length, 'out of the book');
  assert.ok(C.read(t, s.room).items.some((x) => x.t === 'stray' && x.mark === a), 'among the thoughts not yet in it');
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.equal(t.links.members(winter)[2], a, 'one Ctrl+Z puts it back');
});

test('book drag: into the outer margin, a note on that paragraph; a note dragged into the flow a paragraph there', async () => {
  const { host, t, s, rule, lay, row, bottom, drop } = setUp();
  const [winter, , , , summer] = s.chapters;
  const a = t.links.members(winter)[3];
  const L = lay();
  const target = row(L, t.links.members(summer)[1]);
  const mx = target.x + L.width / 2 + 120;
  assert.deepEqual(drop(a, mx, target.y, L), { later: 'note', mark: a, of: t.links.members(summer)[1] });
  assert.equal(drop(s.heads[0], mx, target.y, L), null, 'a heading is not a note');
  rule.drop(host.w, s.room, a, mx, target.y);
  await later();
  assert.equal(C.aboutOf(t, a), t.links.members(summer)[1]);
  assert.ok(!t.links.holders(a).length, 'out of the flow');
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.equal(C.aboutOf(t, a), null, 'one Ctrl+Z');
  assert.equal(t.links.members(winter)[3], a);
  // The sample's note, let go after Summer's first paragraph: a paragraph there.
  const L2 = lay(), r = row(L2, t.links.members(summer)[1]);
  assert.deepEqual(drop(s.note, r.x, bottom(r), L2), { later: 'unnote', mark: s.note, join: summer, at: 2 });
  rule.drop(host.w, s.room, s.note, r.x, bottom(r));
  await later();
  assert.equal(C.aboutOf(t, s.note), null);
  assert.equal(t.links.members(summer)[2], s.note);
  assert.deepEqual(brokenLaws(host.w), []);
  // Moved in the margin beside another paragraph: a note on that one.
  host.world.undo();
  const L3 = lay(), other = row(L3, t.links.members(summer)[2]);
  assert.deepEqual(drop(s.note, other.x + L3.width / 2 + 150, other.y, L3), { later: 'note', mark: s.note, of: t.links.members(summer)[2] });
});

test('book drag: let go where it is, or nudged inside its own row or next to it, nothing', () => {
  const { t, s, lay, row, top, bottom, drop } = setUp();
  const L = lay();
  for (const ch of s.chapters) {
    const ms = t.links.members(ch);
    ms.forEach((id, i) => {
      const r = row(L, id);
      if (!r) return;
      assert.equal(drop(id, r.x, r.y, L), null, 'where it is');
      assert.equal(drop(id, r.x + 30, r.y - 20, L), null, 'a clear-space nudge');
      const prev = ms[i - 1] && row(L, ms[i - 1]);
      if (prev && !C.headed(t, id) && !C.headed(t, ms[i - 1])) assert.equal(drop(id, prev.x, bottom(prev), L), null, 'after the one before it');
      const next = ms[i + 1] && row(L, ms[i + 1]);
      if (next && !C.headed(t, id) && !C.headed(t, ms[i + 1]) && t.marks.get(ms[i + 1]).kind === 'line') assert.equal(drop(id, next.x, top(next), L), null, 'before the one after it');
    });
  }
  // The note, nudged beside its own paragraph: nothing.
  const n = row(L, s.note);
  assert.equal(drop(s.note, n.x + 10, n.y + 30, L), null);
});

test('book drag: on spreads, a grid of columns or rows, and Pages: None, the point reads the page it is over', () => {
  const { host, t, s, lay, row, top, drop } = setUp();
  const [winter, , , , summer] = s.chapters;
  const a = t.links.members(winter)[1];
  const target = t.links.members(summer)[2];
  for (const o of [{ grid: 'columns', count: '2' }, { grid: 'columns', count: '3' }, { grid: 'rows', count: '2' }, { pages: 'none' }]) {
    set(host, s.room, o);
    const L = lay();
    const r = row(L, target);
    assert.deepEqual(drop(a, r.x, top(r), L), { mark: a, join: summer, at: 2, from: winter }, `${JSON.stringify(o)}: before Summer's second paragraph`);
    const under = L.page ? P.belowGrid(L) + 60 : Math.max(...L.rows.map((x) => x.y + x.height / 2)) + 60;
    assert.deepEqual(drop(a, r.x, under, L), { later: 'leave', mark: a }, `${JSON.stringify(o)}: under the book`);
  }
  // Spreads: on a left-hand page the outer margin is on the left.
  set(host, s.room, { pages: 'a4', grid: 'columns', count: '2' });
  const L = lay();
  const left = C.flow(t, s.room).find((id) => L.pageOf.get(id) && P.placeOf(L, L.pageOf.get(id)).left && id !== a && !C.headed(t, id));
  const r = row(L, left), q = P.placeOf(L, L.pageOf.get(left));
  assert.ok(q.left);
  assert.deepEqual(drop(a, q.x - L.width / 2 - 100, r.y, L), { later: 'note', mark: a, of: left }, 'the left margin of a left-hand page');
  assert.ok(drop(a, q.x + L.width / 2 + 10, r.y, L)?.later !== 'note', 'its inner margin: the flow, not a note');
  // A page in an empty slot of the grid (nothing there): nothing.
  assert.equal(drop(a, q.x - 5000, r.y, L), null);
});

test('book drag: a paragraph that runs on to the next page counts as its paragraph on either page', () => {
  const { t, s, lay, top, bottom, drop } = setUp();
  const winter = s.chapters[0];
  const long = t.marks.make({ content: 'A long paragraph that runs on. '.repeat(200), in: s.room }).id;
  t.links.link(long, winter, 'part of', null, { at: 2 });
  const L = lay();
  const pieces = L.rows.filter((r) => r.mark === long);
  assert.ok(pieces.length > 1, 'in pieces');
  const a = t.links.members(s.chapters[4])[1];
  const last = pieces[pieces.length - 1];
  assert.deepEqual(drop(a, last.x, bottom(last), L), { mark: a, join: winter, at: 3, from: s.chapters[4] }, 'after it, from its last piece');
  assert.deepEqual(drop(a, last.x, top(last), L), { mark: a, join: winter, at: 2, from: s.chapters[4] }, 'before it, from its last piece');
});

test('book drag: a drop on a 1,500-paragraph book is quick', () => {
  const host = makeHost({ thoughts: 0 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const { model } = host.lib;
  const room = model.addRoom(host.w, 'Big', host.tick(), {}, C.RULE);
  const b = model.create(host.w, room.id, { kind: 'group', of: 'book', title: 'Big', family: true, x: 0, y: 0 }, host.tick());
  const chs = [];
  for (let c = 0; c < 30; c++) {
    const ch = model.create(host.w, room.id, { kind: 'group', of: 'book-chapter', title: `C${c}`, family: true, x: 0, y: 0 }, host.tick());
    model.join(host.w, b.id, ch.id);
    chs.push(ch.id);
    for (let i = 0; i < 50; i++) model.join(host.w, ch.id, model.create(host.w, room.id, { kind: 'line', text: `paragraph ${c}.${i} ${'word '.repeat(20 + (i % 40))}` }, host.tick()).id);
  }
  host.world.save();
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === C.RULE).item;
  const lay = t.rules.layout(C.RULE, room.id);
  const a = t.links.members(chs[0])[3];
  const target = t.links.members(chs[20])[10];
  const p = lay.find((r) => r.mark === target).position;
  rule.drop(host.w, room.id, a, p.x, p.y + 1); // warm
  host.world.save();
  const t0 = performance.now();
  rule.drop(host.w, room.id, t.links.members(chs[0])[5], p.x, p.y - 1);
  const ms = performance.now() - t0;
  host.world.save();
  assert.ok(t.links.members(chs[20]).includes(a), 'it moved');
  assert.ok(ms < 60, `dropped in ${ms.toFixed(1)} ms`);
});
