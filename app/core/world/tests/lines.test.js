// Tests for the shared lines part (ontologies/lines.js): shapes, ends, and what it draws.

import { test, assert } from 'folio/testing';
import { slack, strand, line, layer, knot, cleanEnds, ENDS, HEAD } from '../ontologies/lines.js';
import { slack as joyceSlack, strand as joyceStrand, STEP } from '../ontologies/joyce.js';

test('a strand sags after a long pause, stays taut when quick, and straightens when pulled', () => {
  const quick = slack({ at: 0 }, { at: 2000 }, 58), pause = slack({ at: 0 }, { at: 1800e3 }, 58);
  assert.ok(quick < pause);
  assert.ok(slack({ at: 0 }, { at: 1800e3 }, 900) < pause);
  assert.equal(slack({ at: 0 }, { at: 1800e3 }, 58, 1), 0); // full tension: always taut
  assert.match(strand({ x: 0, y: 0 }, { x: 0, y: 100 }, 0), /^M0 0L0 100$/);
  assert.match(strand({ x: 0, y: 0 }, { x: 0, y: 100 }, 0.8), /Q/);
});

test('Joyce\'s strands are the shared ones, resting at its line step', () => {
  assert.equal(joyceStrand, strand);
  for (const gap of [0, 5e3, 60e3, 1800e3, 7200e3]) for (const dist of [STEP.line, 200, 700]) {
    assert.equal(joyceSlack({ at: 0 }, { at: gap }, dist, 0.3), slack({ at: 0 }, { at: gap }, dist, 0.3, STEP.line));
  }
});

test('ends: plain, an arrowhead, or both; anything else falls back', () => {
  assert.deepEqual(ENDS, ['none', 'arrow', 'both']);
  assert.equal(cleanEnds('both'), 'both');
  assert.equal(cleanEnds('sideways'), 'arrow');
  assert.equal(cleanEnds(undefined, 'none'), 'none');
  const [plain] = line('M0 0L1 1');
  assert.equal(plain.getAttribute('marker-end'), null);
  assert.equal(plain.getAttribute('marker-start'), null);
  const [one] = line('M0 0L1 1', { ends: 'arrow' });
  assert.equal(one.getAttribute('marker-end'), `url(#${HEAD})`);
  assert.equal(one.getAttribute('marker-start'), null);
  const [both] = line('M0 0L1 1', { ends: 'both' });
  assert.equal(both.getAttribute('marker-start'), `url(#${HEAD})`);
  assert.equal(both.getAttribute('marker-end'), `url(#${HEAD})`);
});

test('a line draws what shows, and a wide unseen line to press when asked', () => {
  const nodes = line('M0 0L5 5', { cls: 'mine', hit: { cls: 'mine-hit', 'data-arrow': 'a>b' } });
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].getAttribute('class'), 'room-line mine');
  assert.equal(nodes[0].getAttribute('d'), 'M0 0L5 5');
  assert.equal(nodes[1].getAttribute('class'), 'room-line-hit mine-hit');
  assert.equal(nodes[1].getAttribute('data-arrow'), 'a>b');
  assert.equal(line('M0 0L5 5').length, 1);
});

test('a layer carries the arrowhead its lines use; a knot is a small dot', () => {
  const l = layer('extra');
  assert.ok(l.getAttribute('class').includes('room-strands'));
  assert.ok(l.getAttribute('class').includes('extra'));
  assert.ok(l.querySelector(`marker#${HEAD}`));
  const k = knot({ x: 3, y: 4 });
  assert.equal(k.getAttribute('cx'), '3');
  assert.equal(k.getAttribute('class'), 'room-knot');
});
