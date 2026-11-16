// Tests for plain Markdown brought in as loose thoughts (plain.js): the six tables of a room,
// landed by the world's carrier like a .traum file.

import { test, assert } from 'folio/testing';
import { emptyWorld, roomItems, groupsIn, landTables, room } from '../../world/model.js';
import * as P from '../../world/places.js';
import { plain } from '../plain.js';
import { summary, fileName } from '../Roomfile.js';

test('list items, headings with paragraphs, paragraphs and pictures become loose thoughts', () => {
  const p = plain([
    '---', 'title: notes', '---', '- first', '  goes on', '- second', '', '# A heading', 'Its paragraph.', '',
    'One line on its own.', '', 'Two lines', 'of a paragraph.', '', '![A cat](data:image/png;base64,iVBORw0KGgo=)', '',
    '$$', 'a', '', 'b', '$$',
  ].join('\n'), 'notes', 10);
  assert.deepEqual(p.tables.marks.slice(1).map((m) => [m.body.kind, m.body.content]), [
    ['line', { text: 'first\ngoes on' }], ['line', { text: 'second' }], ['passage', { title: 'A heading', text: 'Its paragraph.' }],
    ['line', { text: 'One line on its own.' }], ['passage', { title: '', text: 'Two lines\nof a paragraph.' }],
    ['picture', { src: 'data:image/png;base64,iVBORw0KGgo=', text: 'A cat' }], ['passage', { title: '', text: '$$\na\n\nb\n$$' }],
  ]);
  assert.match(p.report[0], /front matter isn't used/);
  assert.equal(summary(p).text, '0 groups, 7 thoughts, 1 picture');
});

test('a plain Markdown file makes a room of loose thoughts, in the file\'s order', () => {
  const w = emptyWorld(1);
  const got = plain('- a\n- b\n\nA paragraph.', 'notes', 10);
  const out = landTables(w, got.tables, got.root, { now: 10 });
  assert.equal(room(w, out.id).name, 'notes');
  assert.deepEqual(roomItems(w, out.id).map((th) => th.text), ['a', 'b', 'A paragraph.']);
  assert.equal(groupsIn(w, out.id).length, 0);
  assert.ok(roomItems(w, out.id).every((th) => P.of(w, th.id).length === 1), 'loose: no rule places them');
  assert.equal(fileName('A / room: one'), 'A room one.traum');
});
