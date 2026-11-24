// Reading notes: collections, as Zotero has them. A collection is a group of the family
// `reading-collection` (membership many), its title its name; a source is `part of` each collection
// it is in (any number), a collection `part of` the one it sits in (at most one, at most three
// levels deep). Deleting a collection never deletes its sources (a family's group keeps its parts):
// its own collections move up to where it was. Plain functions of the read half of the tables, and
// gestures on t, each one step (t.together). Tested in tests/collections.test.js and
// app/core/api/tests/reading.test.js.
//
//   collectionTree(reads, room)        [{ id, name, depth, parent, sources, all }] in tree order
//   sourcesUnder(reads, c)             the sources of a collection and of those inside it (ids)
//   collectionsOf(reads, src)          the collections a source is in (ids)
//   newCollection(t, room, name, in?)  a new collection, at the top or inside `in`
//   renameCollection(t, c, name) · putIn · takeOut(t, src, c) · moveCollection(t, c, parent|null) · removeCollection(t, c)
//   collectionLanding(reads, c, target, zone) where a collection dragged onto a line of the tree goes

import { isSource } from './rules.js';

export const COLLECTION = 'reading-collection';
export const COLLECTION_DEPTH = 3;
export const isCollection = (m) => !!m && m.kind === 'group' && m.of === COLLECTION;

const refuseC = (reason) => ({ ok: false, reason });
const collectionName = (m) => String(m?.title || '').trim() || 'Untitled collection';
const byCollectionName = (reads) => (a, b) => collectionName(reads.marks.get(a)).localeCompare(collectionName(reads.marks.get(b)), undefined, { sensitivity: 'base' }) || String(a).localeCompare(String(b));

// The collection a collection sits in, or null (the top).
export const collectionParent = (reads, c) => reads.links.holders(c).find((g) => isCollection(reads.marks.get(g))) || null;
// The collections right inside one (or at the top of a room: in = null), by name.
export function collectionsIn(reads, room, c = null) {
  const kids = c ? reads.links.members(c).filter((id) => isCollection(reads.marks.get(id)))
    : reads.marks.in(room).filter((m) => isCollection(m) && !collectionParent(reads, m.id)).map((m) => m.id);
  return kids.sort(byCollectionName(reads));
}
// How deep a collection sits (1 at the top) and how many levels it takes (1, more with collections inside).
export const collectionDepth = (reads, c) => { let d = 0; for (let up = c; up && d < 20; up = collectionParent(reads, up)) d++; return d; };
export const collectionLevels = (reads, c) => 1 + Math.max(0, ...collectionsIn(reads, null, c).map((k) => collectionLevels(reads, k)));
// Whether `c` is `other` or holds it, however deep.
export function collectionHolds(reads, c, other) {
  for (let up = other, n = 0; up && n < 20; up = collectionParent(reads, up), n++) if (up === c) return true;
  return false;
}

// The sources right in a collection, and in it or any collection inside it.
export const sourcesInCollection = (reads, c) => reads.links.members(c).filter((id) => isSource(reads.marks.get(id)));
export function sourcesUnder(reads, c) {
  const out = new Set(sourcesInCollection(reads, c));
  for (const k of collectionsIn(reads, null, c)) for (const s of sourcesUnder(reads, k)) out.add(s);
  return [...out];
}
export const collectionsOf = (reads, src) => reads.links.holders(src).filter((g) => isCollection(reads.marks.get(g))).sort(byCollectionName(reads));

// The room's collections in tree order: [{ id, name, depth, parent, sources (right in it), all
// (in it and inside it) }].
export function collectionTree(reads, room) {
  const out = [];
  const walk = (c, depth, parent) => {
    out.push({ id: c, name: collectionName(reads.marks.get(c)), depth, parent, sources: sourcesInCollection(reads, c).length, all: sourcesUnder(reads, c).length });
    if (depth < 20) for (const k of collectionsIn(reads, room, c)) walk(k, depth + 1, c);
  };
  for (const c of collectionsIn(reads, room, null)) walk(c, 1, null);
  return out;
}

// ---- Gestures (each one step) ----

const checkCollection = (t, c) => (isCollection(t.marks.get(c)) ? null : refuseC('No such collection.'));

