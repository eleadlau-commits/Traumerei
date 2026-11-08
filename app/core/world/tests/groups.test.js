// Tests for groups as shared objects (groups.js): a group is one thought in the room's other
// modes, in their tray until placed; a group made in the tray stays there.

import { test, assert } from 'folio/testing';
import * as libForRussell from '../lib.js';
import { surface as surfaceForRussell } from '../../api/v1.js';
import { bind as bindRussell } from '../../russell/world.js';
bindRussell(surfaceForRussell(libForRussell)); // Russell is a plugin: it gets the world's rules through the plugin API
import * as model from '../model.js';
import { emptyWorld, MESSY, startTrain, addThought, create, members, addRoom, join, roomItems, foldedAway } from '../model.js';
import { outermost, foreign, trayForeign, placedForeign, kindTag, wait, waiting, moveLoose } from '../groups.js';
import { groupChosen, throwBack } from '../ontologies/index.js';
import joyce from '../ontologies/joyce.js';
import pessoa from '../ontologies/pessoa.js';
import russell, { chapters, addChapter } from '../../russell/rules.js';

const train = (w, ...texts) => {
  const t = startTrain(w, MESSY, 0, 0, 1);
  texts.forEach((x, i) => addThought(w, t.id, x, i + 2));
  return t;
};
const ids = (list) => list.map((th) => th.id);

test('a train made by writing is layout only: the other modes see its thoughts, not the train', () => {
  const w = emptyWorld();
  const t = train(w, 'a', 'b');
  assert.deepEqual(outermost(w, MESSY), []);
  assert.deepEqual(pessoa.tray(w, MESSY), []);
  assert.deepEqual(ids(russell.tray(w, MESSY)).sort(), ids(members(w, t.id)).sort()); // no double count
  // Ctrl+G on it alone makes it an object as it is: one Train in the other modes, instead of its thoughts.
  assert.equal(groupChosen(joyce, w, MESSY, [t.id], 9), t);
  assert.ok(t.shared);
  assert.deepEqual(ids(russell.tray(w, MESSY)), [t.id]);
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [t.id]);
  assert.equal(groupChosen(joyce, w, MESSY, [t.id], 10), null); // shared already
});

test('a group made with Ctrl+G is one thought in the other modes: in their tray, tagged, until placed', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 2);
  const c = create(w, MESSY, { kind: 'line', text: 'c' }, 3);
  const t = groupChosen(joyce, w, MESSY, [a.id, b.id], 4);
  assert.ok(t.shared);
  assert.deepEqual(ids(outermost(w, MESSY)), [t.id]);
  assert.deepEqual(ids(foreign(w, MESSY, 'joyce')), []); // Joyce's own
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [t.id]);
  assert.equal(kindTag(t, { joyce: 'Train' }), 'Train');
  // In Pessoa the train is one card: its thoughts don't float on their own as well, in the tray or placed.
  assert.deepEqual(ids(pessoa.units(w, MESSY)), [c.id]);
  pessoa.drop(w, MESSY, t.id, 40, 50);
  assert.deepEqual(ids(placedForeign(w, MESSY, 'pessoa')), [t.id]);
  assert.deepEqual(pessoa.tray(w, MESSY), []);
  assert.deepEqual(pessoa.point(w, MESSY, t.id), { x: 40, y: 50 });
  assert.deepEqual(ids(pessoa.units(w, MESSY)), [c.id, t.id]);
  // In Russell the train waits in the tray as one thought, and its thoughts are not loose there too:
  // Joyce has a, b (in the train) and c loose; Russell has the train and c, the same objects.
  assert.deepEqual(ids(russell.tray(w, MESSY)), [c.id, t.id]);
  assert.deepEqual(ids(joyce.tray(w, MESSY)), [c.id]);
});

