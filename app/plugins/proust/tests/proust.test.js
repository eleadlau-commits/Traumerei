// Tests for Proust (rules.js, draw.js): every thought on the canvas, links in loops with each
// relation's ends, clusters, writing on, throwing back, and the same objects as the other modes.

import { test, assert } from 'folio/testing';
import * as lib from '../../world/lib.js';
import { surface } from '../../api/api.js';
import { bind } from '../world.js';
import { emptyWorld, create, MESSY, own, members, setRoomSetting, closeGroup } from '../../world/model.js';
import { gather, missing, groupChosen, throwBack } from '../../world/ontologies/index.js';
import { trayForeign, wait } from '../../world/groups.js';
import joyce from '../../world/ontologies/joyce.js';
import pessoa from '../../world/ontologies/pessoa.js';
import { proust, links, endsOf, point, shownAs, clusterOf, RELATIONS, LINKS } from '../rules.js';
import { draw } from '../draw.js';

bind(surface(lib)); // the world's rules, as Proust gets them from the plugin API

let clock = 10;
const line = (w, text, parent = MESSY) => create(w, parent, { kind: 'line', text }, clock++);
const ids = (list) => list.map((th) => th.id);
const L = () => links();

test('Proust is a whole ontology, with clusters of its own', () => {
  assert.deepEqual(missing(proust), []);
  const all = gather([proust]);
  assert.ok(all.some((o) => o.id === 'proust'));
  assert.equal(proust.groups.form, 'cluster');
  assert.equal(proust.groups.membership, 'one');
});

test('every thought is on the canvas: on the spiral until it is dragged', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b');
  assert.deepEqual(ids(proust.units(w, MESSY)), [a.id, b.id]);
  assert.deepEqual(proust.tray(w, MESSY), []);
  const p = point(w, MESSY, a.id);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  proust.drop(w, MESSY, b.id, 300, -40);
  assert.deepEqual(point(w, MESSY, b.id), { x: 300, y: -40 });
  assert.ok(proust.placed(w, MESSY, a.id));
});

test('links run in loops; a link to itself, or the same link twice, is refused; one back is fine', () => {
  const w = emptyWorld(1);
  const [a, b, c] = ['a', 'b', 'c'].map((t) => line(w, t).id);
  assert.equal(L().link(w, MESSY, a, b), '');
  assert.equal(L().link(w, MESSY, b, c), '');
  assert.equal(L().link(w, MESSY, c, a), ''); // a loop
  assert.equal(L().link(w, MESSY, a, a), 'A thought can\'t be linked to itself.');
  assert.equal(L().link(w, MESSY, a, b), 'That link is already there.');
  assert.equal(L().link(w, MESSY, b, a), ''); // back the other way
  assert.equal(L().arrows(w, MESSY).length, 4);
  // Kept apart from Proust's places, so groups.js's spots stay its own.
  assert.ok(own(w, MESSY, LINKS)[b]);
  assert.equal(own(w, MESSY, 'proust', false)[b], undefined);
});

test('each relation has its own ends, from the room\'s list; a new link takes the first', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a').id, b = line(w, 'b').id;
  assert.deepEqual(RELATIONS.default, ['related to', 'leads to ->', 'is equivalent to <->']);
  assert.deepEqual(L().relations(w, MESSY), ['related to', 'leads to', 'is equivalent to']);
  L().link(w, MESSY, a, b);
  assert.equal(L().relationOf(w, MESSY, a, b), 'related to');
  const list = RELATIONS.default;
  assert.equal(endsOf(list, 'related to'), 'none');
  assert.equal(endsOf(list, 'leads to'), 'arrow');
  assert.equal(endsOf(list, 'is equivalent to'), 'both');
  assert.equal(endsOf(list, 'unknown'), 'none');
  // Written in the ⚙: marks kept, names tidied, each once.
  assert.deepEqual(RELATIONS.clean('cites ->,  cites, sees <->, near --'), ['cites ->', 'sees <->', 'near --']);
  assert.equal(RELATIONS.text(['cites ->', 'a, b']), 'cites ->, "a, b"');
  // Renaming a relation in place renames it on its links, whatever its mark.
  setRoomSetting(w, MESSY, 'proust', 'relations', ['near --', 'leads to ->']);
  proust.settingChanged(w, MESSY, 'relations', list, ['near --', 'leads to ->', 'is equivalent to <->']);
  assert.equal(L().relationOf(w, MESSY, a, b), 'near');
});

