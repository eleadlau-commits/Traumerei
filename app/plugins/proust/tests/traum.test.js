// Tests for Proust's # In proust section of a .traum file (rules.js: traum), read and written by
// the roomfile feature: exact round trips for every kind of end, loops and links both ways,
// clusters (and clusters in clusters), a big room whose modes share objects, refused lines
// reported, and hand edits through the source editor.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v1.js';
import { bind } from '../world.js';
import { bind as bindRoomfile } from '../../roomfile/world.js';
import { emptyWorld, members, groupsIn, roomItems, own, setRoomSetting } from '../../world/model.js';
import { gather } from '../../world/ontologies/index.js';
import { parse, readLink, writeLink } from '../../roomfile/grammar.js';
import { importRoom, exportRoom } from '../../roomfile/traum.js';
import { open, apply } from '../../roomfile/edit.js';
import { proust, links, point, endsOf } from '../rules.js';

bind(surface(lib));
bindRoomfile(lib);
const ontologies = gather([proust]);
const L = () => links();

const head = (modes = '[proust]', more = []) => ['---', 'format: room/2', 'room: Combray', `modes: ${modes}`, ...more, '---', ''];
const fresh = (text) => { const w = emptyWorld(1); return { w, ...importRoom(w, parse(text), { ontologies, now: 1000 }) }; };
const out = (w, id) => exportRoom(w, id, { ontologies });
// The file a room gives, read into a new room and written again: the same text.
function roundTrip(text) {
  const a = fresh(text);
  assert.deepEqual(a.report, []);
  const first = out(a.w, a.room.id);
  const b = fresh(first);
  assert.deepEqual(b.report, []);
  assert.equal(out(b.w, b.room.id), first);
  return { ...a, first, b };
}
const section = (text) => text.slice(text.indexOf('# In proust')).trim().split('\n');
const byText = (w, id) => Object.fromEntries(roomItems(w, id).map((th) => [th.text, th.id]));
const linksBy = (w, id) => {
  const name = Object.fromEntries(Object.entries(byText(w, id)).map(([t, x]) => [x, t]));
  for (const g of groupsIn(w, id)) name[g.id] = g.title;
  return L().arrows(w, id).map((a) => `${name[a.from]} ${a.rel || '·'} ${name[a.to]}${a.label ? ` (${a.label})` : ''}`).sort();
};

const FILE = [...head('[proust]', ['proust.relations: [related to, "calls up ->", "is the same as <->"]']),
  '# Objects', '',
  '## ^1 line: the madeleine', '## ^2 line: Combray', '## ^3 line: the church', '## ^4 line: Swann', '## ^5 line: Odette', '',
  '## ^c group: Combray', 'made in: proust', 'holds: ^2 ^3', '',
  '# In proust',
  'at: ^1 0 0', 'at: ^2 320 0', 'at: ^3 320 120 auto', 'on canvas: ^4 ^5',
  'link: ^1 -> ^2 | calls up | in the tea',
  'link: ^2 -- ^3',
  'link: ^3 -> ^4 | calls up',
  'link: ^4 -> ^1 | calls up',
  'link: ^1 -> ^4 | calls up | and back',
  'link: ^c <-> ^5 | is the same as | "a | in it"',
].join('\n');

test('the grammar: a link\'s three ends, its relation and label, read and written', () => {
  for (const [raw, ends] of [['^a -- ^b', 'none'], ['^a -> ^b', 'arrow'], ['^a <-> ^b', 'both'], ['^a->^b', 'arrow'], ['^a<->^b | x', 'both']]) {
    const l = readLink(raw);
    assert.equal(l.ends, ends, raw);
    assert.equal(l.from.id, 'a');
    assert.equal(l.to.id, 'b');
  }
  assert.deepEqual(readLink('^a => ^b'), { bad: '=>' });
  assert.equal(readLink('a -> b'), null);
  const l = readLink('^a <-> ^b | "is | the same" | "a label"');
  assert.deepEqual([l.rel, l.label], ['is | the same', 'a label']);
  assert.equal(writeLink({ from: '^a', to: '^b', ends: 'both', rel: 'is | the same', label: ' x' }), '^a <-> ^b | "is | the same" | " x"');
  assert.equal(writeLink({ from: '^a', to: '^b' }), '^a -- ^b');
  assert.equal(writeLink({ from: '^a', to: '^b', ends: 'arrow', label: 'only a label' }), '^a -> ^b | | only a label');
});