test('Russell places another mode\'s group as a thought: into a chapter, or a chapter of its own', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 2);
  const t = groupChosen(joyce, w, MESSY, [a.id, b.id], 3);
  russell.drop(w, MESSY, t.id, 100, 100);
  const [ch] = chapters(w, MESSY);
  assert.ok(ch && members(w, ch.id).some((m) => m.id === t.id));
  assert.ok(!ids(russell.tray(w, MESSY)).includes(t.id));
  // The chapter a drop made is layout only: Joyce doesn't get it in its tray; Pessoa still has the train.
  assert.deepEqual(joyce.tray(w, MESSY), []);
  assert.deepEqual(ids(trayForeign(w, MESSY, 'pessoa')), [t.id]);
  // A chapter made with Ctrl+G around it is shared: now Joyce and Pessoa see that chapter.
  const x = create(w, MESSY, { kind: 'line', text: 'x' }, 4);
  const big = groupChosen(russell, w, MESSY, [ch.id, x.id], 5);
  assert.deepEqual(ids(trayForeign(w, MESSY, 'pessoa')), [big.id]);
  assert.deepEqual(ids(joyce.tray(w, MESSY)), [big.id]); // x is inside it, so not loose too
  joyce.drop(w, MESSY, big.id, 7, 8);
  assert.deepEqual(joyce.point(w, MESSY, big.id), { x: 7, y: 8 });
  assert.ok(joyce.units(w, MESSY).some((u) => u.id === big.id));
});

test('a group made in the tray stays in the tray until it is dragged out', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 2);
  const g = groupChosen(russell, w, MESSY, [a.id, b.id], 3, { loose: true });
  assert.ok(model.isLooseGroup(w, g.id));
  assert.deepEqual(chapters(w, MESSY), []);
  assert.deepEqual(ids(russell.tray(w, MESSY)), [g.id]);
  assert.equal(russell.placed(w, MESSY, g.id), false);
  russell.drop(w, MESSY, g.id, 10, 10);
  assert.ok(!model.isLooseGroup(w, g.id));
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

test('fold: many thoughts become one, in their place in every mode, and the old ones are stood for', async () => {
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
  assert.ok(w.things[b.id] && w.things[c.id], 'the folded thoughts stay (Law 2)');
  assert.ok(foldedAway(w, b.id) && foldedAway(w, c.id) && !roomItems(w, MESSY).some((m) => m.id === b.id), 'but show nowhere: the fold stands for them');
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
  assert.ok(w.things[p.id] && foldedAway(w, p.id));
  // What can't be folded says why.
  assert.ok(foldPlan(w, MESSY, [two.id]).why);
  const pic = create(w, MESSY, { kind: 'picture', src: 'data:image/png;base64,AAAA' }, 400);
  assert.match(fold(w, MESSY, [pic.id, x.id]).why, /Pictures/);
});

test('throw back: each mode takes what it placed back into its tray, at the top', () => {
  const w = emptyWorld();
  const t = train(w, 'a', 'b', 'c');
  const [a, b, c] = members(w, t.id);
  // Joyce: a thought leaves its train (the rest stay joined) and comes first in the tray.
  assert.equal(throwBack(joyce, w, MESSY, [b.id], 100), 1);
  assert.deepEqual(ids(members(w, t.id)), [a.id, c.id]);
  assert.deepEqual(ids(joyce.tray(w, MESSY)), [b.id]);
  assert.equal(w.things[b.id].looseAt, 100);
  assert.equal(throwBack(joyce, w, MESSY, [b.id], 101), 0); // loose already
  // A whole train waits in the tray (made-there), its thoughts with it.
  assert.equal(throwBack(joyce, w, MESSY, [t.id, a.id], 102), 1); // a is in the chosen train: once
  assert.ok(model.isLooseGroup(w, t.id));
  assert.ok(!joyce.placed(w, MESSY, t.id));
  assert.deepEqual(ids(joyce.tray(w, MESSY)).sort(), [b.id, t.id].sort());
});

test('throw back: another mode\'s group loses its place; a thought inside it can\'t go alone', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 2);
  const g = groupChosen(joyce, w, MESSY, [a.id, b.id], 3);
  pessoa.drop(w, MESSY, g.id, 40, 50);
  assert.equal(throwBack(pessoa, w, MESSY, [a.id], 4), 0);   // inside another mode's group: the card stands for it
  assert.equal(throwBack(pessoa, w, MESSY, [g.id], 5), 1);
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [g.id]);
  // Russell: placed into a chapter, thrown back out of it; a thought inside the group can't go alone.
  russell.drop(w, MESSY, g.id, 100, 100);
  assert.ok(!ids(russell.tray(w, MESSY)).includes(g.id));
  assert.equal(throwBack(russell, w, MESSY, [a.id], 6), 0);
  assert.equal(throwBack(russell, w, MESSY, [g.id], 7), 1);
  assert.ok(ids(russell.tray(w, MESSY)).includes(g.id));
});

