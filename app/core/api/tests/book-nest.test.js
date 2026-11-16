// Book · blocks, chapters as nested blocks (app/optional/extra/book/blocks.js, nest.js): a chapter's block
// holds its paragraphs' blocks and its sections' blocks; a chapter block dragged by its heading
// nests into another (never into itself, never deeper than three levels), one step; a chapter may be
// unnamed (made around blocks, named by its first paragraph, unnamed again) and unnumbered (skipped
// in its siblings' numbering everywhere, kept in the tables through a .traum round trip).

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const B = await load('book', 'blocks.js');
const C = await load('book', 'column.js');
const R = await load('book', 'rules.js');
const N = await load('book', 'nest.js');
const W = await load('book', 'word.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items); // (World.js does this when the slot changes)
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === B.BLOCKS).item;
  const command = (id) => host.added('book').find((a) => a.item?.id === id)?.item;
  const measure = (text, width) => t.ui.measure(text, width);
  const lay = () => B.board(t, s.room, measure);
  const nums = () => C.read(t, s.room).items.filter((x) => x.t === 'heading' || x.t === 'chapter').map((x) => `${x.num}|${C.nameOf(t, x.chapter)}`);
  const [winter, spring, garden, visitors, summer] = s.chapters;
  return { host, t, s, rule, command, lay, nums, winter, spring, garden, visitors, summer };
}
const inside = (a, b) => a.x0 >= b.x && a.x1 <= b.x + b.w && a.y0 >= b.y && a.y1 <= b.y + b.h;
const within = (a, b) => a.x >= b.x && a.x + a.w <= b.x + b.w && a.y >= b.y && a.y + a.h <= b.y + b.h;

test('book nest: a chapter block holds its paragraphs\' blocks and its sections\' blocks, which hold theirs', () => {
  const { t, lay, spring, garden, visitors } = setUp();
  const L = lay();
  const o = (id) => L.outlines.find((x) => x.id === id);
  for (const ch of [spring, garden, visitors]) {
    for (const p of t.links.members(ch)) {
      if (C.headed(t, p)) continue;
      const box = L.cells.get(p);
      if (box) assert.ok(inside(box, o(ch)), 'a paragraph\'s block inside its chapter\'s');
    }
  }
  for (const sec of [garden, visitors]) {
    assert.ok(within(o(sec), o(spring)), 'a section\'s block inside its chapter\'s');
    assert.ok(Math.abs(o(sec).w - (o(spring).w - 2 * B.BOARD.pad)) < 1, 'a section block spans its chapter\'s width');
    for (const p of t.links.members(sec)) if (L.cells.get(p)) assert.ok(inside(L.cells.get(p), o(spring)), 'and so inside the chapter too');
  }
  // In reading order among the chapter's paragraphs: Spring's paragraph first, then its sections.
  const para = L.cells.get(t.links.members(spring)[1]);
  assert.ok(para.y1 <= o(garden).y && o(garden).y + o(garden).h <= o(visitors).y);
  // The chapter blocks are drawn as boxes (framed heavier by style.css in this mode).
  assert.ok(L.boxes.filter((b) => b.style === 'quiet').length === 5);
});

test('book nest: a section dropped between paragraphs sits among them, blocks across still flowing round it', () => {
  const { t, s, rule, host, lay, spring, summer, garden } = setUp();
  const L = lay();
  const c = L.cells.get(t.links.members(summer)[2]); // Summer's second paragraph: let go just left of it
  const p = B.dropAt(t, s.room, s.heads[2], c.x0 + 4, (c.y0 + c.y1) / 2, L);
  assert.deepEqual(p, { mark: garden, join: summer, at: 2, from: spring });
  rule.drop(host.w, s.room, s.heads[2], c.x0 + 4, (c.y0 + c.y1) / 2);
  host.world.save();
  assert.equal(t.links.members(summer)[2], garden);
  const L2 = lay();
  const g = L2.outlines.find((x) => x.id === garden), sm = L2.outlines.find((x) => x.id === summer);
  assert.ok(within(g, sm));
  const before = L2.cells.get(t.links.members(summer)[1]), after = L2.cells.get(t.links.members(summer)[3]);
  assert.ok(before.y1 <= g.y && after.y0 >= g.y + g.h, 'its paragraphs before it above, after it below');
  assert.deepEqual(brokenLaws(host.w), []);
  host.world.undo();
  assert.equal(t.links.holders(garden)[0], spring, 'one Ctrl+Z puts it back');
});

