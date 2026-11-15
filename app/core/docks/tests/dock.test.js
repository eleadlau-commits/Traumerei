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

test('dock: opening quietly leaves the dock as it was (shut stays hidden, showing keeps its front)', async () => {
  const d = make();
  await d.open({ key: 'loose', tab: 'loose', kind: 'Loose', body: 'loose', quiet: true });
  assert.ok(d.isOpen('loose'), 'it holds the loose tab');
  assert.ok(!d.visible, 'but the dock stays hidden, only its strip shows');
  assert.ok(d.stripped);
  d.tuck(false);
  assert.ok(d.isShowing('loose'), 'brought back, it shows the loose tab');
  await d.close('loose', true);
  await d.open({ key: 'desk', tab: 'desk', kind: 'Desk', body: 'desk' });
  await d.open({ key: 'loose', tab: 'loose', kind: 'Loose', body: 'loose', quiet: true });
  assert.ok(d.isShowing('desk'), 'a dock that showed keeps showing the desk');
  d.root.remove(); d.stripEl?.remove();
});

test('dock: a page opened with drop takes marks let go on it (the element with data-drop, else the page)', async () => {
  const d = make();
  const got = [];
  const { ui } = await import('folio');
  const chapter = ui.el('div', { 'data-drop': 'ch1' }, 'Chapter 1');
  await d.open({ key: 'book', tab: 'book', kind: 'Book', body: ui.el('div', {}, chapter, ui.el('p', {}, 'contents')),
    drop: { drop: (ids, el) => got.push([ids, el.dataset.drop || 'page']), accepts: (ids) => !ids.includes('no') } });
  const real = document.elementFromPoint;
  try {
    document.elementFromPoint = () => chapter;
    const at = d.dropAt(10, 10, ['a']);
    assert.ok(at && at.el === chapter);
    at.take(['a', 'b']);
    assert.deepEqual(got, [[['a', 'b'], 'ch1']]);
    assert.equal(d.dropAt(10, 10, ['no']), null, 'what it does not accept');
    document.elementFromPoint = () => document.body;
    assert.equal(d.dropAt(10, 10, ['a']), null, 'nowhere near the dock');
    d.tuck(true);
    document.elementFromPoint = () => chapter;
    assert.equal(d.dropAt(10, 10, ['a']), null, 'a hidden dock takes nothing');
  } finally { document.elementFromPoint = real; }
  d.root.remove(); d.stripEl?.remove();
});
