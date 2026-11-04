// Tests for room Markdown: reading a file, bringing it into a room, and writing a room back out.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { bind } from '../world.js';
import { emptyWorld, MESSY, members, groupsIn, roomItems, room, view, own, lock, create, addRoom } from '../../world/model.js';
import { BUILT_IN } from '../../world/ontologies/index.js';
import { arrows, chapterName, parentsOf, layout } from '../../world/ontologies/russell.js';
import { parse, summary, importInto, importRoom, exportRoom, escape, unescape, fileName, groupsFor } from '../roomfile.js';

bind(lib); // the world's rules, as roomfile gets them from the world service

const ontologies = BUILT_IN;
const PIC = 'data:image/png;base64,iVBORw0KGgo=';
const NOW = 1000;

// A new room of a mode, with the file brought in.
function into(kind, text, w = emptyWorld(1)) {
  const r = addRoom(w, 'Test', 2, null, 6, {}, kind);
  const out = importInto(w, r.id, parse(text), { ontologies, now: NOW });
  return { w, id: r.id, ...out };
}
const texts = (w, ths) => ths.map((th) => th.text ?? `${th.title}|${th.body}`);
const groupNamed = (w, id, title) => groupsIn(w, id).find((g) => g.title === title);

test('a file is read into front matter, loose thoughts and groups', () => {
  const p = parse([
    '---', 'room: Linear algebra', 'kind: russell', 'description: A book where each chapter abstracts the last',
    'tags: [maths, "book, draft"]', 'tint: "#7a5c3e"', 'russell.overlap: false', '---',
    '- a loose thought', '', '## Arrays', '- one', '- two', '', '## Matrices', '### Why', 'Body.',
  ].join('\n'));
  assert.deepEqual(p.report, []);
  assert.equal(p.meta.room, 'Linear algebra');
  assert.equal(p.meta.kind, 'russell');
  assert.equal(p.meta.description, 'A book where each chapter abstracts the last');
  assert.deepEqual(p.meta.tags, ['maths', 'book, draft']);
  assert.equal(p.meta.tint, '#7a5c3e');
  assert.deepEqual(p.meta.settings, { russell: { overlap: false } });
  assert.equal(p.loose.length, 1);
  assert.deepEqual(p.groups.map((g) => g.title), ['Arrays', 'Matrices']);
  assert.deepEqual(summary(p).text, '2 groups, 4 thoughts');
});

test('a line thought keeps its indented lines, blank ones between them too', () => {
  const p = parse('- first line\n  goes on\n\n  after a gap\n- next');
  assert.deepEqual(p.loose.map((x) => x.text), ['first line\ngoes on\n\nafter a gap', 'next']);
});

test('a passage is a title and paragraphs; a bare ### and a lone paragraph have no title', () => {
  const { w, id } = into('joyce', [
    '## G', '### Why arrays', 'A body.', '', 'A second paragraph.', '###', 'Untitled one.', '- a line',
    'A paragraph on its own.', '', 'And another.',
  ].join('\n'));
  const g = groupNamed(w, id, 'G');
  const ths = members(w, g.id);
  assert.deepEqual(ths.map((t) => t.kind), ['passage', 'passage', 'line', 'passage', 'passage']);
  assert.equal(ths[0].title, 'Why arrays');
  assert.equal(ths[0].body, 'A body.\n\nA second paragraph.');
  assert.equal(ths[1].title, '');
  assert.equal(ths[1].body, 'Untitled one.');
  assert.equal(ths[3].body, 'A paragraph on its own.');
  assert.equal(ths[4].body, 'And another.');
});

