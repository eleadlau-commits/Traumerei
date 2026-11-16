// Book: click anywhere in a chapter to write there (app/optional/book/slots.js). The rule draws a
// slot after each heading and paragraph: a tall one at the end of a chapter (down to the next
// heading, or the page's foot), one under an empty chapter's heading with a hint, thin ones
// between paragraphs; a new thought kept while one is chosen (land hears its centre) goes exactly
// there, as one step; after Enter the box the room keeps chosen is the slot after the paragraph
// just kept; the same on a grid of pages and Pages: None; a 1,500-paragraph book stays quick.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const SL = await load('book', 'slots.js');
const S = await load('book', 'tests/sample.js');

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
  // The room's boxes, as the room draws them (the index is what it keeps chosen).
  const boxes = () => rule.boxes(host.w, s.room);
  const slotAfter = (L, anchor) => L.slots.find((b) => b.slot.anchor === anchor);
  // A thought typed and kept while box i is chosen: made, then land hears the box's centre.
  const keep = (i, text = 'A new paragraph.') => {
    const b = boxes()[i];
    const th = host.lib.model.create(host.w, s.room, { kind: 'line', text }, host.tick());
    rule.land(host.w, s.room, th.id, b.x + b.w / 2, b.y + b.h / 2);
    host.world.save();
    return th.id;
  };
  const indexOf = (b) => boxes().findIndex((x) => Math.abs(x.x - b.x) < 1e-6 && Math.abs(x.y - b.y) < 1e-6 && x.style === 'shelf');
  return { host, t, s, rule, lay, boxes, slotAfter, keep, indexOf, measure, size };
}

test('book slots: a slot after every heading and paragraph, tall at a chapter\'s end, thin between paragraphs', () => {
  const { t, s, lay } = setUp();
  const L = lay();
  const winter = s.chapters[0];
  const [h, p1, p2, p3] = t.links.members(winter);
  const rowsOf = (id) => L.rows.filter((r) => r.mark === id);
  const bottom = (id) => { const r = rowsOf(id).at(-1); return r.y + r.height / 2; };
  const topOf = (id) => { const r = rowsOf(id)[0]; return r.y - r.height / 2; };
  for (const id of [h, p1, p2, p3]) assert.ok(L.slots.some((b) => b.slot.anchor === id), 'a slot after each');
  const gap = L.slots.find((b) => b.slot.anchor === p1);
  assert.equal(gap.level, 2, 'between two paragraphs: thin');
  assert.ok(gap.y <= bottom(p1) + 1e-6 && gap.y + gap.h >= topOf(p2) - 1e-6, 'it covers the gap');
  assert.ok(gap.h < L.lineHeight, 'and is thin');
  assert.equal(gap.x, -L.width / 2); assert.equal(gap.w, L.width);
  const end = L.slots.find((b) => b.slot.anchor === p3);
  assert.equal(end.level, 1, 'after the chapter\'s last paragraph: the end slot');
  assert.ok(end.slot.end);
  assert.ok(Math.abs(end.y - bottom(p3)) < 1e-6);
  assert.ok(end.h > L.lineHeight * 3, 'the rest of the page (the next chapter starts a page)');
  const pg = L.page;
  const pageTop = L.origin + (L.pageOf.get(p3) - 1) * L.pitch;
  assert.ok(Math.abs(end.y + end.h - (pageTop + pg.h - pg.m)) < 1e-6, 'down to the foot of the page\'s words');
  assert.deepEqual({ join: end.slot.join, at: end.slot.at }, { join: winter, at: 4 });
  // The slots come first among the boxes, the last in reading order first; the pages behind them.
  const first = L.boxes.findIndex((b) => b.style !== 'shelf');
  assert.equal(first, L.slots.length);
  assert.deepEqual(L.boxes.slice(0, first), L.slots.slice().reverse());
  assert.ok(!L.slots.some((b) => b.label), 'no hint in a chapter with paragraphs');
});

test('book slots: keeping a thought with a slot chosen lands it there, one step; Enter goes on after it', () => {
  const { host, t, s, lay, keep, indexOf, slotAfter } = setUp();
  const winter = s.chapters[0];
  const [h, p1, p2, p3] = t.links.members(winter);
  // The blank space after Winter's last paragraph.
  const i = indexOf(slotAfter(lay(), p3));
  const a = keep(i, 'First.');
  assert.deepEqual(t.links.members(winter), [h, p1, p2, p3, a], 'the last in Winter');
  assert.deepEqual(brokenLaws(host.w), []);
  // The room keeps box i chosen: it is now the slot after the paragraph just kept.
  const L1 = lay();
  assert.equal(L1.boxes[i], slotAfter(L1, a), 'the caret goes on under it');
  const b = keep(i, 'Second.');
  assert.deepEqual(t.links.members(winter), [h, p1, p2, p3, a, b], 'in order, as typed');
  host.world.undo();
  assert.deepEqual(t.links.members(winter), [h, p1, p2, p3, a], 'one Ctrl+Z takes the last back');
  // Between two paragraphs.
  const c = keep(indexOf(slotAfter(lay(), p1)), 'Between.');
  assert.deepEqual(t.links.members(winter), [h, p1, c, p2, p3, a]);
  // Under a heading: first in its chapter.
  const d = keep(indexOf(slotAfter(lay(), h)), 'Opening.');
  assert.deepEqual(t.links.members(winter), [h, d, p1, c, p2, p3, a]);
});

