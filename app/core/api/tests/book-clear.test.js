// Book (app/optional/extra/book): the room's clear-space leaves a book alone. Book and Book · blocks
// place every mark themselves (hand: false), so since app 1.1.4 the room never pushes their marks
// apart (core gap 5): paragraphs sit as close as the type asks, with no drop per nudge. Before,
// Book 0.4.7 kept every row 20 units under the one above to stay clear of it.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const C = await load('book', 'column.js');
const B = await load('book', 'blocks.js');
const P = await load('book', 'pages.js');
const S = await load('book', 'tests/sample.js');

test('Book: the room\'s clear-space leaves both of its modes alone, and paragraphs sit as the type asks', () => {
  const host = makeHost({ thoughts: 2 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  host.lib.model.declareFamilies(host.app.slot('world.groups').items);
  const s = S.sampleInto(host.lib, host.w, host.tick);
  host.world.save();
  host.choose(s.room);
  const rules = host.added('book').filter((a) => a.slot === 'world.ontologies').map((a) => a.item);
  for (const id of [C.RULE, B.BLOCKS]) {
    const rule = rules.find((r) => r.id === id);
    assert.ok(rule, `${id} added`);
    assert.equal(rule.clears, false, `${id}: no clear-space`);
  }
  // Two paragraphs of one chapter, one under the other: the air between them is the type's own.
  const lay = P.shape(t, s.room, (x, w) => t.ui.measure(x, w), () => null);
  const [a, b] = [s.paras[0], s.paras[1]].map((id) => lay.rows.filter((r) => r.mark === id));
  const gap = (b[0].y - b[0].height / 2) - (a.at(-1).y + a.at(-1).height / 2);
  const lh = t.ui.measure('M', 600).lineHeight;
  assert.ok(Math.abs(gap - lh * C.SPACE.para) < 0.5, `${gap.toFixed(1)} units between paragraphs (${(lh * C.SPACE.para).toFixed(1)} asked)`);
});