test('a picture comes in with its caption; one that can\'t be fetched becomes a line', () => {
  const { w, id, report, made } = into('joyce', `## G\n![A sketch of $A$](${PIC})\n![Far away](https://example.com/a.png)\n![Here](fig.png)`);
  const ths = members(w, groupNamed(w, id, 'G').id);
  assert.equal(ths[0].kind, 'picture');
  assert.equal(ths[0].src, PIC);
  assert.equal(ths[0].text, 'A sketch of $A$');
  assert.equal(ths[1].kind, 'line');
  assert.match(ths[1].text, /couldn't be fetched: Far away \(https:\/\/example.com\/a.png\)/);
  assert.match(ths[2].text, /fig\.png/);
  assert.equal(made.pictures, 1);
  assert.equal(report.filter((r) => /couldn't be fetched/.test(r)).length, 2);
});

test('> folded folds the group; > folded: X names a bare heading', () => {
  const { w, id } = into('joyce', '## Arrays\n> folded\n- a\n\n##\n\n> folded: Named here\n- b\n\n## Kept\n> folded: Not this\n- c');
  const gs = groupsIn(w, id, 'joyce');
  assert.deepEqual(gs.map((g) => [g.title, !!g.folded]), [['Arrays', true], ['Named here', true], ['Kept', true]]);
});

test('thoughts are stamped in the file\'s order, a millisecond apart', () => {
  const { w, id } = into('joyce', '- loose\n## A\n- a1\n- a2\n## B\n- b1');
  const all = roomItems(w, id);
  assert.deepEqual(all.map((t) => t.text), ['loose', 'a1', 'a2', 'b1']);
  const ats = all.map((t) => t.at);
  assert.equal(ats[0], NOW);
  for (let k = 1; k < ats.length; k++) assert.ok(ats[k] > ats[k - 1] && ats[k] - ats[k - 1] <= 2);
  // Loose thoughts stay in no train; each ## is a train of its own, in clear space side by side.
  const [a, b] = groupsIn(w, id, 'joyce');
  assert.deepEqual(texts(w, members(w, a.id)), ['a1', 'a2']);
  assert.ok(b.x > a.x);
});

test('in a Pessoa room ## headings make Joyce trains', () => {
  const { w, id } = into('pessoa', '## A\n- a\n- b');
  assert.equal(groupsIn(w, id, 'joyce').length, 1);
  assert.equal(groupsFor(ontologies.find((o) => o.id === 'pessoa')), 'joyce');
});

test('LaTeX passes through untouched: $ inside passages, and $$ blocks over several lines', () => {
  const body = [
    'Let $A \\in \\mathbb{R}^{m \\times n}$ and say it costs $5 or $6.',
    '$$',
    '- x + y = \\begin{pmatrix} 1 \\\\',
    '### not a passage',
    '\\end{pmatrix}',
    '$$',
    'After it.',
  ].join('\n');
  const { w, id } = into('joyce', `## Maths\n### Inner products $\\langle u, v \\rangle$\n${body}\n- $\\sum_i x_i$\n  $$\\int_0^1 f$$`);
  const g = groupNamed(w, id, 'Maths');
  const [p, l] = members(w, g.id);
  assert.equal(p.title, 'Inner products $\\langle u, v \\rangle$');
  assert.equal(p.body, body);
  assert.equal(l.text, '$\\sum_i x_i$\n$$\\int_0^1 f$$');
  assert.equal(groupsIn(w, id).length, 1);
});

test('text that looks like structure gets a backslash, and loses it again', () => {
  for (const l of ['## not a heading', '- not a line', '> folded', '![not](a-picture)', '\\## already', '\\frac{a}{b}', '\\\\ newline']) {
    assert.equal(unescape(escape(l)), l, l);
  }
  assert.equal(escape('## x'), '\\## x');
  assert.equal(escape('\\frac{a}{b}'), '\\frac{a}{b}');
  assert.equal(escape('#tag'), '#tag');
  const { w, id } = into('joyce', '## G\n###\nFirst\n\\## Second\n\\- Third');
  assert.equal(members(w, groupNamed(w, id, 'G').id)[0].body, 'First\n## Second\n- Third');
});

test('attributes with quotes and maths are read, kept, and written back', () => {
  const p = parse('## Spaces {note="a \\"quoted\\" word" maths="$\\{x : x > 0\\}$" path="C:\\\\dir\\\\"}\n- x');
  assert.deepEqual(p.report, []);
  assert.deepEqual(p.groups[0].attrs, [['note', 'a "quoted" word'], ['maths', '$\\{x : x > 0\\}$'], ['path', 'C:\\dir\\']]);
  // Braces of LaTeX in a title stay in the title.
  assert.equal(parse('## Sets $\\{x\\}$ {k="v"}\n- x').groups[0].title, 'Sets $\\{x\\}$');
  assert.equal(parse('## The map $f_{x}$\n- x').groups[0].title, 'The map $f_{x}$');
  const { w, id } = into('joyce', '## Spaces {note="a \\"quoted\\" word" parent="Kept too"}\n- x');
  const g = groupNamed(w, id, 'Spaces');
  assert.deepEqual(own(w, id, 'joyce').headings[g.id], [['note', 'a "quoted" word'], ['parent', 'Kept too']]);
  assert.match(exportRoom(w, id, { ontologies }), /## Spaces \{note="a \\"quoted\\" word" parent="Kept too"\}/);
});

// Five chapters and a junction: Arrays → Matrices → Inner products, Eigenvalues → Spectral theorem.
const BOOK = `---
room: Linear algebra
kind: russell
---
## Arrays
- tables of numbers

## Matrices {parent="Arrays" forgets="the individual equations"}
- arrays that act

## Inner products {parent="Matrices"}
- lengths and angles

## Eigenvalues {parent="Matrices" forgets="the basis"}
- directions that stay

## Spectral theorem {parent="Inner products" forgets="the basis" parent="Eigenvalues" forgets="non-orthogonal bases"}
- symmetric means diagonal
`;

test('Russell: each ## is a chapter, and parent attributes draw arrows, a junction too', () => {
  const w = emptyWorld(1);
  const { room: r, report } = importRoom(w, parse(BOOK), { ontologies, now: NOW });
  assert.deepEqual(report, []);
  assert.equal(r.name, 'Linear algebra');
  assert.equal(view(w, r.id).mode, 'russell');
  const id = (t) => groupNamed(w, r.id, t).id;
  assert.equal(chapterName(w, id('Matrices')), 'Matrices');
  assert.deepEqual(parentsOf(w, r.id, id('Spectral theorem')), [id('Inner products'), id('Eigenvalues')]);
  const as = arrows(w, r.id).map((a) => `${chapterName(w, a.from)} → ${chapterName(w, a.to)}: ${a.label}`);
  assert.ok(as.includes('Arrays → Matrices: the individual equations'));
  assert.ok(as.includes('Eigenvalues → Spectral theorem: non-orthogonal bases'));
  assert.ok(as.includes('Matrices → Inner products: '));
  // Laid out as a tree: each generation a level lower, the junction under both its parents.
  const at = layout(w, r.id);
  assert.ok(at[id('Arrays')].y < at[id('Matrices')].y && at[id('Matrices')].y < at[id('Eigenvalues')].y && at[id('Eigenvalues')].y < at[id('Spectral theorem')].y);
});

test('Russell: a loop, an unknown parent, a third parent and a twice-used heading are reported, the rest arrive', () => {
  const { w, id, report } = into('russell', [
    '## A {parent="C"}', '- a', '## B {parent="A"}', '- b', '## C {parent="B"}', '- c',
    '## D {parent="Nowhere" parent="A" parent="B" parent="C"}', '- d',
    '## Twice', '- t1', '## Twice', '- t2', '## E {parent="Twice"}', '- e',
    '## Empty', '', '## F {parent="Empty" forgets="it all"}', '- f',
  ].join('\n'));
  const g = (t) => groupNamed(w, id, t).id;
  assert.equal(groupsIn(w, id, 'russell').length, 8);
  assert.deepEqual(parentsOf(w, id, g('A')), [g('C')]);
  assert.deepEqual(parentsOf(w, id, g('B')), [g('A')]);
  assert.deepEqual(parentsOf(w, id, g('C')), []); // B → C would close the loop C → A → B
  assert.deepEqual(parentsOf(w, id, g('D')), [g('A'), g('B')]);
  const said = report.join('\n');
  assert.match(said, /arrow from "B" to "C" wasn't drawn: that arrow would make a loop/);
  assert.match(said, /no chapter is called "Nowhere"/);
  assert.match(said, /"C" to "D" wasn't drawn: a chapter has at most two parents/);
  assert.match(said, /two chapters are called "Twice"/);
  assert.match(said, /"Empty" has nothing under it, so it was left out/);
  assert.match(said, /"Empty" was left out/);
});

test('Russell: importing into a room, a parent can be a chapter already there', () => {
  const w = emptyWorld(1);
  const { room: r } = importRoom(w, parse(BOOK), { ontologies, now: NOW });
  const out = importInto(w, r.id, parse('## Singular values {parent="Spectral theorem" forgets="symmetry"}\n- any matrix'), { ontologies, now: NOW + 100 });
  assert.deepEqual(out.report, []);
  const sv = groupNamed(w, r.id, 'Singular values').id;
  assert.deepEqual(parentsOf(w, r.id, sv), [groupNamed(w, r.id, 'Spectral theorem').id]);
});

test('a malformed file brings in what it can and reports the rest', () => {
  const p = parse([
    '---', 'room: Half done', 'kind: joyce', 'nonsense here', '## Broken {parent="A" note="never closed', '- one',
    '## Also {a="1" b=}', '- two', '## Fine', '- three',
  ].join('\n'));
  assert.match(p.report[0], /no closing ---/);
  assert.equal(p.meta.room, 'Half done');
  assert.deepEqual(p.groups.map((g) => g.title), ['Broken', 'Also', 'Fine']);
  assert.deepEqual(p.groups[0].attrs, [['parent', 'A']]);
  assert.deepEqual(p.groups[1].attrs, [['a', '1']]);
  assert.equal(p.report.filter((r) => /isn't closed properly/.test(r)).length, 2);
  const w = emptyWorld(1);
  const { room: r, made } = importRoom(w, p, { ontologies, now: NOW });
  assert.equal(made.groups, 3);
  assert.equal(made.thoughts, 4); // the line after the settings arrives as a loose paragraph
  assert.equal(r.name, 'Half done');
});

test('an unknown mode and an unknown key are reported; a locked room takes nothing', () => {
  const w = emptyWorld(1);
  const { room: r, report } = importRoom(w, parse('---\nkind: calvino\ncolour: red\n---\n- x'), { ontologies, now: NOW });
  assert.equal(view(w, r.id).mode, 'joyce');
  assert.match(report.join('\n'), /no mode called "calvino"/);
  assert.match(report.join('\n'), /doesn't know "colour"/);
  lock(w, r.id);
  const out = importInto(w, r.id, parse('- y'), { ontologies, now: NOW });
  assert.equal(out.made.thoughts, 0);
  assert.match(out.report.join('\n'), /locked/);
  // It can still be taken out.
  assert.match(exportRoom(w, r.id, { ontologies }), /- x/);
});

test('front matter carries the room\'s name, mode, description, tags, colour and settings', () => {
  const w = emptyWorld(1);
  const { room: r } = importRoom(w, parse('---\nroom: "1984"\nkind: pessoa\ndescription: "Two lines:\\nhere"\ntags: [a, b]\ntint: "#7a5c3e"\nlight: 0.4\njoyce.tension: 0.7\n---\n- x'),
    { ontologies, now: NOW, globals: { joyce: { tension: 0.2 }, pessoa: { overlap: true } } });
  assert.equal(r.name, '1984');
  assert.equal(r.desc, 'Two lines:\nhere');
  assert.deepEqual(r.tags, ['a', 'b']);
  assert.equal(r.tint, '#7a5c3e');
  assert.equal(r.light, 0.4);
  assert.deepEqual(w.settings[r.id], { joyce: { tension: 0.7 }, pessoa: { overlap: true } });
  assert.equal(r.size, 1);
});

test('a round trip: export, import, export again gives the same file', () => {
  const w = emptyWorld(1);
  const { room: r } = importRoom(w, parse(BOOK), { ontologies, now: NOW });
  r.desc = 'A book where "each" chapter: abstracts the last';
  r.tags = ['maths', 'book, draft'];
  w.settings[r.id] = { russell: { overlap: false } };
  const m = groupNamed(w, r.id, 'Matrices');
  m.folded = true;
  (own(w, r.id, 'russell').headings ||= {})[m.id] = [['status', 'draft "two"']];
  let t = 5000;
  create(w, m.id, { kind: 'passage', title: 'Why $A$', body: 'One $x$.\n\n## looks like a heading\n- and a line\n$$\na \\\\ b\n$$' }, t++);
  create(w, m.id, { kind: 'picture', src: PIC, text: 'A [sketch] of $f(x)$' }, t++);
  create(w, m.id, { kind: 'line', text: 'two\nlines' }, t++);
  create(w, m.id, { kind: 'passage', title: '', body: 'untitled' }, t++);
  create(w, r.id, { kind: 'line', text: 'loose one' }, t++);
  const first = exportRoom(w, r.id, { ontologies });
  const w2 = emptyWorld(1);
  const back = importRoom(w2, parse(first), { ontologies, now: NOW });
  assert.deepEqual(back.report, []);
  const second = exportRoom(w2, back.room.id, { ontologies });
  assert.equal(second, first);
  assert.match(first, /^---\nroom: Linear algebra\nkind: russell\n/);
  assert.match(first, /## Matrices \{parent="Arrays" forgets="the individual equations" status="draft \\"two\\""\}\n> folded\n/);
  assert.match(first, /\\## looks like a heading/);
  // The same thoughts, in the same order, with the same folds.
  const ids = (ww, rid) => groupsIn(ww, rid, 'russell').map((g) => [g.title, !!g.folded, members(ww, g.id).map((th) => th.kind + ':' + (th.text || th.title || th.body))]);
  assert.deepEqual(ids(w2, back.room.id).sort(), ids(w, r.id).sort());
});

test('a big room writes the groups of the mode it shows', () => {
  const w = emptyWorld(1);
  importInto(w, MESSY, parse('## Train\n- a\n- b'), { ontologies, now: NOW });
  assert.match(exportRoom(w, MESSY, { ontologies }), /kind: joyce\n---\n\n## Train\n- a\n- b\n$/);
  view(w, MESSY).mode = 'russell';
  assert.match(exportRoom(w, MESSY, { ontologies }), /kind: russell\n---\n\n- a\n- b\n$/);
});

test('a file name is the room\'s name', () => {
  assert.equal(fileName('Linear algebra'), 'Linear algebra.md');
  assert.equal(fileName('a/b: c?'), 'a b c.md');
  assert.equal(fileName(''), 'Untitled.md');
  assert.ok(room);
});
