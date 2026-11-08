// The six tables as the kernel names them (KERNEL.md), read off the world and written back: what
// every carrier moves (Law 8: the file is the tables). No plugin is needed for any of it: a mark
// of a kind whose plugin is off goes out and comes back exactly as it was. No screen here
// (tests/tables.test.js).
//
//   marks     { id, body: { kind, content }, material?, at, edited? }
//             content: the kind's own fields (`text` its words, `title` or `name` its name; a
//             room's `rules` its rules' settings and `mode` the rule it is seen through); material:
//             the mark's own look (a room's tint, light, opacity, size)
//   places    { mark, context, rule?, position?, pinned? }
//   links     { from, to, kind, order?, rule?, label?, note? }
//   distance  { context, reader }
//   gaps      { mark, direction, state, openedAt, resolvedAt?, resolvedBy? }
//   moments   { time, kind, mark }   a mark's history: when it was made, written, moved, visited
//
// Ids are the world's; `rows(tables)` writes no ids of rows but marks', since a place's, a link's,
// a gap's and a distance row's id is made from what it joins.

import * as L from './links.js';
import * as P from './places.js';
import * as G from './gaps.js';
import * as D from './distance.js';

export const NAMES = Object.freeze(['marks', 'places', 'links', 'distance', 'gaps', 'moments']);
export const MATERIAL = Object.freeze(['tint', 'light', 'opacity', 'size']);
const OWN = new Set(['id', 'kind', 'at', 'edited']);
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const kindOf = (th) => (typeof th?.kind === 'string' && th.kind ? th.kind : 'line');
const isRoom = (th) => kindOf(th) === 'room';

// A thought as a mark row, and back (a room's mode rides in its content: views are the screen's).
export function markOf(th, mode = null) {
  const content = {}, material = {};
  for (const [k, v] of Object.entries(th)) {
    if (OWN.has(k) || v === undefined) continue;
    if (isRoom(th) && MATERIAL.includes(k)) material[k] = clone(v);
    else content[k] = clone(v);
  }
  if (mode && isRoom(th)) content.mode = mode;
  const out = { id: th.id, body: { kind: kindOf(th), content }, at: th.at };
  if (Object.keys(material).length) out.material = material;
  if (Number.isFinite(th.edited)) out.edited = th.edited;
  return out;
}
export function thingOf(m) {
  const { mode, ...content } = m.body?.content || {};
  const th = { id: String(m.id), kind: String(m.body?.kind || 'line'), at: Number.isFinite(m.at) ? m.at : 0, ...clone(content), ...clone(m.material || {}) };
  if (Number.isFinite(m.edited)) th.edited = m.edited;
  return { th, mode: typeof mode === 'string' ? mode : null };
}

// The marks a carrier takes for `root` (a context, or null for the whole world): the root and
// everything that sits in it, however deep (folded-away marks too: they keep their home rows).
export function marksUnder(w, root) {
  if (root == null) return new Set(Object.keys(w.things));
  const out = new Set();
  if (!w.things[root]) return out;
  const stack = [root];
  while (stack.length) {
    const c = stack.pop();
    if (out.has(c)) continue;
    out.add(c);
    for (const m of P.marksIn(w, c)) stack.push(m);
  }
  return out;
}

// The marks a carrier takes for a group: the group and its parts however deep (what is part of
// it, and what a fold among them stands for); `outer` is the room they sit in, which the rows name
// but the file does not hold.
export function scopeOf(w, root) {
  const th = root == null ? null : w.things[root];
  if (kindOf(th) !== 'group') return { ids: marksUnder(w, root), outer: null };
  const ids = new Set(), stack = [root];
  while (stack.length) {
    const m = stack.pop();
    if (ids.has(m)) continue;
    ids.add(m);
    for (const r of L.to(w, m, 'part of')) stack.push(r.from);
    for (const r of L.from(w, m, 'stands for')) stack.push(r.to);
  }
  return { ids, outer: P.home(w, root) };
}

const byId = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const rowOut = (r) => { const { id, ...rest } = r; return rest; };

// The six tables of `root` (null: the whole world; a group: it and its parts, scopeOf), each a
// list in a steady order. `log`: the moments log, for each mark's history (left out: none).
export function read(w, root = null, { log = null } = {}) {
  const { ids, outer } = scopeOf(w, root);
  const has = (id) => ids.has(id);
  const inside = (r) => has(r.mark) && (has(r.context) || (outer != null && r.context === outer));
  const marks = [...ids].sort(byId).map((id) => markOf(w.things[id], w.views?.[id]?.mode ?? null));
  const places = P.all(w).filter(inside).sort((a, b) => byId(a.id, b.id)).map(rowOut);
  const links = L.all(w).filter((r) => has(r.from) && has(r.to)).sort((a, b) => byId(a.id, b.id)).map(rowOut);
  const distance = D.all(w).filter((r) => has(r.context)).sort((a, b) => byId(a.id, b.id)).map(rowOut);
  const gaps = G.all(w).filter((r) => has(r.mark)).sort((a, b) => byId(a.id, b.id)).map(rowOut);
  return clone({ marks, places, links, distance, gaps, moments: log ? history(log, ids) : [] });
}