test('a file in: places, the spiral, a cluster, links with every kind of end, a loop and a link back', () => {
  const { w, room: r, report } = fresh(FILE);
  assert.deepEqual(report, []);
  const t = byText(w, r.id);
  assert.deepEqual(point(w, r.id, t['the madeleine']), { x: 0, y: 0 });
  assert.deepEqual(own(w, r.id, 'proust')[t['the church']], { x: 320, y: 120, auto: true });
  assert.equal(own(w, r.id, 'proust', false)[t.Swann], undefined); // on the spiral
  const c = groupsIn(w, r.id, 'proust')[0];
  assert.deepEqual(members(w, c.id).map((m) => m.text), ['Combray', 'the church']);
  assert.deepEqual(linksBy(w, r.id), [
    'Combray is the same as Odette (a | in it)', 'Combray · the church', 'Swann calls up the madeleine',
    'the church calls up Swann', 'the madeleine calls up Combray (in the tea)', 'the madeleine calls up Swann (and back)',
  ].sort());
  const list = w.settings[r.id].proust.relations;
  assert.equal(endsOf(list, 'calls up'), 'arrow');
  assert.equal(endsOf(list, 'is the same as'), 'both');
  assert.equal(endsOf(list, 'related to'), 'none');
});

test('and back out exactly: the same file again, every end as it was', () => {
  const { first } = roundTrip(FILE);
  const lines = section(first);
  for (const l of ['link: ^1 -> ^2 | calls up | in the tea', 'link: ^2 -- ^3', `link: ${lines.find((x) => x.includes('<->')).split(' ').slice(1, 4).join(' ')} | is the same as | a | in it`]) {
    assert.ok(lines.includes(l), `${l} in\n${lines.join('\n')}`);
  }
  assert.ok(lines.some((l) => /^at: \^\d+ 320 120 auto$/.test(l)));
  assert.ok(lines.some((l) => /^on canvas: /.test(l)));
  assert.equal(lines.filter((l) => l.startsWith('link: ')).length, 6);
});

