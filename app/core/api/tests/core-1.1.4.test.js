// The core gaps of 24 Nov 2026 (app/core/core-gaps.md), fixed in 1.1.4: each is additive, reads or
// changes only what it names, and refuses in words where it can't.

import { test, assert } from 'folio/testing';
import { makeHost } from './host.js';
import { connect, surface } from '../v2.js';
import * as lib from '../../world/lib.js';

// Gap 1: the open room's mode rides on ui.chosen() and chosen.on hears it change.
test('gap 1: ui.chosen() carries the open room\'s mode, and chosen.on hears a change of mode', () => {
  const host = makeHost({ thoughts: 2 });
  const { t, off } = host.plug('modal', () => {});
  let mode = 'joyce';
  const ears = new Set();
  host.choose(host.room);
  host.roomWith({
    mode: () => mode,
    onChosen: (fn) => { ears.add(fn); return () => ears.delete(fn); },
  });
  assert.equal(t.ui.chosen().mode, 'joyce');
  const heard = [];
  t.ui.chosen.on((o) => heard.push(o));
  mode = 'pessoa';
  for (const fn of ears) fn({ context: host.room, mark: null, marks: [], mode });
  assert.equal(t.ui.chosen().mode, 'pessoa');
  assert.deepEqual([heard.length, heard[0].mode, heard[0].context], [1, 'pessoa', host.room]);
  // A room service without mode(): the room's own row says it.
  host.roomWith({});
  assert.equal(t.ui.chosen().mode, t.marks.get(host.room).mode);
  host.choose(null);
  assert.equal(t.ui.chosen(), null);
  off();
  assert.equal(ears.size, 0);
});

// Gap 2: the view's centre, and an eased move, through the room (never the canvas's transform).
test('gap 2: ui.zoom.get gives the view\'s centre and ui.zoom.go moves it, or refuses outside a room', () => {
  const host = makeHost({ thoughts: 1 });
  const { t } = host.plug('viewer', () => {});
  assert.equal(t.ui.zoom.go({ x: 1 }).reason, 'No room is open');
  let v = { zoom: 1, band: 'mid', x: 10, y: 20 };
  const asked = [];
  host.choose(host.room);
  host.roomWith({
    zoom: () => v,
    goView: (to, ms) => { asked.push(ms); v = { ...v, x: to.x ?? v.x, y: to.y ?? v.y, zoom: to.zoom ?? v.zoom }; return { x: v.x, y: v.y, zoom: v.zoom }; },
  });
  const now = t.ui.zoom.get();
  assert.deepEqual([now.x, now.y, now.zoom, now.band], [10, 20, 1, 'mid']);
  const went = t.ui.zoom.go({ x: 100, zoom: 2 }, { ms: 0 });
  assert.deepEqual([went.ok, went.x, went.y, went.zoom], [true, 100, 20, 2]);
  assert.ok(Object.isFrozen(went));
  t.ui.zoom.go({ y: 5 });
  assert.deepEqual(asked, [0, undefined]);
});

// Gap 6: a plugin's dock hides and comes back, keeping what it holds.
test('gap 6: ui.docks.<side>.hide() tucks the dock away and show() brings it back', async () => {
  let visible = true, holds = true;
  const dock = {
    open: async (o) => ({ close: () => o.onClose?.() }), close: async () => true,
    show: () => true, isOpen: () => holds, isShowing: () => visible,
    toggle: () => { if (!holds) return false; visible = !visible; return true; },
    get shown() { return holds && visible; },
  };
  const app = { config: { name: 'T', version: '1.1.4' }, slot: () => ({ items: [], add: () => () => {} }) };
  const world = { world: lib.model.emptyWorld(), saved: 0, save() { return true; } };
  const t = connect({ app, world, plugin: { id: 'book', manifest: { plugin: { api: 3 } } }, parts: surface(lib), lib, docks: { left: dock, right: null } });
  const d = t.ui.docks.left;
  assert.equal(d.shown, true);
  assert.equal(d.hide(), true);
  assert.equal(d.shown, false);
  assert.equal(d.hide(), true); // already hidden: stays so
  assert.equal(d.show(), true);
  assert.equal(d.shown, true);
  holds = false;
  assert.equal(d.show(), false); // nothing to bring back
});
