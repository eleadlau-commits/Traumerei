// Create's world. Everything in it is a thought, of three sorts:
//
//   item     a single thing: a line, a passage or a picture (items/, one file per kind; more
//            kinds, such as a page of a PDF, are added there)
//   group    { of, members, x, y, title, folded, keep }   items held together by an ontology.
//            `of` is the ontology that made it (Joyce makes trains); `members` lists its items.
//            Folded, a group shows as one thought (its title); every other ontology then shows it
//            as one thought too: in place of its items (Replace), or beside them (keep: Keep
//            both). Every group follows the same rules: it can be folded, named, moved and
//            deleted, and it is always the same group, never a copy.
//   room     { name, tint, light, opacity,       a thought that holds items and groups, seen
//              col, row, size, page,             through an ontology; on the rooms page it is a
//              desc, tags, locked, archived }    square of size × size cells at (col, row).
//                                                desc: a line or two about it. tags: words it is
//                                                sorted by (its ontology is one too: roomTags).
//                                                locked: nothing in it can change. archived: on
//                                                the Archive page.
//
// Every thought has { id, kind, parent, at }. An item's and a group's `parent` is its room; a
// room's is null (the rooms page). An item is in a group because the group lists it, so one item
// can be in groups of several ontologies at once. Each ontology declares whether an item can be
// in one of its groups (a train) or in several (later, Perec's sets): see declareGroups.
//
// A small room (1 × 1) holds the one ontology it was made with; a big room (Messy thoughts, or any
// 2 × 2 room) holds them all over the same thoughts and switches between them inside (its view's
// mode). The ontologies themselves are in ontologies/.
//
// world = {
//   v: 3,
//   things: { [id]: thought },
//   views:  { [room]: { mode, x, y, zoom } }      each room's ontology and where it was looked at
//   own:    { [room]: { [ontology]: { … } } }     each ontology's own data in a room (own())
//   settings: { [room]: { [ontology]: { key: value } } }   each room's own ontology settings
//   pages:  n                                     how many pages the rooms page has (at least 1)
// }
//
// No screen here, so it can be tested on its own (tests/model.test.js).

import { ITEMS } from './items/index.js';

export const MESSY = 'messy';
export const DEFAULT_MODE = 'joyce';
export const LEAVES = Object.keys(ITEMS); // the kinds of item
export const KINDS = [...LEAVES, 'group', 'room'];
export const kindOf = (th) => (KINDS.includes(th?.kind) ? th.kind : 'line');
export const isLeaf = (th) => LEAVES.includes(kindOf(th));
export const isItem = isLeaf;
export const isGroup = (th) => kindOf(th) === 'group';

// How each ontology's groups hold their items: 'one' (an item is in at most one of its groups,
// and deleting the group deletes its items, as with trains) or 'many' (an item can be in several,
// and deleting the group frees them). An ontology not declared holds them as 'one'.
const MEMBERSHIP = { joyce: 'one' };
export function declareGroups(of, groups) {
  if (groups?.membership === 'many' || groups?.membership === 'one') MEMBERSHIP[of] = groups.membership;
}
export const membership = (of) => MEMBERSHIP[of] || 'one';

