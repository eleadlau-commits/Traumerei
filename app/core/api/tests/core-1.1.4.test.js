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

// Gap 5: the room's clear-space leaves alone a rule that places every mark itself.
test('gap 5: a rule with hand: false, or clear: false, says the room\'s clear-space leaves its marks alone', () => {
  const host = makeHost({ thoughts: 1 });
  host.plug('clearing', (k) => {
    k.slots.rules.add({ id: 'free-hand', name: 'Free', arrange: () => [] });
    k.slots.rules.add({ id: 'no-hand', name: 'Fixed', hand: false, arrange: () => [] });
    k.slots.rules.add({ id: 'no-clear', name: 'Close rows', clear: false, arrange: () => [] });
  });
  const rule = (id) => host.added('clearing').find((a) => a.slot === 'world.ontologies' && a.item.id === id).item;
  assert.deepEqual(['free-hand', 'no-hand', 'no-clear'].map((id) => rule(id).clears), [true, false, false]);
});

// Gap 7: t.rules.layout of a rule that reads the draft follows the draft, as the room draws it.
test('gap 7: the kernel\'s remembered layout of a draft-reading rule follows the thought being written', () => {
  const host = makeHost({ thoughts: 2 });
  let draft = null;
  host.lib.draft.setSource((context) => (context === host.room ? draft : null));
  try {
    host.plug('column', (k) => k.slots.rules.add({ id: 'column', name: 'Column', arrange: (reads, context) => {
      const d = reads.marks.draft(context);
      return reads.marks.in(context).map((m, i) => ({ mark: m.id, x: 0, y: i * 40 + (i > 0 && d ? d.height || 0 : 0) }));
    } }));
    host.plug('still', (k) => k.slots.rules.add({ id: 'still', name: 'Still', arrange: (reads, context) => reads.marks.in(context).map((m, i) => ({ mark: m.id, x: 0, y: i * 40 })) }));
    const rule = (id) => host.added(id).find((a) => a.slot === 'world.ontologies').item;
    const second = host.lib.model.children(host.w, host.room)[1].id;
    const yOf = (o) => host.lib.rules.layout(o, host.w, host.room).get(second).y;
    assert.equal(yOf(rule('column')), 40);
    draft = { text: 'a', after: host.ids[0], height: 30 };
    assert.equal(yOf(rule('column')), 70); // the draft grew: the kernel's memo follows
    draft = { ...draft, height: 60 };
    assert.equal(yOf(rule('column')), 100);
    const still = host.lib.rules.layout(rule('still'), host.w, host.room);
    draft = { ...draft, height: 90 };
    assert.equal(host.lib.rules.layout(rule('still'), host.w, host.room), still); // a rule that never read it: the same map
  } finally { host.lib.draft.setSource(null); }
});

// Gap 8: a box a rule draws may say a thought begun in it goes after a mark of the room.
test('gap 8: a drawn box keeps `after` when it names a mark of the room, and drops it otherwise', () => {
  const host = makeHost({ thoughts: 2 });
  const [a] = host.lib.model.children(host.w, host.room).map((m) => m.id);
  const elsewhere = host.lib.model.children(host.w, host.other)[0]?.id ?? 'nope';
  host.plug('slots', (k) => k.slots.rules.add({ id: 'slotted', name: 'Slotted', arrange: () => [],
    draw: () => [{ x: 0, y: 0, w: 10, h: 10, style: 'quiet', after: a }, { x: 0, y: 20, w: 10, h: 10, after: elsewhere }, { x: 0, y: 40, w: 10, h: 10 }] }));
  const rule = host.added('slots').find((x) => x.slot === 'world.ontologies').item;
  const boxes = rule.boxes(host.w, host.room);
  assert.deepEqual(boxes.map((b) => b.after ?? null), [a, null, null]);
  assert.ok(!('after' in boxes[2]));
});
