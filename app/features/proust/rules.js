// Proust: every thought free on the canvas, joined by named links that may run in loops, and
// gathered into clusters (named after Proust's memory, where any moment can call up any other,
// across time and back). No screen here: draw.js draws it.
//
// Nodes. Every thought is on the canvas, as in Pessoa: placed by hand, or on Pessoa's spiral until
// it is. A group another mode made (a train, a chapter) waits in the tray as one thing until it is
// dragged out; then it is one node. A cluster closed to its title is one node too.
//
// Links. A link joins any two nodes: a thought, a cluster, another mode's group. It has a relation
// and a label (relations.js, shared with Russell) and runs in loops freely: A to B to C to A. Two
// nodes have at most one link each way; one from a node to itself is refused. Each relation has
// its own ends, set in the room's ⚙ list ("leads to ->"): a plain line, an arrow, or both ways.
// Links are Proust's own: no other mode shows them.
//
// Clusters (Ctrl+G) are Proust's groups: a box around its thoughts, which links can join as a
// whole. A thought is in one cluster at a time; clusters can hold clusters. Like every group made
// on purpose it is a shared object (groups.js), one thing in the other modes' trays.
//
// Writing follows Joyce: typing with nothing to go on gives a loose thought; Enter keeps it and
// the next one links on from it; Ctrl+Enter starts a new cluster, which the thoughts written on
// with Enter then join.
//
// Its own data in a room: own(w, room, 'proust')[id] = { x, y } where a node was placed (the same
// shape groups.js keeps for other modes' groups), and own(w, room, 'proust-links') its links
// (relations.js: { [to]: { parents, labels, rel } }).

import {
  own, shut, roomSetting, setRoomSetting, isGroup, isLeaf, create, itemsIn, within, groupOf, groupsIn, roomItems, thoughtText,
  placedForeign, trayForeign, inForeign, spot, putAt, place, unplace, arrowsOf, cleanRelationList, relationEntry, relationEnds, listText, spiralPoint,
} from './world.js';

export const ID = 'proust';
export const LINKS = 'proust-links';

// ---- Relations ----

export const DEFAULT_RELATIONS = ['related to', 'leads to ->', 'is equivalent to <->'];
// Shown in the room's ⚙ by the relations editor (the world's relationsview.js): each relation's
// name, ends, line and colour. uses and retag let it say how many links a relation has, and move
// them to another when it is deleted.
export const RELATIONS = {
  key: 'relations', label: 'Relations', type: 'relations', default: DEFAULT_RELATIONS, ends: true, none: 'none',
  clean: (v) => cleanRelationList(v, DEFAULT_RELATIONS), text: (v) => listText(v),
  note: 'A new link gets the first. Ends: a plain line, an arrow, or both ways.',
  uses: (c, name) => links().uses(c.world, c.roomId, name),
  retag: (c, from, to) => links().retag(c.world, c.roomId, from, to),
};

// A relation's ends in a room's list ('none' when it has no mark, or isn't in the list).
export const endsOf = (list, rel) => relationEnds(list, 'none')[rel] || 'none';

// ---- Clusters and what shows ----

const ownGroup = (w, id) => { const g = w.things[id]; return isGroup(g) && g.of === ID ? g : null; };
// The cluster holding a thing directly, or null.
export const clusterOf = (w, id) => groupOf(w, id, ID);

// How a thing shows: 'tray' when a cluster holding it (however deep) waits in the tray, or the id
// of the outermost closed cluster holding it (the one node it shows as), or itself.
export function shownAs(w, id) {
  let out = id;
  for (let g = clusterOf(w, id), seen = new Set(); g && !seen.has(g.id); seen.add(g.id), g = clusterOf(w, g.id)) {
    if (g.loose) return 'tray';
    if (g.closed) out = g.id;
  }
  const self = ownGroup(w, id);
  if (self?.loose) return 'tray';
  return out;
}

// The room's clusters with something in them, not in the tray, oldest first (nested ones too).
export function clusters(w, roomId) {
  const inside = inForeign(w, roomId, ID);
  return groupsIn(w, roomId, ID).filter((g) => itemsIn(w, g.id).length && shownAs(w, g.id) !== 'tray' && !inside(g.id));
}

