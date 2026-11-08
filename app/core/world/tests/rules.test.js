// The gate of kernel phase 4 (KERNEL.md, Rules): every ontology is a rule with no state of its
// own. Law 3: a rule may constrain, never destroy (its reads change nothing at all; its moves
// never take a thought or a link away). Its layout of a 1,500-thought room is laid out afresh in
// 50 ms after a change, and a mode switch (a cold layout) takes under 100 ms. Old worlds, which
// kept positions on the thoughts and in the rules' own data, are read into rule rows once.

import { test, assert } from 'folio/testing';
import * as lib from '../lib.js';
import { surface } from '../../api/v2.js';
import { bind as bindRussell } from '../../russell/world.js';
import { bind as bindProust } from '../../proust/world.js';
import * as model from '../model.js';
import * as P from '../places.js';
import * as L from '../links.js';
import * as R from '../rules.js';
import { emptyWorld, loadWorld, create, MESSY, addRoom } from '../model.js';
import { gather, groupChosen, ungroupChosen, throwBack } from '../ontologies/index.js';
import russell, { link as russellLink } from '../../russell/rules.js';
import { proust } from '../../proust/rules.js';

bindRussell(surface(lib));
bindProust(surface(lib));
const RULES = gather([russell, proust]);
const byId = (id) => RULES.find((o) => o.id === id);

// A seeded random (the same run every time).
const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// A room of `n` thoughts the way people write: trains of one to nine thoughts, some dragged off
// their line, Pessoa spots, a few Russell chapters with arrows, Proust clusters and links.
function fixture(n = 1500, seed = 7) {
  const r = rng(seed), w = emptyWorld(1), room = MESSY;
  let t = 10, made = 0;
  while (made < n) {
    const train = model.startTrain(w, room, Math.round(r() * 4000), Math.round(r() * 3000), t++);
    const len = 1 + Math.floor(r() * 9);
    for (let k = 0; k < len && made < n; k++, made++) {
      const th = model.addThought(w, train.id, `thought ${made} ${'word '.repeat(1 + Math.floor(r() * 12))}`, t++);
      if (r() < 0.05) lib.ontologies.BUILT_IN[0].drop(w, room, th.id, Math.round(r() * 4000), Math.round(r() * 3000));
      if (r() < 0.2) lib.pessoa.default.drop(w, room, th.id, Math.round(r() * 4000), Math.round(r() * 3000));
    }
  }
  const leaves = model.roomItems(w, room);
  const chapters = [];
  for (let i = 0; i < 40; i++) {
    const g = groupChosen(russell, w, room, [leaves[(i * 3) % leaves.length].id], t++);
    if (g) chapters.push(g);
  }
  for (let i = 1; i < chapters.length; i++) russell.drop(w, room, chapters[i].id, 0, 0);
  for (let i = 1; i < chapters.length; i++) russellLink(w, room, chapters[Math.floor(r() * i)].id, chapters[i].id);
  for (let i = 0; i < 30; i++) groupChosen(proust, w, room, [leaves[(n >> 1) + i * 2].id, leaves[(n >> 1) + 1 + i * 2].id], t++);
  return { w, room };
}

// A deep-frozen copy of a world: any write to it throws (modules run in strict mode).
function frozen(w) {
  const c = JSON.parse(JSON.stringify(w));
  const deep = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) deep(v); } return o; };
  for (const k of Object.keys(c)) if (k !== 'views') deep(c[k]); // (a room's view is where it was looked at, not a table)
  return c;
}

test('Law 3: a rule\'s reads change nothing: layout, admit, moves, draws, units, tray and point run on a frozen world', () => {
  const { w, room } = fixture(300, 3);
  const ice = frozen(w);
  const some = model.roomItems(ice, room).slice(0, 40).map((th) => th.id);
  for (const o of RULES) {
    const rule = R.asRule(o);
    const at = rule.layout(ice, room);
    assert.ok(at.size > 0, `${o.name} lays something out`);
    for (const id of some) {
      rule.moves(ice, room, id);
      rule.admit(ice, { kind: 'place', mark: id, context: room, position: { x: 1, y: 2 } });
      o.placed?.(ice, room, id);
      o.point(ice, room, id);
    }
    rule.draws(ice, room);
    o.units(ice, room);
    o.tray?.(ice, room);
  }
});

