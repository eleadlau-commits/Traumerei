// Tests for groups as shared objects (groups.js): a group is one thought in the room's other
// modes, in their tray until placed; a group made in the tray stays there.

import { test, assert } from 'folio/testing';
import { emptyWorld, MESSY, startTrain, addThought, create, members } from '../model.js';
import { outermost, foreign, trayForeign, placedForeign, kindTag } from '../groups.js';
import { groupChosen } from '../ontologies/index.js';
import joyce from '../ontologies/joyce.js';
import pessoa from '../ontologies/pessoa.js';
import russell, { chapters } from '../ontologies/russell.js';

const train = (w, ...texts) => {
  const t = startTrain(w, MESSY, 0, 0, 1);
  texts.forEach((x, i) => addThought(w, t.id, x, i + 2));
  return t;
};
const ids = (list) => list.map((th) => th.id);

test('a train is one thought in the other modes: in their tray, tagged, until placed', () => {
  const w = emptyWorld();
  const t = train(w, 'a', 'b');
  assert.deepEqual(ids(outermost(w, MESSY)), [t.id]);
  assert.deepEqual(ids(foreign(w, MESSY, 'joyce')), []); // Joyce's own
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [t.id]);
  assert.equal(kindTag(t, { joyce: 'Train' }), 'Train');
  // Pessoa still floats each thought; the train joins them once placed.
  assert.equal(pessoa.units(w, MESSY).length, 2);
  pessoa.drop(w, MESSY, t.id, 40, 50);
  assert.deepEqual(ids(placedForeign(w, MESSY, 'pessoa')), [t.id]);
  assert.deepEqual(pessoa.tray(w, MESSY), []);
  assert.deepEqual(pessoa.point(w, MESSY, t.id), { x: 40, y: 50 });
  assert.equal(pessoa.units(w, MESSY).length, 3);
  // In Russell its thoughts are loose, and the train waits beside them, as one thought.
  assert.deepEqual(ids(russell.tray(w, MESSY)).sort(), [t.id, ...ids(members(w, t.id))].sort());
});

test('Russell places another mode\'s group as a thought: into a chapter, or a chapter of its own', () => {
  const w = emptyWorld();
  const t = train(w, 'a', 'b');
  russell.drop(w, MESSY, t.id, 100, 100);
  const [ch] = chapters(w, MESSY);
  assert.ok(ch && members(w, ch.id).some((m) => m.id === t.id));
  assert.ok(!ids(russell.tray(w, MESSY)).includes(t.id));
  // Now the chapter is the outermost group: Pessoa's tray has the chapter, not the train.
  assert.deepEqual(ids(trayForeign(w, MESSY, 'pessoa')), [ch.id]);
  assert.deepEqual(ids(joyce.tray(w, MESSY)), [ch.id]);
  joyce.drop(w, MESSY, ch.id, 7, 8);
  assert.deepEqual(joyce.point(w, MESSY, ch.id), { x: 7, y: 8 });
  assert.ok(joyce.units(w, MESSY).some((u) => u.id === ch.id));
});

test('a group made in the tray stays in the tray until it is dragged out', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 2);
  const g = groupChosen(russell, w, MESSY, [a.id, b.id], 3, { loose: true });
  assert.ok(g.loose);
  assert.deepEqual(chapters(w, MESSY), []);
  assert.deepEqual(ids(russell.tray(w, MESSY)), [g.id]);
  assert.equal(russell.placed(w, MESSY, g.id), false);
  russell.drop(w, MESSY, g.id, 10, 10);
  assert.equal(g.loose, undefined);
  assert.deepEqual(ids(chapters(w, MESSY)), [g.id]);
  assert.deepEqual(russell.tray(w, MESSY), []);
});

