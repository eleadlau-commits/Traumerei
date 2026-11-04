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

export const ID = 'russell';
export const MOST_PARENTS = 2;
export const LAYOUT = { width: 380, gapX: 70, gapY: 110, head: 0 }; // world units

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
// as its widest thought. The heights are Joyce's (stepAfter), measured the same way.
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
const widest = (w, id) => Math.max(0, WIDTHS.get(id) || 0, ...members(w, id).map((th) => WIDTHS.get(th.id) || 0));

export function chapterSize(w, id) {
  const g = w.things[id];
  if (g?.folded) return { w: widest(w, id) || LAYOUT.width, h: STEP.group };
  const ths = members(w, id);
  const h = LAYOUT.head + ths.reduce((s, th, i) => s + (i < ths.length - 1 ? stepAfter(th) : Math.max(STEP.line, stepAfter(th) - 29)), 0);
  return { w: Math.min(LAYOUT.width, widest(w, id) || LAYOUT.width), h: Math.max(STEP.line, h) };
}

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
// children hang under it. Then each level is swept left to right so no two overlap.
export function layout(w, roomId, size = (id) => chapterSize(w, id)) {
  const all = chapters(w, roomId);
  const lv = levels(w, roomId);
  const sz = Object.fromEntries(all.map((g) => [g.id, size(g.id)]));
  const ps = Object.fromEntries(all.map((g) => [g.id, parentsOf(w, roomId, g.id).filter((p) => sz[p])]));
  // The tree children: those with a single parent.
  const kids = Object.fromEntries(all.map((g) => [g.id, []]));
  for (const g of all) if (ps[g.id].length === 1) kids[ps[g.id][0]].push(g.id);
  const span = {};
  const spanOf = (id) => span[id] ??= Math.max(sz[id].w, kids[id].reduce((s, k, i) => s + spanOf(k) + (i ? LAYOUT.gapX : 0), 0));
  // Each tree child's centre, relative to its parent's.
  const off = {};
  for (const g of all) {
    const ks = kids[g.id];
    let x = -(ks.reduce((s, k, i) => s + spanOf(k) + (i ? LAYOUT.gapX : 0), 0)) / 2;
    for (const k of ks) { off[k] = x + spanOf(k) / 2; x += spanOf(k) + LAYOUT.gapX; }
  }
  // How far down each level starts.
  const deepest = Math.max(-1, ...Object.values(lv));
  const top = [0];
  for (let l = 0; l < deepest; l++) {
    const h = Math.max(0, ...all.filter((g) => lv[g.id] === l).map((g) => sz[g.id].h));
    top.push(top[l] + h + LAYOUT.gapY);
  }
  const centre = {};
  const out = {};
  let rootX = 0;
  for (let l = 0; l <= deepest; l++) {
    const row = all.filter((g) => lv[g.id] === l).map((g) => {
      const id = g.id, p = ps[id];
      let want;
      if (!p.length) { want = rootX + spanOf(id) / 2; rootX += spanOf(id) + LAYOUT.gapX; }
      else if (p.length === 1) want = centre[p[0]] + off[id];
      else want = p.reduce((s, q) => s + centre[q], 0) / p.length;
      return { id, want };
    }).sort((a, b) => a.want - b.want || (a.id < b.id ? -1 : 1));
    let edge = -Infinity;
    for (const r of row) {
      const g = w.things[r.id], half = sz[r.id].w / 2;
      if (g.hand) { centre[r.id] = g.x + half; out[r.id] = { x: g.x, y: g.y }; continue; }
      const c = Math.max(r.want, edge + LAYOUT.gapX + half);
      edge = c + half;
      centre[r.id] = c;
      out[r.id] = { x: Math.round(c - half), y: top[l] };
    }
  }
  return out;
}

// Where each thought of a chapter sits ({ id: { x, y } }), top to bottom from its corner.
export function chapterSpots(w, id, at) {
  const out = {};
  let y = at.y + LAYOUT.head;
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

// ---- The ontology ----

export default {
  id: ID,
  name: 'Russell',
  note: 'chapters in a tree',
  order: 30,
  groups: { form: 'chapter', name: 'Chapter', membership: 'one' },

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

  // A thought's tag in the Timeline: its chapter.
  tag(w, id) {
    const g = groupOf(w, id, ID);
    return g ? { id: g.id, name: chapterName(w, g.id) } : null;
  },
};
