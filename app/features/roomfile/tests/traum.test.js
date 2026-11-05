// Tests for .traum files: a room's objects in and out (traum.js).

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, members, groupsIn, roomItems, room, view, own, addRoom, create } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { parse } from '../grammar.js';
import { importRoom, importInto, exportRoom, summary, fileName, objectOrder, frontOf } from '../traum.js';

bind(lib);

const ontologies = gather(); // the built-in ones, their groups' rules declared
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
  assert.deepEqual(members(w, outer.id).map((th) => th.title ?? th.text), ['two', 'Inner']); // Joyce reads by time
  assert.deepEqual(objectOrder(w, r.id).map((th) => th.title || th.text), ['one', 'two', 'Inner', 'Outer']);
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
