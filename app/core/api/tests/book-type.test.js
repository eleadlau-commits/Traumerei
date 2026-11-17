// Book (app/optional/extra/book): Type size (column.js typeOf): the words, headings, spacing and
// margin numbers smaller or larger together against a page that stays, so more fits on a page at
// 70% than at 100%; the proportions between them hold; it is kept in the room's rule settings and
// read back from there; Book · blocks and the Word document follow it.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const B = await load('book', 'blocks.js');
const WD = await load('book', 'word.js');
const S = await load('book', 'tests/sample.js');

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  // A longer book: forty more paragraphs in Summer.
  const summer = s.chapters.find((c) => host.w.things[c]?.title === 'Summer') || s.chapters.at(-1);
  for (let i = 0; i < 40; i++) {
    const p = host.lib.model.create(host.w, s.room, { kind: 'line', text: `Paragraph ${i + 1}. The lamp turns all night against a sky the colour of milk, and the keeper sleeps in the afternoons, when the light is strongest and the sea is flat.` }, host.tick());
    host.lib.model.join(host.w, summer, p.id);
  }
  host.world.save();
  host.choose(s.room);
  const measure = (text, width) => t.ui.measure(text, width);
  return { host, t, s, measure };
}

test('book type size: at 70% more fits on a page (fewer pages), at 125% less; the page stays the same paper', () => {
  const { t, s, measure } = setUp();
  const pages = (v) => { assert.ok(C.setType(t, s.room, v).ok, `set ${v}`); return P.shape(t, s.room, measure).pages; };
  const at100 = pages('100'), at70 = pages('70'), at125 = pages('125');
  assert.ok(at70 < at100, `70%: ${at70} pages, fewer than ${at100}`);
  assert.ok(at125 > at100, `125%: ${at125} pages, more than ${at100}`);
  // The paper's proportions do not change: only how big it is against the words.
  C.setType(t, s.room, '100'); const p1 = P.pageOf(t, s.room);
  C.setType(t, s.room, '70'); const p7 = P.pageOf(t, s.room);
  assert.ok(Math.abs(p7.w / p7.h - p1.w / p1.h) < 0.01 && Math.abs(p7.m / p7.w - p1.m / p1.w) < 0.01, 'the same page and margins');
  assert.ok(Math.abs(p7.w * 0.7 - p1.w) < 2, 'against the words, the page is 1/0.7 as large');
});

test('book type size: headings, lines, gaps and margin numbers keep their proportions to each other, and shrink against the page', () => {
  const { t, s, measure } = setUp();
  const read = (v) => {
    C.setType(t, s.room, v);
    const L = P.shape(t, s.room, measure), page = L.page;
    const h = (text) => L.rows.find((r) => t.marks.text(r.mark) === text).height;
    const num = L.boxes.find((b) => b.style === 'heading' && !b.opens && b.label === '1');
    return { chapter: h('Winter'), section: h('Visitors'), line: L.lineHeight, num: num.w, page: page.h };
  };
  const a = read('100'), b = read('70');
  for (const k of ['section', 'line', 'num']) assert.ok(Math.abs(a.chapter / a[k] - b.chapter / b[k]) < 0.02, `chapter : ${k} the same at 70%`);
  assert.ok(Math.abs((b.chapter / b.page) / (a.chapter / a.page) - 0.7) < 0.02, 'a chapter heading, against the page, 70% as tall');
  assert.ok(Math.abs((b.line / b.page) / (a.line / a.page) - 0.7) < 0.02, 'a line, against the page, 70% as tall');
});

test('book type size: kept in the room\'s rule settings, read back from there, and a stray value is 100%', () => {
  const { host, t, s } = setUp();
  const rule = host.added('book').find((a) => a.slot === 'world.ontologies' && a.item.id === C.RULE).item;
  assert.ok((rule.settings || []).some((x) => (x.key || x.id) === 'type'), 'a Type size setting in the ⚙');
  assert.equal(C.typeOf(t, s.room), 1, '100% by default');
  assert.ok(C.setType(t, s.room, '80').ok);
  assert.equal(t.marks.get(s.room).rules[C.RULE].type, '80', 'kept under the rule');
  assert.equal(C.typeOf(t, s.room), 0.8);
  assert.equal(C.typeOf(t, s.room, { type: '125' }), 1.25, 'the settings handed to the rule win');
  assert.equal(C.setType(t, s.room, '55').ok, false, 'not a step: refused');
  host.w.things[s.room].rules[C.RULE].type = 'tiny';
  assert.equal(C.typeOf(t, s.room), 1, 'a stray value reads as 100%');
  assert.equal(C.stepType('100', -1), '90'); assert.equal(C.stepType('70', -1), '70'); assert.equal(C.stepType('125', 1), '125');
});

test('book type size: Book · blocks holds more words in a block, the Word document sets the type smaller', () => {
  const { t, s, measure } = setUp();
  const width = () => B.board(t, s.room, measure).rows.find((r) => (t.marks.text(r.mark) || '').startsWith('Nobody reads the log'))?.width;
  C.setType(t, s.room, '100'); const w1 = width();
  C.setType(t, s.room, '70'); const w7 = width();
  assert.ok(Math.abs(w7 * 0.7 - w1) < 1, `a block 1/0.7 as wide against the words (${w1} → ${w7})`);
  const sz = (xml, id) => +new RegExp(`w:styleId="${id}".*?<w:sz w:val="(\\d+)"`).exec(xml)[1];
  const at = WD.stylesFor(1), small = WD.stylesFor(0.7);
  assert.equal(/<w:sz w:val="(\d+)"/.exec(small)[1], '17', 'the text 8.5 pt (12 × 0.7)');
  for (const id of ['Heading1', 'Heading2', 'Heading3']) assert.ok(Math.abs(sz(small, id) - sz(at, id) * 0.7) <= 0.5, `${id} 70%`);
  assert.equal(WD.stylesFor(1), at, '100%: as it was');
});