test('book nest: a chapter block dragged by its heading nests into another, one step; never into itself, never past three levels', () => {
  const { t, s, rule, host, lay, winter, spring, garden, summer } = setUp();
  let L = lay();
  // Winter into Summer, onto its label strip: Summer's last part.
  const sm = L.outlines.find((x) => x.id === summer);
  const p = B.dropAt(t, s.room, s.heads[0], sm.x + sm.w / 2, sm.y + 4, L);
  assert.deepEqual(p, { mark: winter, join: summer, at: t.links.members(summer).length, from: s.book });
  rule.drop(host.w, s.room, s.heads[0], sm.x + sm.w / 2, sm.y + 4);
  host.world.save();
  assert.equal(t.links.holders(winter)[0], summer);
  assert.ok(C.read(t, s.room).items.some((x) => x.chapter === winter && x.num === '2.1'), 'Winter is section 2.1 now');
  host.world.undo();
  assert.equal(t.links.holders(winter)[0], s.book, 'one Ctrl+Z');
  // Let go inside its own block: nothing.
  L = lay();
  const sp = L.outlines.find((x) => x.id === spring);
  assert.equal(B.dropAt(t, s.room, s.heads[1], sp.x + 30, sp.y + sp.h - 30, L), null, 'into itself or a section it holds: nothing');
  // Winter (one level) into The garden (a section): level 3, it fits.
  const g = L.outlines.find((x) => x.id === garden);
  assert.equal(B.dropAt(t, s.room, s.heads[0], g.x + 30, g.top + 10, L)?.join, garden, 'a flat chapter fits in a section (level 3)');
  const deep = B.dropAt(t, s.room, s.heads[1], L.outlines.find((x) => x.id === summer).x + 30, L.outlines.find((x) => x.id === summer).top + 10, L);
  assert.equal(deep?.join, summer, 'Spring (and its sections) fits in a chapter: three levels');
  // Make Summer hold a section, then Spring (two levels) into that section: refused in words.
  const sec = N.addSection(t, s.room, summer);
  assert.ok(sec.ok);
  L = lay();
  const so = L.outlines.find((x) => x.id === sec.id);
  const no = B.dropAt(t, s.room, s.heads[1], so.x + 20, so.y + so.h - 10, L);
  assert.ok(no?.refuse && /three levels/.test(no.refuse), 'refused in words');
  const toasts = host.toasts.length;
  rule.drop(host.w, s.room, s.heads[1], so.x + 20, so.y + so.h - 10);
  assert.equal(host.toasts.length, toasts + 1, 'said');
  assert.equal(t.links.holders(spring)[0], s.book, 'and not moved');
});