// What the log knows of these marks, as moments rows { time, kind, mark }, oldest first: their
// own rows and visits (a told row, from a file, says the kind it was told as). A mark told of by
// a file was made when the file says, so the made row its landing wrote is left out.
export function history(log, ids) {
  const told = new Set(log.rows.filter((r) => r.kind === 'told' && ids.has(r.mark) && r.said === 'made').map((r) => r.mark));
  const out = [];
  for (const r of log.rows) {
    const mark = r.mark ?? (r.kind === 'visited' ? r.context : null);
    if (mark == null || !ids.has(mark)) continue;
    if (r.kind === 'told') out.push({ time: r.time, kind: r.said, mark });
    else if (['made', 'edited', 'moved', 'removed', 'visited'].includes(r.kind) && !(r.kind === 'made' && told.has(mark))) out.push({ time: r.time, kind: r.kind, mark });
  }
  return out.sort((a, b) => a.time - b.time);
}

// ---- Writing tables into a world ----

// Fresh ids for every mark of `tables` but those in `keep` ({ [file id]: world id } fixed ahead).
export function renaming(tables, keep = {}, uid = () => Math.random().toString(36).slice(2)) {
  const ids = { ...keep };
  for (const m of tables.marks) if (!(m.id in ids)) ids[m.id] = `${String(m.body?.kind || 'x')[0]}${uid()}`;
  return ids;
}

// Lands `tables` in `w`, its marks' ids renamed by `ids` (every mark of the tables named; a mark
// renamed to one already in the world takes it over). Rows whose ends are not marks go (Law 1).
// Returns the moments rows told ({ time, kind, mark }, renamed) for the caller's log.
export function write(w, tables, ids) {
  const to = (id) => ids[id] ?? null;
  for (const m of tables.marks) {
    const id = to(m.id);
    if (id == null) continue;
    const { th, mode } = thingOf(m);
    th.id = id;
    w.things[id] = th;
    if (mode && isRoom(th)) (w.views ||= {})[id] = { ...(w.views?.[id] || { x: 0, y: 0, zoom: 1 }), mode };
  }
  const there = (id) => id != null && !!w.things[id];
  for (const r of tables.places) {
    const mark = to(r.mark), context = to(r.context);
    if (!there(mark) || !there(context)) continue;
    const row = { mark, context };
    if (r.rule != null) row.rule = String(r.rule);
    if (r.position != null) row.position = clone(r.position);
    if (r.pinned) row.pinned = true;
    if (row.rule == null) P.setHome(w, mark, context, row.position ?? null); else P.set(w, row);
  }
  for (const r of tables.links) {
    const from = to(r.from), at = to(r.to);
    if (!there(from) || !there(at) || !L.KINDS.includes(r.kind)) continue;
    const row = { from, to: at, kind: r.kind };
    for (const k of ['order', 'rule', 'label', 'note']) if (r[k] != null) row[k] = clone(r[k]);
    const id = r.kind === 'part of' ? L.partId(at, from) : r.kind === 'stands for' ? L.forId(from, at) : L.relId(row.rule || 'relation', from, at);
    L.set(w, id, row);
  }
  for (const r of tables.distance) { const c = to(r.context); if (there(c)) D.declare(w, c, r.reader); }
  for (const r of tables.gaps) {
    const mark = to(r.mark);
    if (!there(mark) || !G.DIRECTIONS.includes(r.direction) || !G.STATES.includes(r.state)) continue;
    const row = { ...clone(r), mark };
    if (row.resolvedBy != null && row.resolvedBy !== G.JUDGEMENT) row.resolvedBy = String(row.resolvedBy).split(':').map((p) => ids[p] ?? p).join(':');
    G.set(w, row);
  }
  return (tables.moments || []).map((r) => ({ time: +r.time, kind: String(r.kind), mark: to(r.mark) })).filter((r) => Number.isFinite(r.time) && there(r.mark));
}

// Takes away the marks of a scope (scopeOf) and every row that is theirs alone, before the
// edited tables are written back in their place: links between two of them, their gaps, readers
// and places (but the root's place in the context above it). A link from one of them to a mark
// outside stays, for the mark may come back under its id; repair takes it if it does not.
export function clear(w, { ids }, root) {
  for (const id of ids) {
    for (const r of [...L.from(w, id), ...L.to(w, id)]) if (ids.has(r.from) && ids.has(r.to)) L.drop(w, r.id);
    G.drop(w, id);
    D.drop(w, id);
    for (const r of P.of(w, id)) if (id !== root || ids.has(r.context)) P.drop(w, r.id);
    delete w.things[id];
  }
}
