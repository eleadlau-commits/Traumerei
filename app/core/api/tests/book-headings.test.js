// Book (app/optional/extra/book): headings step down in size as they nest (column.js HEAD_SCALE:
// a chapter's the largest, then a section's, then a subsection's), and each heading's row is laid
// out that tall, on pages and in one column; a heading's number hangs in the left margin in a box
// that ends before the heading, wide enough for a deep number (12.10.3), so it never runs into
// the words at any level.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const P = await load('book', 'pages.js');
const S = await load('book', 'tests/sample.js');

const set = (host, room, o) => { const r = host.w.things[room]; r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), ...o } }; host.world.save(); };

function setUp() {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  // A subsection (level 3) under "The garden": "Peas".
  const { model, links: Lk } = host.lib;
  const garden = s.chapters.find((c) => host.w.things[c]?.title === 'The garden') || s.chapters[2];
  const sub = model.create(host.w, s.room, { kind: 'group', of: 'book-chapter', title: 'Peas', family: true, x: 0, y: 0 }, host.tick());
  model.join(host.w, garden, sub.id);
  const head = model.create(host.w, s.room, { kind: 'line', text: 'Peas' }, host.tick());
  model.join(host.w, sub.id, head.id);
  Lk.set(host.w, Lk.kindId('heads', head.id, sub.id), { from: head.id, to: sub.id, kind: 'heads' });
  const p = model.create(host.w, s.room, { kind: 'line', text: 'By May there are peas.' }, host.tick());
  model.join(host.w, sub.id, p.id);
  host.world.save();
  host.choose(s.room);
  const measure = (text, width) => t.ui.measure(text, width);
  return { host, t, s, measure, sub: sub.id };
}

test('book headings: a chapter\'s heading is taller than a section\'s, a section\'s than a subsection\'s, and a subsection\'s than the text', () => {
  const { host, t, s, measure } = setUp();
  assert.ok(C.HEAD_SCALE[0] > C.HEAD_SCALE[1] && C.HEAD_SCALE[1] > C.HEAD_SCALE[2] && C.HEAD_SCALE[2] > 1, 'the scale steps down, and stays over the text');
  const W = 600, words = 'Winter';
  const hs = [1, 2, 3].map((d) => C.headHeight(measure, words, W, d));
  assert.ok(hs[0] > hs[1] && hs[1] > hs[2] && hs[2] > measure(words, W).height, `one line: ${hs.join(' > ')}`);
  const long = 'A heading long enough to run on to a second line at the larger size, and maybe a third one too';
  assert.ok(C.headHeight(measure, long, W, 1) >= C.headHeight(measure, long, W, 2), 'a long one too');
  for (const pages of ['a4', 'none']) {
    set(host, s.room, { pages });
    const L = P.shape(t, s.room, measure);
    const heightOf = (text) => { const r = L.rows.find((x) => t.marks.text(x.mark) === text); return r?.height; };
    // Winter (a chapter), Visitors (a section), Peas (a subsection): each one line.
    const [h1, h2, h3] = ['Winter', 'Visitors', 'Peas'].map(heightOf);
    assert.ok(h1 && h2 && h3, `${pages}: all three laid out`);
    assert.ok(h1 > h2 && h2 > h3, `${pages}: ${h1} > ${h2} > ${h3}`);
    const para = heightOf('Nobody does ask. He writes it down anyway.');
    assert.ok(h3 > para, `${pages}: a subsection's heading over a line of text`);
  }
});

test('book headings: a number never runs into its heading, however deep (12.10.3)', () => {
  const { host, t, s, measure } = setUp();
  const lh = 27.5, L = -300;
  for (const d of [1, 2, 3]) {
    const s1 = C.headScale(d), b = C.numBox(L, 0, lh * s1, '12.10.3', d);
    assert.ok(b.x + b.w <= L - lh * s1 * C.NUM_GAP + 1e-9, `level ${d}: it ends before the heading, with air`);
    // The number set at .82 of its heading's size (style.css): a digit under .62 em, a point under .3 em.
    const em = (lh * s1 / 1.45) * 0.82;
    assert.ok(b.w >= em * (5 * 0.62 + 2 * 0.3), `level ${d}: wide enough for 12.10.3 (${b.w.toFixed(1)} px)`);
  }
  assert.ok(C.numWidth('12.10.3', lh) > C.numWidth('1', lh), 'a longer number, a wider box');
  assert.equal(C.numWidth('1', lh), lh * 1.9, 'a short one as wide as ever');
  // In the laid-out book: each number box ends before the heading it numbers starts, on pages and in one column.
  for (const pages of ['a4', 'none']) {
    set(host, s.room, { pages });
    const L2 = P.shape(t, s.room, measure);
    const nums = L2.boxes.filter((b) => b.style === 'heading' && !b.opens && b.label);
    assert.ok(nums.some((b) => b.label === '2.1.1'), `${pages}: the subsection is numbered (${nums.map((b) => b.label).join(', ')})`);
    for (const b of nums) {
      const top = b.y + (b.h / 1.3) * 0.15; // the top of the heading's first line (numBox: 0.15 of a line above it)
      const head = L2.rows.find((r) => Math.abs(r.y - r.height / 2 - top) < 1);
      assert.ok(head, `${pages}: number ${b.label} has its heading beside it`);
      assert.ok(b.x + b.w < head.x - head.width / 2, `${pages}: number ${b.label} ends before its heading`);
    }
  }
});
