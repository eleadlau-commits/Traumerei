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
