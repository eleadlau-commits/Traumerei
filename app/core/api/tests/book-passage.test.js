// Book (app/optional/extra/book): a passage (a title and its words, a verse of a song) right under a
// chapter's heading. E saw "The Deer Song" with its passage's title, VERSE 1, drawn over it, and the
// passage's words stopping short of the column's edge: the rule laid the passage out as one run of
// words (title — words) but the room drew its title on a line of its own, its words in lines under it
// and its box 380 wide, and centred that taller box on the shorter row, so it spilled up over the
// heading. Now the passage is a block as tall as its title's line and its words wrapped across the
// measure (column.js passageHeight), in the column and on pages, and nothing overlaps it.

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

const VERSE = 'I was moving down the lane like I use to every morning;\nAnd told myself good morning so my day won\'t be so boring;\nMy neighbour seemed delightful, yet my heart was somewhere else.';

function setUp(pages) {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  const { model, links: L } = host.lib;
  model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  const ch = model.create(host.w, s.room, { kind: 'group', of: 'book-chapter', title: 'The Deer Song', family: true, x: 0, y: 0 }, host.tick());
  model.join(host.w, s.book, ch.id);
  const head = model.create(host.w, s.room, { kind: 'line', text: 'The Deer Song' }, host.tick());
  model.join(host.w, ch.id, head.id);
  L.set(host.w, L.kindId('heads', head.id, ch.id), { from: head.id, to: ch.id, kind: 'heads' });
  const verse = model.create(host.w, s.room, { kind: 'passage', title: 'Verse 1', text: VERSE }, host.tick());
  model.join(host.w, ch.id, verse.id);
  const after = model.create(host.w, s.room, { kind: 'line', text: 'And the deer stood still in the lane.' }, host.tick());
  model.join(host.w, ch.id, after.id);
  const r = host.w.things[s.room];
  r.rules = { ...(r.rules || {}), [C.RULE]: { ...(r.rules?.[C.RULE] || {}), pages: pages ? 'a5' : 'none' } };
  host.world.save();
  host.choose(s.room);
  const measure = (x, w) => t.ui.measure(x, w);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  return { t, s, head: head.id, verse: verse.id, after: after.id, lay: () => P.shape(t, s.room, measure, size), measure };
}

for (const pages of [false, true]) {
  test(`book passage ${pages ? 'on pages' : 'in the column'}: as tall as its title's line and its words, under the heading, over nothing`, () => {
    const { t, head, verse, after, lay, measure } = setUp(pages);
    const L = lay();
    const row = (id) => L.rows.find((r) => r.mark === id);
    const h = row(head), v = row(verse), a = row(after);
    assert.ok(h && v && a, 'the heading, the passage and the paragraph after it are laid out');
    const W = L.width ?? v.width;
    assert.ok(Math.abs(v.width - W) < 1, 'the passage spans the column\'s measure');
    const lh = measure('M', W).lineHeight;
    const want = lh + measure(VERSE, W - C.PASSAGE_INDENT).height;
    assert.ok(Math.abs(v.height - want) < 0.5, `the passage's row holds its title's line and its words (${v.height.toFixed(1)} vs ${want.toFixed(1)})`);
    assert.ok(v.height >= lh * 4, 'a title and three lines of words: at least four lines tall');
    const top = (r) => r.y - r.height / 2, foot = (r) => r.y + r.height / 2;
    assert.ok(top(v) >= foot(h) - 0.5, 'the passage starts below its heading');
    assert.ok(top(a) >= foot(v) - 0.5, 'the paragraph after it starts below the passage');
    assert.equal(C.passageHeight(t, head, measure, W), null, 'words are no passage');
  });
}
