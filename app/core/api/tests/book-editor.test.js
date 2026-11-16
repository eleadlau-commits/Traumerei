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
const P = await load('book', 'pages.js');
const R = await load('book', 'rules.js');
const S = await load('book', 'tests/sample.js');
const Z = await load('book', 'zoom.js');

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
  const W = P.textWidth(t, s.room);
  assert.ok(lay.filter((r) => r.mark !== s.note).every((r) => r.width === W), 'every row the measure wide');
  const ys = C.flow(t, s.room).map((id) => rows.get(id).position.y);
  assert.deepEqual(ys, [...ys].sort((a, b) => a - b), 'rows run down the page in reading order');
  const boxes = t.rules.draws(C.RULE, s.room).boxes;
  assert.ok(boxes.some((b) => b.style === 'title' && b.label === S.TEXT.title));
  assert.deepEqual(boxes.filter((b) => b.style === 'heading').map((b) => b.label), ['1', '2', '2.1', '2.2', '3']);
});

// A room's settings under the Book rule, as its ⚙ keeps them.
const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };

test('book editor: pages: a title page, each chapter on a new page, numbered, a paragraph running on in pieces', () => {
  const { host, t, s } = setUp();
  const measure = (text, width) => t.ui.measure(text, width);
  const p = P.pageOf(t, s.room);
  assert.equal(p.name, 'A4', 'A4 unless the room says otherwise');
  let lay = P.paginate(t, s.room, measure);
  assert.equal(lay.pageOf.get(s.heads[0]), 2, 'the title page is page 1; Winter opens page 2');
  assert.equal(lay.pageOf.get(s.heads[1]), 3, 'Spring starts a page of its own');
  assert.equal(lay.pageOf.get(s.heads[2]), 3, 'a section does not');
  const pages = lay.boxes.filter((b) => b.style === 'page');
  assert.equal(pages.length, lay.pages);
  assert.ok(lay.boxes.some((b) => b.style === 'quiet' && b.label === '2'), 'numbered at the foot');
  // Every row of the book inside a page's margins.
  const inside = (r) => pages.some((b) => r.y - r.height / 2 >= b.y + p.m - 0.5 && r.y + r.height / 2 <= b.y + b.h - p.m + 0.5);
  const book = new Set(C.flow(t, s.room).filter((id) => lay.pageOf.has(id)));
  assert.ok(lay.rows.filter((r) => book.has(r.mark)).every(inside), 'nothing over a margin');
  // Chapters run on: no page between Winter and Spring.
  set(host, s.room, { chapterPage: false });
  lay = P.paginate(t, s.room, measure);
  assert.equal(lay.pageOf.get(s.heads[1]), 2);
  // A long paragraph on A5 runs on to the next page, never one line alone at the foot or top.
  set(host, s.room, { pages: 'a5', chapterPage: true });
  const long = t.marks.make({ content: 'A long paragraph that runs on. '.repeat(120), in: s.room }).id;
  t.links.link(long, s.chapters[0], 'part of', null, { at: 1 });
  lay = P.paginate(t, s.room, measure);
  const bits = lay.rows.filter((r) => r.mark === long);
  assert.ok(bits.length >= 2, 'in pieces');
  const total = measure(t.marks.text(long), P.textWidth(t, s.room)).lines;
  assert.equal(bits.reduce((n, r) => n + (r.lines[1] - r.lines[0]), 0), total, 'every line once');
  assert.ok(bits.every((r) => r.lines[1] - r.lines[0] >= 2), 'no line alone');
  // One column again: no pages.
  set(host, s.room, { pages: 'none' });
  assert.equal(P.pageOf(t, s.room), null);
  assert.equal(P.shape(t, s.room, measure).pages, 0);
});

test('book editor: margin notes: beside their paragraph, out of the flow and the export; Alt+N back and forth', () => {
  const { t, s, text } = setUp();
  const measure = (x, w) => t.ui.measure(x, w);
  assert.ok(!C.flow(t, s.room).includes(s.note), 'not in the flow');
  assert.ok(!C.read(t, s.room).items.some((x) => x.mark === s.note), 'nor among the thoughts not in the book');
  const lay = P.paginate(t, s.room, measure);
  const n = lay.rows.find((r) => r.mark === s.note), of = lay.rows.find((r) => r.mark === s.paras[1]);
  assert.ok(n.x - n.width / 2 > lay.page.w / 2, 'beside the page');
  assert.ok(Math.abs((n.y - n.height / 2) - (of.y - of.height / 2)) < 1, 'level with its paragraph');
  assert.ok(!R.markdown(R.tree(t, s.book)).includes('Margin note'), 'left out of the export');
  // Alt+N on a paragraph: a note on the one before; again: back after it.
  const [, a, b] = t.links.members(s.chapters[0]);
  assert.ok(E.makeNote(t, s.room, b).ok);
  assert.equal(C.aboutOf(t, b), a);
  assert.ok(!t.links.members(s.chapters[0]).includes(b));
  assert.ok(E.unmakeNote(t, b).ok);
  assert.deepEqual(t.links.members(s.chapters[0]).slice(1, 3), [a, b]);
  assert.equal(E.makeNote(t, s.room, s.heads[0]).ok, false, 'a heading is not a note');
  void text;
});

