// Proust on the screen: each node where it sits, a faint box around each open cluster, and the
// links between them, drawn through the world's shared parts: lines.js (the line, its ends) and
// arrowview.js (labels, editing a link where it is). A link is a strand like Joyce's: taut between
// thoughts written close together, slack after a pause (the room's Line tension); a link back the
// other way bows to the other side.

import { isGroup, itemsIn, lines, arrowView, view as viewOf } from './world.js';
import { ID, RELATIONS, links, endsOf, nodeName, nodes as allNodes, point, sizeOf, shownAs, clusterOf, clusters, isNode, proust, centred, setCentred, keep as keepLayout } from './rules.js';
import { start, step, settle, corners } from './centre.js';

const PAD = 7;           // how far off a node a link starts and ends
const HULL = 14;         // how far a cluster's box stands off what it holds (more for each cluster inside)

// The corner and size of every node as drawn ({ [id]: { at, size } }), and of everything hidden
// in a closed cluster, as that cluster (so its links run to it).
export function boxes(w, roomId) {
  const out = {};
  for (const u of proust.units(w, roomId)) {
    const at = point(w, roomId, u.id);
    if (at) out[u.id] = { at, size: sizeOf(w, u.id) };
  }
  for (const n of allNodes(w, roomId)) {
    if (out[n.id]) continue;
    const shown = shownAs(w, n.id);
    if (out[shown]) out[n.id] = out[shown];
    else if (isGroup(n) && n.of === ID) { const h = hull(w, roomId, n.id, out); if (h) out[n.id] = h; }
  }
  return out;
}

// The box around what an open cluster holds (its own pad growing with each cluster inside it).
function depth(w, id, seen = new Set()) {
  if (seen.has(id)) return 0;
  seen.add(id);
  const inner = (w.things[id]?.members || []).map((m) => w.things[m]).filter((g) => isGroup(g) && g.of === ID && !g.closed);
  return inner.length ? 1 + Math.max(...inner.map((g) => depth(w, g.id, seen))) : 0;
}
function hull(w, roomId, id, all) {
  const bs = itemsIn(w, id).map((m) => all[shownAs(w, m.id)]).filter(Boolean);
  if (!bs.length) return null;
  const pad = HULL + depth(w, id) * 12;
  const x0 = Math.min(...bs.map((b) => b.at.x)) - pad - 6, y0 = Math.min(...bs.map((b) => b.at.y)) - pad;
  const x1 = Math.max(...bs.map((b) => b.at.x + b.size.w)) + pad, y1 = Math.max(...bs.map((b) => b.at.y + b.size.h)) + pad;
  return { at: { x: x0, y: y0 }, size: { w: x1 - x0, h: y1 - y0 } };
}

// Where a line from box a towards point q leaves a's edge (PAD off it).
function edge(b, q) {
  const cx = b.at.x + b.size.w / 2, cy = b.at.y + b.size.h / 2;
  const dx = q.x - cx, dy = q.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const hw = b.size.w / 2 + PAD, hh = b.size.h / 2 + PAD;
  const t = Math.min(hw / Math.abs(dx || 1e-9), hh / Math.abs(dy || 1e-9));
  return { x: cx + dx * t, y: cy + dy * t };
}
const centre = (b) => ({ x: b.at.x + b.size.w / 2, y: b.at.y + b.size.h / 2 });

