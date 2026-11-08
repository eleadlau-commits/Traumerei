// Tests for .traum files: a room's objects in and out (traum.js).

import { test, assert } from 'folio/testing';
import russell, { arrows as russellArrows } from '../../russell/rules.js';
import * as libForRussell from '../../world/lib.js';
import { surface as surfaceForRussell } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, members, groupsIn, roomItems, room, view, own, addRoom, create } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { parse } from '../grammar.js';
import { importRoom, importInto, exportRoom, summary, fileName, objectOrder, frontOf } from '../traum.js';

bind(surfaceForRussell(lib)); // roomfile is a plugin too
import { picture } from '../../picture/item.js';
import { setKinds } from '../../world/items/index.js';
setKinds([picture({ maths: lib.maths.maths, shrinkPicture: async () => '' })]); // Pictures are a plugin: their kind, as it adds it

const ontologies = gather([russell]); // the built-in ones and Russell, their groups' rules declared
const PIC = 'data:image/png;base64,iVBORw0KGgo=';
const NOW = 1000;

const FILE = [
  '---', 'format: room/2', 'room: Linear algebra', 'modes: [russell]', 'description: A book where each chapter abstracts the last',
  'tags: [maths, book]', 'tint: "#7a5c3e"', 'russell.relations: [forgets, "is a case of", ⊂]', '---', '',
  '# Objects', '',
  '## ^1 line', 'A vector is a list of numbers.', '',
  '## ^2 passage: Why arrays', 'A passage keeps its paragraphs, with $x_i$ and', '', '$$\\sum_i x_i$$', '',
  `## ^3 picture: A grid`, PIC, '',
  '## ^arrays group: Arrays', 'made in: russell', 'holds: ^1 ^2 ^3', 'closed', 'shared', '',
  '## ^4 line', 'A matrix is a grid.', '',
  '## ^matrices group: Matrices', 'made in: russell', 'holds: ^4',
].join('\n');

const fresh = (text, o = {}) => { const w = emptyWorld(1); return { w, ...importRoom(w, parse(text), { ontologies, now: NOW, ...o }) }; };
const again = (text) => { const b = fresh(text); return exportRoom(b.w, b.room.id, { ontologies }); };
const named = (w, id, title) => groupsIn(w, id).find((g) => g.title === title);

test('a file becomes a room: its name, modes, description, tags, colour and settings', () => {
  const { w, room: r, report, made } = fresh(FILE);
  assert.deepEqual(report, []);
  assert.equal(r.name, 'Linear algebra');
  assert.equal(view(w, r.id).mode, 'russell');
  assert.equal(r.desc, 'A book where each chapter abstracts the last');
  assert.deepEqual(r.tags, ['maths', 'book']);
  assert.equal(r.tint, '#7a5c3e');
  assert.deepEqual(w.settings[r.id].russell.relations, ['forgets', 'is a case of', '⊂']);
  assert.deepEqual(made, { groups: 2, thoughts: 4, pictures: 1 });
});

test('objects become thoughts and groups, in the file\'s order', () => {
  const { w, room: r } = fresh(FILE);
  const items = roomItems(w, r.id);
  assert.deepEqual(items.map((th) => th.kind), ['line', 'passage', 'picture', 'line']);
  assert.equal(items[1].title, 'Why arrays');
  assert.equal(items[1].body, 'A passage keeps its paragraphs, with $x_i$ and\n\n$$\\sum_i x_i$$');
  assert.equal(items[2].src, PIC);
  assert.equal(items[2].text, 'A grid');
  const arrays = named(w, r.id, 'Arrays');
  assert.equal(arrays.of, 'russell');
  assert.ok(arrays.closed && arrays.shared);
  assert.deepEqual(members(w, arrays.id).map((th) => th.id), items.slice(0, 3).map((th) => th.id));
  assert.ok(!named(w, r.id, 'Matrices').closed);
});

