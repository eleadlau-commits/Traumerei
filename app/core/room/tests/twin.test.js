// Tests for the divider between a Twin's halves (twin.js splitAt): the left half's share.

import { test, assert } from 'folio/testing';
import { splitAt, SIDE_MIN } from '../twin.js';

test('the divider follows the pointer as the left half\'s share of the width', () => {
  assert.equal(splitAt(700, 100, 1200), 0.5);
  assert.equal(splitAt(400, 100, 1200), 0.25);
});

test('each half stays at least SIDE_MIN wide', () => {
  assert.equal(splitAt(110, 100, 1200), SIDE_MIN / 1200);
  assert.equal(splitAt(5000, 100, 1200), 1 - SIDE_MIN / 1200);
});

test('an area too narrow for two halves stays half and half', () => {
  assert.equal(splitAt(300, 0, 500), 0.5);
  assert.equal(splitAt(NaN, 0, 1000), 0.5);
});

// drawTwin with a stand-in room: which half the live canvas sits in decides the stage's width, so
// the world is placed again when that changes (opening a Twin, switching sides, leaving it), not
// on every draw. Without it the live side was placed against the other half's width and jumped on
// the next wheel or zoom when the halves were uneven.
import { Twin } from '../twin.js';
import { emptyWorld, setHolds, create, HOLDS } from '../../world/model.js';
import { addTwin, sides } from '../../world/twin.js';

function standIn(split) {
  const keep = [...HOLDS];
  setHolds([{ id: 'twin', holds: (p, kind) => kind === 'room' && p?.size === 'twin' }]);
  const w = emptyWorld(1);
  const t = addTwin(w, 'T', 2);
  setHolds(keep);
  const [L, R] = sides(w, t.id);
  const classes = new Set();
  const node = () => ({ hidden: false, replaceChildren() {}, style: {}, getBoundingClientRect: () => ({ width: 100, height: 100 }) });
  const r = Object.assign(Object.create(Twin.prototype), {
    world: w, roomId: L.id, placed: 0, placedOther: 0,
    storage: { get: () => ({ [t.id]: split }) },
    roomPage: { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) }, style: { setProperty() {}, removeProperty() {} } },
    otherEl: node(), otherWorld: node(), dividerEl: node(), otherLabel: node(),
    ontology: () => ({ name: 'Pessoa' }), sideNodes: () => [],
  });
  r.place = () => { r.placed++; r.placeOther(); };
  r.placeOther = () => { r.placedOther++; };
  return { r, L, R, classes };
}

test('an uneven Twin places its world again when the live side changes, and only then', () => {
  const { r, R, classes } = standIn(0.3);
  r.drawTwin();
  assert.equal(r.placed, 1); // opened: now in the left half
  r.drawTwin();
  assert.equal(r.placed, 1); // drawn again in the same half: only the other side is placed
  r.roomId = R.id;
  r.drawTwin();
  assert.equal(r.placed, 2); // switched to the right half
  assert.ok(classes.has('twin-right'));
  r.roomId = null;
  r.drawTwin();
  assert.equal(r.placed, 3); // left the Twin: the whole width again
  assert.ok(!classes.has('twin'));
});
