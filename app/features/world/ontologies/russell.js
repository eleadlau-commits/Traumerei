// Russell: chapters joined into a tree, each an abstraction of the one above it. A chapter holds
// its thoughts in order, read top to bottom like a Joyce train. Arrows go from a parent chapter to
// a child: a chapter has any number of children and usually one parent, at most two (a junction).
// There are no cycles: an arrow that would make one is refused. Each arrow can carry a short
// label, what the child forgets about its parent ("forgets the coordinates").
//
// The tree lays itself out: the roots at the top, each generation a level lower, siblings side by
// side, a junction under both its parents. A chapter dragged somewhere stays there (placed by
// hand); its children still hang under it. A thought in no chapter waits in the tray.
//
// A chapter is a group that holds each thought in only one chapter. The arrows and their labels
// are Russell's own data in the room: own(w, room, 'russell')[child] = { parents, labels }, where
// labels is { [parent]: text }. Thoughts stay shared with every other mode.

import { groupsIn, members, groupOf, isGroup, isLeaf, shut, thoughtText, roomItems, create, join, own } from '../model.js';
import { stepAfter, setHeights, STEP } from './joyce.js';
import { maths } from '../maths.js';
import { between, path as arrowLine, labelSpot, sidePoint, PAD } from './arrows.js';

const SVG = 'http://www.w3.org/2000/svg';

export const ID = 'russell';
export const MOST_PARENTS = 2;
// World units. width: the widest a chapter's thoughts go; title: room for an open chapter's name
// over its thoughts; closed: a closed chapter's height; rhythm: every gap is a whole number of
// these, so rows and columns line up; gapX, rootGap, gapY: the least gaps (they grow for labels);
// fan: the most a level is pushed down so arrows fanning out to wide siblings don't lie flat.
export const LAYOUT = { width: 380, title: 32, closed: 30, rhythm: 24, gapX: 72, rootGap: 120, gapY: 72, fan: 240 };
export const LINES = ['straight', 'curved'];

// ---- Reading the tree ----

// The room's chapters (those with thoughts), oldest first.
export const chapters = (w, roomId) => groupsIn(w, roomId, ID).filter((g) => members(w, g.id).length);

const isChapter = (w, roomId, id) => {
  const g = w.things[id];
  return isGroup(g) && g.of === ID && g.parent === roomId;
};

// The arrows into a chapter: { parents, labels }, only to chapters still there.
export function arrowsInto(w, roomId, id) {
  const a = own(w, roomId, ID, false)[id];
  const parents = (a?.parents || []).filter((p) => p !== id && isChapter(w, roomId, p));
  const labels = {};
  for (const p of parents) if (a.labels?.[p]) labels[p] = a.labels[p];
  return { parents, labels };
}

export const parentsOf = (w, roomId, id) => arrowsInto(w, roomId, id).parents;
export const childrenOf = (w, roomId, id) => groupsIn(w, roomId, ID).filter((g) => parentsOf(w, roomId, g.id).includes(id)).map((g) => g.id);
export const labelOf = (w, roomId, parent, child) => arrowsInto(w, roomId, child).labels[parent] || '';

// Every arrow in the room: [{ from, to, label }].
export function arrows(w, roomId) {
  const out = [];
  for (const g of chapters(w, roomId)) {
    const { parents, labels } = arrowsInto(w, roomId, g.id);
    for (const p of parents) out.push({ from: p, to: g.id, label: labels[p] || '' });
  }
  return out;
}

// True if `a` is `b` or one of b's ancestors.
export function above(w, roomId, a, b, seen = new Set()) {
  if (a === b) return true;
  if (seen.has(b)) return false;
  seen.add(b);
  return parentsOf(w, roomId, b).some((p) => above(w, roomId, a, p, seen));
}

// Why an arrow from parent to child can't be drawn, or '' when it can.
export function whyNot(w, roomId, parent, child) {
  if (!isChapter(w, roomId, parent) || !isChapter(w, roomId, child)) return 'Arrows join two chapters.';
  if (parent === child) return 'A chapter can\'t be its own parent.';
  const has = parentsOf(w, roomId, child);
  if (has.includes(parent)) return 'That arrow is already there.';
  if (has.length >= MOST_PARENTS) return 'A chapter has at most two parents.';
  if (above(w, roomId, child, parent)) return 'That arrow would make a loop.';
  return '';
}

// ---- Changing the tree ----

// Draws an arrow from parent to child (with a label). Returns '' when drawn, or why not.
export function link(w, roomId, parent, child, label = '') {
  const why = whyNot(w, roomId, parent, child);
  if (why || shut(w, roomId)) return why || 'This room is locked.';
  const mine = own(w, roomId, ID);
  const a = (mine[child] = { parents: parentsOf(w, roomId, child), labels: { ...arrowsInto(w, roomId, child).labels } });
  a.parents.push(parent);
  const text = String(label || '').trim();
  if (text) a.labels[parent] = text;
  settle(w, roomId);
  return '';
}