// ---- Nodes ----

// Whether links can join a thing: a thought of the room, a cluster, or another mode's group placed
// here (not in the tray). A thing inside another mode's group is not a node: the group stands for
// it (one card). inside: inForeign's test, when it is already made.
export function isNode(w, roomId, id, inside = null) {
  const th = w.things[id];
  if (!th || th.parent !== roomId) return false;
  if ((inside || inForeign(w, roomId, ID))(id)) return false;
  if (isLeaf(th)) return shownAs(w, id) !== 'tray';
  if (!isGroup(th)) return false;
  if (th.of === ID) return !!itemsIn(w, id).length && shownAs(w, id) !== 'tray';
  return !!spot(w, roomId, ID, id);
}

export function nodes(w, roomId) {
  const inside = inForeign(w, roomId, ID);
  return [...roomItems(w, roomId), ...groupsIn(w, roomId, ID), ...placedForeign(w, roomId, ID)].filter((th) => isNode(w, roomId, th.id, inside));
}

// A node in words: a cluster's or group's title, or a thought's first words.
export function nodeName(w, id) {
  const th = w.things[id];
  if (!th) return '';
  if (isGroup(th) && th.title) return th.title;
  const first = isGroup(th) ? itemsIn(w, id)[0] : th;
  const words = first ? thoughtText(w, first).split(/\s+/).slice(0, 4).join(' ') : '';
  return words || (isGroup(th) ? 'A cluster' : 'A thought');
}

// ---- Links (relations.js) ----

let net = null;
export const links = () => (net ||= arrowsOf({
  of: ID, store: LINKS, setting: RELATIONS, isNode, nodes, word: 'thought', noun: 'link', loops: true,
  words: { self: 'A thought can\'t be linked to itself.', join: 'Links join two things on the canvas.' },
}));

// Takes away every link touching these ids. Returns how many went.
export function cut(w, roomId, ids) {
  const set = new Set(ids);
  const data = own(w, roomId, LINKS, false);
  let n = 0;
  for (const [to, a] of Object.entries(data)) {
    if (!a || !Array.isArray(a.parents)) continue;
    if (set.has(to)) { n += a.parents.length; delete data[to]; continue; }
    const keep = a.parents.filter((p) => !set.has(p));
    if (keep.length === a.parents.length) continue;
    n += a.parents.length - keep.length;
    for (const p of a.parents) if (set.has(p)) { delete a.labels?.[p]; delete a.rel?.[p]; }
    a.parents = keep;
  }
  return n;
}

// ---- Where things sit ----

// Each drawn node's size (world units), measured after each drawing; until then a guess.
const SIZES = new Map();
export function setSizes(sizes) {
  let changed = false;
  for (const [id, { w: wd, h }] of sizes) {
    if (!(wd > 0) || !(h > 0)) continue;
    const was = SIZES.get(id);
    if (!was || Math.abs(was.w - wd) > 2 || Math.abs(was.h - h) > 2) { SIZES.set(id, { w: wd, h }); changed = true; }
  }
  return changed;
}
export const clearSizes = () => SIZES.clear();
export function sizeOf(w, id) {
  const s = SIZES.get(id);
  if (s) return s;
  const th = w.things[id];
  const text = !th ? '' : isGroup(th) ? nodeName(w, id) : thoughtText(w, th);
  return { w: Math.min(340, Math.max(40, String(text).length * 9)), h: 30 };
}

// ---- Centre's view ----
// While a room is centred (Ctrl+Shift+C, draw.js), each node shows where Centre put it, not where
// it was placed by hand: a view, kept here and never saved, gone on Esc. A move while centred
// moves a node in the view; "Keep this layout" (keep) places every node where it shows.
// A view: { at: { [id]: { x, y } }, dim: Set of ids shown faint, moved?(id) }.
const VIEWS = new Map();
export const centred = (roomId) => VIEWS.get(roomId) || null;
export function setCentred(roomId, v) { if (v) VIEWS.set(roomId, v); else VIEWS.delete(roomId); }
export function keep(w, roomId) {
  const v = VIEWS.get(roomId);
  if (!v || shut(w, roomId)) return false;
  VIEWS.delete(roomId);
  for (const [id, p] of Object.entries(v.at)) moveTo(w, roomId, id, p.x, p.y);
  return true;
}