test('Ctrl+G on whole trains makes a train of trains, drawn inside it; Ctrl+Shift+G frees them', async () => {
  const { ungroupChosen } = await import('../ontologies/index.js');
  const { roomTrains } = await import('../model.js');
  const w = emptyWorld();
  const a = train(w, 'a', 'b');
  const b = train(w, 'c');
  const outer = groupChosen(joyce, w, MESSY, [a.id, b.id], 50);
  assert.ok(outer);
  assert.deepEqual(ids(members(w, outer.id)), [a.id, b.id]);
  assert.deepEqual(ids(roomTrains(w, MESSY)), [outer.id]); // the two are inside it now
  assert.ok(joyce.units(w, MESSY).some((u) => u.id === a.id));
  assert.ok(joyce.point(w, MESSY, b.id)); // where it sits in the outer train
  // To the other modes it is one Train.
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [outer.id]);
  // One group of its own alone: grouped already.
  assert.equal(groupChosen(joyce, w, MESSY, [outer.id], 60), null);
  assert.equal(ungroupChosen(joyce, w, MESSY, [outer.id]), 2);
  assert.equal(w.things[outer.id], undefined);
  assert.deepEqual(ids(roomTrains(w, MESSY)).sort(), [a.id, b.id].sort());
  assert.equal(members(w, a.id).length, 2); // nothing inside was lost
});

test('a chapter of chapters keeps the inner ones out of the tree', () => {
  const w = emptyWorld();
  const x = create(w, MESSY, { kind: 'line', text: 'x' }, 1);
  const y = create(w, MESSY, { kind: 'line', text: 'y' }, 2);
  russell.drop(w, MESSY, x.id, 0, 0);
  russell.drop(w, MESSY, y.id, 900, 0);
  const [cx, cy] = chapters(w, MESSY);
  const big = groupChosen(russell, w, MESSY, [cx.id, cy.id], 3);
  assert.deepEqual(ids(chapters(w, MESSY)), [big.id]);
  assert.ok(russell.point(w, MESSY, cx.id));
});

test('fold: many thoughts become one, in their place in every mode, and the old ones go', async () => {
  const { fold, foldPlan } = await import('../groups.js');
  const w = emptyWorld();
  const t = train(w, 'a', 'b', 'c');
  const [a, b, c] = members(w, t.id);
  // In Russell, b and c sit in a chapter with x; in Pessoa, b was dragged somewhere.
  const x = create(w, MESSY, { kind: 'line', text: 'x' }, 9);
  russell.drop(w, MESSY, x.id, 0, 0);
  const [ch] = chapters(w, MESSY);
  russell.drop(w, MESSY, b.id, 0, 0);
  russell.drop(w, MESSY, c.id, 0, 0);
  pessoa.drop(w, MESSY, b.id, 11, 22);
  const one = fold(w, MESSY, [b.id, c.id], 100);
  assert.equal(one.kind, 'line');
  assert.equal(one.text, 'b\nc');
  assert.equal(w.things[b.id], undefined);
  assert.equal(w.things[c.id], undefined);
  assert.deepEqual(members(w, t.id).map((m) => m.text), ['a', 'b\nc']); // in the train, where they were
  assert.ok(members(w, ch.id).some((m) => m.id === one.id)); // and in the chapter, once
  assert.equal(members(w, ch.id).filter((m) => m.id === one.id).length, 1);
  assert.deepEqual(pessoa.point(w, MESSY, one.id), { x: 11, y: 22 }); // b's place in Pessoa
  // A whole train folds: it stays, holding one passage when the words aren't all lines.
  const p = create(w, t.id, { kind: 'passage', title: 'P', body: 'body' }, 200);
  const two = fold(w, MESSY, [t.id], 300);
  assert.equal(two.kind, 'passage');
  assert.deepEqual(members(w, t.id).map((m) => m.id), [two.id]);
  assert.match(two.body, /a[\s\S]*b\nc[\s\S]*body/);
  assert.equal(w.things[p.id], undefined);
  // What can't be folded says why.
  assert.ok(foldPlan(w, MESSY, [two.id]).why);
  const pic = create(w, MESSY, { kind: 'picture', src: 'data:image/png;base64,AAAA' }, 400);
  assert.match(fold(w, MESSY, [pic.id, x.id]).why, /Pictures/);
});