test('a relation the room lacks joins its list with the line\'s ends; one it has keeps its own, and says so', () => {
  const text = [...head(), '# Objects', '## ^1 line: a', '## ^2 line: b', '## ^3 line: c', '# In proust',
    'link: ^1 -> ^2 | cites', 'link: ^2 <-> ^3 | mirrors', 'link: ^3 -- ^1 | near', 'link: ^1 <-> ^3 | related to', 'link: ^2 -> ^1'].join('\n');
  const { w, room: r, report } = fresh(text);
  const list = own(w, r.id, 'x', false) && w.settings[r.id].proust.relations;
  assert.deepEqual(list, ['related to', 'leads to ->', 'is equivalent to <->', 'cites ->', 'mirrors <->', 'near']);
  assert.equal(report.length, 2);
  assert.ok(/"related to" is a plain line in this room's relations/.test(report[0]));
  assert.ok(/a link with no relation is a plain line, so its -> was read as --/.test(report[1]));
  assert.equal(L().arrows(w, r.id).length, 5); // all still drawn
});

test('refused lines are reported and the rest arrives: a link to itself, unknown ends, a missing thing, a second at:', () => {
  const text = [...head(), '# Objects', '## ^1 line: a', '## ^2 line: b', '# In proust',
    'at: ^1 5 5', 'at: ^1 6 6', 'at: ^2 x', 'link: ^1 -> ^1', 'link: ^1 => ^2', 'link: ^1 -> ^9', 'link: ^1 -> ^2 | leads to', 'link: ^1 -> ^2 | leads to', 'wobble: ^1'].join('\n');
  const { w, room: r, report } = fresh(text);
  const said = report.join('\n');
  assert.ok(/places a thing once/.test(said));
  assert.ok(/at: needs a \^reference and two numbers/.test(said));
  assert.ok(/the link wasn't drawn: a thought can't be linked to itself/.test(said));
  assert.ok(/a link's ends are --, -> or <->, not "=>"/.test(said));
  assert.ok(/\^9 isn't in the file/.test(said));
  assert.ok(/the link wasn't drawn: that link is already there/.test(said));
  assert.ok(/proust doesn't know "wobble"; it was kept/.test(said));
  assert.equal(L().arrows(w, r.id).length, 1);
  assert.ok(out(w, r.id).includes('wobble: ^1')); // kept, and written back
});

test('Russell\'s arrow: lines and relation objects are links too; a relation object\'s ends: is read', () => {
  const text = [...head(), '# Objects', '## ^1 line: a', '## ^2 line: b', '## ^3 line: c',
    '## ^r relation: echoes', 'from: ^2', 'to: ^3', 'ends: <->', 'label: "far off"',
    '## ^s relation: follows', 'made in: proust', 'from: ^3', 'to: ^1', 'ends: sideways',
    '# In proust', 'arrow: ^1 -> ^2 | forgets'].join('\n');
  const { w, room: r, report } = fresh(text);
  assert.equal(report.length, 1);
  assert.ok(/a relation's ends are none, arrow or both/.test(report[0]));
  const list = w.settings[r.id].proust.relations;
  assert.equal(endsOf(list, 'forgets'), 'arrow');
  assert.equal(endsOf(list, 'echoes'), 'both');
  assert.equal(endsOf(list, 'follows'), 'none'); // no ends given: a plain line
  assert.deepEqual(linksBy(w, r.id), ['a forgets b', 'b echoes c (far off)', 'c follows a']);
  roundTrip(out(w, r.id)); // written as link: lines, and back the same
});

test('clusters: one in the tray, clusters in clusters, links to a cluster whole; and back out the same', () => {
  const text = [...head(), '# Objects', '## ^1 line: a', '## ^2 line: b', '## ^3 line: c', '## ^4 line: d', '## ^5 line: e',
    '## ^in group: Inner', 'made in: proust', 'holds: ^1 ^2', 'shared',
    '## ^out group: Outer', 'made in: proust', 'holds: ^in ^3', 'shared',
    '## ^t group: Waiting', 'made in: proust', 'holds: ^4', 'shared',
    '# In proust', 'at: ^1 0 0', 'at: ^2 100 0', 'at: ^3 0 100', 'tray: ^t',
    'link: ^in -> ^out | leads to', 'link: ^out -- ^5', 'link: ^5 <-> ^1 | is equivalent to'].join('\n');
  const { w, room: r, first } = roundTrip(text);
  const g = (t) => groupsIn(w, r.id).find((x) => x.title === t);
  assert.deepEqual(members(w, g('Outer').id).map((m) => m.title || m.text), ['Inner', 'c']);
  assert.ok(g('Waiting').loose);
  assert.deepEqual(proust.tray(w, r.id).map((x) => x.id), [g('Waiting').id]);
  assert.deepEqual(linksBy(w, r.id), ['Inner leads to Outer', 'Outer · e', 'e is equivalent to a']);
  assert.ok(section(first).some((l) => /^tray: \^\d+$/.test(l)));
  // A cluster's at: moves it whole.
  const moved = fresh(first.replace('# In proust', '# In proust\nat: ^' + first.match(/## \^(\d+) group: Outer/)[1] + ' 500 500'));
  const o = groupsIn(moved.w, moved.room.id).find((x) => x.title === 'Outer');
  assert.deepEqual(point(moved.w, moved.room.id, o.id), { x: 500, y: 500 });
});

test('a big room: Joyce, Russell and Proust share their objects, each mode its own section, the same counts', () => {
  const text = [...head('[joyce, russell, proust]'), '# Objects',
    '## ^1 line: a', '## ^2 line: b', '## ^3 line: c', '## ^4 line: d', '## ^5 line: e',
    '## ^t group: Train', 'made in: joyce', 'holds: ^1 ^2', 'shared',
    '## ^ch group: Chapter', 'made in: russell', 'holds: ^3', 'shared',
    '## ^cl group: Cluster', 'made in: proust', 'holds: ^4 ^5', 'shared',
    '# In joyce', 'at: ^t 0 0', '# In russell', 'on canvas: ^ch',
    '# In proust', 'at: ^t 300 300', 'at: ^ch 200 0', 'at: ^4 0 0', 'at: ^5 0 80', 'link: ^t -> ^cl | leads to', 'link: ^ch <-> ^4 | is equivalent to'].join('\n');
  const { w, room: r, first } = roundTrip(text);
  assert.ok(/# In joyce/.test(first) && /# In russell/.test(first) && /# In proust/.test(first));
  const t = groupsIn(w, r.id).find((x) => x.title === 'Train');
  assert.deepEqual(point(w, r.id, t.id), { x: 300, y: 300 }); // Joyce's train, placed in Proust
  assert.equal(L().arrows(w, r.id).length, 2);
  // Every mode sees the same objects: each shared group once (a card on the canvas or in the tray),
  // never its thoughts as well. (Proust's own open cluster is drawn as a box around its thoughts,
  // so in Proust it counts as the cluster.)
  const seen = (id) => { const o = ontologies.find((x) => x.id === id); return [...o.units(w, r.id), ...(o.tray?.(w, r.id) || [])].map((u) => u.id); };
  const cl = groupsIn(w, r.id, 'proust').find((g) => g.title === 'Cluster');
  const inCl = new Set(members(w, cl.id).map((m) => m.id));
  const inProust = new Set([...seen('proust').filter((id) => !inCl.has(id)), cl.id]);
  assert.ok(inProust.has(t.id));
  assert.ok(!seen('pessoa').some((id) => inCl.has(id)));
  assert.deepEqual([...inProust].sort(), [...new Set(seen('pessoa'))].sort());
  // Links are Proust's own: no other mode's section has them.
  assert.ok(!first.slice(first.indexOf('# In joyce'), first.indexOf('# In proust')).includes('link:'));
});

test('editing in the source editor: a link changed, one taken away, one added, each said', () => {
  const { w, room: r } = fresh(FILE);
  const c = groupsIn(w, r.id, 'proust')[0];
  const s = open(w, r.id, { scope: 'group', groupId: c.id, ontologies });
  const id = (text) => s.text.match(new RegExp(`## \\^(\\d+) line\\n${text}\\n`))[1];
  const [combray, church] = [id('Combray'), id('the church')];
  const text = s.text
    .replace(`link: ^${combray} -- ^${church}`, `link: ^${combray} -> ^${church} | calls up | the bells`)
    .replace(/link: .* <-> .*\n?/, '')
    .concat(`link: ^${church} -> ^${combray} | calls up\n`);
  const res = apply(w, r.id, s, parse(text), { ontologies, now: 5000 });
  assert.deepEqual(res.report, []);
  const said = res.changes.join('\n');
  assert.ok(/no relation becomes calls up/.test(said), said);
  assert.ok(/label none becomes "the bells"/.test(said), said);
  assert.ok(/The link from "?Combray"? to "?Odette"? is taken away/.test(said), said);
  assert.ok(/A new link from "?the church"? to "?Combray"?/.test(said), said);
  assert.deepEqual(linksBy(w, r.id).filter((x) => /church|Combray/.test(x)), [
    'Combray calls up the church (the bells)', 'the church calls up Combray', 'the church calls up Swann', 'the madeleine calls up Combray (in the tea)',
  ].sort());
});

test('the same text through the source editor changes nothing', () => {
  const { w, room: r } = fresh(FILE);
  for (const scope of ['group', 'room']) {
    const s = open(w, r.id, { scope, groupId: groupsIn(w, r.id, 'proust')[0].id, ontologies });
    const before = JSON.stringify(w);
    const res = apply(w, r.id, s, parse(s.text), { ontologies, now: 5000 });
    assert.deepEqual(res.report, []);
    assert.deepEqual(res.changes, []);
    assert.equal(JSON.stringify(w), before);
  }
});

test('each relation\'s look rides in the front matter and comes back the same, for Proust and Russell', () => {
  const text = [...head('[proust, russell]', [
    'proust.relations: [related to, "calls up -> | dashed amber", "is the same as <-> | dotted"]',
    'russell.relations: ["forgets | rust", "is a case of | dashed slate"]',
  ]), '# Objects', '', '## ^1 line: the madeleine', '## ^2 line: Combray', '',
  '# In proust', 'link: ^1 -> ^2 | calls up'].join('\n');
  const { w, room: r, first, b } = roundTrip(text);
  assert.deepEqual(w.settings[r.id].proust.relations, ['related to', 'calls up -> | dashed amber', 'is the same as <-> | dotted']);
  assert.deepEqual(w.settings[r.id].russell.relations, ['forgets | rust', 'is a case of | dashed slate']);
  assert.ok(first.includes('calls up -> | dashed amber') && first.includes('is a case of | dashed slate'), first);
  assert.deepEqual(b.w.settings[b.room.id].proust.relations, w.settings[r.id].proust.relations);
});

test('a thought waiting in the tray (added away from the canvas) is written as tray: and comes back waiting, in Proust and Pessoa', () => {
  const text = [...head('[proust, pessoa]'), '# Objects', '## ^1 line: a', '## ^2 line: new',
    '# In proust', 'at: ^1 0 0', 'tray: ^2', '# In pessoa', 'tray: ^2'].join('\n');
  const { w, room: r, first } = roundTrip(text);
  const n = byText(w, r.id).new;
  assert.deepEqual(proust.tray(w, r.id).map((th) => th.id), [n]);
  const pessoa = ontologies.find((o) => o.id === 'pessoa');
  assert.deepEqual(pessoa.tray(w, r.id).map((th) => th.id), [n]);
  assert.ok(section(first).some((l) => /^tray: \^\d+$/.test(l)));
});
