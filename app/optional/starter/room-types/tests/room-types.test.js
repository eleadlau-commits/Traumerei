// Tests for Room types: the reader (file.js), the rule (rule.js), the kept types (types.js) and
// Export (pack.js), with a small fake of the API. `python build.py test` runs them.

import { test, assert } from 'folio/testing';
import { read, slug, compile } from '../file.js';
import { ruleOf } from '../rule.js';
import { makeTypes } from '../types.js';
import { pack } from '../pack.js';
import { GUIDE, CALENDAR, COPIED } from '../guide.js';

// Ten marks a day apart, the third with an open gap; the second links to the first.
const MARKS = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, kind: 'line', text: `thought ${String.fromCharCode(106 - i)}`, at: 1000 + i * 864e5 }));
function readsOf(marks = MARKS, ahead = {}) {
  const none = () => [];
  return {
    marks: { in: () => marks.map((m) => ({ ...m })), get: (id) => marks.find((m) => m.id === id) || null, text: (id) => marks.find((m) => m.id === id)?.text || '', ofKind: none, search: none },
    links: { from: (id) => (id === 'm1' ? [{ id: 'l', from: 'm1', to: 'm0', kind: 'follows' }] : []), to: none, get: () => null, members: none, holders: none, standsFor: none, kinds: none, named: () => null, count: () => 1 },
    gaps: { of: (id) => (id === 'm2' ? { state: 'open', direction: 'from world' } : null), opened: none, oldest: () => null, progress: () => ({ open: 0, resolved: 0, of: 0 }) },
    moments: { next: (id) => ahead[id] || null, of: none, changed: () => null, ahead: none, returns: none },
    places: { of: none, home: () => 'room', in: none, loose: none, position: () => null },
    distance: { of: () => null, declared: () => null, all: none, shut: () => false, readers: none },
  };
}
const at = (list) => new Map(list.map((p) => [p.mark, { x: p.x, y: p.y }]));

const LADDER = `# Reading ladder

One column, newest at the foot; a step may only follow an older one.

links: follows

Notes to myself are ignored.

\`\`\`js
arrange = (reads, context) =>
  reads.marks.in(context).filter((m) => m.kind !== 'group')
    .sort((a, b) => a.at - b.at)
    .map((m, i) => ({ mark: m.id, x: 0, y: i * 160 }));

admit = (reads, p) =>
  p.kind !== 'link' || reads.marks.get(p.from).at > reads.marks.get(p.to).at
    || 'A step may only follow an older one';
\`\`\`
`;

test('the reader: name, note, lines and code; anything else is ignored', () => {
  const f = read(LADDER);
  assert.deepEqual([f.id, f.name, f.note, f.errors], ['reading-ladder', 'Reading ladder', 'One column, newest at the foot; a step may only follow an older one.', []]);
  assert.deepEqual(f.lines.links, ['follows']);
  assert.ok(typeof f.hooks.arrange === 'function' && typeof f.hooks.admit === 'function' && !f.hooks.draw);
  assert.equal(slug('Ça va, Wochenplan 2!'), 'ca-va-wochenplan-2');
  const g = read('# Cards\n\narrange: columns\ncolumns: 3\ncell: 300 x 120\norder: by text\nhand: no\nicon: M4 4h16v16H4z');
  assert.deepEqual([g.lines.arrange, g.lines.columns, g.lines.cell, g.lines.order, g.lines.hand, g.icon], ['columns', 3, { w: 300, h: 120 }, 'by text', false, '<path d="M4 4h16v16H4z"/>']);
});

