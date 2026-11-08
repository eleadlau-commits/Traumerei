// Russell: chapters joined into a tree, each an abstraction of the one above it. A chapter holds
// its thoughts in order, read top to bottom like a Joyce train. Arrows go from a parent chapter to
// a child: a chapter has any number of children and any number of parents (more than one makes a
// junction). There are no cycles: an arrow that would make one is refused. Each arrow has a
// relation, how the child stands to its parent ("forgets", "is a case of", "⊂", or none), and a
// short label: "forgets the coordinates". The arrows and relations are relations.js, shared with
// any ontology that joins its groups; the room's list of relations is Russell's setting 'relations'.
//
// The tree lays itself out: the roots at the top, each generation a level lower, siblings side by
// side, a junction under both its parents. A chapter dragged somewhere stays there (placed by
// hand); its children still hang under it. A thought in no chapter waits in the tray.
//
// A chapter is a group that holds each thought in only one chapter. The arrows and their labels
// are relation rows of the links table (relations.js arrowsOf, store 'russell')
// (relations.js).
// Thoughts stay shared with every other mode.

import {
  groupsIn, parentOf, members, groupOf, isGroup, isLeaf, shut, thoughtText, roomItems, create, join, setOrder, groupLabel, isLooseGroup, spotOf, setSpot, unsetSpot, // model
  trayForeign, place, inForeign, unplace, // groups of other modes, as one thing here
  stepAfter, setHeights, STEP, // a train's rhythm (Joyce's), which a chapter reads by too
  maths, lines, PAD, arrowsOf, arrowView,
  relationName, splitList, listText, cleanRelations, relationShown, withRelation, RELATIONS,
} from './world.js';
const sidePoint = (...a) => lines.sidePoint(...a);

export const ID = 'russell';
// World units. width: the widest a chapter's thoughts go; title: room for an open chapter's name
// over its thoughts; closed: a closed chapter's height; rhythm: every gap is a whole number of
// these, so rows and columns line up; gapX, rootGap, gapY: the least gaps (they grow for labels);
// fan: the most a level is pushed down so arrows fanning out to wide siblings don't lie flat.
export const LAYOUT = { width: 380, title: 32, closed: 30, rhythm: 24, gapX: 72, rootGap: 120, gapY: 72, fan: 240 };
export const LINES = ['straight', 'curved'];

// ---- Reading the tree ----

// The room's chapters (those with thoughts), oldest first.
// (A chapter held by another chapter is one thought inside it: not in the tree.)
export const chapters = (w, roomId) => groupsIn(w, roomId, ID).filter((g) => !isLooseGroup(w, g.id) && members(w, g.id).length && !groupOf(w, g.id, ID));
// Where a chapter was put (its rule row: { x, y, hand? }; hand true: dragged, 'auto': pushed clear).
const spotAt = (w, id) => spotOf(w, id) || {};

const isChapter = (w, roomId, id) => {
  const g = w.things[id];
  return isGroup(g) && g.of === ID && parentOf(w, g.id) === roomId && !groupOf(w, id, ID);
};

// ---- Arrows and relations (relations.js, shared with any ontology that joins its groups) ----

export { relationName, splitList, listText, cleanRelations, relationShown, withRelation, RELATIONS };

// The arrows, made the first time they are asked for (the API's parts are bound by then).
let made = null;
const arrowNet = () => (made ||= arrowsOf({ of: ID, isNode: isChapter, nodes: (w, roomId) => chapters(w, roomId), word: 'chapter', loops: false, changed: (w, roomId) => settle(w, roomId) }));
const fromNet = (name) => (...a) => arrowNet()[name](...a);
export const relations = fromNet('relations'), renameRelations = fromNet('renameRelations'), retag = fromNet('retag'),
  uses = fromNet('uses'), arrowsInto = fromNet('arrowsInto'), parentsOf = fromNet('parentsOf'), childrenOf = fromNet('childrenOf'),
  labelOf = fromNet('labelOf'), relationOf = fromNet('relationOf'), arrows = fromNet('arrows'), above = fromNet('above'),
  whyNot = fromNet('whyNot'), link = fromNet('link'), unlink = fromNet('unlink'), setLabel = fromNet('setLabel'), setRelation = fromNet('setRelation');

