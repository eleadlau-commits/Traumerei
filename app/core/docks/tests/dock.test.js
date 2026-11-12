// A dock keeps what the person had in front when something opens behind it (the room's Loose
// tab, opened on entering a room, leaves the Desk in front).

import { test, assert } from 'folio/testing';
import { Dock } from '../dock.js';

const make = () => new Dock({ side: 'left', saved: undefined, keep: () => {}, resized: () => {}, label: 'Left dock', tab: '' });

test('dock: opening behind leaves the front where it was; opening plainly takes it', async () => {
  const d = make();
  await d.open({ key: 'desk', tab: 'desk', kind: 'Desk', body: 'desk' });
  assert.ok(d.isShowing('desk'));
  await d.open({ key: 'loose', tab: 'loose', kind: 'Loose', body: 'loose', behind: true });
  assert.ok(d.isShowing('desk'), 'the desk stays in front');
  assert.ok(d.isOpen('loose'), 'loose is there behind it');
  await d.close('loose', true);
  await d.open({ key: 'loose', tab: 'loose', kind: 'Loose', body: 'loose' });
  assert.ok(d.isShowing('loose'));
  d.root.remove(); d.stripEl?.remove();
});

test('dock: opening behind into an empty dock shows it', async () => {
  const d = make();
  await d.open({ key: 'loose', tab: 'loose', kind: 'Loose', body: 'loose', behind: true });
  assert.ok(d.isShowing('loose'));
  d.root.remove(); d.stripEl?.remove();
});
