// Tests for Templates' rules. `python build.py test` runs every *.test.js file of every feature.
// (tests/land.mjs lands every template in a world.)

import { test, assert } from 'folio/testing';
import { TEMPLATES, SAMPLE, fresh, dayName, nineOn, todo, essay, reading, week } from '../rules.js';

const NOW = new Date(2026, 10, 12, 16).getTime();

test('the chooser opens by itself only on a fresh start', () => {
  assert.equal(fresh({ seen: false, rooms: 1, inMessy: 0 }), true);
  assert.equal(fresh({ seen: true, rooms: 1, inMessy: 0 }), false);
  assert.equal(fresh({ seen: false, rooms: 2, inMessy: 0 }), false);
  assert.equal(fresh({ seen: false, rooms: 1, inMessy: 3 }), false);
});

test('four templates, each in one of the four shapes, none adding anything else', () => {
  assert.deepEqual(TEMPLATES.map((x) => x.id), ['todo', 'essay', 'reading', 'week']);
  const modes = [todo, essay, reading, week].map((f) => f(NOW).match(/^mode: (\w+)$/m)[1]);
  assert.deepEqual(modes, ['pessoa', 'joyce', 'proust', 'joyce']);
  for (const f of [todo, essay, reading, week]) {
    const kinds = [...f(NOW).matchAll(/^## \^\S+ ([a-z-]+)/gm)].map((m) => m[1]);
    assert.ok(kinds.every((k) => ['room', 'line', 'passage', 'group'].includes(k)), kinds.join());
  }
});

test('the weekly plan is seven days from today, each thing due at nine on its day', () => {
  const text = week(NOW);
  assert.ok(text.includes('group: Thursday 12 Nov'));
  assert.ok(text.includes('group: Wednesday 18 Nov'));
  assert.equal((text.match(/ due \^/g) || []).length, 7);
  assert.ok(text.includes(`${new Date(nineOn(NOW, 1)).toISOString()} due ^d2t`));
  assert.equal(dayName(NOW), 'Thursday 12 Nov');
});

test('the essay is named after the finished text, due three weeks on', () => {
  assert.ok(essay(NOW).includes('room: Essay: its title, 3,000 words, due 3 Dec'));
  assert.equal((essay(NOW).match(/open to maker/g) || []).length, 4);
});

test('the sample room is the seven steps, five resolved and two open, the sixth coming back tomorrow', () => {
  const text = SAMPLE.make(NOW);
  assert.ok(/^mode: russell$/m.test(text));
  assert.equal((text.match(/ resolved from world/g) || []).length, 5);
  assert.deepEqual([...text.matchAll(/^\^(s\d) open from world/gm)].map((m) => m[1]), ['s6', 's7']);
  assert.ok(text.includes(`${new Date(nineOn(NOW, 1)).toISOString()} due ^s6`));
});