// A new chapter in the room (empty until a thought joins it: an empty group goes), as a child of
// `parent` when given. Returns it.
export function addChapter(w, roomId, { parent = null, x = 0, y = 0 } = {}, now = Date.now()) {
  const g = create(w, roomId, { kind: 'group', of: ID, x, y }, now);
  if (!g) return null;
  if (parent && isChapter(w, roomId, parent)) arrowNet().adopt(w, roomId, g.id, parent);
  return g;
}

// After the tree changes, chapters pushed aside by clear space (not dragged) go back into the
// layout.
function settle(w, roomId) {
  for (const g of groupsIn(w, roomId, ID)) if (spotAt(w, g.id).hand === 'auto') setSpot(w, g.id, { hand: null });
}

// ---- Layout ----

// Each thought's width as drawn (world units), measured after each drawing; a chapter is as wide
// as its widest thought, or its name. A chapter's name (a closed chapter's, or an open one's title)
// is measured under the chapter's own id. The heights are Joyce's (stepAfter), measured the same way.
const WIDTHS = new Map();
export function setWidths(sizes) {
  let changed = false;
  for (const [id, { w: wd }] of sizes) {
    const was = WIDTHS.get(id);
    if (!(wd > 0)) continue;
    if (was == null || Math.abs(was - wd) > 2) { WIDTHS.set(id, wd); changed = true; }
  }
  return changed;
}
export const clearWidths = () => WIDTHS.clear();
const widest = (w, id) => Math.max(0, ...members(w, id).map((th) => WIDTHS.get(th.id) || 0));

// Room over an open chapter's thoughts for its title (none without one).
const headOf = (g) => (g?.title && !g.closed ? LAYOUT.title : 0);

// A chapter's box as drawn: a closed one is only its name; an open one its title and thoughts.
// Until they are measured, names and thoughts are guessed from their length.
export function chapterSize(w, id) {
  const g = w.things[id];
  if (g?.closed) return { w: Math.round(WIDTHS.get(id) || chapterName(w, id).length * 12.6 + 4), h: LAYOUT.closed };
  const ths = members(w, id);
  const body = ths.reduce((s, th, i) => s + (i < ths.length - 1 ? stepAfter(th) : Math.max(STEP.line, stepAfter(th) - 29)), 0);
  const title = g?.title ? (WIDTHS.get(id) || g.title.length * 9) : 0;
  return { w: Math.round(Math.max(Math.min(LAYOUT.width, widest(w, id) || LAYOUT.width), title)), h: headOf(g) + Math.max(STEP.line, body) };
}

// How big an arrow's label is drawn, guessed from its length (13px italic, up to 200 wide).
export function labelSize(text) {
  const n = String(text || '').length;
  if (!n) return { w: 0, h: 0 };
  return { w: Math.min(200, Math.round(n * 6.4 + 4)), h: 19 * Math.ceil((n * 6.4 + 4) / 200) };
}

// A gap made a whole number of rhythm steps.
export const snap = (v) => Math.ceil(v / LAYOUT.rhythm - 1e-9) * LAYOUT.rhythm;

// How deep each chapter sits: a root at 0, and every chapter one below its deepest parent, so a
// junction sits under both its parents.
export function levels(w, roomId) {
  const out = {};
  const depth = (id, path = new Set()) => {
    if (out[id] != null) return out[id];
    if (path.has(id)) return 0; // never, since arrows refuse loops; a guard for broken data
    path.add(id);
    const ps = parentsOf(w, roomId, id).filter((p) => members(w, p).length);
    out[id] = ps.length ? 1 + Math.max(...ps.map((p) => depth(p, path))) : 0;
    return out[id];
  };
  for (const g of chapters(w, roomId)) depth(g.id);
  return out;
}