// Where a thought, a cluster or a group sits ({ x, y }, its top left), or null (in the tray). A
// thought: where it was placed, or its place on the spiral. A cluster: the corner of what it holds.
// While centred: where Centre shows it.
export function point(w, roomId, id) {
  const th = w.things[id];
  if (!th || th.parent !== roomId) return null;
  const shown = VIEWS.get(roomId)?.at[id];
  if (shown) return { x: shown.x, y: shown.y };
  const placed = own(w, roomId, ID, false)[id];
  if (isLeaf(th)) {
    if (placed && Number.isFinite(placed.x)) return { x: placed.x, y: placed.y };
    const all = roomItems(w, roomId);
    const i = all.findIndex((u) => u.id === id);
    return spiralPoint(i < 0 ? all.length : i, id);
  }
  if (!isGroup(th)) return null;
  if (th.of !== ID) return spot(w, roomId, ID, id);
  const ps = itemsIn(w, id).map((m) => point(w, roomId, m.id)).filter(Boolean);
  if (!ps.length) return null;
  return { x: Math.min(...ps.map((p) => p.x)), y: Math.min(...ps.map((p) => p.y)) };
}

// Moves a thing so its corner is at x, y: a thought is placed there; a cluster takes everything
// in it along (and comes out of the tray); another mode's group is placed there.
export function moveTo(w, roomId, id, x, y, auto = false) {
  const th = w.things[id];
  if (!th || shut(w, roomId)) return false;
  const view = VIEWS.get(roomId);
  if (view) return moveInView(w, roomId, view, id, x, y);
  const places = own(w, roomId, ID);
  if (isLeaf(th)) { places[id] = { x: Math.round(x), y: Math.round(y), ...(auto ? { auto: true } : {}) }; return true; }
  if (!isGroup(th)) return false;
  if (th.of !== ID) return putAt(w, roomId, ID, id, x, y);
  const at = point(w, roomId, id);
  if (!at) return false;
  const dx = x - at.x, dy = y - at.y;
  for (const m of itemsIn(w, id)) {
    const p = point(w, roomId, m.id);
    if (p) places[m.id] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy), ...(auto ? { auto: true } : {}) };
  }
  place(w, id);
  return true;
}

// While centred, a move moves a node only as Centre shows it (an open cluster: what it holds).
function moveInView(w, roomId, view, id, x, y) {
  const at = point(w, roomId, id);
  if (!at) return false;
  const dx = x - at.x, dy = y - at.y;
  const ids = view.at[id] ? [id] : itemsIn(w, id).map((m) => shownAs(w, m.id)).filter((m, i, all) => view.at[m] && all.indexOf(m) === i);
  if (!ids.length) return false;
  for (const m of ids) { const p = view.at[m]; view.at[m] = { x: Math.round(p.x + dx), y: Math.round(p.y + dy) }; view.moved?.(m); }
  return true;
}

// Where the next thought goes after `id`: just below it, or else the nearest clear place around
// there (not over another node, nor too close to one), so the link between them shows.
const GAP = 64;
const ROOM = { w: 300, h: 34, margin: 26 }; // the room a new thought needs, and what it keeps clear
export function below(w, roomId, id) {
  const p = point(w, roomId, id) || { x: 0, y: 0 };
  const own = sizeOf(w, shownAs(w, id) === id ? id : shownAs(w, id));
  const start = { x: p.x, y: p.y + own.h + GAP };
  const others = proust.units(w, roomId).map((u) => ({ p: point(w, roomId, u.id), s: sizeOf(w, u.id) })).filter((o) => o.p);
  const m = ROOM.margin;
  const clear = (x, y) => !others.some((o) => x < o.p.x + o.s.w + m && x + ROOM.w > o.p.x - m && y < o.p.y + o.s.h + m && y + ROOM.h > o.p.y - m);
  if (clear(start.x, start.y)) return { x: Math.round(start.x), y: Math.round(start.y) };
  // Rings around the spot below, nearest first; going down or right costs a little less.
  const tries = [];
  for (let r = 1; r <= 14; r++) {
    for (let k = -r; k <= r; k++) for (const [dx, dy] of [[k, -r], [k, r], [-r, k], [r, k]]) {
      const x = start.x + dx * 40, y = start.y + dy * 30;
      if (y < p.y) continue; // never above the one it goes on from
      tries.push({ x, y, cost: Math.hypot(dx * 40, dy * 30) - (dy > 0 ? 6 : 0) - (dx > 0 ? 4 : 0) });
    }
  }
  tries.sort((a, b) => a.cost - b.cost);
  const spot = tries.find((t) => clear(t.x, t.y)) || start;
  return { x: Math.round(spot.x), y: Math.round(spot.y) };
}