let counter = 0;
export function uid(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const messyRoom = (now) => ({ id: MESSY, kind: 'room', parent: null, at: now, name: 'Messy thoughts', col: 0, row: 0, size: 2 });

export function emptyWorld(now = Date.now()) {
  return { v: 3, things: { [MESSY]: messyRoom(now) }, views: {}, own: {}, settings: {}, pages: 1 };
}

// A saved world, repaired: the messy room always exists; every room sits on the rooms page; an
// item or group whose room is gone goes to the messy room, and a group forgets members that are
// gone. A world saved in an older shape is not kept: it starts afresh.
export function loadWorld(saved, now = Date.now()) {
  const w = Object.assign(emptyWorld(now), saved && typeof saved === 'object' && saved.v === 3 ? saved : {});
  for (const key of ['things', 'views', 'own', 'settings']) if (!w[key] || typeof w[key] !== 'object') w[key] = {};
  w.pages = Math.max(1, Math.floor(+w.pages) || 1);
  if (!w.things[MESSY]) w.things[MESSY] = messyRoom(now);
  for (const th of Object.values(w.things)) {
    if (kindOf(th) === 'room') { th.parent = null; continue; }
    if (kindOf(w.things[th.parent]) !== 'room') th.parent = MESSY;
  }
  for (const g of Object.values(w.things)) {
    if (!isGroup(g)) continue;
    g.members = [...new Set(Array.isArray(g.members) ? g.members : [])]
      .filter((id) => isLeaf(w.things[id]) && w.things[id].parent === g.parent);
    if (typeof g.of !== 'string' || !g.of) g.of = DEFAULT_MODE;
  }
  const messy = w.things[MESSY];
  messy.size = 2;
  delete messy.page;
  if (messy.col == null) { messy.col = 0; messy.row = 0; }
  gridAll(w);
  return w;
}

// ---- Reading ----

export const thing = (w, id) => w.things[id] || null;
export const room = (w, id) => (kindOf(w.things[id]) === 'room' ? w.things[id] : null);

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// A big room (Messy thoughts, or any 2 × 2 room) switches between the ontologies inside; a small
// one keeps the one it was made with.
export const isBig = (th) => kindOf(th) === 'room' && (th.id === MESSY || (th.size || 1) > 1);

export const children = (w, id) => Object.values(w.things).filter((th) => th.parent === id).sort(byTime);

// The rooms at the top (the rooms page, every page), oldest first; archived ones are on the Archive page.
export const rooms = (w) => children(w, null).filter((th) => kindOf(th) === 'room' && !th.archived);
// The archived rooms, in the order they were archived (`archived` holds when).
export const archived = (w) => children(w, null).filter((th) => kindOf(th) === 'room' && th.archived)
  .sort((a, b) => (+a.archived || 0) - (+b.archived || 0) || a.at - b.at);
// The rooms on one page of the rooms page.
export const roomsOn = (w, page = 0) => rooms(w).filter((th) => (th.page || 0) === page);

// True if `id` is a locked room, or is somewhere inside one: then nothing about it can change.
export function shut(w, id) {
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (kindOf(th) === 'room' && th.locked) return true;
  return false;
}

// The room at the top (on the rooms page, or archived) that a thought is in.
export function topRoom(w, id) {
  let top = null;
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (kindOf(th) === 'room') top = th;
  return top;
}

// The room a thought is in (itself, if it is a room).
export function roomOf(w, id) {
  let th = w.things[id];
  while (th && kindOf(th) !== 'room') th = w.things[th.parent];
  return th || null;
}

// ---- Groups ----

// A group's items, in the order they were written.
export function members(w, groupId) {
  const g = w.things[groupId];
  return isGroup(g) ? g.members.map((id) => w.things[id]).filter(isLeaf).sort(byTime) : [];
}
// The groups in a room (of one ontology, or of all).
export const groupsIn = (w, roomId, of = null) => children(w, roomId).filter((th) => isGroup(th) && (of == null || th.of === of));
// The groups an item is in (of one ontology, or of all); and the first of them.
export const groupsOf = (w, id, of = null) => Object.values(w.things)
  .filter((g) => isGroup(g) && g.members.includes(id) && (of == null || g.of === of)).sort(byTime);
export const groupOf = (w, id, of = DEFAULT_MODE) => groupsOf(w, id, of)[0] || null;
// The items in a room, in the order they were written.
export const roomItems = (w, roomId) => children(w, roomId).filter(isLeaf);

// Puts an item into a group (of its room). Where the group's ontology lets an item be in only one
// of its groups, the item leaves the one it was in.
export function join(w, groupId, id) {
  const g = w.things[groupId], th = w.things[id];
  if (!isGroup(g) || !isLeaf(th) || th.parent !== g.parent || g.members.includes(id)) return false;
  if (membership(g.of) === 'one') for (const o of groupsOf(w, id, g.of)) leave(w, o.id, id);
  g.members.push(id);
  return true;
}

// Takes an item out of a group; a group left empty goes.
export function leave(w, groupId, id) {
  const g = w.things[groupId];
  if (!isGroup(g)) return false;
  g.members = g.members.filter((m) => m !== id);
  if (!g.members.length) { delete w.things[groupId]; forget(w, groupId); }
  return true;
}

// Joyce's names for the same things.
export const trainThoughts = members;
export const roomTrains = (w, roomId) => groupsIn(w, roomId, 'joyce').filter((g) => members(w, g.id).length);

// Every line, passage and picture in a room, in time order.
export const roomThoughts = roomItems;

// What floats on a canvas that places single thoughts (Pessoa): each item on its own, and a folded
// group as the one thought it is, in place of its items (or beside them, when it keeps both).
export function roomUnits(w, roomId) {
  const folded = groupsIn(w, roomId).filter((g) => g.folded && members(w, g.id).length);
  const hidden = new Set(folded.filter((g) => !g.keep).flatMap((g) => g.members));
  return [...folded, ...roomItems(w, roomId).filter((th) => !hidden.has(th.id))].sort(byTime);
}

// The folded groups other ontologies made, which ontology `of` shows as one thought each: one with
// a tray keeps them there until it places them.
export const foldedFrom = (w, roomId, of) =>
  groupsIn(w, roomId).filter((g) => g.folded && g.of !== of && members(w, g.id).length);

export function lastWritten(w, roomId) {
  const all = roomThoughts(w, roomId);
  return all.length ? Math.max(...all.map((th) => th.at)) : null;
}

export function view(w, roomId) {
  if (!w.views[roomId]) w.views[roomId] = { mode: DEFAULT_MODE, x: 0, y: 0, zoom: 1 };
  return w.views[roomId];
}

// An ontology's own data in a room: a plain object it keeps what it likes in, saved with the world.
// What it keeps under a thought's id is forgotten when that thought is removed or moved out.
// make: false only reads it (an empty object when there is none yet, not saved).
export function own(w, roomId, of, make = true) {
  if (!make) return w.own[roomId]?.[of] || {};
  const r = (w.own[roomId] ||= {});
  return (r[of] ||= {});
}
function forget(w, id, roomId = null) {
  for (const [r, mine] of Object.entries(w.own)) {
    if (roomId != null && r !== roomId) continue;
    for (const data of Object.values(mine || {})) if (data && typeof data === 'object') delete data[id];
  }
}

// ---- Each room's ontology settings ----
// A room keeps its own value for each of an ontology's settings (ontologies/index.js). Where it has
// none, the global one (Settings → Rooms) counts, then the setting's own default. A new room starts
// with a copy of the global ones; "Apply to all rooms" copies them into every room again.

const copy = (o) => JSON.parse(JSON.stringify(o || {}));

// The value of an ontology's setting s ({ key, default }) in a room. globals: { [ontology]: { key: value } }.
export function roomSetting(w, roomId, of, s, globals = {}) {
  const mine = w.settings?.[roomId]?.[of]?.[s.key];
  if (mine !== undefined) return mine;
  const global = globals?.[of]?.[s.key];
  return global !== undefined ? global : s.default;
}

export function setRoomSetting(w, roomId, of, key, value) {
  const r = ((w.settings ||= {})[roomId] ||= {});
  (r[of] ||= {})[key] = value;
}

// A room's settings for one ontology go back to the global ones (and follow them from then on).
export function resetRoomSettings(w, roomId, of) {
  if (w.settings?.[roomId]) delete w.settings[roomId][of];
}

// A room starts from the global settings.
export function seedRoomSettings(w, roomId, globals = {}) {
  (w.settings ||= {})[roomId] = copy(globals);
}

// Every room, archived ones too, takes the global settings.
export function applySettingsToAll(w, globals = {}) {
  w.settings = {};
  for (const th of Object.values(w.things)) if (kindOf(th) === 'room') w.settings[th.id] = copy(globals);
}

// The words of a thought, as plain text.
export function thoughtText(w, th) {
  const kind = kindOf(th);
  if (kind === 'group') return members(w, th.id).map((x) => thoughtText(w, x)).join('\n');
  if (kind === 'room') return th.name || '';
  return ITEMS[kind].text(th);
}

// ---- Making and changing thoughts ----

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lines = (s) => String(s ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export const DESC = 280; // a room's description, at most this many letters
export const TAG = 30; // a tag, at most this many letters

// A tag as it is kept: one line, no leading #, at most TAG letters. Empty when there is nothing.
export const tidyTag = (s) => oneLine(s).replace(/^#+\s*/, '').slice(0, TAG).trim();
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
function tidyTags(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const tag = tidyTag(t);
    if (tag && !out.some((o) => same(o, tag))) out.push(tag);
  }
  return out;
}
const clamp01 = (v, d) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : d);

// An item keeps where it was dragged to in its train (dx, dy from the train's corner), and when it
// was last changed.
function spot(f, out) {
  if (Number.isFinite(f.dx) && Number.isFinite(f.dy)) { out.dx = Math.round(f.dx); out.dy = Math.round(f.dy); }
  if (Number.isFinite(f.edited)) out.edited = f.edited;
  return out;
}

// A thought's own fields, tidied; null when an item would be empty.
function tidy(f) {
  const kind = kindOf(f);
  if (LEAVES.includes(kind)) {
    const own = ITEMS[kind].tidy(f, { oneLine, lines });
    return own ? spot(f, { kind, ...own }) : null;
  }
  if (kind === 'group') {
    const out = { kind, of: typeof f.of === 'string' && f.of ? f.of : DEFAULT_MODE,
      members: Array.isArray(f.members) ? [...new Set(f.members)] : [],
      x: Math.round(+f.x || 0), y: Math.round(+f.y || 0), title: oneLine(f.title) };
    if (f.folded) out.folded = true;
    if (f.keep) out.keep = true;
    return out;
  }
  const out = { kind, name: oneLine(f.name) || 'Untitled' };
  if (typeof f.tint === 'string' && /^#[0-9a-f]{6}$/i.test(f.tint)) out.tint = f.tint;
  if (f.light != null) out.light = clamp01(f.light, 0.5);
  if (f.opacity != null) out.opacity = clamp01(f.opacity, 1);
  if (Number.isInteger(f.col) && Number.isInteger(f.row) && f.col >= 0 && f.row >= 0) { out.col = f.col; out.row = f.row; }
  out.size = f.size === 2 ? 2 : 1;
  const desc = lines(f.desc).slice(0, DESC);
  if (desc) out.desc = desc;
  const tags = tidyTags(f.tags);
  if (tags.length) out.tags = tags;
  if (f.locked) out.locked = true;
  if (f.archived) { out.archived = Number.isFinite(f.archived) ? f.archived : true; delete out.col; delete out.row; }
  if (Number.isInteger(f.page) && f.page > 0) out.page = f.page;
  return out;
}

// What can sit inside what: items and groups in rooms, rooms at the top (null).
export function canHold(w, parent, kind) {
  const p = parent == null ? null : w.things[parent];
  if (parent != null && !p) return false;
  if (LEAVES.includes(kind) || kind === 'group') return p != null && kindOf(p) === 'room';
  if (kind === 'room') return p == null;
  return false;
}

// Puts a new thought inside `parent`: a room, or (for an item) a group, which it joins in the
// group's room. Returns it, or null (adding nothing) if it would be empty or can't go there.
export function create(w, parent, fields, now = Date.now()) {
  const th = tidy(fields);
  if (!th) return null;
  const p = parent == null ? null : w.things[parent];
  const group = isLeaf(th) && isGroup(p) ? p : null;
  const at = group ? group.parent : parent;
  if (!canHold(w, at, th.kind) || (at != null && shut(w, at))) return null;
  if (isGroup(th)) th.members = [];
  Object.assign(th, { id: uid(th.kind[0]), parent: at ?? null, at: now });
  w.things[th.id] = th;
  if (group) join(w, group.id, th.id);
  return th;
}

// Changes a thought's own fields (never its kind, place, time or members). An item left empty is
// removed.
export function update(w, id, fields, now = Date.now()) {
  const th = w.things[id];
  if (!th || (kindOf(th) !== 'room' && shut(w, id))) return null; // a room itself can still be renamed, coloured or unlocked
  const next = tidy({ ...th, ...fields, kind: th.kind, edited: now });
  if (!next) { remove(w, id); return null; }
  if (isGroup(th)) {
    next.members = th.members;
    next.of = th.of;
    if (!next.folded) delete th.folded;
    if (!next.keep) delete th.keep;
  }
  if (kindOf(th) === 'room') for (const k of ['desc', 'tags', 'locked', 'archived', 'page', 'col', 'row']) if (!(k in next)) delete th[k];
  Object.assign(th, next);
  return th;
}

// Removes a thought and everything inside it: a room's items and groups; a group's items too, when
// its ontology holds each item in only one group (a train). An item leaves every group it was in,
// and a group left empty goes. Messy thoughts stays.
export function remove(w, id) {
  const th = w.things[id];
  if (!th || id === MESSY || shut(w, id)) return;
  delete w.things[id];
  for (const c of children(w, id)) remove(w, c.id);
  if (isGroup(th) && membership(th.of) === 'one') for (const m of th.members) remove(w, m);
  if (isLeaf(th)) for (const g of groupsOf(w, id)) leave(w, g.id, id);
  forget(w, id);
  delete w.views[id];
  delete w.own[id];
}

// ---- The shared operations ----

// True if `id` is `ancestor`, or somewhere inside it.
export function inside(w, id, ancestor) {
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (th.id === ancestor) return true;
  return false;
}

// An item comes into another room: it leaves its groups in the old one, and what was kept about it
// there is forgotten.
function rehome(w, th, to) {
  const from = th.parent;
  for (const g of groupsOf(w, th.id)) if (g.parent === from) leave(w, g.id, th.id);
  forget(w, th.id, from);
  th.parent = to;
}

// Moves a thought into `into` (a room, or a group). A group moves to another room with its items;
// an item put into a group joins it; an item put into a room gets a train of its own there (at x,
// y: Joyce holds every item in a train), and the rest of its old train stays joined. Never into
// itself.
export function move(w, id, into, x = 0, y = 0) {
  const th = w.things[id], to = w.things[into];
  if (!th || !to || th.parent === into && !isLeaf(th) || inside(w, into, id) || shut(w, id) || shut(w, into)) return false;
  if (isGroup(th)) {
    if (kindOf(to) !== 'room') return false;
    const from = th.parent;
    for (const m of members(w, id)) {
      for (const g of groupsOf(w, m.id)) if (g.id !== id && g.parent === from) leave(w, g.id, m.id);
      forget(w, m.id, from);
      m.parent = into;
    }
    forget(w, id, from);
    Object.assign(th, { parent: into, x: Math.round(x), y: Math.round(y) });
    return true;
  }
  if (!isLeaf(th)) return false; // a room never goes inside anything
  if (isGroup(to)) {
    if (to.members.includes(id)) return false;
    if (th.parent !== to.parent) rehome(w, th, to.parent);
    return join(w, into, id);
  }
  if (kindOf(to) !== 'room') return false;
  const train = create(w, into, { kind: 'group', of: 'joyce', x, y }, th.at);
  if (!train) return false;
  rehome(w, th, into);
  return join(w, train.id, id);
}

// Names a thought: a room's name, a group's or a passage's title.
export function name(w, id, text) {
  const th = w.things[id];
  if (th) update(w, id, kindOf(th) === 'room' ? { name: text } : { title: text });
}

// A group folds into one thought, and unfolds back; its items and their order never change.
// keep: other ontologies show it beside its items (Keep both), not in their place (Replace).
export function fold(w, groupId, title, keep = false) {
  if (!isGroup(w.things[groupId])) return false;
  update(w, groupId, { folded: true, keep, ...(title != null ? { title } : {}) });
  return true;
}
export function unfold(w, groupId) {
  const g = w.things[groupId];
  if (!isGroup(g) || !g.folded || shut(w, groupId)) return false;
  delete g.folded;
  delete g.keep;
  return true;
}

// ---- Shortcuts the screens use ----

// A new room on a page of the rooms page (`where`: { page }), in `cell` if it is free, or the first
// free one. `kind`: its ontology ('joyce', 'pessoa', …).
export function addRoom(w, text = 'Untitled', now, cell = null, cols = 6, where = {}, kind = DEFAULT_MODE) {
  const page = where.page || 0;
  const r = create(w, null, { kind: 'room', name: text, ...(cell || {}), page }, now);
  if (!r) return null;
  if (typeof kind === 'string' && kind) view(w, r.id).mode = kind;
  if (!cell || !placeRoom(w, r.id, cell.col, cell.row, cols)) {
    delete r.col; delete r.row;
    gridRooms(w, cols, page);
  }
  return r;
}

// ---- The rooms page's grid ----

// The cells a room covers.
export function cells(r) {
  const out = [];
  for (let dc = 0; dc < (r.size || 1); dc++) for (let dr = 0; dr < (r.size || 1); dr++) out.push([r.col + dc, r.row + dr]);
  return out;
}

// The room at a cell of a page (other than `except`), or null.
export function roomAt(w, col, row, except = null, page = 0) {
  return roomsOn(w, page).find((r) => r.id !== except && r.col != null && cells(r).some(([c, rr]) => c === col && rr === row)) || null;
}

// Puts a room at (col, row) of its page if all its cells are free. Returns whether it moved.
export function placeRoom(w, id, col, row, cols = Infinity) {
  const r = room(w, id);
  if (!r || r.locked || r.archived || col < 0 || row < 0 || col + (r.size || 1) > cols) return false;
  const want = cells({ ...r, col, row });
  if (want.some(([c, rr]) => roomAt(w, c, rr, id, r.page || 0))) return false;
  r.col = col;
  r.row = row;
  return true;
}

// Every page's rooms given a place.
export function gridAll(w, cols = 6) {
  for (const page of new Set(rooms(w).map((r) => r.page || 0))) gridRooms(w, cols, page);
}

// Gives every room on one page without a place the first free cell (left to right, top to bottom,
// `cols` wide), and returns the page's rooms.
export function gridRooms(w, cols = 6, page = 0) {
  const all = roomsOn(w, page).sort((a, b) => (b.id === MESSY) - (a.id === MESSY));
  const taken = new Set();
  const free = (r, col, row) => cells({ ...r, col, row }).every(([c, rr]) => !taken.has(`${c},${rr}`));
  for (const r of all) {
    if (r.col == null || !free(r, r.col, r.row)) {
      for (let i = 0; ; i++) {
        const col = i % cols, row = Math.floor(i / cols);
        if (col + (r.size || 1) <= cols && free(r, col, row)) { r.col = col; r.row = row; break; }
      }
    }
    for (const [c, rr] of cells(r)) taken.add(`${c},${rr}`);
  }
  return roomsOn(w, page);
}

// ---- Pages ----

// Moves a room to another page, at the first free cell there (not Messy thoughts, nor a locked room).
export function toPage(w, id, page = 0, cols = 6) {
  const r = room(w, id);
  if (!r || id === MESSY || r.locked || r.archived || (r.page || 0) === page) return false;
  delete r.col; delete r.row;
  if (page > 0) r.page = page; else delete r.page;
  gridRooms(w, cols, page);
  return true;
}

// The rooms page's pages: at least one, and enough for every room on them.
export const pageCount = (w) => Math.max(w.pages || 1, ...rooms(w).map((r) => (r.page || 0) + 1));
export function addPage(w) { w.pages = pageCount(w) + 1; return w.pages - 1; }
export const startTrain = (w, roomId, x, y, now) => create(w, roomId, { kind: 'group', of: 'joyce', x, y }, now);
export const addThought = (w, trainId, text, now) => create(w, trainId, { kind: 'line', text }, now);

// ---- Where things go ----

// A random spot in the box { x, y, w, h } (world units), as far as it can find from the points
// already there: the best of a few random tries.
export function randomSpot(box, taken = [], random = Math.random, tries = 24) {
  let best = null;
  let bestD = -1;
  for (let i = 0; i < tries; i++) {
    const p = { x: box.x + random() * box.w, y: box.y + random() * box.h };
    const d = taken.length ? Math.min(...taken.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : 0;
    if (d > bestD) { best = p; bestD = d; }
  }
  return best;
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---- Search: every thought, group and room whose words hold the query ----

export function search(w, query, most = 30) {
  const q = oneLine(query).toLowerCase();
  if (!q) return [];
  const out = [];
  for (const th of Object.values(w.things).sort(byTime).reverse()) {
    const kind = kindOf(th);
    const text = kind === 'group' ? th.title || '' : kind === 'room' ? th.name || '' : thoughtText(w, th);
    if (!oneLine(text).toLowerCase().includes(q)) continue;
    const r = roomOf(w, kind === 'room' ? th.id : th.id);
    out.push({ id: th.id, kind, text, room: r?.id ?? null, roomName: r?.name ?? '' });
    if (out.length >= most) break;
  }
  return out;
}

// A room's size on the grid (1 or 2 cells a side), if the cells it would take are free.
export function sizeRoom(w, id, size, cols = Infinity) {
  const r = room(w, id);
  if (!r || r.locked) return false;
  const was = r.size || 1;
  r.size = size === 2 ? 2 : 1;
  if (r.col == null || placeRoom(w, id, r.col, r.row, cols)) return true;
  r.size = was;
  return false;
}

// ---- The rooms page: lock, archive, peek, search lights ----

// Locks or unlocks a room: locked, nothing in it can be written, moved or deleted, and its square
// stays where it is.
export function lock(w, id, on = true) {
  const r = room(w, id);
  if (!r) return false;
  if (on) r.locked = true; else delete r.locked;
  return true;
}

// Takes a room off the grid to the Archive page (not Messy thoughts, nor a locked room).
export function archive(w, id, now = Date.now()) {
  const r = room(w, id);
  if (!r || id === MESSY || r.locked || r.archived) return false;
  r.archived = now;
  delete r.col;
  delete r.row;
  return true;
}

// Brings an archived room back to the grid: to `cell` if it is free, or the first free one.
export function restore(w, id, cell = null, cols = 6) {
  const r = room(w, id);
  if (!r || !r.archived) return false;
  delete r.archived;
  if (!cell || !placeRoom(w, id, cell.col, cell.row, cols)) gridRooms(w, cols, r.page || 0);
  return true;
}

// ---- Tags ----
// A room's tags are the words the rooms page sorts it by. Its ontology is a tag of its own that
// can't be taken off: a small room's one mode, or every mode for a big room (Messy thoughts, or
// any 2 × 2 room). The rest are the room's own (`tags`), added and taken off in its properties.
// Tags are the same whatever their case: "Algebra" and "algebra" are one tag.

// A room's tags, its ontology's first: [{ tag, auto }]. ontologies: [{ id, name }], all there are.
export function roomTags(w, id, ontologies = []) {
  const r = room(w, id);
  if (!r) return [];
  const mode = view(w, id).mode;
  const names = isBig(r) ? ontologies.map((o) => o.name)
    : [ontologies.find((o) => o.id === mode)?.name || ''].filter(Boolean);
  const out = names.map((tag) => ({ tag, auto: true }));
  for (const tag of r.tags || []) if (!out.some((o) => same(o.tag, tag))) out.push({ tag, auto: false });
  return out;
}

// Adds a tag to a room. False if it is empty, or the room has it already.
export function addTag(w, id, text, ontologies = []) {
  const r = room(w, id), tag = tidyTag(text);
  if (!r || !tag || roomTags(w, id, ontologies).some((o) => same(o.tag, tag))) return false;
  r.tags = [...(r.tags || []), tag];
  return true;
}

// Takes one of a room's own tags off (an ontology's can't be).
export function removeTag(w, id, text) {
  const r = room(w, id);
  if (!r?.tags?.some((t) => same(t, text))) return false;
  r.tags = r.tags.filter((t) => !same(t, text));
  if (!r.tags.length) delete r.tags;
  return true;
}

// Every tag on the rooms page (and in the Archive too, with shelf), with how many rooms have it:
// [{ tag, n }], the ontologies' first (in their order), then the rest by name.
export function allTags(w, ontologies = [], shelf = false) {
  const counts = new Map();
  const all = shelf ? [...rooms(w), ...archived(w)] : rooms(w);
  for (const r of all) {
    for (const { tag } of roomTags(w, r.id, ontologies)) {
      const key = tag.toLowerCase();
      const had = counts.get(key);
      counts.set(key, { tag: had?.tag || tag, n: (had?.n || 0) + 1 });
    }
  }
  const order = ontologies.map((o) => o.name.toLowerCase());
  const rank = (t) => { const i = order.indexOf(t.tag.toLowerCase()); return i < 0 ? order.length : i; };
  return [...counts.values()].sort((a, b) => rank(a) - rank(b) || a.tag.localeCompare(b.tag));
}

// True if a room has a tag (whatever its case).
export const hasTag = (w, id, tag, ontologies = []) => roomTags(w, id, ontologies).some((o) => same(o.tag, tidyTag(tag)));

// The last few things written in a room (newest last), as plain text, for its square's peek.
export function peek(w, roomId, most = 3) {
  return roomThoughts(w, roomId).slice(-most).map((th) => oneLine(thoughtText(w, th))).filter(Boolean);
}

// Search lights: for each room, how many of its thoughts (and its name) hold the query.
export function roomHits(w, query) {
  const out = {};
  for (const f of search(w, query, Infinity)) {
    const at = topRoom(w, f.id);
    if (at) out[at.id] = (out[at.id] || 0) + 1;
  }
  return out;
}
