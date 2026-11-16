// The Book plugin through the whole API (app/plugins/book): a book of chapters in a room, its
// thoughts still where their mode put them; thoughts dropped in, reordered, taken out; the book
// out as Markdown and round a .traum file; deleting it leaves every thought. The laws hold.

import { test, assert } from 'folio/testing';
import { makeHost, brokenLaws } from './host.js';

async function load(id, file) {
  try { return await import(new URL(`../../${id}/${file}`, import.meta.url).href); }
  catch { return import(new URL(`../../../plugins/${id}/${file}`, import.meta.url).href); }
}
const book = await load('book', 'Book.js');
const rules = await load('book', 'rules.js');

test('book: chapters of a room\'s thoughts, in the maker\'s order, out as Markdown and back from a file', () => {
  const host = makeHost();
  const { t, off } = host.plug('book', book.install);
  const families = host.app.slot('world.groups').items;
  assert.deepEqual(families.map((f) => f.id), ['book', 'book-chapter']);
  host.lib.model.declareFamilies(families); // (World.js does this when the slot changes)
  host.choose(host.room);
  const made = host.added('book');
  assert.ok(made.some((a) => a.slot === 'room.buttons') && made.some((a) => a.slot === 'keys'));
  // A book, as Tools → Book makes it (no dock in a test: it is made all the same).
  const b = t.marks.make({ kind: 'group', content: { title: 'Linear maps', of: 'book' }, in: host.room });
  assert.ok(b.ok);
  const ch1 = t.marks.make({ kind: 'group', content: { title: 'Vectors', of: 'book-chapter' }, in: host.room });
  const ch2 = t.marks.make({ kind: 'group', content: { title: 'Matrices', of: 'book-chapter' }, in: host.room });
  t.links.link(ch1.id, b.id, 'part of');
  t.links.link(ch2.id, b.id, 'part of');
  const [x, y, z] = host.ids.slice(5, 8);
  for (const id of [x, y]) assert.ok(t.links.link(id, ch1.id, 'part of').ok);
  assert.ok(t.links.link(z, ch2.id, 'part of').ok);
  assert.ok(t.links.link(x, ch2.id, 'part of').ok);
  assert.deepEqual(t.links.holders(x), [ch2.id], 'a thought sits in one chapter (since 0.2): it moved');
  assert.ok(t.links.link(x, ch1.id, 'part of').ok);
  // The book is a card in every mode; its thoughts stay where they were.
  assert.ok(host.lib.groups.trayForeign(host.w, host.room, 'joyce').some((g) => g.id === b.id));
  assert.ok(t.rules.layout('pessoa', host.room).some((p) => p.mark === x), 'x still laid out by Pessoa');
  // Order: chapters swapped; a chapter's thoughts reordered.
  t.links.order(b.id, [ch2.id, ch1.id]);
  t.links.order(ch1.id, [y, x]);
  const node = rules.tree(t, b.id);
  assert.deepEqual(node.parts.map((p) => p.title), ['Matrices', 'Vectors']);
  assert.deepEqual(node.parts[1].parts.map((p) => p.id), [y, x]);
  assert.deepEqual(rules.contents(node).map((c) => `${c.num} ${c.title} ${c.thoughts}`), ['1 Matrices 1', '2 Vectors 2']);
  const md = rules.markdown(node);
  assert.ok(md.startsWith('# Linear maps\n') && md.indexOf('## 1 Matrices') < md.indexOf('## 2 Vectors'));
  assert.ok(md.includes(t.marks.text(y)));
  // Round a .traum file: the book comes back with its chapters, in order.
  const got = t.carriers.read(t.carriers.text(host.room));
  const landed = t.carriers.land(got);
  assert.ok(landed.ok, landed.reason);
  const back = rules.booksIn(t, landed.id);
  assert.equal(back.length, 1);
  assert.deepEqual(rules.tree(t, back[0].id).parts.map((p) => p.title), ['Matrices', 'Vectors']);
  // Deleting a chapter, then the book, leaves every thought.
  t.marks.delete(ch1.id);
  t.marks.delete(b.id);
  for (const id of [x, y, z]) assert.ok(t.marks.get(id), 'the thought stays');
  assert.deepEqual(brokenLaws(host.w), []);
  off();
  host.lib.model.declareFamilies([]);
});
