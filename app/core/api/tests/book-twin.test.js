// Book (app/optional/extra/book) on a Twin's side (side.js): the other side is found through the
// places table (each side is placed in its Twin under the rule `twin`), so the Book's docks stay
// while you work on the other half; and the zoom that fits the book into its half (never in, never
// under the floor, in steps of 0.05). And with no Twin: no other side.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../optional/extra/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const SD = await load('book', 'side.js');
const H = (await import(new URL('../../twin/holds.js', import.meta.url).href).catch(() => import(new URL('../../../plugins/twin/holds.js', import.meta.url).href))).default;

test('book twin: the other side of a Twin, through places; none for a room of its own', () => {
  const host = makeHost({ thoughts: 1 });
  const { t } = host.plug('book', book.install, { api: 3, needs: ['files'] });
  const { model, twin } = host.lib;
  const held = [...model.HOLDS];
  model.setHolds([...held.filter((h) => h.id !== H.id), H]);
  try {
    const tw = twin.addTwin(host.w, 'Pair', host.tick(), {}, ['book-page', 'joyce']);
    assert.ok(tw, 'a Twin');
    const [L, R] = twin.sides(host.w, tw.id);
    host.world.save();
    assert.equal(SD.otherSide(t, L.id), R.id);
    assert.equal(SD.otherSide(t, R.id), L.id);
    assert.equal(SD.twinOf(t, L.id), tw.id);
    assert.equal(SD.twinOf(t, R.id), tw.id);
    const alone = model.addRoom(host.w, 'Alone', host.tick());
    host.world.save();
    assert.equal(SD.otherSide(t, alone.id), null);
    assert.equal(SD.twinOf(t, alone.id), null);
    assert.equal(SD.otherSide(t, null), null);
  } finally { model.setHolds(held); }
});

test('book twin: the zoom that fits the book into its half', () => {
  assert.equal(SD.fitZoom(683, 760, 1), 0.85, 'a half 683 px wide, a column of 760: zoomed out to 0.85');
  assert.equal(SD.fitZoom(1366, 760, 1), null, 'it fits: left be');
  assert.equal(SD.fitZoom(387, 760, 1), 0.5, 'between the docks too: 0.5');
  assert.equal(SD.fitZoom(200, 760, 1), 0.5, 'never under the floor');
  assert.equal(SD.fitZoom(683, 760, 0.6), null, 'already out far enough: never in');
  assert.equal(SD.fitZoom(0, 760, 1), null, 'nothing measured: left be');
  assert.equal(SD.fitZoom(683, 0, 1), null);
});