// ---- In a .traum file (the roomfile feature): its # In proust section ----
//
//   at: ^a 120 40 [auto]   a thought placed at a point (auto: pushed there to keep clear, not
//                          dragged); another mode's group placed here; a cluster moved whole
//   on canvas: ^b ^c        thoughts on the spiral, where Proust lays them (the same as no line); a
//                          cluster out of the tray
//   tray: ^g                a cluster waiting in the tray; another mode's group not placed yet
//   link: ^a -> ^b | leads to | the proof    a link: -- a plain line, -> an arrow, <-> both ways
//   arrow: ^a -> ^b | forgets                Russell's arrow lines, read as links with an arrow
//
// A link's ends are its relation's (the room's ⚙ list), written on each line so a file reads on
// its own. Read back, a relation the room doesn't have yet joins its list with the ends the line
// gives; one it has keeps its own ends, and a line saying otherwise is reported. A relation object
// (## ^r relation: leads to, with from:, to:, and ends: none, arrow or both) is a link too.
// c: the roomfile feature's helpers (ref, writeLink; thing, report, keep, link(line), arrow(line),
// relations, scope, change, name).

const roomList = (w, roomId) => cleanRelationList(roomSetting(w, roomId, ID, RELATIONS), DEFAULT_RELATIONS);
const ENDS_SAID = { none: 'a plain line', arrow: 'an arrow', both: 'an arrow both ways' };
const MARK = { none: '--', arrow: '->', both: '<->' };

// Each link read takes its relation's ends; a relation new to the room joins its list.
function settleEnds(w, roomId, list, c) {
  let names = roomList(w, roomId);
  for (const a of list) {
    if (!a.ends) continue;
    const rel = a.rel ?? '';
    if (!rel) {
      if (a.ends !== 'none') c.report(a.line, `a link with no relation is a plain line, so its ${MARK[a.ends]} was read as --.`);
      continue;
    }
    const had = names.find((n) => relationEntry(n).name.toLowerCase() === rel.toLowerCase());
    if (!had) {
      names = [...names, a.ends === 'none' ? rel : `${rel} ${MARK[a.ends]}`];
      if (!shut(w, roomId)) setRoomSetting(w, roomId, ID, RELATIONS.key, names);
      continue;
    }
    const ends = relationEntry(had).ends || 'none';
    if (ends !== a.ends) c.report(a.line, `"${relationEntry(had).name}" is ${ENDS_SAID[ends]} in this room's relations, so this link is drawn as one (the line said ${MARK[a.ends]}).`);
  }
}