// A link's line: a strand from a's edge to b's, slack by the time between them; one with a link
// back bows at least a little, so the two lie apart. Its label sits at the strand's middle.
function route(c, a, b, from, to) {
  if (a === b) return null;
  const w = c.world;
  const p = edge(a, centre(b)), q = edge(b, centre(a));
  const dist = Math.hypot(q.x - p.x, q.y - p.y);
  const tA = w.things[from], tB = w.things[to];
  const [early, late] = (tA?.at ?? 0) <= (tB?.at ?? 0) ? [tA, tB] : [tB, tA];
  let k = lines.slack(early || {}, late || {}, dist, c.setting('tension') ?? 0.5);
  if (links().parentsOf(w, c.roomId, from).includes(to)) k = Math.max(k, 0.3);
  const d = lines.strand(p, q, k);
  // The middle of the strand (a quadratic's, halfway).
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
  const bow = k < 0.02 ? 0 : k * Math.max(26, len * 0.42) / 2;
  const m = { x: mx + (-dy / len) * bow, y: my + (dx / len) * bow };
  // Beside a link that runs up or down, above one that runs across.
  const upright = Math.abs(dy) > Math.abs(dx);
  return { d, spot: upright ? { x: m.x + 10, y: m.y, side: 'right' } : { x: m.x, y: m.y - 6, side: 'above' } };
}

let view = null;
const arrows = () => (view ||= arrowView({
  of: ID, net: links(), setting: RELATIONS, word: 'link', route, quiet: true,
  boxes, pads: () => ({}), name: nodeName,
  nodeAt: (w, roomId, x, y) => {
    for (const [id, b] of Object.entries(boxes(w, roomId))) if (x >= b.at.x && x <= b.at.x + b.size.w && y >= b.at.y && y <= b.at.y + b.size.h && isNode(w, roomId, id)) return id;
    return null;
  },
  ends: (rel, c) => endsOf(c.setting(RELATIONS.key), rel),
  // A thought is its own node even inside an open cluster (whose box a drop elsewhere finds).
  onNode: (c, at) => {
    const id = at.closest?.('[data-thought]')?.dataset.thought || at.closest?.('[data-dot]')?.dataset.dot || at.closest?.('.room-bead[data-group]')?.dataset.group;
    return id && isNode(c.world, c.roomId, id) ? id : null;
  },
}));

// A press on the canvas: a link's own (its edit box, a double-click to edit it), or a drag from
// a node's dot, which draws a new link onto the node it is let go on.
export function press(c, e) {
  const act = e.button === 0 && e.target.closest?.('[data-centre]')?.dataset.centre;
  if (act) { e.preventDefault(); if (act === 'keep') keepCentred(c); else escape(c); return true; }
  if (e.button !== 0 || c.locked) return false;
  const view = arrows();
  if (view.press(c, e)) return true;
  const dot = e.target.closest?.('[data-dot]');
  const b = dot && boxes(c.world, c.roomId)[dot.dataset.dot];
  if (!b) return false;
  e.preventDefault();
  view.drag(c, e, dot.dataset.dot, edge(b, centre(b)), (q) => lines.strand(edge(b, q), q, 0));
  return true;
}

// Ctrl+J: the two things chosen are linked, from the one chosen first to the other (the room's
// first relation), and the new link opens to be named where it is.
export function join(c) {
  if (c.locked) { c.toast('This room is locked.'); return; }
  const ids = c.sel?.kind === 'many' ? c.sel.ids : [];
  if (ids.length !== 2) { c.toast('Choose two things to link: click one, then Shift+click the other.'); return; }
  const [a, b] = ids;
  const why = links().link(c.world, c.roomId, a, b);
  if (why) { c.toast(why); return; }
  c.save();
  arrows().edit(c, a, b);
}

// ---- Centre (Ctrl+Shift+C) ----
// What is chosen goes to the middle and everything else into rings around it, by how many links
// away it is (centre.js); with nothing chosen, the web just settles (Tidy). It is a view: nothing
// is saved, Esc goes back to the layout by hand, and "Keep this layout" places every node where it
// shows. It moves into place elastically, and settles again round a node dragged meanwhile.
let run = null; // the layout settling: { room, L, c, frame }
const HOLD_MS = 250; // a dragged node stays pinned this long after its last move