test('writing: loose with nothing to go on, Enter links on, Ctrl+Enter starts a cluster', () => {
  const w = emptyWorld(1);
  // Typing with nothing to go on: no cluster, so the thought is loose, placed where it was written.
  assert.equal(proust.begin(w, MESSY, { x: 10, y: 20 }, clock++), null);
  const a = line(w, 'a');
  proust.kept(w, MESSY, a, { x: 10, y: 20 });
  assert.deepEqual(point(w, MESSY, a.id), { x: 10, y: 20 });
  // Enter: the next goes on below it, linked on from it.
  const next = proust.goOn(w, MESSY, a.id);
  assert.equal(next.train, null);
  assert.equal(next.after, a.id);
  assert.ok(next.y > 20);
  const b = line(w, 'b');
  proust.kept(w, MESSY, b, next);
  assert.deepEqual(L().parentsOf(w, MESSY, b.id), [a.id]);
  // Ctrl+Enter: a new cluster, which the thoughts written on join, each linked to the one before.
  const g = proust.begin(w, MESSY, { x: 400, y: 0, fresh: true }, clock++);
  assert.equal(g.of, 'proust');
  const c = line(w, 'c', g.id);
  proust.kept(w, MESSY, c, { x: 400, y: 0, fresh: true });
  assert.deepEqual(L().parentsOf(w, MESSY, c.id), []); // a fresh start links to nothing
  const on = proust.goOn(w, MESSY, c.id);
  assert.equal(on.train, g.id);
  const d = line(w, 'd', on.train);
  proust.kept(w, MESSY, d, on);
  assert.deepEqual(ids(members(w, g.id)), [c.id, d.id]);
  assert.deepEqual(L().parentsOf(w, MESSY, d.id), [c.id]);
  assert.equal(proust.tag(w, d.id).id, g.id);
});

test('a cluster: Ctrl+G makes one, shared with the other modes; it moves whole and closes to one node', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  proust.drop(w, MESSY, a.id, 0, 0);
  proust.drop(w, MESSY, b.id, 100, 50);
  const g = groupChosen(proust, w, MESSY, [a.id, b.id], clock++);
  assert.equal(g.of, 'proust');
  assert.ok(g.shared);
  assert.equal(clusterOf(w, a.id).id, g.id);
  assert.deepEqual(ids(trayForeign(w, MESSY, 'pessoa')), [g.id]); // one thing in the other modes
  assert.deepEqual(point(w, MESSY, g.id), { x: 0, y: 0 });
  proust.drop(w, MESSY, g.id, 20, 30); // dragged whole
  assert.deepEqual(point(w, MESSY, b.id), { x: 120, y: 80 });
  // A link to the cluster as a whole.
  assert.equal(L().link(w, MESSY, c.id, g.id), '');
  closeGroup(w, g.id, 'Pair');
  assert.equal(shownAs(w, a.id), g.id);
  assert.deepEqual(ids(proust.units(w, MESSY)).sort(), [c.id, g.id].sort());
});

test('throw back: a cluster waits in the tray and its links go; Ctrl+Z would bring them back', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  const g = groupChosen(proust, w, MESSY, [a.id, b.id], clock++);
  L().link(w, MESSY, c.id, a.id);
  L().link(w, MESSY, g.id, c.id);
  L().link(w, MESSY, a.id, b.id);
  assert.equal(throwBack(proust, w, MESSY, [g.id], clock++), 1);
  assert.ok(g.loose);
  assert.deepEqual(ids(proust.tray(w, MESSY)), [g.id]);
  assert.deepEqual(ids(proust.units(w, MESSY)), [c.id]);
  assert.equal(L().arrows(w, MESSY).length, 0);
  assert.equal(own(w, MESSY, LINKS)[b.id], undefined);
  // A plain thought goes too: it waits in the tray until it is dragged out, and once there it
  // can't go again.
  assert.equal(throwBack(proust, w, MESSY, [c.id], clock++), 1);
  assert.deepEqual(ids(proust.tray(w, MESSY)).sort(), [g.id, c.id].sort());
  assert.ok(!proust.placed(w, MESSY, c.id));
  assert.equal(throwBack(proust, w, MESSY, [c.id], clock++), 0);
  proust.drop(w, MESSY, c.id, 40, 40);
  assert.ok(proust.placed(w, MESSY, c.id));
  // Dragged out again, it is back on the canvas (its links stay gone).
  proust.drop(w, MESSY, g.id, 0, 0);
  assert.ok(!g.loose);
  assert.ok(proust.placed(w, MESSY, a.id));
});

test('another mode\'s group: one thing in the tray, placed by a drop, thrown back with its links', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  const t = groupChosen(joyce, w, MESSY, [a.id, b.id], clock++);
  assert.deepEqual(ids(proust.tray(w, MESSY)), [t.id]);
  assert.equal(L().link(w, MESSY, c.id, t.id), 'Links join two things on the canvas.');
  proust.drop(w, MESSY, t.id, 50, 60);
  assert.deepEqual(point(w, MESSY, t.id), { x: 50, y: 60 });
  assert.equal(L().link(w, MESSY, c.id, t.id), '');
  assert.equal(throwBack(proust, w, MESSY, [t.id], clock++), 1);
  assert.deepEqual(ids(proust.tray(w, MESSY)), [t.id]);
  assert.equal(L().arrows(w, MESSY).length, 0);
});

