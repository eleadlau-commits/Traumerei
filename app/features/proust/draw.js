// Proust on the screen: each node where it sits, a faint box around each open cluster, and the
// links between them, drawn through the world's shared parts: lines.js (the line, its ends) and
// arrowview.js (labels, editing a link where it is). A link is a strand like Joyce's: taut between
// thoughts written close together, slack after a pause (the room's Line tension); a link back the
// other way bows to the other side.

import { isGroup, itemsIn, lines, arrowView } from './world.js';
import { ID, RELATIONS, links, endsOf, nodeName, nodes as allNodes, point, sizeOf, shownAs, clusterOf, clusters, isNode, proust } from './rules.js';

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
}));

// A press on the canvas: a link's own (its edit box, a double-click to edit it).
export const press = (c, e) => e.button === 0 && !c.locked && arrows().press(c, e);

// The canvas.
export function draw(c) {
  const w = c.world, el = c.el, roomId = c.roomId;
  const all = boxes(w, roomId);
  const layer = lines.layer('room-proust-links');
  const nodes = [];
  const chosenGroup = (id) => (c.sel?.kind === 'train' && c.sel.id === id) || c.isSel(id);

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
        class: 'room-bead room-closed' + (u.of !== ID ? ' room-foreign' : '') + (chosenGroup(u.id) ? ' selected' : ''),
        'data-group': u.id, 'data-measure': u.id, style,
      }, c.thoughtNode(u)));
      continue;
    }
    const g = clusterOf(w, u.id);
    nodes.push(el('div', {
      class: 'room-bead' + ((g && chosenGroup(g.id)) || c.isSel(u.id) ? ' selected' : '') + (c.found === u.id ? ' found' : ''),
      ...(g ? { 'data-group': g.id } : {}), 'data-thought': u.id, style,
    }, c.thoughtNode(u)));
  }

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