test('a broken file names its line', () => {
  assert.equal(read('no heading here').errors[0], 'Line 1: a room type needs a name, as its first heading (# Name)');
  assert.equal(read('# A\n\narrange: diagonal').errors[0], 'Line 3: arrange is one of grid, rows, columns, spiral, by links, code');
  assert.equal(read('# A\n\ncell: big').errors[0], 'Line 3: cell is width x height in world units, e.g. 240 x 160');
  assert.ok(/^Line 4(\+\d+)?: the code does not run/.test(read('# A\n\n```js\narrange = (r, c) => {\n```').errors[0]));
  assert.ok(/never closed/.test(read('# A\n```js\narrange = () => []').errors.at(-1)));
  assert.equal(read('# A\narrange: code').errors[0], 'arrange: code needs an arrange = (reads, context) => … in the ```js block');
  assert.equal(compile('draw = 3').why, 'draw must be a function');
});

test('each arrangement in words places all ten marks, in the order asked', () => {
  const reads = readsOf();
  const by = (md) => at(ruleOf(read(md)).arrange(reads, 'room'));
  const grid = by('# G\ncolumns: 4');
  assert.deepEqual([grid.size, grid.get('m5')], [10, { x: 240, y: 160 }]);
  assert.deepEqual(by('# R\narrange: rows').get('m3'), { x: 0, y: 480 });
  const cols = by('# C\narrange: columns\ncolumns: 2');
  assert.deepEqual([cols.get('m4'), cols.get('m5')], [{ x: 0, y: 640 }, { x: 240, y: 0 }]);
  const sp = by('# S\narrange: spiral');
  assert.equal(new Set([...sp.values()].map((p) => `${p.x},${p.y}`)).size, 10);
  const tree = by('# T\narrange: by links');
  assert.ok(tree.get('m1').x > tree.get('m0').x && tree.get('m1').y === tree.get('m0').y + 160); // under the one it links to
  assert.deepEqual(by('# N\norder: newest first').get('m9'), { x: 0, y: 0 });
  assert.deepEqual(by('# X\norder: by text').get('m9'), { x: 0, y: 0 }); // 'thought a'
  assert.deepEqual(by('# O\norder: open gaps first').get('m2'), { x: 0, y: 0 });
});

test('the code wins over the words, a throwing arrange falls back to rows, and admit says no in words', () => {
  const reads = readsOf();
  const ladder = ruleOf(read(LADDER));
  assert.deepEqual(at(ladder.arrange(reads, 'room')).get('m9'), { x: 0, y: 1440 });
  assert.equal(ladder.admit(reads, { kind: 'link', from: 'm0', to: 'm1', link: 'follows' }), 'A step may only follow an older one');
  assert.equal(ladder.admit(reads, { kind: 'link', from: 'm1', to: 'm0', link: 'cites' }), 'This room takes only follows links');
  assert.equal(ladder.admit(reads, { kind: 'link', from: 'm1', to: 'm0', link: 'follows' }), true);
  const said = [];
  const odd = ruleOf(read('# Odd\n```js\narrange = () => { throw new Error("oops"); };\ndraw = () => { throw new Error("no"); };\n```'), (hook, err) => said.push(`${hook}: ${err.message}`));
  assert.deepEqual(at(odd.arrange(reads, 'room')).get('m2'), { x: 0, y: 320 });
  assert.deepEqual(odd.draw(reads, 'room'), []);
  assert.deepEqual(said, ['arrange: oops', 'draw: no']);
});

test('a 1,500-mark room arranges within the budget (50 ms)', () => {
  const many = Array.from({ length: 1500 }, (_, i) => ({ id: `b${i}`, kind: 'line', text: `t${i}`, at: i }));
  const reads = readsOf(many);
  for (const md of ['# G', '# T\narrange: by links', LADDER, CALENDAR]) {
    const r = ruleOf(read(md));
    r.arrange(reads, 'room');
    const t0 = performance.now();
    r.arrange(reads, 'room');
    assert.ok(performance.now() - t0 < 50, `${read(md).name} took ${Math.round(performance.now() - t0)} ms`);
  }
});