test('Law 3: a rule\'s moves never take a thought or a link away (property: 300 moves × 4 rules × 3 seeds)', () => {
  for (const seed of [1, 2, 3]) {
    const r = rng(seed);
    for (const o of RULES) {
      const { w, room } = fixture(200, seed);
      const thoughts = () => Object.values(w.things).filter((th) => model.isLeaf(th)).length;
      const kept = () => L.all(w).filter((x) => x.kind !== 'part of').map((x) => x.id); // what is not a group's membership
      const n0 = thoughts(), k0 = new Set(kept());
      for (let step = 0; step < 300; step++) {
        const units = [...model.roomItems(w, room), ...model.groupsIn(w, room)];
        const pick = () => units[Math.floor(r() * units.length)]?.id;
        const what = Math.floor(r() * 6), id = pick();
        if (!id || !w.things[id]) continue;
        if (what === 0) o.drop(w, room, id, Math.round(r() * 3000), Math.round(r() * 3000));
        else if (what === 1) o.shift?.(w, room, id, 10, -10);
        else if (what === 2) throwBack(o, w, room, [id], step);
        else if (what === 3) groupChosen(o, w, room, [id, pick()].filter(Boolean), step);
        else if (what === 4) ungroupChosen(o, w, room, [id], step);
        else o.unplace?.(w, room, id);
        if (thoughts() !== n0) assert.ok(false, `${o.name} (seed ${seed}, move ${what}) took a thought away`);
      }
      const now = new Set(kept());
      // A link goes only with a group that dissolved (left empty by the user's own move: a mark
      // that holds nothing is structure, not a thought), or as Proust's throw back cuts it (the
      // move asked for; Ctrl+Z brings it back).
      for (const id of k0) {
        if (now.has(id)) continue;
        const [, , a, b] = id.split(':');
        const dissolved = [a, b].some((m) => m && !w.things[m] && m.startsWith('g'));
        if (!dissolved && !(o.id === 'proust' && id.startsWith('rel:proust-links:'))) assert.ok(false, `${o.name} (seed ${seed}) took away the link ${id}`);
      }
    }
  }
});

test('a rule\'s layout of the whole room puts each unit where point() puts it, one by one', () => {
  const { w, room } = fixture(400, 13);
  for (const o of RULES) {
    const at = R.layout(o, w, room);
    for (const u of o.units(w, room)) {
      const p = o.point(w, room, u.id);
      if (p) assert.deepEqual(at.get(u.id), { x: p.x, y: p.y }, `${o.name}: ${u.id}`);
    }
  }
});

test('admit refuses in words: a locked room, a mark elsewhere, a loop under Russell; and changes nothing', () => {
  const { w, room } = fixture(200, 5);
  const ice = frozen(w);
  const joyce = R.asRule(byId('joyce')), rus = R.asRule(russell);
  const a = model.roomItems(ice, room)[0].id;
  assert.equal(joyce.admit(ice, { kind: 'place', mark: a, context: room, position: { x: 0, y: 0 } }).ok, true);
  const other = addRoom(w, 'Elsewhere', 2);
  assert.match(R.admit(byId('joyce'), w, { kind: 'place', mark: a, context: other.id }).reason, /not in that context/);
  const x = create(w, room, { kind: 'line', text: 'x' }, 900), y = create(w, room, { kind: 'line', text: 'y' }, 901);
  const c1 = groupChosen(russell, w, room, [x.id], 902), c2 = groupChosen(russell, w, room, [y.id], 903);
  russell.drop(w, room, c1.id, 0, 0);
  russell.drop(w, room, c2.id, 400, 400);
  assert.equal(russellLink(w, room, c1.id, c2.id), '', 'c1 the parent of c2');
  const loop = rus.admit(w, { kind: 'link', from: c1.id, to: c2.id, link: 'relation' }); // c2 the parent of c1: a loop
  assert.equal(loop.ok, false);
  assert.match(loop.reason, /loop|already/);
  model.lock(w, room);
  assert.match(rus.admit(w, { kind: 'place', mark: c1.id, context: room }).reason, /locked/);
});

test('budget: each rule lays out a 1,500-thought room afresh in 50 ms after a change, and a mode switch is under 100 ms', () => {
  const { w, room } = fixture(1500, 11);
  const ids = model.roomItems(w, room).map((th) => th.id);
  for (const o of RULES) {
    const t0 = performance.now();
    const cold = R.layout(o, w, room); // the room switched to this mode: nothing remembered yet
    const switched = performance.now() - t0;
    assert.ok(cold.size > 0);
    const t1 = performance.now();
    assert.equal(R.layout(o, w, room), cold, `${o.name}: nothing changed, the layout is remembered`);
    const again = performance.now() - t1;
    let worst = 0;
    for (let k = 0; k < 5; k++) {
      o.drop(w, room, ids[(k * 97) % ids.length], 100 + k, 200 + k); // one change…
      const t2 = performance.now();
      const fresh = R.layout(o, w, room); // …and the room laid out afresh
      worst = Math.max(worst, performance.now() - t2);
      assert.ok(fresh !== cold, `${o.name}: a change lays out afresh`);
    }
    console.log(`${o.name}: switch ${switched.toFixed(1)} ms, change ${worst.toFixed(1)} ms`);
    assert.ok(switched < 100, `${o.name}: mode switch in ${switched.toFixed(1)} ms (budget 100)`);
    assert.ok(worst < 50, `${o.name}: a change laid out in ${worst.toFixed(1)} ms (budget 50)`);
    assert.ok(again < 1, `${o.name}: a remembered layout in ${again.toFixed(2)} ms`);
  }
});