test('throw back: a Russell chapter waits in the tray, its thoughts with it', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const top = addChapter(w, MESSY, {}, 2);
  const sub = addChapter(w, MESSY, { parent: top.id }, 3);
  russell.drop(w, MESSY, a.id, 0, 0);
  join(w, sub.id, a.id);
  assert.equal(throwBack(russell, w, MESSY, [sub.id], 5), 1);
  assert.ok(model.isLooseGroup(w, sub.id));
  assert.ok(!chapters(w, MESSY).some((g) => g.id === sub.id));
  assert.ok(ids(russell.tray(w, MESSY)).includes(sub.id));
  assert.ok(!ids(russell.tray(w, MESSY)).includes(a.id)); // it went with its chapter
});

test('a thought added away from the canvas waits in the tray, even in Pessoa, until it is dragged out', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  const n = create(w, MESSY, { kind: 'line', text: 'new' }, 2);
  assert.ok(wait(w, MESSY, n.id));
  assert.ok(waiting(w, MESSY, 'pessoa', n.id));
  assert.deepEqual(ids(pessoa.units(w, MESSY)), [a.id]);
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [n.id]);
  assert.ok(!pessoa.placed(w, MESSY, n.id));
  assert.equal(pessoa.point(w, MESSY, n.id), null);
  assert.ok(ids(joyce.tray(w, MESSY)).includes(n.id)); // in no train: in Joyce's tray anyway
  pessoa.drop(w, MESSY, n.id, 70, 80);
  assert.ok(!waiting(w, MESSY, 'pessoa', n.id));
  assert.deepEqual(ids(pessoa.units(w, MESSY)), [a.id, n.id]);
  assert.deepEqual(pessoa.tray(w, MESSY), []);
  assert.deepEqual(pessoa.point(w, MESSY, n.id), { x: 70, y: 80 });
});

test('throw back in Pessoa: a single thought waits in its tray, only there, until dragged out', () => {
  const w = emptyWorld();
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 1);
  pessoa.drop(w, MESSY, a.id, 40, 50);
  assert.equal(throwBack(pessoa, w, MESSY, [a.id], 2), 1);
  assert.ok(!pessoa.placed(w, MESSY, a.id));
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [a.id]);
  assert.ok(waiting(w, MESSY, 'pessoa', a.id));
  assert.ok(!waiting(w, MESSY, 'proust', a.id)); // thrown back in Pessoa: other modes keep it
  assert.equal(throwBack(pessoa, w, MESSY, [a.id], 3), 0); // in the tray already
  pessoa.drop(w, MESSY, a.id, 10, 10);
  assert.ok(pessoa.placed(w, MESSY, a.id));
});

test('moved to another room (Move to…): it lands in that room\'s loose tray in every mode', () => {
  const w = emptyWorld();
  const other = addRoom(w, 'Other', 1);
  const a = create(w, MESSY, { kind: 'line', text: 'a' }, 2);
  const b = create(w, MESSY, { kind: 'line', text: 'b' }, 3);
  const c = create(w, MESSY, { kind: 'line', text: 'c' }, 4);
  const t = groupChosen(joyce, w, MESSY, [b.id, c.id], 5);
  assert.ok(moveLoose(w, a.id, other.id));
  assert.equal(model.parentOf(w, a.id), other.id);
  assert.ok(ids(joyce.tray(w, other.id)).includes(a.id));   // no train of its own
  assert.ok(ids(pessoa.tray(w, other.id)).includes(a.id));  // waits until dragged out
  assert.ok(ids(russell.tray(w, other.id)).includes(a.id));
  assert.ok(moveLoose(w, t.id, other.id));
  assert.ok(model.isLooseGroup(w, t.id));
  assert.ok(ids(joyce.tray(w, other.id)).includes(t.id));
  assert.ok(!joyce.placed(w, other.id, t.id));
  assert.ok(waiting(w, other.id, 'pessoa', b.id));
});
