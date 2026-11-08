// Tests for what Settings → Plugins says (rows.js): which features are plugins, the line under
// each, the question before turning off what others need, and the plugin behind a mode that is off.

import { test, assert } from 'folio/testing';
import { plugins, note, kindWords, dependentsWords, offMode, isOn } from '../rows.js';

const f = (id, status, o = {}) => [id, { status, reason: o.reason || '', problem: o.problem || null,
  manifest: { id, name: o.name || id[0].toUpperCase() + id.slice(1), description: `${id} things`, ...(o.core ? {} : { plugin: { api: 1, kind: o.kind || ['tool'] } }) } }];
const features = new Map([
  f('world', 'active', { core: true }),
  f('russell', 'disabled', { kind: ['mode'] }),
  f('proust', 'active', { kind: ['mode'] }),
  f('time', 'failed', { kind: ['dock'], reason: 'no dock' }),
  f('search', 'active', { problem: 'a find broke' }),
  f('picture', 'safe', { kind: ['item'] }),
  f('source', 'skipped', { reason: 'Needs Docks, which is switched off', kind: ['editor'] }),
]);

test('only plugins are listed, by name', () => {
  assert.deepEqual(plugins(features).map((x) => x.manifest.id), ['picture', 'proust', 'russell', 'search', 'source', 'time']);
  assert.ok(isOn(features.get('proust')));
  assert.equal(isOn(features.get('russell')), false);
});

test('the line under a plugin says what is wrong, else what it is', () => {
  assert.deepEqual(note(features.get('time')), { text: 'Couldn\'t start: no dock', problem: true });
  assert.deepEqual(note(features.get('search')), { text: 'Had a problem: a find broke', problem: true });
  assert.deepEqual(note(features.get('picture')), { text: 'Off in safe mode', problem: false });
  assert.deepEqual(note(features.get('source')), { text: 'Needs Docks, which is switched off', problem: true });
  assert.deepEqual(note(features.get('russell')), { text: 'russell things', problem: false });
  assert.equal(kindWords(features.get('picture')), 'a kind of item');
});

test('turning off what others need names them', () => {
  assert.equal(dependentsWords('Room files', []), '');
  assert.equal(dependentsWords('Room files', ['Source editor']), 'Turning off Room files also turns off Source editor.');
  assert.equal(dependentsWords('A', ['B', 'C', 'D']), 'Turning off A also turns off B, C and D.');
});

test('a mode that is off names the plugin that gives it', () => {
  assert.equal(offMode(features, 'russell').manifest.name, 'Russell');
  assert.equal(offMode(features, 'proust'), null); // it runs
  assert.equal(offMode(features, 'joyce'), null);  // no such plugin: a core mode
  assert.equal(offMode(features, 'time'), null);   // not a mode
});
