// Tests for editing a room or a group as .traum text (edit.js): written out, changed, put back.

import { test, assert } from 'folio/testing';
import russell, { arrows as russellArrows } from '../../russell/rules.js';
import * as libForRussell from '../../world/lib.js';
import { surface as surfaceForRussell } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, members, groupsIn, roomItems, room, lock } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { parse } from '../grammar.js';
import { importRoom } from '../traum.js';
import { open, apply, shortPictures, badMaths, copyWorld } from '../edit.js';

bind(surfaceForRussell(lib)); // roomfile is a plugin too
import { picture } from '../../picture/item.js';
import { setKinds } from '../../world/items/index.js';
setKinds([picture({ maths: lib.maths.maths, shrinkPicture: async () => '' })]); // Pictures are a plugin: their kind, as it adds it
const ontologies = gather([russell]);
const PIC = 'data:image/png;base64,iVBORw0KGgo=';

const BOOK = ['---', 'room: Book', 'modes: [russell]', '---', '# Objects',
  '## ^1 line', 'Vectors are lists.', '## ^2 line', 'They add.', '## ^3 line', 'Matrices are grids.', `## ^4 picture: A grid`, PIC,
  '## ^a group: Arrays', 'made in: russell', 'holds: ^1 ^2', '## ^m group: Matrices', 'made in: russell', 'holds: ^3 ^4',
  '# In russell', 'on canvas: ^a ^m', 'arrow: ^a -> ^m | forgets | the equations'].join('\n');

function book() {
  const w = emptyWorld(1);
  const { room: r } = importRoom(w, parse(BOOK), { ontologies, now: 100 });
  return { w, id: r.id, named: (t) => groupsIn(w, r.id).find((g) => g.title === t) };
}
const run = (w, id, session, text, o = {}) => apply(w, id, session, parse(text), { ontologies, now: 5000, ...o });

test('a group\'s text holds its objects and the lines about them, with the room\'s own ids', () => {
  const { w, id, named } = book();
  const s = open(w, id, { scope: 'group', groupId: named('Matrices').id, ontologies, pictures: shortPictures() });
  assert.equal(s.text, ['# Objects', '', '## ^3 line', 'Matrices are grids.', '', '## ^4 picture: A grid', 'picture:1', '',
    '## ^6 group: Matrices', 'made in: russell', 'holds: ^3 ^4', '', '# In russell', 'on canvas: ^6', 'arrow: ^5 -> ^6 | forgets | the equations', ''].join('\n'));
});

test('the same text changes nothing', () => {
  const { w, id, named } = book();
  const pictures = shortPictures();
  for (const scope of ['group', 'room']) {
    const s = open(w, id, { scope, groupId: named('Matrices').id, ontologies, pictures });
    const before = JSON.stringify(w);
    const r = run(w, id, s, s.text, { pictures });
    assert.deepEqual(r.report, []);
    assert.deepEqual(r.changes, []);
    assert.equal(JSON.stringify(w), before);
  }
});

test('a changed thought is changed in place; a new one is made; one gone is deleted', () => {
  const { w, id, named } = book();
  const g = named('Arrays');
  const [one, two] = members(w, g.id);
  const s = open(w, id, { scope: 'group', groupId: g.id, ontologies });
  const text = s.text.replace('Vectors are lists.', 'Vectors are lists of numbers.').replace('## ^2 line\nThey add.\n\n', '')
    .replace('holds: ^1 ^2', 'holds: ^1 ^new').replace('## ^5 group', '## ^new line\nA new one.\n\n## ^5 group');
  const r = run(w, id, s, text);
  assert.deepEqual(r.report, []);
  assert.deepEqual(r.counts, { kept: 0, changed: 1, made: 1, deleted: 1 });
  assert.equal(w.things[one.id].text, 'Vectors are lists of numbers.'); // the same thought, its id kept
  assert.ok(!w.things[two.id]);
  assert.deepEqual(members(w, g.id).map((th) => th.text), ['Vectors are lists of numbers.', 'A new one.']);
});

test('the heading wins: renamed, closed; an arrow changed and one taken away', () => {
  const { w, id, named } = book();
  const m = named('Matrices');
  const s = open(w, id, { scope: 'group', groupId: m.id, ontologies });
  const r = run(w, id, s, s.text.replace('group: Matrices', 'group: Grids').replace('holds: ^3 ^4', 'holds: ^3 ^4\nclosed')
    .replace('| forgets | the equations', '| ⊂ | the rows'));
  assert.ok(w.things[m.id].closed);
  assert.equal(w.things[m.id].title, 'Grids');
  const a = russellArrows(w, id);
  assert.deepEqual(a.map((x) => [x.rel, x.label]), [['⊂', 'the rows']]);
  assert.ok(r.changes.some((c) => /renamed "Grids"/.test(c)));
  run(w, id, open(w, id, { scope: 'group', groupId: m.id, ontologies }), s.text.replace(/arrow:.*\n/, ''));
  assert.equal(russellArrows(w, id).length, 0);
});

test('a thought moved to another group by holds leaves its old one and is not deleted', () => {
  const { w, id, named } = book();
  const pictures = shortPictures();
  const s = open(w, id, { scope: 'room', ontologies, pictures });
  const r = run(w, id, s, s.text.replace('holds: ^1 ^2', 'holds: ^1').replace('holds: ^3 ^4', 'holds: ^3 ^4 ^2'), { pictures });
  assert.equal(r.counts.deleted, 0);
  assert.deepEqual(members(w, named('Matrices').id).map((th) => th.text ?? th.kind), ['Matrices are grids.', 'A grid', 'They add.']);
});

test('the whole room: what isn\'t in the text is listed, and deleted only when asked; front matter changes', () => {
  const { w, id } = book();
  const pictures = shortPictures();
  const s = open(w, id, { scope: 'room', ontologies, pictures });
  const text = s.text.replace('room: Book', 'room: Linear algebra').replace('## ^3 line\nMatrices are grids.\n\n', '').replace('holds: ^3 ^4', 'holds: ^4');
  const dry = run(copyWorld(w), id, s, text, { pictures });
  assert.equal(dry.missing.length, 1);
  assert.ok(dry.changes.some((c) => /Name: "Book" → "Linear algebra"/.test(c)));
  assert.ok(dry.changes.some((c) => /Not in the text/.test(c)));
  run(w, id, s, text, { pictures, removeMissing: true });
  assert.equal(room(w, id).name, 'Linear algebra');
  assert.equal(roomItems(w, id).length, 3);
});

test('a thought of another kind takes the old one\'s place in its group', () => {
  const { w, id, named } = book();
  const g = named('Arrays');
  const s = open(w, id, { scope: 'group', groupId: g.id, ontologies });
  run(w, id, s, s.text.replace('## ^1 line\nVectors are lists.', '## ^1 passage: Vectors\nare lists.'));
  assert.deepEqual(members(w, g.id).map((th) => th.kind), ['passage', 'line']);
});

test('a locked room is blocked; maths KaTeX can\'t draw is found by its line', () => {
  const { w, id } = book();
  const s = open(w, id, { scope: 'room', ontologies });
  lock(w, id);
  assert.ok(run(w, id, s, s.text).blocked);
  assert.deepEqual(badMaths(parse('# Objects\n## ^1 line\nfine $x$\nbad $\\frac{$')), [{ line: 4, tex: '\\frac{' }]);
});