// A fake of the API's two parts the kept types use.
function fakeT(kept = {}) {
  const rules = [{ id: 'joyce', name: 'Joyce' }, { id: 'pessoa', name: 'Pessoa' }];
  const data = { types: kept };
  return {
    rules,
    slots: { rules: { add: (r) => { rules.push(r); return () => { const i = rules.indexOf(r); if (i >= 0) rules.splice(i, 1); }; }, get all() { return rules; } } },
    store: { get: (k, d) => (k in data ? JSON.parse(JSON.stringify(data[k])) : d), set: (k, v) => { data[k] = JSON.parse(JSON.stringify(v)); } },
    data,
  };
}

test('kept types: save, edit (renamed), remove; a broken one or a taken name is refused', () => {
  const t = fakeT();
  const types = makeTypes(t);
  types.start();
  assert.ok(types.save(LADDER).ok);
  assert.ok(t.rules.some((r) => r.id === 'reading-ladder'));
  assert.equal(types.save(LADDER).reason, 'Reading ladder is already made here; edit that one');
  assert.equal(types.save('# Joyce').reason, 'A room type called Joyce is already here; give this one another name');
  assert.equal(types.save('# Bad\n```js\narrange = () => 7;\n```').reason, 'arrange must return a list of { mark, x, y }');
  assert.ok(/fails: boom/.test(types.save('# Bad\n```js\narrange = () => { throw new Error("boom"); };\n```').reason));
  const edited = LADDER.replace('# Reading ladder', '# Steps');
  assert.ok(types.save(edited, 'reading-ladder').ok);
  assert.deepEqual(t.rules.map((r) => r.id), ['joyce', 'pessoa', 'steps']);
  assert.deepEqual(Object.keys(t.data.types), ['steps']);
  // Started again (the next session), it comes back from the store.
  const again = fakeT(t.data.types);
  makeTypes(again).start();
  assert.ok(again.rules.some((r) => r.id === 'steps' && r.name === 'Steps'));
  assert.ok(types.remove('steps').ok);
  assert.deepEqual([t.rules.length, Object.keys(t.data.types)], [2, []]);
});

test('Export writes a traumplug/1 that registers the same rule', async () => {
  const f = read(CALENDAR);
  assert.deepEqual(f.errors, []);
  const text = pack(f, CALENDAR, { minApp: '1.0.2' });
  const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  const mod = await import(url);
  URL.revokeObjectURL(url);
  assert.deepEqual([mod.manifest.format, mod.manifest.id, mod.manifest.plugin.kind, mod.manifest.plugin.minApp, mod.css], ['traumplug/1', 'made-month-calendar', ['mode'], '1.0.2', '']);
  assert.equal(mod.file.md, CALENDAR);
  const t = fakeT();
  class Feature { use() { return { connect: () => t }; } }
  const Made = mod.default({ Feature });
  new Made().start();
  const rule = t.rules.find((r) => r.id === 'month-calendar');
  assert.ok(rule && rule.draw && rule.drop && rule.land && rule.hand === false);
  const reads = readsOf();
  const boxes = rule.draw(reads, 'room');
  assert.ok(boxes.length >= 35 && boxes.some((b) => b.note === 'today'));
  const b = boxes[10];
  const due = rule.drop(reads, 'room', 'm0', b.x + 10, b.y + 10).due;
  assert.equal(new Date(due).getHours(), 12);
  assert.deepEqual(rule.land(reads, 'room', 'm0', -50, 10), null);
  assert.deepEqual(rule.drop(reads, 'room', 'm0', -50, 10), { clear: true });
  // A dated mark sits inside its day's box.
  const p = at(rule.arrange(readsOf(MARKS, { m3: { at: due, state: 'waiting', kind: 'due' } }), 'room')).get('m3');
  assert.ok(p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h);
});

test('the guide a model is given carries the format, the hooks and the calendar', () => {
  for (const words of ['# Name of the type', '`arrange(reads, context)`', '`draw(reads, context)`', '`drop(reads, context, mark, x, y)`', '`land(reads, context, mark, x, y)`', '{ due: time, note? }', 'reads.moments']) assert.ok(GUIDE.includes(words), words);
  assert.ok(COPIED.startsWith(GUIDE) && COPIED.includes(CALENDAR));
});