// Where each chapter's top left sits ({ id: { x, y } }, world units). A chapter with one parent
// hangs under it, among its siblings, each subtree as wide as it needs; a junction is centred
// under its parents; roots stand side by side. A chapter placed by hand stays where it is, and its
// children hang under it. Then each level is swept left to right so no two overlap. The gaps adapt:
// a level sits lower, and siblings further apart, when their arrows' labels need the room, and
// every gap is a whole number of rhythm steps.
export function layout(w, roomId, size = (id) => chapterSize(w, id)) {
  const all = chapters(w, roomId);
  const lv = levels(w, roomId);
  const sz = Object.fromEntries(all.map((g) => [g.id, size(g.id)]));
  const ps = Object.fromEntries(all.map((g) => [g.id, parentsOf(w, roomId, g.id).filter((p) => sz[p])]));
  // The biggest label on an arrow into each chapter (with its relation, when the room has several).
  const names = relations(w, roomId);
  const lab = Object.fromEntries(all.map((g) => {
    const { parents, labels, rel } = arrowsInto(w, roomId, g.id);
    const ls = parents.filter((p) => labels[p] || relationShown(names, rel[p])).map((p) => labelSize(`${relationShown(names, rel[p])} ${labels[p] || ''}`.trim()));
    return [g.id, { w: Math.max(0, ...ls.map((l) => l.w)), h: Math.max(0, ...ls.map((l) => l.h)) }];
  }));
  const gapX = (a, b) => snap(Math.max(LAYOUT.gapX, Math.max(lab[a].w, lab[b].w) / 2 + PAD));
  // The tree children: those with a single parent.
  const kids = Object.fromEntries(all.map((g) => [g.id, []]));
  for (const g of all) if (ps[g.id].length === 1) kids[ps[g.id][0]].push(g.id);
  const span = {};
  const row = (ks) => ks.reduce((s, k, i) => s + spanOf(k) + (i ? gapX(ks[i - 1], k) : 0), 0);
  const spanOf = (id) => span[id] ??= Math.max(sz[id].w, row(kids[id]));
  // Each tree child's centre, relative to its parent's.
  const off = {};
  for (const g of all) {
    const ks = kids[g.id];
    let x = -row(ks) / 2;
    ks.forEach((k, i) => { if (i) x += gapX(ks[i - 1], k); off[k] = x + spanOf(k) / 2; x += spanOf(k); });
  }
  // How far down each level starts: under the tallest chapter above, far enough for the labels
  // on the arrows into the level (beside the arrow, between its foot and its head), and for
  // siblings fanning out wide, far enough that their arrows don't lie flat.
  const deepest = Math.max(-1, ...Object.values(lv));
  const top = [0];
  for (let l = 0; l < deepest; l++) {
    const h = Math.max(0, ...all.filter((g) => lv[g.id] === l).map((g) => sz[g.id].h));
    const next = all.filter((g) => lv[g.id] === l + 1).map((g) => g.id);
    const label = Math.max(0, ...next.map((id) => lab[id].h));
    const fan = Math.min(LAYOUT.fan, Math.max(0, ...next.map((id) => Math.abs(off[id] || 0) * 0.6)));
    top.push(top[l] + h + snap(Math.max(LAYOUT.gapY, FOOT + PAD * 2 + label + 2 * PAD, fan)));
  }
  const centre = {};
  const out = {};
  let rootX = 0;
  for (let l = 0; l <= deepest; l++) {
    const rowOf = all.filter((g) => lv[g.id] === l).map((g) => {
      const id = g.id, p = ps[id];
      let want;
      if (!p.length) { want = rootX + spanOf(id) / 2; rootX += spanOf(id) + LAYOUT.rootGap; }
      else if (p.length === 1) want = centre[p[0]] + off[id];
      else want = p.reduce((s, q) => s + centre[q], 0) / p.length;
      return { id, want };
    }).sort((a, b) => a.want - b.want || (a.id < b.id ? -1 : 1));
    let edge = -Infinity, last = null;
    for (const r of rowOf) {
      const g = w.things[r.id], half = sz[r.id].w / 2;
      const p = spotAt(w, g.id);
      if (p.hand) { centre[r.id] = p.x + half; out[r.id] = { x: p.x, y: p.y }; continue; }
      const c = Math.max(r.want, edge + (last ? gapX(last, r.id) : 0) + half);
      edge = c + half;
      last = r.id;
      centre[r.id] = c;
      out[r.id] = { x: Math.round(c - half), y: top[l] };
    }
  }
  return out;
}