const traum = {
  write(w, roomId, c) {
    const places = own(w, roomId, ID, false);
    const out = [], spiral = [];
    const inside = inForeign(w, roomId, ID);
    for (const th of roomItems(w, roomId)) {
      if (!c.ref(th.id) || inside(th.id)) continue; // another mode's group stands for it
      const p = places[th.id];
      if (p && Number.isFinite(p.x)) out.push(`at: ${c.ref(th.id)} ${p.x} ${p.y}${p.auto ? ' auto' : ''}`);
      else spiral.push(c.ref(th.id));
    }
    for (const g of placedForeign(w, roomId, ID)) { const p = spot(w, roomId, ID, g.id); if (c.ref(g.id)) out.push(`at: ${c.ref(g.id)} ${p.x} ${p.y}${p.auto ? ' auto' : ''}`); }
    if (spiral.length) out.push(`on canvas: ${spiral.join(' ')}`);
    const tray = proust.tray(w, roomId).map((th) => c.ref(th.id)).filter(Boolean);
    if (tray.length) out.push(`tray: ${tray.join(' ')}`);
    const list = roomList(w, roomId);
    for (const a of links().arrows(w, roomId)) {
      if (!c.ref(a.from) || !c.ref(a.to)) continue;
      out.push(`link: ${c.writeLink({ from: c.ref(a.from), to: c.ref(a.to), ends: endsOf(list, a.rel), rel: a.rel, label: a.label })}`);
    }
    return out;
  },
  read(w, roomId, lines, c) {
    const read = [...(c.relations || [])];
    const placed = new Set(), wholes = [];
    const num = (v) => (v?.t === 'num' ? v.v : null);
    for (const l of lines) {
      if (l.key === 'at') {
        const id = c.thing(l.values[0], l.line);
        const x = num(l.values[1]), y = num(l.values[2]);
        if (!id) continue;
        if (x == null || y == null) { c.report(l.line, 'at: needs a ^reference and two numbers.'); continue; }
        if (placed.has(id)) { c.report(l.line, 'Proust places a thing once; this second at: was left out.'); continue; }
        placed.add(id);
        const th = w.things[id];
        if (isLeaf(th)) own(w, roomId, ID)[id] = { x: Math.round(x), y: Math.round(y), ...(l.values.slice(3).some((v) => v.v === 'auto') ? { auto: true } : {}) };
        else if (isGroup(th) && th.of === ID) wholes.push([id, x, y]); // after its thoughts are placed
        else moveTo(w, roomId, id, x, y);
      } else if (l.key === 'on canvas' || l.key === 'tray') {
        for (const v of l.values) {
          const id = c.thing(v, l.line);
          const th = id && w.things[id];
          if (!th) continue;
          if (l.key === 'on canvas') {
            if (isLeaf(th) && !placed.has(id)) delete own(w, roomId, ID)[id]; // back on the spiral
            else if (isGroup(th) && th.of === ID) place(w, id);
          } else if (isGroup(th) && th.of === ID) th.loose = true;
          else if (isGroup(th) && !placed.has(id)) delete own(w, roomId, ID)[id];
          else c.report(l.line, 'Proust places every thought on the canvas, so only a cluster or another mode\'s group waits in the tray.');
        }
      } else if (l.key === 'link') {
        const a = c.link(l);
        if (a) read.push(a);
      } else if (l.key === 'arrow') {
        const a = c.arrow(l);
        if (a) read.push({ ...a, ends: 'arrow' });
      } else c.keep(l);
    }
    for (const [id, x, y] of wholes) moveTo(w, roomId, id, x, y);
    settleEnds(w, roomId, read, c);
    links().traumArrows(w, roomId, read, c);
  },
  // (c.scope, when editing: the things the text holds. Links touching them are made to read as the
  // text does: ones not in it are taken away, ones changed are changed. c.change(words) says so.)
};

// ---- The ontology ----