test('book nest: an unnamed chapter around chosen blocks; named by its first paragraph; unnamed again, the chapter kept', () => {
  const { t, s, host, command, winter, nums } = setUp();
  const [, a, b] = t.links.members(winter);
  host.choose(s.room, a);
  host.roomWith({ chosenAll: () => [a, b] });
  const made = N.wrap(t, s.room, [b, a]);
  assert.ok(made.ok);
  const ch = made.id;
  assert.deepEqual(t.links.members(ch), [a, b], 'in their order');
  assert.equal(t.links.members(winter)[1], ch, 'where the first was, after the heading');
  assert.equal(C.nameOf(t, ch), '', 'unnamed');
  assert.ok(nums().includes('1.1|'), 'numbered 1.1, no name');
  assert.equal(C.titleOf(t, ch), '(untitled)');
  // The Book view: its number alone where the heading would be; Markdown the same.
  const col = C.column(t, s.room, (x, w) => t.ui.measure(x, w));
  assert.ok(col.boxes.some((x) => x.label === '1.1' && x.opens === ch));
  assert.ok(R.markdown(R.tree(t, s.book)).includes('### 1.1\n'));
  assert.ok(R.contents(R.tree(t, s.book)).some((x) => x.num === '1.1' && x.title === ''));
  host.world.undo();
  assert.ok(!t.marks.get(ch) && t.links.members(winter)[1] === a, 'one Ctrl+Z');
  // Again, by the key, then named: its first paragraph becomes its heading (Ctrl+Alt+H semantics too).
  const ch2 = N.wrap(t, s.room, [a, b]).id;
  host.choose(s.room, a);
  command('book.name').run();
  assert.equal(C.headOf(t, ch2), a, 'Alt+Shift+H: named by its first paragraph');
  assert.equal(C.nameOf(t, ch2), t.marks.text(a).split('\n')[0].trim());
  assert.ok(N.unname(t, ch2).ok);
  assert.equal(C.headOf(t, ch2), null);
  assert.equal(C.nameOf(t, ch2), '', 'unnamed again');
  assert.deepEqual(t.links.members(ch2), [a, b], 'the chapter kept, its heading a paragraph first in it');
  host.choose(s.room, a);
  command('book.heading').run();
  assert.equal(C.headOf(t, ch2), a, 'Ctrl+Alt+H on the first paragraph of an unnamed chapter names it');
  assert.equal(t.links.holders(ch2)[0], winter, 'and keeps it where it was');
  // The dock's Title: typed on an unnamed chapter, a heading thought made; emptied, unnamed.
  const sec = N.addSection(t, s.room, winter).id;
  assert.equal(C.nameOf(t, sec), '');
  assert.ok(N.rename(t, s.room, sec, '  An interlude ').ok);
  assert.equal(C.nameOf(t, sec), 'An interlude');
  assert.equal(t.marks.text(C.headOf(t, sec)), 'An interlude');
  assert.ok(N.rename(t, s.room, sec, '').ok);
  assert.equal(C.nameOf(t, sec), '');
  assert.deepEqual(brokenLaws(host.w), []);
});

test('book nest: wrap refuses blocks in two chapters, the tray, or past three levels', () => {
  const { t, s, winter, summer, garden } = setUp();
  assert.match(N.wrap(t, s.room, [t.links.members(winter)[1], t.links.members(summer)[1]]).reason, /one chapter/);
  assert.match(N.wrap(t, s.room, [C.flow(t, s.room).at(-1)]).reason, /book/);
  const sec = N.addSection(t, s.room, garden); // level 3
  assert.ok(sec.ok);
  assert.match(N.addSection(t, s.room, sec.id).reason, /three levels/);
  assert.match(N.wrap(t, s.room, [sec.id]).reason, /three levels/, 'a chapter around a level-3 chapter: four');
  assert.ok(N.wrap(t, s.room, [t.links.members(garden)[1]]).ok, 'around a paragraph of a section: level 3, it fits');
});

