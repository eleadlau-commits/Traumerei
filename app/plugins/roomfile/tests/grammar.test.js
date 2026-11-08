// Tests for the .traum grammar: front matter, objects, sections, typed values and escaping.

import { test, assert } from 'folio/testing';
import { parse, write, values, writeValue, keyLine, keysOf, escape, unescape } from '../grammar.js';

const FILE = [
  '---', 'format: room/2', 'room: Linear algebra', 'modes: [russell, joyce]', 'tags: [maths, "book, draft"]', '---', '',
  '# Objects', '', '## ^1 line', 'A vector is a list of numbers.', '',
  '## ^2 passage: Why arrays', 'A passage keeps its paragraphs, with $x_i$ and', '', '$$\\sum_i x_i$$', '',
  '## ^arrays group: Arrays', 'made in: russell', 'holds: ^1 ^2', 'closed', '',
  '# In russell', 'on canvas: ^arrays', 'arrow: ^arrays -> ^matrices | forgets | the equations', '',
  '# In joyce', 'at: ^arrays 120 -40',
].join('\n');

test('a file is read into front matter, objects and sections', () => {
  const p = parse(FILE);
  assert.deepEqual(p.report, []);
  assert.deepEqual(p.front.map((f) => f.key), ['format', 'room', 'modes', 'tags']);
  assert.deepEqual(p.objects.map((o) => [o.id, o.kind, o.title]), [['1', 'line', null], ['2', 'passage', 'Why arrays'], ['arrays', 'group', 'Arrays']]);
  assert.deepEqual(p.objects[1].lines, ['A passage keeps its paragraphs, with $x_i$ and', '', '$$\\sum_i x_i$$']);
  assert.deepEqual(p.sections.map((s) => s.name), ['In russell', 'In joyce']);
  assert.deepEqual(p.sections[0].lines.map((l) => l.key), ['on canvas', 'arrow']);
  assert.deepEqual(p.sections[1].lines[0].values, [{ t: 'ref', id: 'arrays' }, { t: 'num', v: 120 }, { t: 'num', v: -40 }]);
});

test('a group\'s body is key lines; a bare word is a flag', () => {
  const p = parse(FILE);
  const { keys, other } = keysOf(p.objects[2]);
  assert.deepEqual(keys.map((k) => [k.key, !!k.flag]), [['made in', false], ['holds', false], ['closed', true]]);
  assert.deepEqual(keys[1].values.map((v) => v.id), ['1', '2']);
  assert.equal(other.length, 0);
  assert.equal(keys[0].line, 19);
});

test('values are typed: refs, occurrences, spans, numbers, dates, text, lists, signs, words', () => {
  assert.deepEqual(values('^a ^a#2 ^b@"the cruellest month" 3 -2.5 2026-11-05 "quoted, text" [x, "y z", 4] -> | word'), [
    { t: 'ref', id: 'a' }, { t: 'ref', id: 'a', occ: 2 }, { t: 'ref', id: 'b', span: 'the cruellest month' },
    { t: 'num', v: 3 }, { t: 'num', v: -2.5 }, { t: 'date', v: '2026-11-05' }, { t: 'text', v: 'quoted, text' },
    { t: 'list', v: [{ t: 'word', v: 'x' }, { t: 'text', v: 'y z' }, { t: 'num', v: 4 }] },
    { t: 'sign', v: '->' }, { t: 'sign', v: '|' }, { t: 'word', v: 'word' },
  ]);
});

test('every value writes back as itself', () => {
  const raw = '^a ^a#2 ^b@"say \\"hi\\"" 3 -2.5 2026-11-05T10:30 "with \\\\ and space" [x, "y z", 4] -> | word';
  const vs = values(raw);
  assert.deepEqual(values(vs.map(writeValue).join(' ')), vs);
  assert.equal(writeValue('two words'), '"two words"');
  assert.equal(writeValue('12'), '"12"');
});

test('key lines: key: values, or a bare flag; anything else is not one', () => {
  assert.deepEqual(keyLine('made in: joyce').key, 'made in');
  assert.equal(keyLine('closed').flag, true);
  assert.equal(keyLine('A vector is a list.'), null);
  assert.equal(keyLine('holds:').raw, '');
});

test('a body line that would read as structure gets a backslash, and loses it on the way back', () => {
  for (const l of ['## ^7 line', '# In joyce', '\\## ^7 line']) assert.equal(unescape(escape(l)), l);
  assert.equal(escape('## not an object'), '## not an object');
  assert.equal(escape('#hashtag'), '#hashtag');
  const text = write({ objects: [{ id: '1', kind: 'passage', title: 'T', lines: ['# Not a section', '## ^2 not an object'] }] });
  assert.deepEqual(parse(text).objects.map((o) => o.lines), [['# Not a section', '## ^2 not an object']]);
});

test('write and parse agree', () => {
  const text = write({
    front: [['format', 'room/2'], ['room', 'A']],
    objects: [{ id: '1', kind: 'line', lines: ['one', '', 'two'] }, { id: '2', kind: 'group', title: 'G', lines: ['holds: ^1'] }],
    sections: [{ name: 'In joyce', lines: ['at: ^2 0 0'] }],
  });
  const p = parse(text);
  assert.deepEqual(p.objects.map((o) => [o.id, o.kind, o.title, o.lines]), [['1', 'line', null, ['one', '', 'two']], ['2', 'group', 'G', ['holds: ^1']]]);
  assert.equal(p.sections[0].lines[0].text, 'at: ^2 0 0');
});

test('lines outside any object or section are reported once', () => {
  const p = parse('stray\nmore stray\n# Objects\n## ^1 line\nok');
  assert.equal(p.report.length, 1);
  assert.match(p.report[0], /Line 1: "stray" is outside any object or section, and so is 1 more line/);
  assert.equal(p.objects.length, 1);
});