export function unlink(w, roomId, parent, child) {
  if (shut(w, roomId)) return false;
  const { parents, labels } = arrowsInto(w, roomId, child);
  if (!parents.includes(parent)) return false;
  delete labels[parent];
  own(w, roomId, ID)[child] = { parents: parents.filter((p) => p !== parent), labels };
  settle(w, roomId);
  return true;
}

// What the child forgets about its parent: the arrow's label ('' takes it away).
export function setLabel(w, roomId, parent, child, text) {
  if (shut(w, roomId)) return false;
  const { parents, labels } = arrowsInto(w, roomId, child);
  if (!parents.includes(parent)) return false;
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t) labels[parent] = t; else delete labels[parent];
  own(w, roomId, ID)[child] = { parents, labels };
  return true;
}

// A new chapter in the room (empty until a thought joins it: an empty group goes), as a child of
// `parent` when given. Returns it.
export function addChapter(w, roomId, { parent = null, x = 0, y = 0 } = {}, now = Date.now()) {
  const g = create(w, roomId, { kind: 'group', of: ID, x, y }, now);
  if (!g) return null;
  if (parent && isChapter(w, roomId, parent)) own(w, roomId, ID)[g.id] = { parents: [parent], labels: {} };
  return g;
}

// After the tree changes, chapters pushed aside by clear space (not dragged) go back into the
// layout.
function settle(w, roomId) {
  for (const g of groupsIn(w, roomId, ID)) if (g.hand === 'auto') { delete g.hand; }
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
const headOf = (g) => (g?.title && !g.folded ? LAYOUT.title : 0);

// A chapter's box as drawn: a closed one is only its name; an open one its title and thoughts.
// Until they are measured, names and thoughts are guessed from their length.
export function chapterSize(w, id) {
  const g = w.things[id];
  if (g?.folded) return { w: Math.round(WIDTHS.get(id) || chapterName(w, id).length * 12.6 + 4), h: LAYOUT.closed };
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
  // The biggest label on an arrow into each chapter.
  const lab = Object.fromEntries(all.map((g) => {
    const ls = Object.values(arrowsInto(w, roomId, g.id).labels).map(labelSize);
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
      if (g.hand) { centre[r.id] = g.x + half; out[r.id] = { x: g.x, y: g.y }; continue; }
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
export function chapterName(w, id) {
  const g = w.things[id];
  if (!g) return '';
  if (g.title) return g.title;
  const first = members(w, id)[0];
  const words = first ? thoughtText(w, first).split(/\s+/).slice(0, 3).join(' ') : '';
  return words || 'A chapter';
}

// The chapter chosen in a room: the one chosen whole, or the one a chosen thought is in.
export function chosenChapter(c) {
  const id = c.sel?.id;
  const th = id && c.world.things[id];
  if (!th) return null;
  if (isGroup(th)) return th.of === ID ? th.id : null;
  return groupOf(c.world, id, ID)?.id || null;
}

// ---- On the canvas ----

// A move waiting for a click on a chapter: { room, child, kind: 'add' | 'cut' } (Add second
// parent: click the parent; Remove arrow, from a junction: click the parent to cut it from).
let pending = null;

const svg = (name, attrs = {}) => {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const FOOT = 16; // how far under a chapter its foot sits
const RULE = 14; // how far left of an open chapter's thoughts its hairline runs

// A chapter's box for arrows: what is drawn (an open chapter's hairline is kept clear by its pad).
const arrowBox = ({ at, size }) => ({ x: at.x, y: at.y, w: size.w, h: size.h });
const foot = (box) => sidePoint(box, 'bottom', FOOT);
// How far off each side an arrow starts (below a chapter's foot circle; past an open chapter's
// hairline on its left) and ends (a little further, so the arrowhead shows).
const pads = (w, from, to) => {
  const off = (id, side, more) => (side === 'left' && !w.things[id]?.folded ? RULE : 0) + PAD + more;
  return { from: (side) => (side === 'bottom' ? FOOT + 7 : off(from, side, 0)), to: (side) => off(to, side, 2) };
};

// Each chapter's corner and size, as drawn now.
function boxes(w, roomId) {
  const places = layout(w, roomId);
  const out = {};
  for (const g of chapters(w, roomId)) if (places[g.id]) out[g.id] = { at: places[g.id], size: chapterSize(w, g.id) };
  return out;
}

// The chapter under a pointer: the drawn chapter it is over, or the nearest box.
function chapterUnder(c, ev) {
  const n = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('[data-group]');
  const g = n && c.world.things[n.dataset.group];
  if (g && g.of === ID) return g.id;
  const p = c.toWorld(ev.clientX, ev.clientY);
  return chapterAt(c.world, c.roomId, p.x, p.y);
}

// Draws an arrow by dragging from a chapter's foot onto another chapter.
function dragArrow(c, e, from) {
  const layer = c.world$?.querySelector('.room-russell-arrows');
  const b = boxes(c.world, c.roomId)[from];
  if (!layer || !b) return;
  const p = foot(arrowBox(b));
  const line = c.setting('line') || 'straight';
  const drawn = svg('path', { class: 'room-russell-arrow room-russell-drawing', 'marker-end': 'url(#russell-head)' });
  layer.append(drawn);
  const move = (ev) => { const q = c.toWorld(ev.clientX, ev.clientY); drawn.setAttribute('d', arrowLine({ p, q, from: 'bottom', to: 'top' }, line)); };
  const up = (ev) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    drawn.remove();
    if (ev.type !== 'pointerup') return;
    const to = chapterUnder(c, ev);
    if (!to || to === from) { c.drawWorld(); return; }
    const why = link(c.world, c.roomId, from, to);
    if (why) c.toast(why);
    c.save();
    c.drawWorld();
  };
  move(e);
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

// ---- The ontology ----

export default {
  id: ID,
  name: 'Russell',
  note: 'chapters in a tree',
  order: 30,
  groups: { form: 'chapter', name: 'Chapter', membership: 'one' },
  settings: [{ key: 'line', label: 'Arrows', type: 'choice', options: [['straight', 'Straight'], ['curved', 'Curved']], default: 'straight' }],

  // Each chapter's thoughts, or a folded chapter as one thought.
  units: (w, roomId) => chapters(w, roomId).flatMap((g) => (g.folded ? [g] : members(w, g.id))),

  point(w, roomId, id) {
    const th = w.things[id];
    const g = isGroup(th) ? th : groupOf(w, id, ID);
    if (!g || g.parent !== roomId) return null;
    const at = layout(w, roomId)[g.id];
    if (!at) return null;
    return g === th || g.folded ? at : chapterSpots(w, g.id, at)[id] || null;
  },

  // A chapter dragged stays where it is let go (placed by hand). A thought let go over another
  // chapter joins it; one from the tray let go on the empty canvas starts a chapter of its own
  // there (a new root).
  drop(w, roomId, id, x, y) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th)) { if (th.of === ID) Object.assign(th, { x: Math.round(x), y: Math.round(y), hand: true }); return; }
    if (!isLeaf(th)) return;
    const was = groupOf(w, id, ID);
    const onto = chapterAt(w, roomId, x + 10, y + 10, was?.id);
    if (onto) { join(w, onto, id); return; }
    if (!was) {
      const g = addChapter(w, roomId, { x: Math.round(x), y: Math.round(y) }, th.at);
      if (g) { join(w, g.id, id); g.hand = true; }
    }
  },

  // A thought kept with no chapter to go on with: a child chapter when a move asked for one
  // (draft.for.parent), or loose in the tray.
  begin(w, roomId, draft, now) {
    const parent = draft?.for?.parent;
    if (!parent || !isChapter(w, roomId, parent)) return null;
    return addChapter(w, roomId, { parent, x: draft.x, y: draft.y }, now);
  },

  // The thoughts in no chapter yet, oldest first.
  tray: (w, roomId) => roomItems(w, roomId).filter((th) => !groupOf(w, th.id, ID)),
  placed: (w, roomId, id) => !!groupOf(w, id, ID) || isGroup(w.things[id]),

  // Clear space (clear.js): a chapter is one block; one dragged was placed by hand. One pushed
  // aside keeps its new place until the tree changes.
  blocks: (w, roomId) => chapters(w, roomId).map((g) => ({
    id: g.id, thoughts: g.folded ? [] : members(w, g.id).map((th) => th.id), group: g.id,
    hand: g.hand === true, at: Math.max(g.at ?? 0, ...members(w, g.id).map((th) => th.at ?? 0)),
  })),

  shift(w, roomId, id, dx, dy) {
    const g = w.things[id];
    if (!isGroup(g) || shut(w, id)) return;
    const at = layout(w, roomId)[id];
    if (!at) return;
    Object.assign(g, { x: Math.round(at.x + dx), y: Math.round(at.y + dy) });
    if (g.hand !== true) g.hand = 'auto';
  },

  // Each thought's size as drawn: the layout follows it.
  measured: (sizes) => { const a = setHeights(sizes), b = setWidths(sizes); return a || b; },

  // A press on the canvas: a chapter's foot starts an arrow; a move waiting for a chapter takes
  // the one clicked (anywhere else lets it go).
  press(c, e) {
    if (e.button !== 0 || c.locked) return false;
    if (pending && pending.room === c.roomId) {
      const job = pending;
      pending = null;
      const to = chapterUnder(c, e);
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
    dragArrow(c, e, f.dataset.foot);
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
      id: 'parent', label: 'Add second parent',
      when: (c) => { const g = chosenChapter(c); return !!g && parentsOf(c.world, c.roomId, g).length < MOST_PARENTS; },
      run(c) {
        pending = { room: c.roomId, child: chosenChapter(c), kind: 'add' };
        c.sel = null;
        c.toast('Click the chapter to be its other parent.');
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

  // In a chapter's pop-up: each arrow into it, with what it forgets about that parent.
  props(c, th) {
    if (!isGroup(th) || th.of !== ID) return [];
    const { parents, labels } = arrowsInto(c.world, c.roomId, th.id);
    return parents.map((p) => c.el('label', { class: 'room-russell-forgets' },
      c.el('span', { class: 'pop-note' }, `From ${chapterName(c.world, p)}, it forgets`),
      c.el('input', {
        class: 'room-edit-text', value: labels[p] || '', placeholder: 'the coordinates', 'aria-label': `What it forgets about ${chapterName(c.world, p)}`,
        onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
        onchange: (e) => { setLabel(c.world, c.roomId, p, th.id, e.target.value); c.save(); c.drawWorld(); },
      })));
  },

  // The canvas: each chapter's thoughts down a hairline, a foot under it to draw arrows from, the
  // arrows down to its children with their labels, and the thought being written.
  draw(c) {
    const w = c.world, el = c.el, roomId = c.roomId;
    const all = boxes(w, roomId);
    const layer = svg('svg', { class: 'room-strands room-russell-arrows' });
    const defs = svg('defs');
    const mark = svg('marker', { id: 'russell-head', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    mark.append(svg('path', { d: 'M0 1L9 5L0 9', class: 'room-russell-head' }));
    defs.append(mark);
    layer.append(defs);
    const nodes = [];
    const picking = pending && pending.room === roomId;
    const line = c.setting('line') || 'straight';
    for (const { from, to, label } of arrows(w, roomId)) {
      const a = all[from], b = all[to];
      if (!a || !b) continue;
      // From the side of the parent that faces the child to the child's facing side; the label
      // at the arrow's middle.
      const arrow = between(arrowBox(a), arrowBox(b), pads(w, from, to));
      layer.append(svg('path', { class: 'room-russell-arrow', d: arrowLine(arrow, line), 'marker-end': 'url(#russell-head)' }));
      if (label) {
        // A junction's two arrows lean towards each other, so each label goes on the side its
        // parent is on, away from the other arrow. Arrows fanning out of one foot are close
        // together at their middles, so their labels sit further down, where they have spread.
        const prefer = parentsOf(w, roomId, to).length > 1 ? (arrow.p.x < arrow.q.x ? 'left' : 'right') : null;
        const fan = arrow.from === 'bottom' && childrenOf(w, roomId, from).length > 1;
        const spot = labelSpot(arrow, line, { prefer, t: fan ? 0.7 : 0.5 });
        nodes.push(el('div', {
          class: `room-russell-label side-${spot.side}`, 'data-group': to, title: 'What the child forgets',
          style: `left:${Math.round(spot.x)}px;top:${Math.round(spot.y)}px`,
        }, maths(label)));
      }
    }
    for (const g of chapters(w, roomId)) {
      const box = all[g.id];
      if (!box) continue;
      const { at, size } = box;
      const chosen = (c.sel?.kind === 'train' && c.sel.id === g.id) || c.isSel(g.id);
      const cls = 'room-bead' + (picking ? ' room-russell-pick' : '');
      if (g.folded) {
        // A closed chapter: only its name. A click opens it as a document (open, below).
        nodes.push(el('div', {
          class: cls + ' room-folded room-russell-closed' + (chosen ? ' selected' : ''), 'data-group': g.id, 'data-measure': g.id,
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
      if (!g.folded) layer.append(svg('path', { class: 'room-russell-rule' + (chosen ? ' selected' : ''), d: `M${at.x - RULE} ${top + 6}L${at.x - RULE} ${at.y + size.h - 4}` }));
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

  // A tap on a closed (folded) chapter opens it as a document (document.js).
  open(c, id) {
    const g = c.world.things[id];
    if (!isGroup(g) || g.of !== ID || !g.folded) return false;
    c.openDocument(id);
    return true;
  },

  // A thought's tag in the Timeline: its chapter.
  tag(w, id) {
    const g = groupOf(w, id, ID);
    return g ? { id: g.id, name: chapterName(w, g.id) } : null;
  },
};