test('book nest: an unnumbered chapter has no number and is skipped (2, *, 3) everywhere numbering is read', () => {
  const { t, s, host, command, spring, garden, nums } = setUp();
  const preface = N.wrap(t, s.room, [t.links.members(s.chapters[0])[1]]); // (a section of Winter, for the sections case below)
  assert.ok(preface.ok);
  host.choose(s.room, s.heads[1]);
  command('book.numbered').run(); // Alt+U on Spring's heading
  assert.equal(t.marks.get(spring).numbered, false, 'kept as a field of the chapter');
  assert.deepEqual(nums().filter((x) => !x.startsWith('1.')), ['1|Winter', '|Spring', '|The garden', '|Visitors', '2|Summer']);
  // Contents (rules.js), Markdown, the Book view, the blocks, the Word document.
  const toc = R.contents(R.tree(t, s.book));
  assert.deepEqual(toc.filter((x) => x.depth === 1).map((x) => x.num), ['1', '', '2']);
  const md = R.markdown(R.tree(t, s.book));
  assert.ok(md.includes('## Spring\n') && md.includes('## 2 Summer\n') && md.includes('### The garden\n'));
  const col = C.column(t, s.room, (x, w) => t.ui.measure(x, w));
  assert.ok(!col.boxes.some((x) => x.style === 'heading' && x.label === '2' && x.y < col.rows.find((r) => r.mark === s.heads[1]).y), 'no number beside Spring');
  const L = B.board(t, s.room, (x, w) => t.ui.measure(x, w));
  assert.deepEqual(L.boxes.filter((b) => b.style === 'quiet').map((b) => b.label), ['1', '1.1', '', '', '', '2']);
  const doc = W.bodyOf(t, s.book, W.pageSetup(t, s.room)).body.join('');
  assert.ok(doc.includes('>Spring<') && doc.includes('>2  Summer<'), 'Word numbers the same way');
  // Numbered again: the field goes; one step each.
  assert.ok(N.setNumbered(t, spring, true).ok);
  assert.equal(t.marks.get(spring).numbered, undefined);
  host.world.undo();
  assert.equal(t.marks.get(spring).numbered, false, 'one Ctrl+Z');
  assert.ok(N.unnumberedAbove(t, garden));
  assert.deepEqual(brokenLaws(host.w), []);
});

test('book nest: numbered: false travels in a .traum file', () => {
  const { t, s, host, spring } = setUp();
  N.setNumbered(t, spring, false);
  const text = t.carriers.text(s.room);
  const into = t.marks.make({ kind: 'room', content: 'Copy' }).id;
  assert.ok(t.carriers.land(t.carriers.read(text), { into }).ok);
  const copy = t.marks.in(into).filter((m) => R.isChapter(m));
  assert.equal(copy.find((m) => m.title === 'Spring').numbered, false);
  assert.equal(copy.find((m) => m.title === 'Summer').numbered, undefined);
  assert.deepEqual(brokenLaws(host.w), []);
});

test('book nest: a 1,500-paragraph book of nested, unnamed and unnumbered chapters arranges in under 50 ms in both rules', () => {
  const host = makeHost({ thoughts: 0 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const { model } = host.lib;
  const room = model.addRoom(host.w, 'Big', host.tick(), {}, B.BLOCKS);
  const b = model.create(host.w, room.id, { kind: 'group', of: 'book', title: 'Big', family: true, x: 0, y: 0 }, host.tick());
  const group = (title, extra = {}) => model.create(host.w, room.id, { kind: 'group', of: 'book-chapter', title, family: true, x: 0, y: 0, ...extra }, host.tick());
  for (let c = 0; c < 10; c++) {
    const ch = group(c % 3 ? `C${c}` : '', c % 4 ? {} : { numbered: false });
    model.join(host.w, b.id, ch.id);
    for (let s = 0; s < 3; s++) {
      const sec = group(s ? `S${s}` : '');
      model.join(host.w, ch.id, sec.id);
      for (let i = 0; i < 50; i++) model.join(host.w, sec.id, model.create(host.w, room.id, { kind: 'line', text: `paragraph ${c}.${s}.${i} ${'word '.repeat(20 + (i % 40))}` }, host.tick()).id);
    }
  }
  host.world.save();
  for (const rule of [B.BLOCKS, C.RULE]) {
    t.rules.layout(rule, room.id);
    model.update(host.w, model.roomThoughts(host.w, room.id)[7].id, { text: `changed ${rule}` }, host.tick());
    const t0 = performance.now();
    const lay = t.rules.layout(rule, room.id);
    const ms = performance.now() - t0;
    assert.equal(lay.length, 1500);
    assert.ok(ms < 50, `${rule}: arranged in ${ms.toFixed(1)} ms`);
  }
});
