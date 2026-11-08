// Tests for Centre (centre.js, and draw.js's centre/escape/keep): rings by link distance from what
// is chosen, several chosen and webs that never meet, the room's reach, Tidy, a view that Esc
// leaves and "Keep this layout" places.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/v1.js';
import { bind } from '../world.js';
import { emptyWorld, create, MESSY, own } from '../../world/model.js';
import { distances, start, settle, RING } from '../centre.js';
import { proust, links, point, centred } from '../rules.js';
import { centreWeb as centre, escape, keepCentred, draw } from '../draw.js';

bind(surface(lib));

let clock = 10;
const line = (w, text) => create(w, MESSY, { kind: 'line', text }, clock++);
const box = (id, x, y) => ({ id, x, y, w: 100, h: 30 });
const middle = (L, id) => L.nodes.find((n) => n.id === id);
const far = (L, id) => Math.hypot(middle(L, id).x - L.c.x, middle(L, id).y - L.c.y);

test('distances: links count both ways, from the nearest of several; unreached is Infinity', () => {
  const d = distances(['a', 'b', 'c', 'd', 'e'], [['a', 'b'], ['c', 'b'], ['d', 'c']], ['a', 'd']);
  assert.deepEqual([...d.values()], [0, 1, 1, 0, Infinity]);
});

test('rings: the chosen in the middle, each step out further away', () => {
  const nodes = [box('a', 0, 0), box('b', 40, 10), box('c', -30, 50), box('d', 10, -40), box('e', 5, 5)];
  const L = settle(start(nodes, [['a', 'b'], ['b', 'c'], ['c', 'd']], ['a']));
  assert.ok(far(L, 'a') < 60);
  assert.ok(far(L, 'b') < far(L, 'c') && far(L, 'c') < far(L, 'd'));
  assert.ok(Math.abs(far(L, 'b') - RING) < RING * 0.6);
  // e is linked to nothing: outside them all.
  assert.ok(far(L, 'e') > far(L, 'c'));
});

test('nothing overlaps once it settles', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => box(`n${i}`, i * 3, i * 2));
  const L = settle(start(nodes, nodes.slice(1).map((n, i) => [nodes[i].id, n.id]), []));
  for (const p of L.nodes) for (const q of L.nodes) {
    if (p === q) continue;
    assert.ok(Math.hypot(p.x - q.x, p.y - q.y) > 60, `${p.id} and ${q.id} overlap`);
  }
});

test('the room\'s reach: further out than that shows faint', () => {
  const L = start([box('a', 0, 0), box('b', 0, 0), box('c', 0, 0), box('d', 0, 0)], [['a', 'b'], ['b', 'c'], ['c', 'd']], ['a'], 1);
  assert.deepEqual(L.nodes.filter((n) => n.dim).map((n) => n.id), ['c', 'd']);
  assert.equal(start([box('a', 0, 0), box('b', 0, 0)], [], [], 1).nodes.some((n) => n.dim), false); // Tidy fades nothing
});

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
}
function room(w, sel = null) {
  const r = {
    world: w, roomId: MESSY, el, sel, found: null, draft: null, locked: false, saved: 0, toasts: [],
    isSel: () => false, setting: (k) => proust.settings.find((s) => s.key === k)?.default,
    thoughtNode: (th) => el('span', {}, th.text || ''), draftNode: () => el('span', {}, ''),
    save() { r.saved++; }, drawWorld() {}, toast(t) { r.toasts.push(t); },
  };
  return r;
}
// Waits for Centre to settle on the screen (it moves a few steps each frame).
const settled = () => new Promise((done) => { const t0 = performance.now(); const go = () => (performance.now() - t0 > 3500 ? done() : requestAnimationFrame(go)); go(); });

test('Centre is a view: nothing is saved, Esc goes back to the layout by hand', async () => {
  const w = emptyWorld(1);
  const [a, b, c] = ['Combray', 'Balbec', 'Venice'].map((t) => line(w, t).id);
  proust.drop(w, MESSY, a, 0, 0); proust.drop(w, MESSY, b, 10, 0); proust.drop(w, MESSY, c, 20, 0);
  links().link(w, MESSY, a, b);
  links().link(w, MESSY, b, c);
  const hand = JSON.stringify(own(w, MESSY, 'proust'));
  const r = room(w, { kind: 'thought', id: b });
  assert.equal(centre(r), true);
  assert.ok(centred(MESSY));
  await settled();
  assert.ok(JSON.stringify(point(w, MESSY, a)) !== JSON.stringify({ x: 0, y: 0 })); // shown elsewhere...
  assert.equal(JSON.stringify(own(w, MESSY, 'proust')), hand); // ...but nothing saved
  assert.ok(draw(r).some((n) => n.classList?.contains('room-proust-centre-bar')));
  // A move while centred moves it only in the view.
  proust.drop(w, MESSY, c, 900, 900);
  assert.deepEqual(point(w, MESSY, c), { x: 900, y: 900 });
  assert.equal(JSON.stringify(own(w, MESSY, 'proust')), hand);
  assert.equal(escape(r), true);
  assert.equal(centred(MESSY), null);
  assert.deepEqual(point(w, MESSY, a), { x: 0, y: 0 });
  assert.equal(escape(r), false); // Esc again is the room's
});

test('Keep this layout places every thought where Centre shows it', async () => {
  const w = emptyWorld(1);
  const [a, b] = ['Combray', 'Balbec'].map((t) => line(w, t).id);
  proust.drop(w, MESSY, a, 0, 0); proust.drop(w, MESSY, b, 5, 0);
  links().link(w, MESSY, a, b);
  const r = room(w); // nothing chosen: Tidy
  centre(r);
  await settled();
  const shown = { a: point(w, MESSY, a), b: point(w, MESSY, b) };
  keepCentred(r);
  assert.equal(centred(MESSY), null);
  assert.ok(r.saved > 0);
  assert.deepEqual(point(w, MESSY, a), shown.a);
  assert.deepEqual(point(w, MESSY, b), shown.b);
  assert.ok(Math.hypot(shown.a.x - shown.b.x, shown.a.y - shown.b.y) > 60); // tidied apart
});