// The units a link end shows as: itself, the closed cluster holding it, or (an open cluster) what
// it holds.
function shownUnits(w, id, units) {
  const s = shownAs(w, id);
  if (units.has(s)) return [s];
  const g = w.things[id];
  if (!isGroup(g) || g.of !== ID) return [];
  return [...new Set(itemsIn(w, id).map((m) => shownAs(w, m.id)).filter((m) => units.has(m)))];
}

export function centreWeb(c) {
  const w = c.world, roomId = c.roomId;
  const all = boxes(w, roomId);
  const list = proust.units(w, roomId).filter((u) => all[u.id]);
  if (!list.length) { c.toast('Nothing on the canvas to centre.'); return true; }
  const units = new Set(list.map((u) => u.id));
  const nodes = list.map((u) => ({ id: u.id, x: all[u.id].at.x, y: all[u.id].at.y, w: all[u.id].size.w, h: all[u.id].size.h }));
  const pairs = [];
  for (const a of links().arrows(w, roomId)) for (const p of shownUnits(w, a.from, units)) for (const q of shownUnits(w, a.to, units)) pairs.push([p, q]);
  // What an open cluster holds keeps together, as if lightly linked in a row.
  for (const g of clusters(w, roomId)) {
    const inside = shownUnits(w, g.id, units);
    for (let i = 1; i < inside.length; i++) pairs.push([inside[i - 1], inside[i]]);
  }
  const chosen = [...new Set((c.sel ? c.sel.ids || [c.sel.id] : []).flatMap((id) => shownUnits(w, id, units)))];
  const reach = c.setting('reach');
  const L = start(nodes, pairs, chosen, reach && reach !== 'all' ? Number(reach) : null);
  stop();
  const view = { at: corners(L), dim: new Set(L.nodes.filter((n) => n.dim).map((n) => n.id)), tidy: !chosen.length, moved: (id) => hold(id) };
  setCentred(roomId, view);
  run = { room: roomId, L, c, frame: 0 };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still || typeof requestAnimationFrame !== 'function') { settle(L); view.at = { ...view.at, ...corners(L) }; c.drawWorld(); }
  else animate();
  c.toast(chosen.length ? 'Centred: Esc goes back, or keep this layout.' : 'Tidied: Esc goes back, or keep this layout.');
  return true;
}

// A node dragged while centred: pinned where it is dragged, and the rest settle round it again.
function hold(id) {
  const view = run && centred(run.room);
  const n = view && run.L.nodes.find((x) => x.id === id);
  if (!n) return;
  const p = view.at[id];
  n.x = p.x + n.w / 2; n.y = p.y + n.h / 2;
  n.pinned = performance.now();
  run.L.alpha = Math.max(run.L.alpha, 0.25);
  if (!run.frame) animate();
}

function animate() {
  const r = run;
  r.frame = requestAnimationFrame(() => {
    r.frame = 0;
    const view = centred(r.room);
    if (run !== r || !view || r.c.roomId !== r.room) return;
    const now = performance.now();
    for (const n of r.L.nodes) if (n.pinned && now - n.pinned > HOLD_MS) n.pinned = false;
    let going = true;
    for (let i = 0; i < 3 && going; i++) going = step(r.L);
    view.at = { ...view.at, ...corners(r.L) };
    // The screen drifts to the middle of the layout as it settles, so what is chosen ends there.
    const v = viewOf(r.c.world, r.room);
    if (v && r.L.centred && typeof r.c.place === 'function') { v.x += (r.L.c.x - v.x) * 0.12; v.y += (r.L.c.y - v.y) * 0.12; r.c.place(); }
    r.c.drawWorld();
    if (going || r.L.nodes.some((n) => n.pinned)) animate();
  });
}

function stop() {
  if (run?.frame) cancelAnimationFrame(run.frame);
  run = null;
}

// Esc while centred: back to the layout by hand. True when it was centred.
export function escape(c) {
  if (!centred(c.roomId)) return false;
  stop();
  setCentred(c.roomId, null);
  c.drawWorld();
  return true;
}