test('Proust sees the same objects as Pessoa: every thought, and each shared group once', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b');
  line(w, 'c');
  const t = groupChosen(joyce, w, MESSY, [a.id, b.id], clock++);
  const seen = (o) => ids([...o.units(w, MESSY), ...o.tray(w, MESSY)]).sort();
  assert.deepEqual(seen(proust), seen(pessoa));
  proust.drop(w, MESSY, t.id, 0, 0);
  pessoa.drop(w, MESSY, t.id, 0, 0);
  assert.deepEqual(seen(proust), seen(pessoa));
});

// A small element maker, like the room's c.el.
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
const room = (w, settings = {}) => ({
  world: w, roomId: MESSY, el, sel: null, isSel: () => false, found: null, draft: null, locked: false,
  setting: (k) => settings[k] ?? proust.settings.find((s) => s.key === k)?.default,
  thoughtNode: (th) => el('span', { class: 'room-thought', 'data-id': th.id }, th.text || th.title || ''),
  draftNode: () => el('span', {}, ''),
});

test('drawn: each thought, a cluster\'s box, and each link with its relation\'s ends', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  proust.drop(w, MESSY, a.id, 0, 0);
  proust.drop(w, MESSY, b.id, 300, 0);
  proust.drop(w, MESSY, c.id, 0, 300);
  groupChosen(proust, w, MESSY, [a.id, b.id], clock++);
  L().link(w, MESSY, a.id, b.id); // related to: a plain line
  L().link(w, MESSY, b.id, c.id, '', 'leads to'); // an arrow
  L().link(w, MESSY, c.id, a.id, '', 'is equivalent to'); // both ways
  const out = draw(room(w));
  const svg = out[0];
  const shown = [...svg.querySelectorAll('path.room-arrow')];
  assert.equal(shown.length, 3);
  const heads = shown.map((p) => `${p.hasAttribute('marker-start')} ${p.hasAttribute('marker-end')}`).sort();
  assert.deepEqual(heads, ['false false', 'false true', 'true true']);
  assert.equal(svg.querySelectorAll('rect.room-proust-cluster').length, 1);
  const beads = out.filter((n) => n.dataset?.thought);
  assert.deepEqual(beads.map((n) => n.dataset.thought).sort(), [a.id, b.id, c.id].sort());
  assert.ok(beads.find((n) => n.dataset.thought === a.id).dataset.group); // a double-click chooses its cluster
  // The relation's name shows, since the room has several.
  assert.ok(out.some((n) => n.classList?.contains('room-arrow-label') && /leads to/.test(n.textContent)));
});

test('drawn: a link and the one back bow apart; links into a closed cluster run to it', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  proust.drop(w, MESSY, a.id, 0, 0);
  proust.drop(w, MESSY, b.id, 300, 0);
  proust.drop(w, MESSY, c.id, 0, 300);
  L().link(w, MESSY, a.id, b.id);
  L().link(w, MESSY, b.id, a.id);
  let d = [...draw(room(w))[0].querySelectorAll('path.room-arrow')].map((p) => p.getAttribute('d'));
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.includes('Q')) && d[0] !== d[1]);
  const g = groupChosen(proust, w, MESSY, [a.id, b.id], clock++);
  L().link(w, MESSY, c.id, a.id);
  closeGroup(w, g.id, 'Pair');
  const out = draw(room(w));
  d = [...out[0].querySelectorAll('path.room-arrow')];
  assert.equal(d.length, 1); // a ↔ b are inside it now; c → a runs to the cluster
  assert.ok(out.some((n) => n.dataset?.group === g.id && n.classList.contains('room-closed')));
});

test('another mode\'s group is one card: its thoughts are not nodes on their own, in the tray or placed', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), b = line(w, 'b'), c = line(w, 'c');
  const t = groupChosen(joyce, w, MESSY, [a.id, b.id], clock++);
  assert.deepEqual(ids(proust.units(w, MESSY)), [c.id]);
  assert.deepEqual(ids(proust.tray(w, MESSY)), [t.id]);
  proust.drop(w, MESSY, t.id, 100, 100);
  assert.deepEqual(ids(proust.units(w, MESSY)), [c.id, t.id]);
  assert.equal(L().link(w, MESSY, a.id, c.id), 'Links join two things on the canvas.'); // the train stands for it
});

test('a thought added away from the canvas waits in the tray until it is dragged out; then it is a node', () => {
  const w = emptyWorld(1);
  const a = line(w, 'a'), n = line(w, 'new');
  wait(w, MESSY, n.id);
  assert.deepEqual(ids(proust.units(w, MESSY)), [a.id]);
  assert.deepEqual(ids(proust.tray(w, MESSY)), [n.id]);
  assert.equal(shownAs(w, n.id), 'tray');
  assert.equal(L().link(w, MESSY, a.id, n.id), 'Links join two things on the canvas.');
  proust.drop(w, MESSY, n.id, 10, 20);
  assert.deepEqual(ids(proust.units(w, MESSY)), [a.id, n.id]);
  assert.deepEqual(proust.tray(w, MESSY), []);
  assert.equal(L().link(w, MESSY, a.id, n.id), '');
  // The same in Pessoa, which keeps its own place: still waiting there.
  assert.deepEqual(ids(pessoa.tray(w, MESSY)), [n.id]);
});
