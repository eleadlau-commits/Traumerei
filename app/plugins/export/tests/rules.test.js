// Tests for Export's rules. `python build.py test` runs every *.test.js file of every feature.

import { test, assert } from 'folio/testing';
import { outline, markdown, fileName, wordsOf } from '../rules.js';

// A room's tables, by hand: marks [id, kind, content], `at` in the order given.
function room(mode, marks, { places = [], links = [], gaps = [] } = {}) {
  return {
    marks: [{ id: 'R', at: 0, body: { kind: 'room', content: { name: 'My room', mode } } },
      ...marks.map(([id, kind, content], i) => ({ id, at: i + 1, body: { kind, content } }))],
    places: [...marks.map(([id]) => ({ mark: id, context: 'R' })), ...places],
    links, gaps, distance: [], moments: [],
  };
}
const at = (mark, rule, x, y) => ({ mark, context: 'R', rule, position: { x, y } });
const md = (t) => markdown(outline(t, 'R'));

test('Pessoa: a list top to bottom, gaps as tasks, open ones counted at the top', () => {
  const t = room('pessoa', [['a', 'line', { text: 'Paint' }], ['b', 'line', { text: 'Buy paint' }], ['c', 'line', { text: 'Note\nsecond line' }], ['d', 'line', { text: 'Check the colour' }]], {
    places: [at('a', 'pessoa', 0, 200), at('b', 'pessoa', 0, 100), at('c', 'pessoa', 0, 300), at('d', 'pessoa', 0, 400)],
    gaps: [{ mark: 'a', state: 'open', direction: 'from world' }, { mark: 'b', state: 'resolved', direction: 'from world' }, { mark: 'd', state: 'open', direction: 'to world' }],
  });
  assert.equal(md(t), '# My room\n\n> 2 gaps are still open.\n\n- [x] Buy paint\n- [ ] Paint\n- Note\n  second line\n- [ ] Check the colour *(to check)*\n');
});

test('Joyce: trains top to bottom, a titled train or passage is a heading, the rest paragraphs', () => {
  const t = room('joyce', [['g1', 'group', { of: 'joyce', title: 'Day one' }], ['x', 'line', { text: 'Wake' }], ['p', 'passage', { title: 'Intro', text: 'Not written.' }], ['g2', 'group', { of: 'joyce' }], ['y', 'line', { text: 'Loose words' }]], {
    places: [at('g1', 'joyce', 0, 300), at('g2', 'joyce', 0, 0)],
    links: [{ from: 'x', to: 'g1', kind: 'part of', order: 1 }, { from: 'y', to: 'g1', kind: 'part of', order: 0 }, { from: 'p', to: 'g2', kind: 'part of', order: 0 }],
    gaps: [{ mark: 'p', state: 'open', direction: 'to maker' }],
  });
  assert.equal(md(t), '# My room\n\n> One gap is still open.\n\n## **Open, to judge:** Intro\n\nNot written.\n\n## Day one\n\nLoose words\n\nWake\n');
});

test('Russell: the tree as nested headings, parts in order, relations\' children under their parent', () => {
  const t = room('russell', [['top', 'group', { of: 'russell', title: 'Book' }], ['c1', 'line', { text: 'Chapter one\nwhat it says' }], ['c2', 'line', { text: 'Chapter two' }], ['s', 'line', { text: 'A section' }], ['deep', 'line', { text: 'Deeper' }]], {
    links: [{ from: 'c2', to: 'top', kind: 'part of', order: 1 }, { from: 'c1', to: 'top', kind: 'part of', order: 0 },
      { from: 's', to: 'c1', kind: 'relation' }, { from: 'deep', to: 's', kind: 'relation' }],
  });
  assert.equal(md(t), '# My room\n\n## Book\n\n### Chapter one\n\nwhat it says\n\n#### A section\n\nDeeper\n\nChapter two\n');
});

test('Russell: past the sixth level a heading is bold words, and nothing in a loop is lost', () => {
  const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
  const t = room('russell', ids.map((id) => [id, 'line', { text: id }]), { links: ids.slice(1).map((id, i) => ({ from: id, to: ids[i], kind: 'relation' })) });
  assert.ok(md(t).includes('###### n4\n\n**n5**\n\nn6\n'));
  const loop = room('pessoa', [['a', 'group', { title: 'A' }], ['b', 'group', { title: 'B' }]], { links: [{ from: 'a', to: 'b', kind: 'part of' }, { from: 'b', to: 'a', kind: 'part of' }] });
  assert.equal(outline(loop, 'R').blocks.length, 2);
});

test('Proust: one card per thought, ruled apart, each with what it is linked to', () => {
  const t = room('proust', [['a', 'line', { text: 'Card A' }], ['b', 'line', { text: 'Card B\nmore' }]], {
    links: [{ from: 'a', to: 'b', kind: 'link' }], gaps: [{ mark: 'b', state: 'open', direction: 'to maker' }],
  });
  assert.equal(md(t), '# My room\n\n> One gap is still open.\n\nCard A\n\n*Linked to:* Card B\n\n---\n\n**Open, to judge:** Card B\nmore\n\n*Linked to:* Card A\n');
});

test('maths stays as typed, sized words as plain words, a mark in another room is left out', () => {
  const t = room('joyce', [['a', 'line', { text: 'Area $\\pi r^2$ and [big]{size=big}\n$$\\int_0^1 x\\,dx$$' }]]);
  t.marks.push({ id: 'z', at: 9, body: { kind: 'line', content: { text: 'elsewhere' } } });
  t.places.push({ mark: 'z', context: 'Q' });
  assert.equal(md(t), '# My room\n\nArea $\\pi r^2$ and big\n$$\\int_0^1 x\\,dx$$\n');
  assert.equal(wordsOf({ body: { kind: 'picture', content: { caption: 'A view' } } }), 'A view');
});

test('a file name a disk takes', () => {
  assert.equal(fileName('Essay: due 3/12', 'md'), 'Essay- due 3-12.md');
  assert.equal(fileName('', 'pdf'), 'Untitled.pdf');
});

test('the printed page: headings, tasks, cards and open gaps as the Markdown has them', async () => {
  if (typeof document === 'undefined') return; // drawn only where there is a page
  const { page } = await import('../Export.js');
  const t = room('pessoa', [['a', 'line', { text: 'Paint' }], ['b', 'line', { text: 'Check' }]], {
    gaps: [{ mark: 'a', state: 'resolved', direction: 'from world' }, { mark: 'b', state: 'open', direction: 'to world' }] });
  const node = page({}, outline(t, 'R'));
  assert.equal(node.querySelector('h1').textContent, 'My room');
  assert.equal(node.querySelector('.export-left').textContent, 'One gap is still open.');
  assert.deepEqual([...node.querySelectorAll('li')].map((li) => li.textContent), ['☑ Paint', '☐ Open, to check Check']);
});