// "Keep this layout": every node is placed where Centre shows it (one step Ctrl+Z takes back).
export function keepCentred(c) {
  if (c.locked) { c.toast('This room is locked.'); return; }
  stop();
  if (!keepLayout(c.world, c.roomId)) return;
  c.save();
  c.drawWorld();
  c.toast('Kept: every thought stays where it is now. Ctrl+Z undoes.');
}

// The bar over a centred layout: what it is, Keep this layout, Back.
function centreBar(c, view, all) {
  const bs = Object.keys(view.at).map((id) => all[id]).filter(Boolean);
  if (!bs.length) return null;
  const x = (Math.min(...bs.map((b) => b.at.x)) + Math.max(...bs.map((b) => b.at.x + b.size.w))) / 2;
  const y = Math.min(...bs.map((b) => b.at.y)) - 28;
  // Its words are pressed through press() (the canvas holds the pointer), or the keyboard.
  const word = (label, act, title) => c.el('button', { type: 'button', class: 'word', title, 'data-centre': act, onclick: () => (act === 'keep' ? keepCentred(c) : escape(c)) }, label);
  return c.el('div', { class: 'panel room-proust-centre-bar', style: `left:${Math.round(x)}px;top:${Math.round(y)}px` },
    c.el('span', { class: 'label' }, view.tidy ? 'Tidied' : 'Centred'),
    c.locked ? null : word('Keep this layout', 'keep', 'Place every thought where it shows now'),
    word('Back', 'back', 'Back to the layout by hand (Esc)'));
}

// In the pop-up of what is chosen: what it points to, what points to it, and what it is linked
// with (by a plain line, or both ways); each name goes to that node, and the × beside it takes
// that link away (both ways, for a pair linked each way; Ctrl+Z brings it back).
export function props(c, th) {
  const w = c.world, roomId = c.roomId, net = links();
  if (!isNode(w, roomId, th.id)) return [];
  const list = c.setting(RELATIONS.key);
  const out = [], into = [], with_ = [];
  for (const a of net.arrows(w, roomId)) {
    if (a.from !== th.id && a.to !== th.id) continue;
    const other = a.from === th.id ? a.to : a.from;
    const ends = endsOf(list, a.rel);
    const entry = { id: other, rel: a.rel, label: a.label, links: [[a.from, a.to]] };
    const same = ends === 'arrow' ? null : with_.find((x) => x.id === other);
    if (ends === 'arrow') (a.from === th.id ? out : into).push(entry);
    else if (same) same.links.push([a.from, a.to]);
    else with_.push(entry);
  }
  const go = (x) => c.el('button', {
    type: 'button', class: 'value-btn room-proust-go', title: [x.rel, x.label].filter(Boolean).join(' · ') || 'Go to it',
    onclick: () => {
      const to = shownAs(w, x.id) === 'tray' ? x.id : shownAs(w, x.id);
      c.goTo({ room: roomId, id: to });
      if (c.sel) c.openProps?.(c.sel);
    },
  }, nodeName(w, x.id) || 'Untitled');
  const cut = (x) => (c.locked ? null : c.el('button', {
    type: 'button', class: 'close-x room-arrow-x', 'aria-label': `Remove the link with ${nodeName(w, x.id) || 'Untitled'}`, title: 'Remove this link (Ctrl+Z brings it back)',
    onclick: (e) => {
      e.currentTarget.blur();
      for (const [from, to] of x.links) net.unlink(w, roomId, from, to);
      c.save();
      c.drawWorld();
      c.toast(`Link${x.links.length > 1 ? 's' : ''} removed. Ctrl+Z brings ${x.links.length > 1 ? 'them' : 'it'} back.`);
    },
  }));
  const name = (x) => c.el('span', { class: 'room-proust-name' }, go(x), cut(x));
  const row = (label, xs) => (xs.length ? c.el('div', { class: 'kv room-proust-links' }, c.el('span', {}, label), c.el('span', { class: 'room-proust-names' }, ...xs.map(name))) : null);
  return [row('Points to', out), row('Pointed to by', into), row('Linked with', with_)].filter(Boolean);
}