export const proust = {
  id: ID,
  name: 'Proust',
  note: 'thoughts joined by links, in loops',
  icon: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6.4l8 1.2M6.4 8l1.2 8M10 18h6M18 10v6M7.5 7.5l9 9"/>', // a web
  order: 40,
  groups: { form: 'cluster', name: 'Cluster', membership: 'one' },
  lays: true, // places every thought itself
  live: true, // a drag moves the node at once, so its links follow it
  fresh: 'New cluster: type to start it.',
  settings: [
    RELATIONS,
    { key: 'tension', label: 'Line tension', min: 0, max: 1, default: 0.5 },
    { key: 'legend', label: 'Legend on the canvas', type: 'switch', default: false },
    { key: 'reach', label: 'Centre shows', type: 'choice', default: 'all',
      options: [['all', 'The whole web'], ['1', '1 step out'], ['2', '2 steps out'], ['3', '3 steps out']] },
  ],

  // A relation renamed in the room's list is renamed on its links.
  settingChanged(w, roomId, key, before, after) {
    if (key === RELATIONS.key) links().renameRelations(w, roomId, before, after);
  },
  traum,

  // Every thought not in a closed or waiting cluster, each closed cluster, and other modes' groups
  // placed here.
  // A thought inside another mode's group is not on the canvas on its own: the group stands for it.
  units(w, roomId) {
    const inside = inForeign(w, roomId, ID);
    return [
      ...roomItems(w, roomId).filter((th) => shownAs(w, th.id) === th.id),
      ...groupsIn(w, roomId, ID).filter((g) => g.closed && itemsIn(w, g.id).length && shownAs(w, g.id) === g.id),
    ].filter((th) => !inside(th.id)).concat(placedForeign(w, roomId, ID));
  },
  // Clusters thrown back (or made in the tray), and other modes' groups not placed yet.
  tray: (w, roomId) => [
    ...groupsIn(w, roomId, ID).filter((g) => g.loose && itemsIn(w, g.id).length && !(clusterOf(w, g.id))),
    ...trayForeign(w, roomId, ID),
  ].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)),
  placed(w, roomId, id) {
    const th = w.things[id];
    if (isGroup(th) && th.of !== ID) return !!spot(w, roomId, ID, id);
    return shownAs(w, id) !== 'tray';
  },
  // Thrown back: a cluster waits in the tray, another mode's group loses its spot, and every link
  // touching it (or anything in it) goes; Ctrl+Z brings them back. A thought can't go: Proust
  // places every thought itself.
  unplace(w, roomId, id) {
    const th = w.things[id];
    if (!isGroup(th) || !unplace(w, roomId, ID, id, { leaves: false })) return false;
    cut(w, roomId, [id, ...within(w, id).map((m) => m.id)]);
    return true;
  },

  point,
  drop(w, roomId, id, x, y) { moveTo(w, roomId, id, x, y); },
  draftPoint: (w, roomId) => spiralPoint(roomItems(w, roomId).length, 'draft'),

  // A thought kept with nothing to go on with: after Ctrl+Enter, a new cluster where it was
  // written; otherwise none (it is loose: no cluster, no link).
  begin(w, roomId, draft, now) {
    if (!draft?.fresh) return null;
    return create(w, roomId, { kind: 'group', of: ID, x: Math.round(draft.x || 0), y: Math.round(draft.y || 0) }, now);
  },
  // After `id`: the next thought goes just below it, in its cluster, linked on from it.
  goOn(w, roomId, id) {
    const th = w.things[id];
    if (!th || th.parent !== roomId || !isNode(w, roomId, id)) return null;
    const c = isLeaf(th) ? clusterOf(w, id) : null;
    return { train: c && !c.closed ? c.id : null, after: id, ...below(w, roomId, id) };
  },
  // A new thought: placed where it was written, and linked on from the one before (the room's
  // first relation).
  kept(w, roomId, th, draft) {
    if (Number.isFinite(draft?.x) && Number.isFinite(draft?.y)) {
      const at = { x: Math.round(draft.x), y: Math.round(draft.y) };
      own(w, roomId, ID)[th.id] = at;
      const view = VIEWS.get(roomId);
      if (view) view.at[th.id] = { ...at }; // written while centred: it shows where it was written
    }
    if (draft?.after && draft.after !== th.id && isNode(w, roomId, draft.after)) links().link(w, roomId, draft.after, th.id);
  },

  // Clear space (clear.js): each node is a block; one dragged was placed by hand. One pushed clear
  // keeps its new place (marked auto, so it still counts as laid out by Proust).
  blocks(w, roomId) {
    const places = own(w, roomId, ID, false);
    return this.units(w, roomId).map((u) => {
      const ids = isGroup(u) && u.of === ID ? itemsIn(w, u.id).map((m) => m.id) : [u.id];
      return { id: u.id, thoughts: [u.id], hand: ids.some((m) => places[m] && !places[m].auto), at: u.at ?? 0 };
    });
  },
  shift(w, roomId, id, dx, dy) {
    const p = point(w, roomId, id);
    if (!p) return;
    const was = own(w, roomId, ID, false)[id];
    moveTo(w, roomId, id, p.x + dx, p.y + dy, !(was && !was.auto));
  },
  measured: (sizes) => setSizes(sizes),

  // A thought's tag in the room's Timeline: its cluster.
  tag(w, id) {
    const g = clusterOf(w, id);
    return g ? { id: g.id, name: nodeName(w, g.id) } : null;
  },
};