test('no rule keeps state: every position is a rule row, and the rules\' own data holds none', () => {
  const { w, room } = fixture(400, 9);
  for (const th of Object.values(w.things)) for (const k of ['x', 'y', 'col', 'row', 'side', 'dx', 'dy', 'hand', 'loose']) assert.ok(!(k in th), `${th.id} keeps ${k} on itself`);
  assert.equal(w.own[room], undefined, 'no rule keeps data of its own in the room');
  const rows = P.inContext(w, room).filter((r) => r.rule != null);
  assert.ok(['joyce', 'pessoa', 'russell', 'proust'].every((rule) => rows.some((r) => r.rule === rule)), 'each rule placed things, as rows');
  // Undo walks a rule's move back: the row is in the moments log like any other.
  const log = lib.moments.loadLog(null, 1);
  const before = JSON.parse(JSON.stringify(lib.moments.stateOf(w)));
  const id = model.roomItems(w, room)[5].id;
  lib.pessoa.default.drop(w, room, id, 12345, 678);
  lib.moments.record(log, before, JSON.parse(JSON.stringify(lib.moments.stateOf(w))), 2);
  assert.ok(log.rows.some((x) => x.kind === 'moved' && x.place === P.ruleId(room, id, 'pessoa')), 'a moved row for the rule row');
});

test('an old world is read into rule rows once: cells, sides, trains, offsets, spots, the tray', () => {
  const old = { v: 3, things: {
    messy: { id: 'messy', kind: 'room', at: 1, name: 'Messy thoughts', size: 2, col: 0, row: 0 },
    r: { id: 'r', kind: 'room', at: 2, name: 'R', page: 0, col: 4, row: 2, size: 1 },
    tw: { id: 'tw', kind: 'room', at: 3, name: 'Pair', page: 0, size: 'twin', col: 2, row: 3 },
    s1: { id: 's1', kind: 'room', at: 4, name: 'Right', parent: 'tw', side: 1, size: 1 },
    t: { id: 't', kind: 'group', of: 'joyce', parent: 'r', at: 5, x: 10, y: 20, hand: true, members: ['a', 'b'] },
    u: { id: 'u', kind: 'group', of: 'joyce', parent: 'r', at: 6, x: 0, y: 0, loose: true, members: ['c'] },
    a: { id: 'a', kind: 'line', parent: 'r', at: 7, text: 'a' },
    b: { id: 'b', kind: 'line', parent: 'r', at: 8, text: 'b', dx: 30, dy: -4 },
    c: { id: 'c', kind: 'line', parent: 'r', at: 9, text: 'c' },
    d: { id: 'd', kind: 'line', parent: 'r', at: 10, text: 'd' },
  }, own: { r: { pessoa: { a: { x: 5, y: 6, auto: true } }, tray: { d: true }, traum: { front: ['kept'] } } } };
  const w = loadWorld(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(model.cellOf(w, 'r'), { col: 4, row: 2 });
  assert.deepEqual(model.cellOf(w, MESSY), { col: 0, row: 0 });
  assert.equal(model.sideOf(w, 's1'), 1);
  assert.deepEqual(model.spotOf(w, 't'), { x: 10, y: 20, hand: true });
  assert.ok(model.isLooseGroup(w, 'u'), 'loose: no row');
  assert.deepEqual(model.offsetOf(w, 'b'), { dx: 30, dy: -4 });
  assert.deepEqual(P.spot(w, 'r', 'a', 'pessoa'), { x: 5, y: 6, auto: true });
  assert.ok(lib.groups.waiting(w, 'r', 'pessoa', 'd'));
  assert.deepEqual(w.own.r, { traum: { front: ['kept'] } }, 'what is not a position stays with its plugin');
  for (const th of Object.values(w.things)) for (const k of ['x', 'y', 'col', 'row', 'side', 'dx', 'dy', 'hand', 'loose']) assert.ok(!(k in th), `${th.id} keeps ${k}`);
  const again = loadWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(again.places, w.places, 'read once: loading again changes nothing');
});