// The canvas.
export function draw(c) {
  const w = c.world, el = c.el, roomId = c.roomId;
  const all = boxes(w, roomId);
  const layer = lines.layer('room-proust-links');
  const nodes = [];
  const chosenGroup = (id) => (c.sel?.kind === 'train' && c.sel.id === id) || c.isSel(id);
  const view = centred(roomId);
  const far = (id) => (view?.dim.has(id) ? ' room-proust-far' : '');
  // A node's dot, on its right side while the pointer is on it: drag it onto another node to link.
  const dot = (id, style) => (c.locked ? null : el('span', { class: 'room-proust-dot', 'data-dot': id, title: 'Drag onto another thing to link them', ...(style ? { style } : {}) }));

  // Each open cluster: a faint box around what it holds, its title over it.
  for (const g of clusters(w, roomId)) {
    if (g.closed || shownAs(w, g.id) !== g.id) continue;
    const h = hull(w, roomId, g.id, all);
    if (!h) continue;
    layer.append(lines.svg('rect', {
      x: h.at.x, y: h.at.y, width: h.size.w, height: h.size.h, rx: 10,
      class: 'room-line room-proust-cluster' + (chosenGroup(g.id) ? ' selected' : ''),
    }));
    if (g.title) nodes.push(el('div', { class: 'label room-proust-title', 'data-group': g.id, style: `left:${h.at.x + 10}px;top:${h.at.y - 9}px` }, g.title));
    const d = dot(g.id, `left:${h.at.x + h.size.w}px;top:${h.at.y + h.size.h / 2}px`);
    if (d) { d.classList.add('room-proust-hull-dot'); nodes.push(d); }
  }

  // The links, with their labels (arrowview.js).
  nodes.push(...arrows().draw(c, layer, all));

  // Each node: a thought (in an open cluster: that cluster's, so a double-click chooses it whole),
  // a closed cluster, another mode's group.
  for (const u of proust.units(w, roomId)) {
    const b = all[u.id];
    if (!b) continue;
    const style = `left:${b.at.x}px;top:${b.at.y}px`;
    if (isGroup(u)) {
      nodes.push(el('div', {
        class: 'room-bead room-closed' + (u.of !== ID ? ' room-foreign' : '') + (chosenGroup(u.id) ? ' selected' : '') + far(u.id),
        'data-group': u.id, 'data-measure': u.id, style,
      }, c.thoughtNode(u), dot(u.id)));
      continue;
    }
    const g = clusterOf(w, u.id);
    nodes.push(el('div', {
      class: 'room-bead' + ((g && chosenGroup(g.id)) || c.isSel(u.id) ? ' selected' : '') + (c.found === u.id ? ' found' : '') + far(u.id),
      ...(g ? { 'data-group': g.id } : {}), 'data-thought': u.id, style,
    }, c.thoughtNode(u), dot(u.id)));
  }

  if (view) { const bar = centreBar(c, view, all); if (bar) nodes.push(bar); }

  // The thought being written, where it will be kept, with a faint line from the one it links on from.
  if (c.draft && !c.draft.edit) {
    const at = { x: c.draft.x ?? 0, y: c.draft.y ?? 0 };
    const from = c.draft.after && all[c.draft.after];
    if (from) {
      const box = { at, size: { w: 120, h: 26 } };
      const [ln] = lines.line(lines.strand(edge(from, centre(box)), edge(box, centre(from)), 0), { cls: 'room-arrow room-arrow-drawing' });
      layer.append(ln);
    }
    nodes.push(el('div', { class: 'room-bead', ...(c.draft.train ? { 'data-group': c.draft.train } : {}), style: `left:${at.x}px;top:${at.y}px` }, c.draftNode()));
  }
  return [layer, ...nodes];
}