export function newCollection(t, room, name = '', inside = null) {
  if (inside && (checkCollection(t, inside) || collectionDepth(t, inside) >= COLLECTION_DEPTH)) return refuseC(inside && !checkCollection(t, inside) ? `Collections go ${COLLECTION_DEPTH} levels deep at most.` : 'No such collection.');
  const title = String(name || '').replace(/\s+/g, ' ').trim() || 'New collection';
  return t.together(() => {
    const r = t.marks.make({ kind: 'group', content: { title, of: COLLECTION }, in: room });
    if (r?.ok === false) return r;
    if (inside) { const l = t.links.link(r.id, inside, 'part of'); if (l?.ok === false) return l; }
    return { ok: true, id: r.id };
  });
}

export function renameCollection(t, c, name) {
  const bad = checkCollection(t, c);
  if (bad) return bad;
  const title = String(name || '').replace(/\s+/g, ' ').trim();
  if (!title) return refuseC('A collection needs a name.');
  if (title === t.marks.get(c).title) return { ok: true };
  return t.marks.edit(c, { title });
}

// A source into a collection (it stays in the others it is in).
export function putIn(t, src, c) {
  const bad = checkCollection(t, c);
  if (bad) return bad;
  if (!isSource(t.marks.get(src))) return refuseC('Only a source goes in a collection.');
  if (t.places.home(src) !== t.places.home(c)) return refuseC('That collection is in another library.');
  if (sourcesInCollection(t, c).includes(src)) return { ok: true, already: true };
  const l = t.links.link(src, c, 'part of');
  return l?.ok === false ? l : { ok: true };
}
export function takeOut(t, src, c) {
  const row = t.links.from(src, 'part of').find((l) => l.to === c);
  if (!row) return { ok: true, already: true };
  const u = t.links.unlink(row.id);
  return u?.ok === false ? u : { ok: true };
}

// A collection moved into another (or to the top: null), with all it holds.
export function moveCollection(t, c, parent) {
  const bad = checkCollection(t, c);
  if (bad) return bad;
  if (parent && checkCollection(t, parent)) return refuseC('No such collection.');
  if (parent && collectionHolds(t, c, parent)) return refuseC('A collection can\'t go inside itself.');
  if (parent && collectionDepth(t, parent) + collectionLevels(t, c) > COLLECTION_DEPTH) return refuseC(`Collections go ${COLLECTION_DEPTH} levels deep at most.`);
  const was = collectionParent(t, c);
  if (was === (parent || null)) return { ok: true, already: true };
  return t.together(() => {
    for (const l of t.links.from(c, 'part of')) if (isCollection(t.marks.get(l.to))) t.links.unlink(l.id);
    if (parent) { const l = t.links.link(c, parent, 'part of'); if (l?.ok === false) return l; }
    return { ok: true };
  });
}

// A collection deleted: its sources stay in the library (and in their other collections); the
// collections inside it move up to where it was.
export function removeCollection(t, c) {
  const bad = checkCollection(t, c);
  if (bad) return bad;
  const up = collectionParent(t, c);
  const kids = collectionsIn(t, null, c);
  return t.together(() => {
    for (const k of kids) { const r = moveCollection(t, k, up); if (r?.ok === false) return r; }
    const d = t.marks.delete(c);
    return d?.ok === false ? d : { ok: true };
  });
}

// Where a collection dragged onto the line of `target` lands, by the part of the line it is let
// go on (zone: 'before', 'into', 'after'): into it from the middle, beside it otherwise (the tree
// is by name, so beside is in the same collection). target null: the top. → { parent } or { reason }.
export function collectionLanding(reads, c, target, zone) {
  const parent = !target ? null : zone === 'into' ? target : collectionParent(reads, target);
  if (parent === c || (parent && collectionHolds(reads, c, parent))) return { reason: 'A collection can\'t go inside itself.' };
  if (parent && collectionDepth(reads, parent) + collectionLevels(reads, c) > COLLECTION_DEPTH) return { reason: `Collections go ${COLLECTION_DEPTH} levels deep at most.` };
  return { parent };
}
// The part of a line the pointer is on: 'before' (top third), 'into' (middle), 'after' (bottom). Book's treedrop.
export function zoneOf(y, top, height) {
  const f = height > 0 ? (y - top) / height : 0.5;
  return f < 1 / 3 ? 'before' : f > 2 / 3 ? 'after' : 'into';
}