test('book slots: an empty chapter has a slot under its heading with a hint, and a thought kept there goes in', () => {
  const { host, t, s, lay, keep, indexOf, slotAfter } = setUp();
  const { model, links: Lk } = host.lib;
  const ch = model.create(host.w, s.room, { kind: 'group', of: 'book-chapter', title: 'Autumn', family: true, x: 0, y: 0 }, host.tick());
  model.join(host.w, s.book, ch.id);
  const head = model.create(host.w, s.room, { kind: 'line', text: 'Autumn' }, host.tick());
  model.join(host.w, ch.id, head.id);
  Lk.set(host.w, Lk.kindId('heads', head.id, ch.id), { from: head.id, to: ch.id, kind: 'heads' });
  host.world.save();
  const L = lay();
  const slot = slotAfter(L, head.id);
  assert.ok(slot, 'a slot under the heading');
  assert.equal(slot.label, SL.HINT);
  assert.equal(slot.level, 1);
  assert.ok(slot.h >= L.lineHeight, 'at least a line tall');
  const a = keep(indexOf(slot), 'The storms.');
  assert.deepEqual(t.links.members(ch.id), [head.id, a]);
  assert.ok(!lay().slots.some((b) => b.label), 'the hint goes once it has a paragraph');
  // A chapter with no heading thought: the slot under its title box.
  const bare = model.create(host.w, s.room, { kind: 'group', of: 'book-chapter', title: 'Coda', family: true, x: 0, y: 0 }, host.tick());
  model.join(host.w, s.book, bare.id);
  host.world.save();
  const L2 = lay();
  const bs = L2.slots.find((b) => b.slot.join === bare.id);
  assert.ok(bs && bs.label === SL.HINT && bs.slot.anchor === null);
  const c = keep(indexOf(bs), 'The end.');
  assert.deepEqual(t.links.members(bare.id), [c]);
});

test('book slots: on a grid of pages, spreads and Pages: None, each slot sits with its page', () => {
  const { host, t, s, lay, keep, indexOf, slotAfter } = setUp();
  const winter = s.chapters[0];
  for (const o of [{ grid: 'columns', count: '2' }, { grid: 'columns', count: '3' }, { grid: 'rows', count: '2' }, { pages: 'none' }]) {
    set(host, s.room, { pages: 'a4', grid: 'columns', count: '1', ...o });
    const L = lay();
    const p3 = t.links.members(winter).at(-1); // the chapter's last paragraph
    const r = L.rows.filter((x) => x.mark === p3).at(-1);
    const slot = slotAfter(L, p3);
    assert.ok(Math.abs(slot.x - (r.x - L.width / 2)) < 1e-6, `${JSON.stringify(o)}: under its paragraph, across the column`);
    assert.ok(Math.abs(slot.y - (r.y + r.height / 2)) < 1e-6, `${JSON.stringify(o)}: from its foot`);
    if (L.page) {
      const n = P.pageAt(L, slot.x + slot.w / 2, slot.y + 1);
      assert.equal(n, L.pageOf.get(p3), 'on its page');
      assert.ok(slot.y + slot.h <= P.placeOf(L, n).y + L.page.h - L.page.m + 1e-6, 'within its words');
    }
    const before = t.links.members(winter).length;
    const a = keep(indexOf(slot), `In ${JSON.stringify(o)}.`);
    assert.equal(t.links.members(winter).at(-1), a);
    assert.equal(t.links.members(winter).length, before + 1);
  }
});

test('book slots: a 1,500-paragraph book with its slots lays out in under 50 ms', () => {
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
  const measure = (text, width) => t.ui.measure(text, width);
  P.shape(t, room.id, measure);
  for (const o of [{}, { pages: 'none' }, { grid: 'columns', count: '2' }]) {
    host.w.things[room.id].rules = { [C.RULE]: o };
    P.shape(t, room.id, measure); // the words measured at this width once (as the room has them)
    const t0 = performance.now();
    const L = P.shape(t, room.id, measure);
    const ms = performance.now() - t0;
    assert.equal(L.slots.length, 1500 + 30, 'one after each paragraph and heading (the chapters have none)');
    assert.ok(ms < 50, `${JSON.stringify(o)}: laid out in ${ms.toFixed(1)} ms`);
  }
});
