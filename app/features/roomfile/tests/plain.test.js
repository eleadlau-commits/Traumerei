// Tests for plain Markdown brought in as loose thoughts (plain.js).

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, roomItems, groupsIn } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { plain } from '../plain.js';
import { importRoom } from '../traum.js';

bind(lib);
const ontologies = gather();

test('list items, headings with paragraphs, paragraphs and pictures become loose thoughts', () => {
  const p = plain([
    '---', 'title: notes', '---', '- first', '  goes on', '- second', '', '# A heading', 'Its paragraph.', '',
    'One line on its own.', '', 'Two lines', 'of a paragraph.', '', '![A cat](data:image/png;base64,iVBORw0KGgo=)', '',
    '$$', 'a', '', 'b', '$$',
  ].join('\n'));
  assert.deepEqual(p.objects.map((o) => [o.kind, o.title, o.lines.join('\n')]), [
    ['line', null, 'first\ngoes on'], ['line', null, 'second'], ['passage', 'A heading', 'Its paragraph.'],
    ['line', null, 'One line on its own.'], ['passage', '', 'Two lines\nof a paragraph.'],
    ['picture', 'A cat', 'data:image/png;base64,iVBORw0KGgo='], ['passage', '', '$$\na\n\nb\n$$'],
  ]);
  assert.match(p.report[0], /front matter isn't used/);
});

test('a plain Markdown file makes a room of loose thoughts, in the file\'s order', () => {
  const w = emptyWorld(1);
  const { room, report } = importRoom(w, plain('- a\n- b\n\nA paragraph.'), { ontologies, now: 10, name: 'notes' });
  assert.deepEqual(report, []);
  assert.equal(room.name, 'notes');
  assert.deepEqual(roomItems(w, room.id).map((th) => th.text), ['a', 'b', 'A paragraph.']);
  assert.equal(groupsIn(w, room.id).length, 0);
});
