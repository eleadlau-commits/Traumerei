// Tests for group families a plugin declares (model.js declareFamilies): a book holds chapters,
// a chapter holds thoughts, a thought sits in a chapter and stays where its mode put it; a book
// is one card in every mode; deleting a book or a chapter never deletes a thought.

import { test, assert } from 'folio/testing';
import * as model from '../model.js';
import { emptyWorld, addRoom, create, join, members, remove, declareFamilies, familyOf, isCard, leave, loadWorld } from '../model.js';
import { foreign, inForeign, trayForeign } from '../groups.js';

const BOOK = [{ id: 'book', name: 'Book', card: true }, { id: 'book-chapter', name: 'Chapter' }];

test('families: a book of chapters, its order kept; a thought stays in its mode too', () => {
  declareFamilies(BOOK);
  const w = emptyWorld();
  const r = addRoom(w, 'Thesis');
  const a = create(w, r.id, { kind: 'line', text: 'a' }, 1);
  const b = create(w, r.id, { kind: 'line', text: 'b' }, 2);
  const book = create(w, r.id, { kind: 'group', of: 'book', title: 'My book' }, 3);
  const ch1 = create(w, r.id, { kind: 'group', of: 'book-chapter', title: 'One' }, 4);
  const ch2 = create(w, r.id, { kind: 'group', of: 'book-chapter', title: 'Two' }, 5);
  assert.ok(book.family && ch1.family, 'a family\'s group says so');
  assert.equal(familyOf('book').membership, 'many');
  assert.ok(join(w, book.id, ch2.id) && join(w, book.id, ch1.id));
  assert.deepEqual(members(w, book.id).map((g) => g.id), [ch2.id, ch1.id], 'kept in the order put in');
  model.setOrder(w, book.id, [ch1.id, ch2.id]);
  assert.deepEqual(members(w, book.id).map((g) => g.id), [ch1.id, ch2.id]);
  assert.ok(join(w, ch1.id, b.id) && join(w, ch1.id, a.id) && join(w, ch2.id, a.id), 'membership many: a thought in two chapters');
  // A card: one thing in every mode, its parts not hidden there.
  assert.ok(isCard(book) && !isCard(ch1));
  assert.deepEqual(foreign(w, r.id, 'pessoa').map((g) => g.id), [book.id]);
  assert.deepEqual(trayForeign(w, r.id, 'joyce').map((g) => g.id), [book.id], 'unplaced, it waits in the tray');
  assert.equal(inForeign(w, r.id, 'pessoa')(a.id), false, 'its thoughts stay where they are');
  // A chapter left empty stays (keep); deleting a book or chapter frees its parts.
  leave(w, ch2.id, a.id);
  assert.ok(w.things[ch2.id], 'an empty chapter stays');
  remove(w, ch1.id);
  assert.ok(w.things[a.id] && w.things[b.id], 'its thoughts stay');
  remove(w, book.id);
  assert.ok(w.things[ch2.id] && w.things[a.id]);
  declareFamilies([]);
});

test('families: switched off, its groups are kept and still never take their parts', () => {
  declareFamilies(BOOK);
  const w = emptyWorld();
  const r = addRoom(w, 'Thesis');
  const a = create(w, r.id, { kind: 'line', text: 'a' }, 1);
  const ch = create(w, r.id, { kind: 'group', of: 'book-chapter', title: 'One' }, 2);
  join(w, ch.id, a.id);
  declareFamilies([]); // its plugin off
  const back = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.ok(back.things[ch.id].family, 'still a family\'s group when read back');
  assert.equal(isCard(back.things[ch.id]), false);
  remove(back, ch.id);
  assert.ok(back.things[a.id], 'deleting it leaves its thought');
});

test('families: an id must be its own, never a mode\'s', () => {
  const warned = [];
  declareFamilies([{ id: 'joyce' }, { id: 'Bad Id' }, { id: 'set' }, { id: 'set' }], (f, why) => warned.push(f.id));
  assert.deepEqual(warned, ['joyce', 'Bad Id', 'set']);
  assert.ok(familyOf('set'));
  declareFamilies([]);
  assert.equal(familyOf('set'), null);
});

test('a rule that claims a family lays its groups out itself: no card of it there, a card everywhere else', () => {
  declareFamilies([{ id: 'claimed-book', name: 'Book', card: true }]);
  const w = emptyWorld(1);
  const room = addRoom(w, 'Study', 2);
  const book = create(w, room.id, { kind: 'group', of: 'claimed-book', title: 'My book', family: true }, 3);
  model.declareClaims('pages-test', ['claimed-book']);
  assert.ok(foreign(w, room.id, 'joyce').some((g) => g.id === book.id));
  assert.ok(!foreign(w, room.id, 'pages-test').some((g) => g.id === book.id));
  model.declareClaims('pages-test', null);
  assert.ok(foreign(w, room.id, 'pages-test').some((g) => g.id === book.id));
  declareFamilies([]);
});

test('join takes a position in the order: 0 first, past the end last', () => {
  declareFamilies([{ id: 'ordered-book', name: 'Book' }]);
  const w = emptyWorld(1);
  const room = addRoom(w, 'Study', 2);
  const g = create(w, room.id, { kind: 'group', of: 'ordered-book', family: true }, 3);
  const [a, b, c, d] = [4, 5, 6, 7].map((at) => create(w, room.id, { kind: 'line', text: `t${at}` }, at));
  join(w, g.id, a.id); join(w, g.id, b.id);
  join(w, g.id, c.id, 0);
  join(w, g.id, d.id, 2);
  assert.deepEqual(members(w, g.id).map((m) => m.id), [c.id, a.id, d.id, b.id]);
  declareFamilies([]);
});