test('book editor: the export has each heading once, as its chapter\'s title', () => {
  const { t, s } = setUp();
  const md = R.markdown(R.tree(t, s.book));
  assert.equal(md.split('Winter').length - 1, 1);
  assert.ok(md.includes('## 1 Winter'));
  t.marks.edit(s.heads[0], { text: 'Deep winter' });
  assert.ok(R.markdown(R.tree(t, s.book)).includes('## 1 Deep winter'), 'the heading as written now');
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

test('book editor: far off, each heading reads as its title; a page opens its first paragraph', () => {
  const { host, t, s } = setUp();
  const measure = (x, w) => t.ui.measure(x, w);
  const titles = ['Winter', 'Spring', 'The garden', 'Visitors', 'Summer'];
  const bandsOf = () => new Map(t.rules.layout(C.RULE, s.room).map((r) => [r.mark, r.bands]));
  let bands = bandsOf();
  assert.deepEqual(s.heads.map((h) => bands.get(h)?.far), titles, 'a heading: its title under far');
  assert.ok(C.flow(t, s.room).filter((id) => !s.heads.includes(id)).every((id) => !bands.get(id)), 'a paragraph: no band words (quiet lines, by the look)');
  // The pages: each opens the first paragraph that starts on it, else the one running on to it.
  set(host, s.room, { pages: 'a5' });
  const long = t.marks.make({ content: 'A long paragraph that runs on. '.repeat(160), in: s.room }).id;
  t.links.link(long, s.chapters[0], 'part of', null, { at: 1 });
  const lay = P.paginate(t, s.room, measure);
  const pages = lay.boxes.filter((b) => b.style === 'page');
  assert.equal(pages.length, lay.pages);
  assert.equal(pages[0].opens, undefined, 'the title page: its title box opens the book');
  pages.forEach((b, i) => { assert.equal(Z.pageAt(lay, b.y), i + 1, 'a page box says its page'); if (i) assert.equal(b.opens, lay.firstOn[i], `page ${i + 1}`); });
  assert.equal(lay.firstOn[1], s.heads[0], 'Winter opens page 2');
  const on = (r, n) => r.y >= P.pageTop(lay, n) && r.y <= P.pageTop(lay, n) + lay.page.h;
  for (let n = 2; n <= lay.pages; n++) {
    const id = lay.firstOn[n - 1];
    const starts = [...lay.pageOf.values()].includes(n);
    if (starts) assert.equal(lay.pageOf.get(id), n, `page ${n} opens a paragraph that starts there`);
    else assert.ok(lay.rows.some((r) => r.mark === id && on(r, n)), `page ${n}: the paragraph running on to it`);
  }
  const bits = lay.rows.filter((r) => r.mark === long);
  assert.ok(bits.length >= 3, 'the long paragraph over three pages or more');
  const whole = lay.pageOf.get(long) + 1; // a page all of the running paragraph
  assert.ok(on(bits[1], whole) && lay.firstOn[whole - 1] === long, 'a page all of one running paragraph opens it');
  // The running heads are level 1 (read large far off); page numbers are not.
  const heads = lay.boxes.filter((b) => b.style === 'quiet' && b.level === 1);
  assert.ok(heads.length && heads.every((b) => ['Winter', 'Spring', 'Summer'].includes(b.label)), 'a chapter\'s title at the head of its pages');
  assert.ok(lay.boxes.filter((b) => b.style === 'quiet' && /^\d+$/.test(b.label)).every((b) => !b.level));
  // The heading as written now; and in one column, still its title far off.
  t.marks.edit(s.heads[1], { text: 'Early spring\nand more' });
  assert.equal(bandsOf().get(s.heads[1]).far, 'Early spring', 'its first line');
  set(host, s.room, { pages: 'none' });
  bands = bandsOf();
  assert.equal(bands.get(s.heads[0]).far, 'Winter');
});

test('book editor: going to a page: the zoom that fills the height, and two zooms that move the view', () => {
  assert.equal(Z.fillHeight(1010, 1034), 1);
  assert.equal(Z.fillHeight(1010, 300), 0.5, 'never under mid: the words still read');
  assert.equal(Z.fillHeight(100, 4000), 4);
  const lay = { origin: -300, pitch: 1066, page: { h: 1010 } };
  assert.equal(P.pageTop(lay, 3), -300 + 2 * 1066);
  assert.deepEqual(Z.pageCentre(lay, 1, 1, 1100), { x: 0, y: -300 + 505 }, 'the whole page, when it fits');
  const c = Z.pageCentre(lay, 2, 1, 600);
  assert.ok(Math.abs(c.y - (766 - 12 + 300)) < 1e-9, 'else its top, with a little air');
  // What t.ui.zoom.set(z, at) does to the view's middle (room/view.js setZoom): at + (V - at) * z0 / z.
  const run = (V, z0, steps) => steps.reduce((v, st) => ({ x: st.at.x + (v.x - st.at.x) * v.z / st.zoom, y: st.at.y + (v.y - st.at.y) * v.z / st.zoom, z: st.zoom }), { ...V, z: z0 });
  for (const [V, z0, C2, z] of [[{ x: 120, y: 900 }, 0.3, { x: 0, y: 2000 }, 0.8], [{ x: 0, y: 0 }, 1, { x: 50, y: -400 }, 1], [{ x: 10, y: 10 }, 2, { x: -40, y: 70 }, 4]]) {
    const end = run(V, z0, Z.aim(V, z0, C2, z));
    assert.ok(Math.abs(end.x - C2.x) < 1e-6 && Math.abs(end.y - C2.y) < 1e-6 && end.z === z, `to ${C2.x},${C2.y} at ${z}`);
  }
});

test('book editor: a 1,500-paragraph book lays out on pages in under 50 ms', () => {
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