// Where each thought of a chapter sits ({ id: { x, y } }), top to bottom from its corner.
export function chapterSpots(w, id, at) {
  const out = {};
  let y = at.y + headOf(w.things[id]);
  for (const th of members(w, id)) { out[th.id] = { x: at.x, y }; y += stepAfter(th); }
  return out;
}

// Puts a thought into a chapter (its own, or another) at the place a drag let it go: before the
// first thought whose place (it and the gap after it) has its middle below the dragged thought's
// own middle (y: where the dragged thought's top is; a line stands about 24 units tall).
export function placeIn(w, roomId, chapterId, id, y) {
  const g = w.things[chapterId];
  const at = layout(w, roomId)[chapterId];
  if (!isGroup(g) || !at) return false;
  if (!members(w, chapterId).some((th) => th.id === id) && !join(w, chapterId, id)) return false;
  const spots = chapterSpots(w, chapterId, at);
  const rest = members(w, chapterId).map((th) => th.id).filter((m) => m !== id);
  const mid = y + 12;
  let i = rest.findIndex((m) => spots[m] && spots[m].y + stepAfter(w.things[m]) / 2 > mid);
  if (i < 0) i = rest.length;
  rest.splice(i, 0, id);
  return setOrder(w, chapterId, rest);
}

// The chapter under a point (world units), from the layout, or null.
export function chapterAt(w, roomId, x, y, except = null) {
  const places = layout(w, roomId);
  for (const g of chapters(w, roomId)) {
    if (g.id === except) continue;
    const p = places[g.id], s = chapterSize(w, g.id);
    if (p && x >= p.x - 20 && x <= p.x + s.w + 20 && y >= p.y - 20 && y <= p.y + s.h + 20) return g.id;
  }
  return null;
}

// A chapter as a tag, or a name in a move: its title, or its first words.
export const chapterName = (w, id) => groupLabel(w, id, 'A chapter');

// The chapter chosen in a room: the one chosen whole, or the one a chosen thought is in.
export function chosenChapter(c) {
  const id = c.sel?.id;
  const th = id && c.world.things[id];
  if (!th) return null;
  if (isGroup(th)) return th.of === ID ? th.id : null;
  return groupOf(c.world, id, ID)?.id || null;
}

// ---- On the canvas ----

// A move waiting for a click on a chapter: { room, child, kind: 'add' | 'cut' } (Add
// parent: click the parent; Remove arrow, from a junction: click the parent to cut it from).
let pending = null;

const svg = (...a) => lines.svg(...a);
const FOOT = 16; // how far under a chapter its foot sits
const RULE = 14; // how far left of an open chapter's thoughts its hairline runs

// A chapter's box for arrows: what is drawn (an open chapter's hairline is kept clear by its pad).
const arrowBox = ({ at, size }) => ({ x: at.x, y: at.y, w: size.w, h: size.h });
const foot = (box) => sidePoint(box, 'bottom', FOOT);
// How far off each side an arrow starts (below a chapter's foot circle; past an open chapter's
// hairline on its left) and ends (a little further, so the arrowhead shows).
const pads = (w, from, to) => {
  const off = (id, side, more) => (side === 'left' && !w.things[id]?.closed ? RULE : 0) + PAD + more;
  return { from: (side) => (side === 'bottom' ? FOOT + 7 : off(from, side, 0)), to: (side) => off(to, side, 2) };
};

// Each chapter's corner and size, as drawn now.
function boxes(w, roomId) {
  const places = layout(w, roomId);
  const out = {};
  for (const g of chapters(w, roomId)) if (places[g.id]) out[g.id] = { at: places[g.id], size: chapterSize(w, g.id) };
  return out;
}

// Russell's arrows on the screen (arrowview.js): drawn, edited where they are, drawn anew from a
// chapter's foot, and listed in a chapter's pop-up.
// Made the first time it is needed, like the arrows.
let shown = null;
const view = () => (shown ||= arrowView({
  of: ID, net: arrowNet(), boxes, pads, name: (w, id) => chapterName(w, id),
  nodeAt: (w, roomId, x, y) => chapterAt(w, roomId, x, y),
}));

// ---- The ontology ----