test('a room goes out and comes back the same', () => {
  const { w, room: r } = fresh(FILE);
  const once = exportRoom(w, r.id, { ontologies });
  const back = fresh(once);
  assert.deepEqual(back.report, []);
  assert.equal(exportRoom(back.w, back.room.id, { ontologies }), once);
  assert.match(once, /^---\nformat: room\/2\nguide: https:\/\/github.com\/.+FORMAT.md\nroom: Linear algebra\nmodes: \[russell\]\n/);
  assert.match(once, /## \^4 group: Arrays\nmade in: russell\nholds: \^1 \^2 \^3\nclosed\nshared/);
});

test('groups of groups: a group holds other groups, and each comes after what it holds', () => {
  const text = ['# Objects', '## ^a line', 'one', '## ^b line', 'two', '## ^inner group: Inner', 'made in: joyce', 'holds: ^a',
    '## ^outer group: Outer', 'made in: joyce', 'holds: ^inner ^b'].join('\n');
  const { w, room: r } = fresh(text);
  const outer = named(w, r.id, 'Outer'), inner = named(w, r.id, 'Inner');
  assert.deepEqual(members(w, outer.id).map((th) => th.title ?? th.text), ['Inner', 'two']); // a group held sits where holds: puts it
  assert.deepEqual(objectOrder(w, r.id).map((th) => th.title || th.text), ['one', 'Inner', 'two', 'Outer']);
  assert.ok(members(w, inner.id).length === 1);
});

test('a thought can sit in groups of several modes', () => {
  const text = ['---', 'modes: [russell, joyce]', '---', '# Objects', '## ^1 line', 'shared thought',
    '## ^c group: Chapter', 'made in: russell', 'holds: ^1', '## ^t group: Train', 'made in: joyce', 'holds: ^1'].join('\n');
  const { w, room: r } = fresh(text);
  assert.equal(r.size, 2); // a big room: it holds every mode
  const th = roomItems(w, r.id)[0];
  assert.ok(members(w, named(w, r.id, 'Chapter').id).includes(th));
  assert.ok(members(w, named(w, r.id, 'Train').id).includes(th));
});

test('a train of trains keeps the order holds: gives its trains, and its thoughts among them', () => {
  // ^c was written on after ^ab was made, so the file lists it after ^ab; the outer train still
  // holds it first.
  const text = ['# Objects', '## ^a line', 'a', '## ^b line', 'b', '## ^ab group: AB', 'made in: joyce', 'holds: ^a ^b',
    '## ^c line', 'c', '## ^ct group: C', 'made in: joyce', 'holds: ^c', '## ^x line', 'x',
    '## ^out group: Out', 'made in: joyce', 'holds: ^ct ^ab', '## ^mix group: Mix', 'made in: joyce', 'holds: ^x ^out'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.deepEqual(report, []);
  const title = (th) => th.title || th.text;
  assert.deepEqual(members(w, named(w, r.id, 'Out').id).map(title), ['C', 'AB']);
  assert.deepEqual(members(w, named(w, r.id, 'Mix').id).map(title), ['x', 'Out']);
  const out = exportRoom(w, r.id, { ontologies });
  const back = fresh(out);
  assert.deepEqual(members(back.w, named(back.w, back.room.id, 'Out').id).map(title), ['C', 'AB']);
  assert.equal(exportRoom(back.w, back.room.id, { ontologies }), out);
});

test('a kept order: a Russell chapter holds its thoughts in the order holds: lists', () => {
  const text = ['# Objects', '## ^1 line', 'first', '## ^2 line', 'second', '## ^c group: C', 'made in: russell', 'holds: ^2 ^1'].join('\n');
  const { w, room: r } = fresh(text);
  assert.deepEqual(members(w, named(w, r.id, 'C').id).map((th) => th.text), ['second', 'first']);
});

test('unknown kinds, keys and front matter are reported, kept, and written back out', () => {
  const text = ['---', 'mood: grey', '---', '# Objects', '## ^1 line', 'a', '## ^r1 region: The north', 'contains: ^1', 'shape: [0, 0, 10, 10]',
    '## ^g group: G', 'made in: joyce', 'holds: ^1', 'rule: oldest first'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.equal(report.length, 3);
  assert.match(report[0], /doesn't know "mood"/);
  assert.match(report[1], /kind "region"/);
  assert.match(report[2], /"rule" isn't known/);
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /\nmood: grey\n/);
  assert.match(out, /## \^r1 region: The north\ncontains: \^1\nshape: \[0, 0, 10, 10\]/);
  assert.match(out, /holds: \^\d\nrule: oldest first/);
  assert.ok(!/## \^r1 group/.test(out));
});

test('what can\'t be read is reported, and the rest still arrives', () => {
  const text = ['# Objects', '## ^1 line', 'a', '## ^1 line', 'twice', '## ^e line', '', '## ^g group: G', 'holds: ^1 ^missing word',
    '## ^empty group: Empty', 'holds: ^nothing'].join('\n');
  const { w, room: r, report, made } = fresh(text);
  assert.equal(made.thoughts, 1);
  assert.equal(made.groups, 1);
  assert.equal(report.length, 6);
  assert.match(report.join('\n'), /\^1 is used twice/);
  assert.match(report.join('\n'), /\^e is empty/);
  assert.match(report.join('\n'), /holds \^missing, which isn't in the file/);
  assert.match(report.join('\n'), /"word" in \^g's holds isn't a \^reference/);
  assert.match(report.join('\n'), /"Empty" holds nothing/);
  assert.equal(named(w, r.id, 'G').of, 'joyce'); // no made in: the room's mode with groups
});

test('a group with no made in belongs to the room\'s first mode with groups', () => {
  const { w, room: r } = fresh(['---', 'modes: [russell]', '---', '# Objects', '## ^1 line', 'a', '## ^g group: G', 'holds: ^1'].join('\n'));
  assert.equal(named(w, r.id, 'G').of, 'russell');
});

test('a hand-written file needs only objects; a line may be written on its header', () => {
  const { w, room: r, report } = fresh('# Objects\n## ^1 line: A vector\n## ^2 line\nA matrix\n', { name: 'From disk' });
  assert.deepEqual(report, []);
  assert.equal(r.name, 'From disk');
  assert.deepEqual(roomItems(w, r.id).map((th) => th.text), ['A vector', 'A matrix']);
  assert.equal(view(w, r.id).mode, 'joyce');
});

test('an unknown mode is reported; a picture at an address that wasn\'t fetched becomes a line', () => {
  const { w, room: r, report } = fresh(['---', 'modes: [eliot]', '---', '# Objects', '## ^1 picture: Cat', 'https://example.com/cat.jpg'].join('\n'));
  assert.match(report[0], /no mode called "eliot"/);
  assert.match(report[1], /couldn't be fetched/);
  assert.match(roomItems(w, r.id)[0].text, /^A picture couldn't be fetched: Cat/);
});

test('importing into a room adds the objects and leaves the room as it is', () => {
  const w = emptyWorld(1);
  const r = addRoom(w, 'Here', 2, {}, 'joyce');
  create(w, r.id, { kind: 'line', text: 'already here' }, 3);
  const out = importInto(w, r.id, parse(FILE), { ontologies, now: NOW });
  assert.equal(room(w, r.id).name, 'Here');
  assert.equal(roomItems(w, r.id).length, 5);
  assert.deepEqual(out.made, { groups: 2, thoughts: 4, pictures: 1 });
});

test('summary counts what a file holds; a file name ends in .traum', () => {
  assert.equal(summary(parse(FILE)).text, '2 groups, 4 thoughts, 1 picture');
  assert.equal(fileName('A/B: c'), 'A B c.traum');
  const report = [];
  frontOf(parse('---\nformat: room/9\n---\n'), report);
  assert.match(report[0], /format room\/9/);
});

test('a body line that looks like structure survives the trip', () => {
  const w = emptyWorld(1);
  const r = addRoom(w, 'Esc', 2, {}, 'joyce');
  create(w, r.id, { kind: 'passage', title: 'T', body: '# Not a section\n## ^9 not an object' }, 3);
  const text = exportRoom(w, r.id, { ontologies });
  assert.match(text, /\\# Not a section\n\\## \^9 not an object/);
  const back = fresh(text);
  assert.equal(roomItems(back.w, back.room.id)[0].body, '# Not a section\n## ^9 not an object');
});

// ---- # In <mode> sections ----

const head = (modes) => ['---', `modes: [${modes}]`, '---', '# Objects'];
const two = ['## ^1 line', 'one', '## ^2 line', 'two', '## ^3 line', 'three'];

test('Joyce: trains at exact points, a thought\'s offset, a train in the tray; and back out the same', () => {
  const text = [...head('joyce'), ...two, '## ^t group: T', 'made in: joyce', 'holds: ^1 ^2', '## ^u group: U', 'made in: joyce', 'holds: ^3',
    '# In joyce', 'at: ^t 120 -40 hand', 'offset: ^2 10 -6', 'tray: ^u'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.deepEqual(report, []);
  const t = named(w, r.id, 'T'), u = named(w, r.id, 'U');
  assert.deepEqual([t.x, t.y, t.hand], [120, -40, true]);
  assert.ok(u.loose);
  const second = members(w, t.id)[1];
  assert.deepEqual([second.dx, second.dy], [10, -6]);
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /# In joyce\nat: \^4 120 -40 hand\noffset: \^2 10 -6\ntray: \^5\n/);
  const back = fresh(out);
  assert.equal(exportRoom(back.w, back.room.id, { ontologies }), out);
});

test('Joyce: trains with no at: line start side by side; a thought in no train placed by at: gets a train', () => {
  const text = [...head('joyce'), ...two, '## ^t group: T', 'made in: joyce', 'holds: ^1', '## ^u group: U', 'made in: joyce', 'holds: ^2',
    '# In joyce', 'at: ^3 500 500'].join('\n');
  const { w, room: r } = fresh(text);
  const t = named(w, r.id, 'T'), u = named(w, r.id, 'U');
  assert.deepEqual([t.x, t.y, u.x, u.y], [0, 0, 440, 0]);
  const three = roomItems(w, r.id)[2];
  const train = groupsIn(w, r.id, 'joyce').find((g) => g.members.includes(three.id));
  assert.deepEqual([train.x, train.y], [500, 500]);
});

test('Pessoa: thoughts at points (auto: pushed clear), the rest on the spiral; and back out the same', () => {
  const text = [...head('pessoa'), ...two, '# In pessoa', 'at: ^1 10 20', 'at: ^2 30 40 auto', 'on canvas: ^3'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.deepEqual(report, []);
  const [a, b] = roomItems(w, r.id);
  assert.deepEqual(own(w, r.id, 'pessoa')[a.id], { x: 10, y: 20 });
  assert.deepEqual(own(w, r.id, 'pessoa')[b.id], { x: 30, y: 40, auto: true });
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /# In pessoa\nat: \^1 10 20\nat: \^2 30 40 auto\non canvas: \^3\n/);
  assert.equal(again(out), out);
});

const BOOK = [...head('russell'), ...two, '## ^a group: Arrays', 'made in: russell', 'holds: ^1', '## ^m group: Matrices', 'made in: russell', 'holds: ^2',
  '## ^f group: Fields', 'made in: russell', 'holds: ^3'];

test('Russell: chapters on canvas or placed by hand, arrows with relations and labels; and back out the same', () => {
  const text = [...BOOK, '# In russell', 'on canvas: ^a ^m', 'at: ^f 900 0', 'arrow: ^a -> ^m | forgets | the individual equations',
    'arrow: ^a -> ^f | | $|v|$ kept', 'arrow: ^m -> ^f'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.deepEqual(report, []);
  const a = named(w, r.id, 'Arrays'), m = named(w, r.id, 'Matrices'), f = named(w, r.id, 'Fields');
  assert.deepEqual([f.x, f.y, f.hand], [900, 0, true]);
  const got = russellArrows(w, r.id).map((x) => [w.things[x.from].title, w.things[x.to].title, x.rel, x.label]);
  assert.deepEqual(got, [['Arrays', 'Matrices', 'forgets', 'the individual equations'], ['Arrays', 'Fields', '', '$|v|$ kept'], ['Matrices', 'Fields', '', '']]);
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /# In russell\non canvas: \^4 \^5\nat: \^6 900 0\narrow: \^4 -> \^5 \| forgets \| the individual equations\narrow: \^4 -> \^6 \| \| \$\|v\|\$ kept\narrow: \^5 -> \^6\n/);
  assert.equal(again(out), out);
  assert.ok(a && m);
});

test('Russell: a loop is refused and reported, the other arrows still drawn', () => {
  const text = [...BOOK, '# In russell', 'arrow: ^a -> ^m', 'arrow: ^m -> ^f', 'arrow: ^f -> ^a', 'arrow: ^a -> ^nowhere', 'arrow: not an arrow'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.equal(russellArrows(w, r.id).length, 2);
  assert.match(report.join('\n'), /the arrow wasn't drawn: that arrow would make a loop/);
  assert.match(report.join('\n'), /\^nowhere isn't in the file/);
  assert.match(report.join('\n'), /an arrow is written \^from -> \^to/);
});

test('a relation object is an arrow; one joining more than two things is kept', () => {
  const text = [...BOOK, '## ^r relation: is a case of', 'from: ^a', 'to: ^m', 'label: "the square ones"',
    '## ^s relation: therefore', 'from: ^a ^m', 'to: ^f'].join('\n');
  const { w, room: r, report } = fresh(text);
  const got = russellArrows(w, r.id);
  assert.equal(got.length, 1);
  assert.deepEqual([got[0].rel, got[0].label], ['is a case of', 'the square ones']);
  assert.match(report[0], /relation \^s joins more than two things/);
  assert.match(exportRoom(w, r.id, { ontologies }), /## \^s relation: therefore\nfrom: \^a \^m\nto: \^f/);
});

test('a mode\'s unknown lines, and sections for no mode of the room, are reported, kept and written back', () => {
  const text = [...head('russell'), ...two, '## ^a group: A', 'made in: russell', 'holds: ^1', '# In russell', 'hidden: ^2', 'on canvas: ^a', '# In perec', 'cell: ^1 3 7', '# Notes', 'anything'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.equal(report.length, 3);
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /# In russell\non canvas: \^4\ntray: \^2 \^3\nhidden: \^2\n/);
  assert.match(out, /# In perec\ncell: \^1 3 7\n\n# Notes\nanything\n$/);
});

test('Joyce places a thing once: a second at: is reported', () => {
  const text = [...head('joyce'), '## ^1 line', 'a', '## ^t group: T', 'made in: joyce', 'holds: ^1', '# In joyce', 'at: ^t 0 0', 'at: ^t 9 9', 'at: ^t#2 5 5'].join('\n');
  const { report } = fresh(text);
  assert.match(report.join('\n'), /places a thing once/);
  assert.match(report.join('\n'), /doesn't use occurrences/);
});

// ---- Big rooms and Twins ----

test('a big room writes every mode\'s section, and another mode\'s group placed there comes back placed', () => {
  const text = ['---', 'modes: [russell, joyce, pessoa]', '---', '# Objects', '## ^1 line', 'one', '## ^2 line', 'two',
    '## ^c group: Chapter', 'made in: russell', 'holds: ^1', 'shared',
    '# In russell', 'on canvas: ^c', 'tray: ^2', '# In joyce', 'at: ^c 300 200', 'tray: ^2', '# In pessoa', 'at: ^c 5 5', 'on canvas: ^1 ^2'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.deepEqual(report, []);
  assert.equal(r.size, 2);
  const c = named(w, r.id, 'Chapter');
  assert.deepEqual(own(w, r.id, 'joyce')[c.id], { x: 300, y: 200 });
  assert.deepEqual(own(w, r.id, 'pessoa')[c.id], { x: 5, y: 5 });
  const out = exportRoom(w, r.id, { ontologies });
  assert.match(out, /modes: \[russell, joyce, pessoa\]/);
  assert.match(out, /# In joyce\nat: \^3 300 200\ntray: \^2\n/);
  assert.equal(again(out), out);
});

const TWIN = ['---', 'room: Pair', 'twin: [joyce, russell]', 'left.joyce.tension: 0.3', '---', '# Objects',
  '## ^1 line', 'left one', '## ^2 line', 'right one', '## ^3 line', 'in no section', '## ^t group: Train', 'made in: joyce', 'holds: ^1',
  '## ^c group: Chapter', 'made in: russell', 'holds: ^2',
  '# Left: joyce', 'at: ^t 10 20', '# Right: russell', 'on canvas: ^c'].join('\n');

test('a Twin: each object on the side whose section places it, the rest on the left; and back out the same', () => {
  const { w, room: t, report, made } = fresh(TWIN);
  assert.deepEqual(report, []);
  assert.equal(t.size, 'twin');
  const [l, r] = lib.twin.sides(w, t.id);
  assert.deepEqual([view(w, l.id).mode, view(w, r.id).mode], ['joyce', 'russell']);
  assert.deepEqual(roomItems(w, l.id).map((th) => th.text), ['left one', 'in no section']);
  assert.deepEqual(roomItems(w, r.id).map((th) => th.text), ['right one']);
  assert.equal(named(w, r.id, 'Chapter').of, 'russell');
  assert.deepEqual([named(w, l.id, 'Train').x, named(w, l.id, 'Train').y], [10, 20]);
  assert.equal(w.settings[l.id].joyce.tension, 0.3);
  assert.deepEqual(made, { groups: 2, thoughts: 3, pictures: 0 });
  const out = exportRoom(w, t.id, { ontologies });
  assert.match(out, /twin: \[joyce, russell\]/);
  assert.match(out, /left\.joyce\.tension: 0\.3/);
  assert.match(out, /# Left: joyce\nat: \^\d 10 20\ntray: \^\d\n\n# Right: russell\non canvas: \^\d\n$/);
  assert.equal(again(out), out);
});

test('a Twin\'s side section brought into an ordinary room is read as that mode\'s', () => {
  const w = emptyWorld(1);
  const r = addRoom(w, 'Here', 2, {}, 'joyce');
  const { report } = importInto(w, r.id, parse(TWIN), { ontologies, now: NOW });
  assert.match(report.join('\n'), /"russell" isn't one of this room's modes/);
  const train = groupsIn(w, r.id, 'joyce').find((g) => g.title === 'Train');
  assert.deepEqual([train.x, train.y], [10, 20]);
});