const russell = {
  id: ID,
  name: 'Russell',
  note: 'chapters in a tree',
  icon: '<rect x="9" y="3" width="6" height="4"/><rect x="3" y="16" width="6" height="4"/><rect x="15" y="16" width="6" height="4"/><path d="M12 7v4.5M6 16v-4.5h12V16"/>', // a tree
  order: 30,
  groups: { form: 'chapter', name: 'Chapter', membership: 'one', order: 'kept' },
  // Read when asked (not when this file loads), since RELATIONS comes from the plugin API.
  get settings() {
    return [
      { key: 'line', label: 'Arrows', type: 'choice', options: [['straight', 'Straight'], ['curved', 'Curved']], default: 'straight' },
      { ...RELATIONS, uses: (c, name) => uses(c.world, c.roomId, name), retag: (c, from, to) => retag(c.world, c.roomId, from, to) },
      { key: 'legend', label: 'Legend on the canvas', type: 'switch', default: false },
    ];
  },

  // A relation renamed in the room's list is renamed on its arrows.
  settingChanged(w, roomId, key, before, after) {
    if (key === RELATIONS.key) renameRelations(w, roomId, before, after);
  },

  // Each chapter's thoughts, or a closed chapter as one thought.
  units: (w, roomId) => chapters(w, roomId).flatMap((g) => (g.closed ? [g] : members(w, g.id))),

  // Its own refusals (the kernel's admit): an arrow that would make a loop, or join what isn't two
  // chapters, said in words.
  admit(w, p) {
    if (p?.kind !== 'link' || p.link !== 'relation') return { ok: true };
    const why = whyNot(w, parentOf(w, p.from), p.to, p.from);
    return why ? { ok: false, reason: why } : { ok: true };
  },

  // The whole room at once (the kernel's rule layout): the tree laid out once, then each
  // chapter's thoughts down it; the same points as point() gives one by one.
  layout(w, roomId) {
    const tree = layout(w, roomId), out = new Map();
    for (const g of chapters(w, roomId)) {
      const at = tree[g.id];
      if (!at) continue;
      if (g.closed) out.set(g.id, at);
      else for (const [id, p] of Object.entries(chapterSpots(w, g.id, at))) out.set(id, p);
    }
    return out;
  },

  point(w, roomId, id) {
    const th = w.things[id];
    const g = isGroup(th) && th.of === ID && !groupOf(w, id, ID) ? th : groupOf(w, id, ID);
    if (!g || parentOf(w, g.id) !== roomId) return null;
    const at = layout(w, roomId)[g.id];
    if (!at) return null;
    return g === th || g.closed ? at : chapterSpots(w, g.id, at)[id] || null;
  },

  // A chapter dragged stays where it is let go (placed by hand). A thought let go over a chapter
  // goes in among its thoughts where it was let go: further up or down its own chapter, or into
  // another. Let go on the empty canvas, it starts a chapter of its own there (a new root); the only
  // thought of a chapter moves its chapter instead, so the chapter keeps its arrows.
  drop(w, roomId, id, x, y) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th) && th.of === ID && !groupOf(w, id, ID)) { setSpot(w, id, { x, y, hand: true }); return; }
    if (!isLeaf(th) && !isGroup(th)) return; // another mode's group goes where a thought would
    const was = groupOf(w, id, ID);
    const onto = chapterAt(w, roomId, x + 10, y + 10);
    if (onto && !w.things[onto].closed) { placeIn(w, roomId, onto, id, y); return; }
    if (onto) { if (onto !== was?.id) join(w, onto, id); return; }
    if (was && members(w, was.id).length === 1) {
      setSpot(w, was.id, { x, y: y - headOf(was), hand: true });
      return;
    }
    const g = addChapter(w, roomId, { x: Math.round(x), y: Math.round(y) }, th.at);
    if (g) { join(w, g.id, id); setSpot(w, g.id, { hand: true }); }
  },

  // A thought kept with no chapter to go on with: a child chapter when a move asked for one
  // (draft.for.parent), or loose in the tray.
  begin(w, roomId, draft, now) {
    const parent = draft?.for?.parent;
    if (!parent || !isChapter(w, roomId, parent)) return null;
    return addChapter(w, roomId, { parent, x: draft.x, y: draft.y }, now);
  },

  // The thoughts in no chapter yet, chapters made in the tray, and other modes' groups in no
  // chapter yet, oldest first. Another mode's group is placed like a thought: into a chapter.
  // A thought inside another mode's shared group is not loose here too: the group stands for it.
  tray(w, roomId) {
    const inside = inForeign(w, roomId, ID);
    return [
      ...roomItems(w, roomId).filter((th) => !groupOf(w, th.id, ID)),
      ...groupsIn(w, roomId, ID).filter((g) => isLooseGroup(w, g.id) && members(w, g.id).length),
      ...trayForeign(w, roomId, ID).filter((g) => !groupOf(w, g.id, ID)),
    ].filter((th) => !inside(th.id)).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  },
  // Thrown back: a thought or another mode's group leaves its chapters; a chapter waits in the
  // tray with its thoughts (its arrows are kept, and come back when it is dragged out again).
  unplace: (w, roomId, id) => unplace(w, roomId, ID, id),
  placed(w, roomId, id) {
    const th = w.things[id];
    return isGroup(th) && th.of === ID ? !isLooseGroup(w, id) : !!groupOf(w, id, ID);
  },

  // Clear space (clear.js): a chapter is one block; one dragged was placed by hand. One pushed
  // aside keeps its new place until the tree changes.
  blocks: (w, roomId) => chapters(w, roomId).map((g) => ({
    id: g.id, thoughts: g.closed ? [] : members(w, g.id).map((th) => th.id), group: g.id,
    hand: spotAt(w, g.id).hand === true, at: Math.max(g.at ?? 0, ...members(w, g.id).map((th) => th.at ?? 0)),
  })),

  shift(w, roomId, id, dx, dy) {
    const g = w.things[id];
    if (!isGroup(g) || shut(w, id)) return;
    const p = layout(w, roomId)[id];
    if (!p) return;
    setSpot(w, id, { x: p.x + dx, y: p.y + dy, hand: spotAt(w, id).hand === true ? true : 'auto' });
  },

  // Each thought's size as drawn: the layout follows it.
  measured: (sizes) => { const a = setHeights(sizes), b = setWidths(sizes); return a || b; },

  // A press on the canvas: a chapter's foot starts an arrow; a move waiting for a chapter takes
  // the one clicked (anywhere else lets it go).
  press(c, e) {
    if (e.button !== 0 || c.locked) return false;
    // An arrow's own presses: its edit box, a double-click to edit it (arrowview.js).
    if (view().press(c, e)) return true;
    if (pending && pending.room === c.roomId) {
      const job = pending;
      pending = null;
      const to = view().nodeUnder(c, e);
      if (to) {
        if (job.kind === 'add') { const why = link(c.world, c.roomId, to, job.child); if (why) c.toast(why); }
        else if (!unlink(c.world, c.roomId, to, job.child)) c.toast('That chapter isn\'t a parent of this one.');
        c.save();
      }
      c.drawWorld();
      return true;
    }
    const f = e.target.closest?.('[data-foot]');
    if (!f) return false;
    e.preventDefault();
    const b = boxes(c.world, c.roomId)[f.dataset.foot];
    if (b) view().drag(c, e, f.dataset.foot, foot(arrowBox(b)));
    return true;
  },

  moves: [
    {
      id: 'child', label: 'New child chapter', when: (c) => !!chosenChapter(c),
      run(c) {
        const parent = chosenChapter(c);
        const b = boxes(c.world, c.roomId)[parent];
        const at = b ? { x: b.at.x, y: b.at.y + b.size.h + LAYOUT.gapY } : c.freeSpot();
        c.write({ x: at.x, y: at.y, for: { parent } });
      },
    },
    {
      id: 'parent', label: 'Add parent',
      when: (c) => !!chosenChapter(c),
      run(c) {
        pending = { room: c.roomId, child: chosenChapter(c), kind: 'add' };
        c.sel = null;
        c.toast('Click the chapter to be another parent.');
      },
    },
    {
      id: 'cut', label: 'Remove arrow',
      when: (c) => { const g = chosenChapter(c); return !!g && parentsOf(c.world, c.roomId, g).length > 0; },
      run(c) {
        const child = chosenChapter(c);
        const ps = parentsOf(c.world, c.roomId, child);
        if (ps.length === 1) { unlink(c.world, c.roomId, ps[0], child); return; }
        pending = { room: c.roomId, child, kind: 'cut' };
        c.sel = null;
        c.toast('Click the parent to take its arrow away.');
      },
    },
  ],

  // In a chapter's pop-up: each arrow into it, its relation (any of the room's, none, or a new one)
  // and its label.
  props(c, th) {
    if (!isGroup(th) || th.of !== ID) return [];
    return view().props(c, th);
  },

  // The canvas: each chapter's thoughts down a hairline, a foot under it to draw arrows from, the
  // arrows down to its children with their labels, and the thought being written.
  draw(c) {
    const w = c.world, el = c.el, roomId = c.roomId;
    const all = boxes(w, roomId);
    const layer = lines.layer('room-russell-arrows'); // the shared lines part (lines.js), with its arrowheads
    const nodes = [];
    const picking = pending && pending.room === roomId;
    nodes.push(...view().draw(c, layer, all)); // the arrows, their labels, and one being edited
    for (const g of chapters(w, roomId)) {
      const box = all[g.id];
      if (!box) continue;
      const { at, size } = box;
      const chosen = (c.sel?.kind === 'train' && c.sel.id === g.id) || c.isSel(g.id);
      const cls = 'room-bead' + (picking ? ' room-russell-pick' : '');
      if (g.closed) {
        // A closed chapter: only its name. A click opens it as a document (open, below).
        nodes.push(el('div', {
          class: cls + ' room-closed room-russell-closed' + (chosen ? ' selected' : ''), 'data-group': g.id, 'data-measure': g.id,
          title: 'Click to open', style: `left:${at.x}px;top:${at.y}px`,
        }, el('span', { class: 'room-thought', 'data-id': g.id }, maths(chapterName(w, g.id)))));
      } else {
        const spots = chapterSpots(w, g.id, at);
        for (const th of members(w, g.id)) {
          const sp = spots[th.id];
          nodes.push(el('div', {
            class: cls + (chosen || c.isSel(th.id) ? ' selected' : '') + (c.found === th.id ? ' found' : ''),
            'data-group': g.id, 'data-thought': th.id, style: `left:${sp.x}px;top:${sp.y}px`,
          }, c.thoughtNode(th)));
        }
        if (c.draft?.train === g.id && !c.draft.edit) {
          const last = members(w, g.id).at(-1);
          const y = last ? spots[last.id].y + stepAfter(last) : at.y;
          nodes.push(el('div', { class: 'room-bead', 'data-group': g.id, style: `left:${at.x}px;top:${y}px` }, c.draftNode()));
        }
      }
      // The chapter's hairline, down its left, and its name over it.
      const top = at.y + headOf(g);
      if (!g.closed) layer.append(svg('path', { class: 'room-russell-rule' + (chosen ? ' selected' : ''), d: `M${at.x - RULE} ${top + 6}L${at.x - RULE} ${at.y + size.h - 4}` }));
      if (headOf(g)) nodes.push(el('div', { class: 'room-russell-title', 'data-group': g.id, 'data-measure': g.id, style: `left:${at.x}px;top:${at.y}px` }, g.title));
      if (!c.locked) {
        const f = foot(arrowBox(box));
        nodes.push(el('div', { class: 'room-russell-foot', 'data-foot': g.id, title: 'Drag onto another chapter to make it a child', style: `left:${f.x}px;top:${f.y}px` }));
      }
    }
    if (c.draft && !c.draft.train && !c.draft.edit) {
      nodes.push(el('div', { class: 'room-bead', style: `left:${c.draft.x}px;top:${c.draft.y}px` }, c.draftNode()));
    }
    return [layer, ...nodes];
  },

  // A tap on a closed (closed) chapter opens it as a document (document.js).
  open(c, id) {
    const g = c.world.things[id];
    if (!isGroup(g) || g.of !== ID || !g.closed) return false;
    c.openDocument(id);
    return true;
  },

  // A thought's tag in the Timeline: its chapter.
  tag(w, id) {
    const g = groupOf(w, id, ID);
    return g ? { id: g.id, name: chapterName(w, g.id) } : null;
  },
};

export default russell;
