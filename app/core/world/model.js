// The world. Everything in it is a thought, of three sorts:
//
//   item     a single thing: a line, a passage or a picture (items/, one file per kind; more
//            kinds, such as a page of a PDF, are added there)
//   group    { of, x, y, title, closed, loose }   thoughts held together by an ontology.
//            `of` is the ontology that made it (Joyce makes trains, Russell chapters); what it
//            holds is the links table's part-of rows into it (links.js): items, and other groups
//            (a train of trains). No group keeps a list of its own (Law 4). A group is one
//            object shared by every ontology of its room: in the others it is one thought, in
//            their tray until placed (groups.js), and its members stay where they are there.
//            Closed, it shows as one thought (its title) in its own ontology too; that is only
//            how it shows. Every group can be closed, named, moved and deleted, and is always the
//            same group, never a copy. loose: made in its ontology's tray, and still there.
//   room     { name, tint, light, opacity,       a thought that holds items and groups, seen
//              col, row, size,                   through an ontology; on the rooms page it is a
//              desc, tags }                      square at (col, row) of its floor, its shape from
//                                                size (span()). desc: a line or two about it.
//                                                tags: words it is sorted by (its ontology is one
//                                                too: roomTags). Locked is the distance table's
//                                                (distance.js): a room for others.
//   context  { name, holds: 'rooms', n? }        a context of the top: a floor of the rooms page
//                                                (id floor:<n>) or the Archive (id archive).
//
// Every thought has { id, kind, at }. Where it is, is its home row in the places table
// (places.js): an item's and a group's home is its room; a room's is a floor, the Archive (the
// row's position says when it went and the floor it left) or, for a Twin's side, the Twin. A
// floor and the Archive have none. `parentOf` gives the room a thought is in (null for a room on a
// floor or in the Archive), `floorOf` a room's floor. An item (or a group) is in a group because a part-of link says
// so, so one item can be in groups of several ontologies at once. A group never holds itself, nor a
// group that holds it. Each ontology declares whether an item can be
// in one of its groups (a train) or in several (later, Perec's sets): see declareGroups.
//
// A small room (1 × 1) holds the one ontology it was made with; a big room (Messy thoughts, or any
// 2 × 2 room) holds them all over the same thoughts and switches between them inside (its view's
// mode). The ontologies themselves are in ontologies/.
//
// world = {
//   v: 3,
//   things: { [id]: thought },
//   links:  { [id]: { from, to, kind, … } }         the links table (links.js): part of, stands for, relation
//   places: { [id]: { mark, context, rule?, position? } }   the places table (places.js): where each thought is
//   gaps:   { [id]: { mark, direction, state, … } }  the gaps table (gaps.js)
//   ahead:  { [id]: { mark, kind, at?, note?, state, … } }  moments ahead: due, revisit, return (ahead.js)
//   distance: { [id]: { context, reader } }       the distance table (distance.js): who a context is for
//   views:  { [room]: { mode, x, y, zoom } }      each room's ontology and where it was looked at
//   own:    { [room]: { [store]: { … } } }        a plugin's data in a room that is not a position (own()); where a
//                                                 rule puts a thing is a rule row of places, never here (phase 4)
//   tagGroups: { [tag]: group }                   the group each tag is in (tag in lower case)
//   tagsMade: [tag], groupsMade: [group]          tags and groups made with + (they show with no rooms)
// }
//
// No screen here, so it can be tested on its own (tests/model.test.js).

import * as S from './spans.js';
import { kindFor } from './items/index.js';
import * as L from './links.js';
import * as P from './places.js';
import * as G from './gaps.js';
import * as A from './ahead.js';
import * as D from './distance.js';
import * as T from './tables.js';

export const MESSY = 'messy';
export const DEFAULT_MODE = 'joyce'; // the default rule before anyone chose one (World: defaultRule); read defaultMode()
// The rule a new room opens in: a plain setting (Settings → Rooms), nothing special about any rule.
// World sets it from the setting and the rules that are on; until then it is DEFAULT_MODE.
let defaultId = DEFAULT_MODE;
export const defaultMode = () => defaultId;
export function setDefaultMode(id) { if (typeof id === 'string' && id) defaultId = id; }
// A thought's kind: 'group', 'room', or an item's kind. Any item kind counts, even one whose
// plugin is switched off now (items/index.js: kindFor gives it a stand-in that keeps it as it is);
// a thought with no kind, or a malformed one, is a line.
const ITEM_KIND = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const kindOf = (th) => (typeof th?.kind === 'string' && ITEM_KIND.test(th.kind) ? th.kind : 'line');
export const isLeaf = (th) => { const k = kindOf(th); return k !== 'group' && k !== 'room' && k !== 'context'; };
export const isItem = isLeaf;
export const isGroup = (th) => kindOf(th) === 'group';

// How each ontology's groups hold their items: 'one' (an item is in at most one of its groups,
// and deleting the group deletes its items, as with trains) or 'many' (an item can be in several,
// and deleting the group frees them). An ontology not declared holds them as 'one'.
const MEMBERSHIP = { joyce: 'one' };
const MODES = new Set([DEFAULT_MODE]); // every mode that declared its groups: no family takes its id
export function declareGroups(of, groups) {
  MODES.add(of);
  if (groups?.membership === 'many' || groups?.membership === 'one') MEMBERSHIP[of] = groups.membership;
  declareOrder(of, groups);
}
export const membership = (of) => MEMBERSHIP[of] || 'one';
// How each ontology's groups order their items: by time (the order they were written, as a train
// reads) unless it declares order: 'kept', when they stay in the order they were put in (a
// Russell chapter, whose thoughts are dragged up and down it).
const KEPT = new Set();
export function declareOrder(of, groups) { if (groups?.order === 'kept') KEPT.add(of); else KEPT.delete(of); }

// Group families a plugin declares (not a mode's: a book, its chapters): { id, name, membership,
// order, card, keep, open? }. Their groups hold parts like any group (part of rows), never belong to
// a mode, and a mode never lays them out: a thought sits in a chapter and in a Proust cluster at
// once. `card`: its groups that no other group holds show as one card in every mode (placed by
// hand, or waiting in the tray), with their parts still where they are. `keep`: a group of it
// left empty stays (a new chapter with nothing in it yet). Membership is 'many' unless it says
// 'one' (deleting such a group never deletes its parts).
//
// One group concept (open core step 1a): every kind of group is said the same way, in the slot
// 'world.groups' (t.slots.groups, which World hands to declareGroupKinds): { id, name,
// membership?, order?, card?, keep?, open?(id), rule? }. With `rule`, they are that rule's own
// groups (their id is the rule's: a train is of 'joyce'), laid out by it, and Ctrl+G in that rule
// makes one; a rule may say the same on itself (its `groups`). Without `rule`, no rule lays them
// out: a family, as above. The core's own kind is PLAIN, a plain group: what Ctrl+G makes in a rule
// with no groups of its own, a card in every rule, its parts still where they are.
export const PLAIN = 'group';
const PLAIN_KIND = { id: PLAIN, name: 'Group', membership: 'many', order: 'kept', card: true, keep: false };
const RULE_GROUPS = new Map();
// A rule's own groups, said on the rule or in the slot ({ name, membership, order, … }), or null.
// Families a rule claims (its `claims`: [family ids]): it lays their groups out itself, so their
// cards don't show in it (groups.js: foreign). Declared by gather() (ontologies/index.js).
const CLAIMS = new Map();
export function declareClaims(rule, families) {
  if (Array.isArray(families) && families.length) CLAIMS.set(rule, new Set(families.filter((f) => typeof f === 'string')));
  else CLAIMS.delete(rule);
}
export const claims = (rule, family) => !!CLAIMS.get(rule)?.has(family);
export const groupsFor = (o) => o?.groups || (o?.id != null && RULE_GROUPS.get(o.id)) || null;
// The slot's kinds of group: a rule's go with that rule, the rest are families. Returns the families.
export function declareGroupKinds(list = [], warn = () => {}) {
  for (const id of RULE_GROUPS.keys()) if (!MODES.has(id)) { delete MEMBERSHIP[id]; KEPT.delete(id); }
  RULE_GROUPS.clear();
  const rest = [];
  for (const g of list) {
    if (!g || typeof g.rule !== 'string') { rest.push(g); continue; }
    if (g.id !== g.rule) { warn(g, 'an id that is its rule\'s'); continue; }
    const kind = Object.freeze({ id: g.id, rule: g.rule, name: typeof g.name === 'string' && g.name ? g.name : 'Group',
      membership: g.membership === 'many' ? 'many' : 'one', order: g.order === 'kept' ? 'kept' : 'time', ...ownFields(g, warn) });
    RULE_GROUPS.set(g.rule, kind);
    MEMBERSHIP[g.rule] = kind.membership;
    declareOrder(g.rule, kind);
  }
  return rest;
}
const FAMILIES = new Map();
export function declareFamilies(list = [], warn = () => {}) {
  for (const id of FAMILIES.keys()) { delete MEMBERSHIP[id]; KEPT.delete(id); }
  FAMILIES.clear();
  for (const f of [PLAIN_KIND, ...list]) {
    if (!f || typeof f.id !== 'string' || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(f.id)) { warn(f, 'an id of lowercase words joined by dashes'); continue; }
    if (FAMILIES.has(f.id) || MODES.has(f.id)) { warn(f, 'an id of its own, not a mode\'s'); continue; }
    const fam = Object.freeze({ id: f.id, name: typeof f.name === 'string' && f.name ? f.name : f.id, membership: f.membership === 'one' ? 'one' : 'many',
      order: f.order === 'time' ? 'time' : 'kept', card: !!f.card, keep: f.keep !== false, open: typeof f.open === 'function' ? f.open : null, ...ownFields(f, warn) });
    FAMILIES.set(f.id, fam);
    MEMBERSHIP[f.id] = fam.membership;
    if (fam.order === 'kept') KEPT.add(f.id);
  }
}
export const familyOf = (of) => FAMILIES.get(of) || null;
// A kind of group's own fields (since 1.1.1): `fields: [names]` it keeps on its groups (plain JSON
// values, saved in the .traum like any field, Law 8), and `tidy(group) → group`, its own reading
// of them. A name the core owns is refused. Returns { fields, tidy } to go on the kind, or {}.
export const GROUP_CORE_FIELDS = Object.freeze(['id', 'kind', 'of', 'title', 'closed', 'shared', 'family', 'x', 'y', 'at', 'edited', 'parent', 'members', 'archived', 'loose', 'mode']);
function ownFields(g, warn) {
  if (!Array.isArray(g.fields) || !g.fields.length) return {};
  const fields = [];
  for (const name of g.fields) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(name) || GROUP_CORE_FIELDS.includes(name)) { warn(g, `fields named as its own, not ${GROUP_CORE_FIELDS.join(', ')} (${name})`); continue; }
    if (!fields.includes(name)) fields.push(name);
  }
  return fields.length ? { fields: Object.freeze(fields), tidy: typeof g.tidy === 'function' ? g.tidy : null } : {};
}
const groupKindOf = (of) => FAMILIES.get(of) || RULE_GROUPS.get(of) || null;
// A plain JSON copy of a value, or undefined when it is none (or over 64 KB written out).
function plain(v) {
  if (v === undefined || v === null) return undefined;
  try { const s = JSON.stringify(v); return s === undefined || s.length > 65536 ? undefined : JSON.parse(s); } catch { return undefined; }
}
// A group's own fields from f, tidied by its kind (`fields`, `tidy`): kept on out. A group of a
// family no plugin declares now (its plugin off) keeps every field it has as it is: off loses nothing.
function groupFields(f, out) {
  const k = groupKindOf(out.of);
  if (!k) {
    if (out.family) for (const [name, v] of Object.entries(f)) { if (GROUP_CORE_FIELDS.includes(name) || name in out) continue; const p = plain(v); if (p !== undefined) out[name] = p; }
    return out;
  }
  if (!k.fields) return out;
  for (const name of k.fields) { const p = plain(f[name]); if (p !== undefined) out[name] = p; }
  if (k.tidy) {
    let t = null;
    try { t = k.tidy(Object.freeze(JSON.parse(JSON.stringify(out)))); } catch (err) { console.warn(`Group kind ${k.id}: tidy failed`, err); }
    if (t && typeof t === 'object') for (const name of k.fields) { if (!(name in t)) continue; const p = plain(t[name]); if (p === undefined) delete out[name]; else out[name] = p; }
  }
  return out;
}
// The fields a group's kind keeps (declared), to take off a group when a change leaves them out.
const ownFieldsOf = (g) => groupKindOf(g?.of)?.fields || [];
declareFamilies(); // the plain group, before any plugin says more
export const families = () => [...FAMILIES.values()];
// Whether a group is a card: one of a card family's (a book), shown as one thing in every mode.
export const isCard = (g) => isGroup(g) && !!FAMILIES.get(g.of)?.card;

let counter = 0;
export function uid(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const messyRoom = (now) => ({ id: MESSY, kind: 'room', at: now, name: 'Messy thoughts', size: 2 });

// The contexts of the top: the rooms page's floors and the Archive, marks of kind context.
export const ARCHIVE = 'archive';
export const FLOOR = (n) => `floor:${n || 0}`;
const floorThing = (n, now) => ({ id: FLOOR(n), kind: 'context', at: now, name: `Floor ${n + 1}`, holds: 'rooms', n });
const archiveThing = (now) => ({ id: ARCHIVE, kind: 'context', at: now, name: 'Archive', holds: 'rooms' });
export const isContext = (th) => kindOf(th) === 'context';
export const isFloor = (id) => typeof id === 'string' && /^floor:\d+$/.test(id);

export function emptyWorld(now = Date.now()) {
  const w = { v: 3, things: { [FLOOR(0)]: floorThing(0, now), [ARCHIVE]: archiveThing(now), [MESSY]: messyRoom(now) }, links: {}, places: {}, gaps: {}, distance: {}, ahead: {}, views: {}, own: {}, tagGroups: {}, tagsMade: [], groupsMade: [] };
  P.setHome(w, MESSY, FLOOR(0));
  P.putSpot(w, FLOOR(0), MESSY, CELL, { col: 0, row: 0 }); // its four squares at the top left
  return w;
}

// Where a thought is (places.js): the room it is in, or null (a room on a floor or archived);
// the context it is in, whatever it is; a room's floor (an archived room's: the one it left).
export const contextOf = (w, id) => P.home(w, id);
export const parentOf = (w, id) => { const c = P.home(w, id); return c != null && kindOf(w.things[c]) === 'room' ? c : null; };
export function floorOf(w, id) {
  const r = P.homeRow(w, id);
  if (!r) return 0;
  if (r.context === ARCHIVE) return r.position?.floor || 0;
  return isFloor(r.context) ? +r.context.slice(6) : 0;
}
// When a room was archived, or null when it is not.
export const archivedAt = (w, id) => { const r = P.homeRow(w, id); return r?.context === ARCHIVE ? r.position?.at ?? 0 : null; };
export const isArchived = (w, id) => P.home(w, id) === ARCHIVE;

// A saved world, repaired: the messy room always exists; every room is on the rooms page; an
// item or group whose room is gone goes to the messy room, and a link whose end is gone goes. A
// world saved in an older shape is not kept: it starts afresh. (A world saved before the links
// table, with `members` on its groups and arrows in the ontologies' own data, is read into the
// table once.)
export function loadWorld(saved, now = Date.now()) {
  const w = Object.assign(emptyWorld(now), saved && typeof saved === 'object' && saved.v === 3 ? saved : {});
  for (const key of ['things', 'links', 'places', 'gaps', 'distance', 'ahead', 'views', 'own', 'tagGroups']) if (!w[key] || typeof w[key] !== 'object') w[key] = {};
  for (const [roomId, set] of Object.entries(w.settings || {})) if (kindOf(w.things[roomId]) === 'room' && set && typeof set === 'object' && Object.keys(set).length) w.things[roomId].rules = set; // settings were beside the rooms once (phase 6)
  delete w.settings;
  for (const key of ['tagsMade', 'groupsMade']) w[key] = Array.isArray(w[key]) ? w[key].map(tidyTag).filter(Boolean) : [];
  P.touched(w);
  L.touched(w);
  if (!w.things[MESSY]) w.things[MESSY] = messyRoom(now);
  // A world saved before the places table says where things are on the things themselves
  // (`parent`, a room's `page` and `archived`): read into home rows once.
  // (`page` only on a room: a plugin's kind may have a field of that name, a PDF page's.)
  const legacy = Object.values(w.things).some((th) => th && ('parent' in th || (kindOf(th) === 'room' && 'page' in th) || 'archived' in th));
  const floors = Math.max(1, Math.floor(+w.pages) || 1, ...Object.values(w.things).map((th) => (kindOf(th) === 'room' && Number.isInteger(th.page) ? th.page + 1 : 1)),
    ...Object.keys(w.things).filter(isFloor).map((id) => +id.slice(6) + 1));
  delete w.pages;
  for (let n = 0; n < floors; n++) if (!isContext(w.things[FLOOR(n)])) w.things[FLOOR(n)] = floorThing(n, now);
  if (!isContext(w.things[ARCHIVE])) w.things[ARCHIVE] = archiveThing(now);
  for (const [id, th] of Object.entries(w.things)) if (isContext(th) && id !== ARCHIVE && !isFloor(id)) delete w.things[id]; // no other context of the top
  if (legacy) {
    for (const th of Object.values(w.things)) {
      if (!th || isContext(th)) continue;
      const parent = th.parent;
      if (kindOf(th) === 'room') {
        if (parent != null && isTwin(w.things[parent])) P.setHome(w, th.id, parent);
        else if (th.archived) P.setHome(w, th.id, ARCHIVE, { at: Number.isFinite(th.archived) ? th.archived : 0, floor: th.page || 0 });
        else P.setHome(w, th.id, FLOOR(th.page || 0));
      } else if (parent != null) P.setHome(w, th.id, parent);
      delete th.parent; delete th.archived;
      if (kindOf(th) === 'room') delete th.page;
    }
  }
  P.repair(w);
  for (const th of Object.values(w.things)) { // everything is somewhere (Law 2): a room on a floor, a thought in a room
    if (!th || isContext(th)) continue;
    const at = P.home(w, th.id), there = w.things[at];
    if (kindOf(th) === 'room') { if (!(isContext(there) || (isTwin(there) && !isTwin(th)))) P.setHome(w, th.id, FLOOR(0)); }
    else if (kindOf(there) !== 'room' || isTwin(there)) P.setHome(w, th.id, MESSY);
  }
  if (P.home(w, MESSY) !== FLOOR(0)) P.setHome(w, MESSY, FLOOR(0));
  for (const g of Object.values(w.things)) {
    if (!isGroup(g)) continue;
    if (typeof g.of !== 'string' || !g.of) g.of = DEFAULT_MODE;
    if (Array.isArray(g.members)) { g.members.forEach((id, i) => { if (typeof id === 'string' && !L.has(w, L.partId(g.id, id))) L.set(w, L.partId(g.id, id), { from: id, to: g.id, kind: 'part of', order: i }); }); }
    delete g.members;
  }
  for (const [roomId, stores] of Object.entries(w.own)) { // arrows kept the old way: { [child]: { parents, labels, rel } }
    for (const [store, data] of Object.entries(stores || {})) {
      for (const [child, a] of Object.entries(data || {})) {
        if (!Array.isArray(a?.parents)) continue;
        for (const p of a.parents) L.set(w, L.relId(store, child, p), { from: child, to: p, kind: 'relation', rule: store, label: a.rel?.[p] || '', note: a.labels?.[p] || '' });
        delete data[child];
      }
      if (data && !Object.keys(data).length) delete stores[store];
    }
    if (!Object.keys(stores || {}).length) delete w.own[roomId];
  }
  L.repair(w, (r) => (r.kind === 'part of' ? isGroup(w.things[r.to]) && (isLeaf(w.things[r.from]) || isGroup(w.things[r.from])) && P.home(w, r.from) === P.home(w, r.to) : true));
  G.repair(w); // a gap sits on a mark that is there (Law 1)
  A.repair(w); // and a moment ahead (phase 7)
  for (const th of Object.values(w.things)) if (th && 'locked' in th) { if (th.locked && kindOf(th) === 'room') D.declare(w, th.id, 'others'); delete th.locked; } // Lock was a field once (phase 6)
  D.repair(w, (id) => declarable(w, id)); // a reader on a context that is there (Law 1)
  for (const g of Object.values(w.things)) if (isGroup(g) && holds(w, g.id, g.id)) for (const r of L.to(w, g.id, 'part of')) if (holds(w, r.from, g.id)) L.drop(w, r.id); // no group holds itself, however deep
  const messy = w.things[MESSY];
  messy.size = 2;
  for (const th of Object.values(w.things)) if (th && !isContext(th)) placeFields(w, th, { ...th }); // phase 4: positions were fields once
  for (const [roomId, stores] of Object.entries(w.own)) { // …and rules' own data: { [thing]: { x, y } }, and the tray's { [thing]: true }
    for (const [store, data] of Object.entries(stores || {})) {
      if (!w.things[roomId] || !data || typeof data !== 'object') continue;
      for (const [id, v] of Object.entries(data)) {
        if (!w.things[id] || P.home(w, id) !== roomId) continue;
        if (store === 'tray' && v) P.putSpot(w, roomId, id, 'tray', v === true ? null : { in: { ...v } });
        else if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) P.putSpot(w, roomId, id, store, { ...v });
        else continue;
        delete data[id];
      }
      if (!Object.keys(data).length) delete stores[store];
    }
    if (!Object.keys(stores || {}).length) delete w.own[roomId];
  }
  if (!cellOf(w, MESSY)) setCell(w, MESSY, 0, 0);
  // Rooms without a cell, or outside the floor size, are placed by the floors feature (floors.settle).
  return w;
}

// ---- Reading ----

export const thing = (w, id) => w.things[id] || null;
export const room = (w, id) => (kindOf(w.things[id]) === 'room' ? w.things[id] : null);

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// A room's shape on the rooms page says how many ontologies it holds (Borges's rule): 1 × 1 holds
// one (the one it was made with), a Twin, two cells wide and one high, holds two side by side, and
// 2 × 2 (Messy thoughts, any big room) holds them all and switches between them inside. Saved as
// `size`: 1, 'twin' or 2.
export const SHAPES = { one: { w: 1, h: 1 }, twin: { w: 2, h: 1 }, all: { w: 2, h: 2 } };
export const shapeOf = (r) => (r.id === MESSY || r.size === 2 ? 'all' : r.size === 'twin' ? 'twin' : 'one');
export const span = (r) => SHAPES[shapeOf(r)];
export const isBig = (th) => kindOf(th) === 'room' && shapeOf(th) === 'all';

// (A thought a fold stands for is folded away: it stays in the world but is nobody's child.)
// Read off the places table's index, so a room's thoughts cost what the room holds, not the world.
const marksAt = (w, ids) => { const out = []; for (const m of ids) { const th = w.things[m]; if (th && !L.stoodFor(w, m)) out.push(th); } return out; };
export const children = (w, id) => (id == null ? [...floorIds(w), ARCHIVE].flatMap((c) => marksAt(w, P.marksIn(w, c))) : marksAt(w, P.marksIn(w, id))).sort(byTime);
export const foldedAway = (w, id) => L.stoodFor(w, id);

// The rooms at the top (the rooms page, every page), oldest first; archived ones are on the Archive page.
export const rooms = (w) => floorIds(w).flatMap((c) => marksAt(w, P.marksIn(w, c))).filter((th) => kindOf(th) === 'room').sort(byTime);
// The archived rooms, in the order they were archived (their Archive row says when).
export const archived = (w) => marksAt(w, P.marksIn(w, ARCHIVE)).filter((th) => kindOf(th) === 'room')
  .sort((a, b) => archivedAt(w, a.id) - archivedAt(w, b.id) || a.at - b.at);
// The rooms on one page of the rooms page.
export const roomsOn = (w, page = 0) => marksAt(w, P.marksIn(w, FLOOR(page))).filter((th) => kindOf(th) === 'room').sort(byTime);

// True if `id` is in a context written for others (or a machine), or is one: then nothing about
// it can change. Lock declares a room for others (distance.js; Law 7: inherited down, by hand only).
export const shut = (w, id) => D.isShut(w, id);
// Who a mark is written for: its own or its contexts' farthest declared reader (distance.js).
export const readerOf = (w, id) => D.of(w, id);
// Whether a context can be declared for a reader: a room (a Twin too), a floor, the Archive.
export const declarable = (w, id) => { const k = kindOf(w.things[id]); return !!w.things[id] && (k === 'room' || k === 'context'); };

// The room at the top (on the rooms page, or archived) that a thought is in.
export function topRoom(w, id) {
  let top = null;
  for (let th = w.things[id]; th; th = w.things[P.home(w, th.id)]) if (kindOf(th) === 'room') top = th;
  return top;
}

// The room a thought is in (itself, if it is a room).
export function roomOf(w, id) {
  let th = w.things[id];
  while (th && kindOf(th) !== 'room') th = w.things[P.home(w, th.id)];
  return th || null;
}

// ---- Groups ----

// Who holds what is read off the links table's index (links.js), so a big room's drawing asks for
// every thought's groups in constant time each. reading() and changed() are kept for the callers
// that bracketed a drawing with them: there is nothing left for them to do.
export function reading(w, fn) { return fn(); }
export const changed = () => {};

// What a group holds (items, and groups), in the order they were written (or as they were put in,
// for an ontology that keeps its order: declareOrder, read off the part-of rows' ranks).
export function members(w, groupId) {
  const g = w.things[groupId];
  if (!isGroup(g)) return [];
  const held = L.parts(w, groupId).map((r) => w.things[r.from]).filter((th) => isLeaf(th) || isGroup(th));
  return KEPT.has(g.of) ? held : held.sort(byTime);
}
// The ids a group holds, in rank order (no sorting by time: the rows as they are).
export const memberIds = (w, groupId) => L.parts(w, groupId).map((r) => r.from);
// Every item inside a group, however deep (a train of trains: the thoughts of each), each once,
// in reading order.
export function itemsIn(w, groupId, seen = new Set()) {
  if (seen.has(groupId)) return [];
  seen.add(groupId);
  const out = [];
  for (const th of members(w, groupId)) {
    if (isGroup(th)) out.push(...itemsIn(w, th.id, seen));
    else if (!out.includes(th)) out.push(th);
  }
  return [...new Set(out)];
}
// Everything inside a group, however deep (groups and items), each once.
export function within(w, groupId, seen = new Set()) {
  const out = [];
  for (const th of members(w, groupId)) {
    if (seen.has(th.id)) continue;
    seen.add(th.id);
    out.push(th);
    if (isGroup(th)) out.push(...within(w, th.id, seen));
  }
  return out;
}
// True if group `a` holds `id`, however deep.
export function holds(w, a, id, seen = new Set()) {
  const g = w.things[a];
  if (!isGroup(g) || seen.has(a)) return false;
  seen.add(a);
  const ids = memberIds(w, a);
  return ids.includes(id) || ids.some((m) => holds(w, m, id, seen));
}
// True if group `a` holds `id` directly (a part-of row from id into a).
export const holdsDirectly = (w, a, id) => L.has(w, L.partId(a, id));
// The groups in a room (of one ontology, or of all).
export const groupsIn = (w, roomId, of = null) => children(w, roomId).filter((th) => isGroup(th) && (of == null || th.of === of));
// The groups an item is in (of one ontology, or of all); and the first of them.
export function groupsOf(w, id, of = null) {
  return L.holders(w, id).map((g) => w.things[g]).filter((g) => isGroup(g) && (of == null || g.of === of)).sort(byTime);
}
export const groupOf = (w, id, of = defaultMode()) => groupsOf(w, id, of)[0] || null;
// The items in a room, in the order they were written.
export const roomItems = (w, roomId) => children(w, roomId).filter(isLeaf);

// Puts an item, or another group, into a group (of its room). Where the group's ontology lets a
// thing be in only one of its groups, it leaves the one it was in. Never a group into itself, nor
// into a group it holds.
// at: (optional) the position in the group's order it takes (0 first; past the end, last).
export function join(w, groupId, id, at = null) {
  const g = w.things[groupId], th = w.things[id];
  if (!isGroup(g) || !(isLeaf(th) || isGroup(th)) || P.home(w, id) !== P.home(w, groupId) || holdsDirectly(w, groupId, id)) return false;
  if (id === groupId || holds(w, id, groupId)) return false;
  if (membership(g.of) === 'one') for (const o of groupsOf(w, id, g.of)) leave(w, o.id, id);
  // A group that keeps its order takes a newcomer before the first item written after it (so a
  // thought written between two goes between them); one written last goes at the end.
  // (A family's group, a book's chapter, takes it at the end: its order is the maker's alone.)
  const ids = memberIds(w, groupId);
  const after = Number.isInteger(at) && at >= 0 ? (ids[at] ?? null)
    : KEPT.has(g.of) && !g.family ? ids.find((m) => (w.things[m]?.at ?? 0) > (th.at ?? 0)) : null;
  L.join(w, groupId, id, after == null ? null : L.rankBefore(w, groupId, after));
  return true;
}

// Puts a group's items in the order `ids` gives (for a group that keeps its order; see
// declareOrder). Items it holds that `ids` leaves out keep their places after them.
export function setOrder(w, groupId, ids) {
  if (!isGroup(w.things[groupId])) return false;
  L.rank(w, groupId, ids);
  return true;
}

// A new thought takes an old one's place in every group that held it (same groups, same ranks).
export function replaceIn(w, was, now) {
  if (!w.things[now] || !(isLeaf(w.things[now]) || isGroup(w.things[now]))) return false;
  L.replace(w, was, now);
  const at = P.home(w, now); // and where every rule put it, in the room they share
  for (const r of P.of(w, was)) if (r.rule != null && r.context === at && !P.hasSpot(w, at, now, r.rule)) P.putSpot(w, at, now, r.rule, r.position ?? null);
  return true;
}

// Takes an item out of a group; a group left empty goes.
export function leave(w, groupId, id) {
  const g = w.things[groupId];
  if (!isGroup(g)) return false;
  L.drop(w, L.partId(groupId, id));
  if (!L.parts(w, groupId).length && !(g.family && FAMILIES.get(g.of)?.keep !== false)) { delete w.things[groupId]; L.dropAll(w, groupId); G.drop(w, groupId); A.drop(w, groupId); P.dropMark(w, groupId); forget(w, groupId); }
  return true;
}

// Joyce's names for the same things.
export const trainThoughts = members;
// (A train held by another train is drawn inside it, so it is not one of the room's trains.)
export const roomTrains = (w, roomId) => groupsIn(w, roomId, 'joyce')
  .filter((g) => !isLooseGroup(w, g.id) && members(w, g.id).length && !groupsOf(w, g.id, 'joyce').length);

// Every line, passage and picture in a room, in time order.
// A room's thoughts; a Twin's are its two sides'.
export const roomThoughts = (w, roomId) => (isTwin(w.things[roomId])
  ? children(w, roomId).filter((th) => kindOf(th) === 'room').flatMap((s) => roomItems(w, s.id)).sort(byTime)
  : roomItems(w, roomId));

// Every item in a room (what Pessoa floats, each on its own), in time order. Groups are not
// among them: they are shared objects each ontology places itself (groups.js).
export const roomUnits = (w, roomId) => roomItems(w, roomId);

export function lastWritten(w, roomId) {
  const all = roomThoughts(w, roomId);
  return all.length ? Math.max(...all.map((th) => th.at)) : null;
}

export function view(w, roomId) {
  if (!w.views[roomId]) w.views[roomId] = { mode: defaultMode(), x: 0, y: 0, zoom: 1 };
  return w.views[roomId];
}

// A plugin's own data in a room (the roomfile's lines it kept): a plain object, saved with the world.
// Never a position: where a rule puts a thing is its rule row (places.js: spot, putSpot).
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
  const mine = w.things[roomId]?.rules?.[of]?.[s.key];
  if (mine !== undefined) return mine;
  const global = globals?.[of]?.[s.key];
  return global !== undefined ? global : s.default;
}

export function setRoomSetting(w, roomId, of, key, value) {
  const th = w.things[roomId];
  if (!th) return;
  ((th.rules ||= {})[of] ||= {})[key] = value;
}

// A room's settings for one ontology go back to the global ones (and follow them from then on).
export function resetRoomSettings(w, roomId, of) {
  const th = w.things[roomId];
  if (th?.rules) { delete th.rules[of]; if (!Object.keys(th.rules).length) delete th.rules; }
}

// A room starts from the global settings.
export function seedRoomSettings(w, roomId, globals = {}) {
  const th = w.things[roomId];
  if (!th) return;
  if (globals && Object.keys(globals).length) th.rules = copy(globals); else delete th.rules;
}

// Every room, archived ones too, takes the global settings.
export function applySettingsToAll(w, globals = {}) {
  for (const th of Object.values(w.things)) if (kindOf(th) === 'room') seedRoomSettings(w, th.id, globals);
}

// A group's name as lists show it: its title, else its first three words, else `none`.
export function groupLabel(w, id, none = 'A group') {
  const g = w.things[id];
  if (!g) return '';
  if (g.title) return g.title;
  const first = members(w, id)[0];
  const words = first ? thoughtText(w, first).split(/\s+/).slice(0, 3).join(' ') : '';
  return words || none;
}

// The words of a thought, as plain text.
export function thoughtText(w, th) {
  const kind = kindOf(th);
  if (kind === 'group') return members(w, th.id).map((x) => thoughtText(w, x)).join('\n');
  if (kind === 'room') return th.name || '';
  return kindFor(kind).text(th);
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

// When a thought was last changed. (Where it sits is never a field of it: rule rows, below.)
function spot(f, out) {
  if (Number.isFinite(f.edited)) out.edited = f.edited;
  return out;
}

// A thought's own fields, tidied; null when an item would be empty.
function tidy(f) {
  const kind = kindOf(f);
  if (isLeaf(f)) {
    const own = kindFor(kind).tidy(f, { oneLine, lines });
    if (!own) return null;
    const sp = typeof own.text === 'string' ? S.clean(f.spans, own.text.length) : null; // the look of its words (spans.js)
    return spot(f, { kind, ...own, ...(sp ? { spans: sp } : {}) });
  }
  if (kind === 'group') {
    const out = spot(f, { kind, of: typeof f.of === 'string' && f.of ? f.of : DEFAULT_MODE, title: oneLine(f.title) });
    if (f.closed) out.closed = true;
    if (f.shared) out.shared = true; // made on purpose (Ctrl+G, the tray): one object in every mode (groups.js)
    if (f.family || FAMILIES.has(out.of)) out.family = true; // a plugin's family's (declareFamilies): never takes its parts with it, its plugin on or off
    return groupFields(f, out); // its kind's own fields (since 1.1.1)
  }
  const out = { kind, name: oneLine(f.name) || 'Untitled' };
  if (f.rules && typeof f.rules === 'object' && !Array.isArray(f.rules) && Object.keys(f.rules).length) out.rules = copy(f.rules); // its rules' settings (KERNEL.md: on the context mark)
  if (typeof f.tint === 'string' && /^#[0-9a-f]{6}$/i.test(f.tint)) out.tint = f.tint;
  if (f.light != null) out.light = clamp01(f.light, 0.5);
  if (f.opacity != null) out.opacity = clamp01(f.opacity, 1);
  out.size = f.size === 2 || f.size === 'twin' ? f.size : 1;
  const desc = lines(f.desc).slice(0, DESC);
  if (desc) out.desc = desc;
  const tags = tidyTags(f.tags);
  if (tags.length) out.tags = tags;
  return out;
}

// The marks' version: a number from one clock, changed by every change to a thought made here
// (and by the world's save(), for writes made by hand). A rule's layout remembers it (rules.js).
const MARKS = new WeakMap();
let markClock = 0;
export const touch = (w) => { MARKS.set(w.things, ++markClock); };
export const marksVersion = (w) => { if (!MARKS.has(w.things)) touch(w); return MARKS.get(w.things); };

// ---- Where the rules put things (phase 4) ----
// A rule keeps no state of its own: where it puts a thing is a rule row of the places table
// (places.js: spot, putSpot), never a field of the thing nor data the rule keeps. A group's own
// rule's row is where it sits ({ x, y, hand? }; no row: it waits in that rule's tray, `loose`); a
// train's thought dragged off its line has a 'joyce' row { dx, dy }; a room's cell on its floor is
// a 'borges' row { col, row } (no row: the floors feature gives it one); a Twin's side, 'twin' { side }.
export const CELL = 'borges', SIDE = 'twin', OFFSET = 'joyce';
const ruleSpot = (w, id, rule) => { const at = P.home(w, id); return at == null ? null : P.spot(w, at, id, rule); };
const putRuleSpot = (w, id, rule, position) => { const at = P.home(w, id); if (at == null) return false; P.putSpot(w, at, id, rule, position); return true; };
const dropRuleSpot = (w, id, rule) => { const at = P.home(w, id); return at != null && P.dropSpot(w, at, id, rule); };
// A room's cell { col, row } on its floor, or null.
export const cellOf = (w, id) => ruleSpot(w, id, CELL);
export const setCell = (w, id, col, row) => putRuleSpot(w, id, CELL, { col, row });
export const unsetCell = (w, id) => dropRuleSpot(w, id, CELL);
// A Twin side's side (0 or 1), or null.
export const sideOf = (w, id) => ruleSpot(w, id, SIDE)?.side ?? null;
export const setSide = (w, id, side) => putRuleSpot(w, id, SIDE, { side });
// A train's thought dragged off its line: { dx, dy } from the train's corner, or null.
export const offsetOf = (w, id) => ruleSpot(w, id, OFFSET);
export const setOffset = (w, id, dx, dy) => putRuleSpot(w, id, OFFSET, { dx: Math.round(dx), dy: Math.round(dy) });
export const unsetOffset = (w, id) => dropRuleSpot(w, id, OFFSET);
// Where a group's own rule put it ({ x, y, hand? }), or null: it waits in that rule's tray.
export const spotOf = (w, id) => (isGroup(w.things[id]) ? ruleSpot(w, id, w.things[id].of) : null);
export const isLooseGroup = (w, id) => isGroup(w.things[id]) && !spotOf(w, id);
// Puts a group where its rule shows it (out of the tray): `patch` goes over what its row had.
export function setSpot(w, id, patch = {}) {
  const g = w.things[id];
  if (!isGroup(g)) return false;
  const was = spotOf(w, id) || { x: 0, y: 0 };
  const next = { ...was, ...patch };
  for (const k of Object.keys(next)) if (next[k] == null) delete next[k];
  if (Number.isFinite(next.x)) next.x = Math.round(next.x);
  if (Number.isFinite(next.y)) next.y = Math.round(next.y);
  return putRuleSpot(w, id, g.of, next);
}
// The group goes back to its rule's tray (loose).
export const unsetSpot = (w, id) => (isGroup(w.things[id]) ? dropRuleSpot(w, id, w.things[id].of) : false);
// The fields that once said where a thing was, put as rule rows (a saved world of before phase 4,
// a thing made with them, an update that gives them). Takes them off `f`.
function placeFields(w, th, f) {
  const at = P.home(w, th.id);
  if (at == null) return;
  if (kindOf(th) === 'room') {
    if (Number.isInteger(f.col) && Number.isInteger(f.row) && f.col >= 0 && f.row >= 0 && isFloor(at)) P.putSpot(w, at, th.id, CELL, { col: f.col, row: f.row });
    if ((f.side === 0 || f.side === 1) && isTwin(w.things[at])) P.putSpot(w, at, th.id, SIDE, { side: f.side });
  } else if (isGroup(th)) {
    const patch = {};
    for (const k of ['x', 'y', 'hand']) if (k in f) patch[k] = k === 'hand' ? f.hand : Math.round(+f[k] || 0);
    if (!f.loose && Object.keys(patch).length) setSpot(w, th.id, patch);
  } else if (Number.isFinite(f.dx) && Number.isFinite(f.dy)) setOffset(w, th.id, f.dx, f.dy);
  for (const k of ['x', 'y', 'hand', 'loose', 'col', 'row', 'side', 'dx', 'dy']) delete th[k];
}

// A Twin room (on the rooms page, size 'twin') holds its two sides, each a room of its own with its
// own mode and thoughts (twin.js); nothing else is ever a room inside a room.
// (A side is never a Twin's shape itself.)
export const isTwin = (th) => kindOf(th) === 'room' && th.size === 'twin';

// What a mark may hold beyond the core's own, from plugins (the slot 'world.holds', which World
// keeps here with setHolds): [{ id, name?, holds(parent, kind) }]. The core holds items and groups
// in rooms and rooms on floors; a room holding rooms (a Twin's sides) is a plugin's (Twin). One
// array, changed in place. A saved room inside a room is read and kept whether or not a plugin
// allows making one now: a hook only says what may be made or moved in.
export const HOLDS = [];
export function setHolds(list = [], warn = () => {}) {
  HOLDS.length = 0;
  for (const h of list) {
    if (h && typeof h.id === 'string' && typeof h.holds === 'function') HOLDS.push(h);
    else warn(h, 'it needs { id, holds(parent, kind) }');
  }
  return HOLDS;
}
// Whether some plugin lets mark `p` (a thing, or a shape like { kind: 'room', size: 'twin' }) hold
// a mark of `kind`.
export const mayHold = (p, kind) => !!p && HOLDS.some((h) => { try { return h.holds(p, kind) === true; } catch { return false; } });

// What can sit inside what: items and groups in rooms, rooms on a floor or in the Archive (null:
// the first floor), and whatever a plugin's hook allows (mayHold: a Twin's sides).
export function canHold(w, parent, kind) {
  const p = parent == null ? null : w.things[parent];
  if (parent != null && !p) return false;
  if (isLeaf({ kind }) || kind === 'group') return p != null && kindOf(p) === 'room' && !isTwin(p);
  if (kind === 'room') return p == null || isContext(p) || mayHold(p, 'room');
  return false;
}

// Puts a new thought inside `parent`: a room, or (for an item) a group, which it joins in the
// group's room. Returns it, or null (adding nothing) if it would be empty or can't go there.
export function create(w, parent, fields, now = Date.now()) {
  const th = tidy(fields);
  if (!th) return null;
  const p = parent == null ? null : w.things[parent];
  const group = isLeaf(th) && isGroup(p) ? p : null;
  const into = group ? P.home(w, group.id) : parent;
  if (!canHold(w, into, th.kind) || (into != null && shut(w, into))) return null;
  Object.assign(th, { id: uid(th.kind[0]), at: now });
  w.things[th.id] = th;
  touch(w);
  P.setHome(w, th.id, into ?? FLOOR(0));
  placeFields(w, th, isGroup(th) && !('x' in fields) && !fields.loose ? { ...fields, x: 0, y: 0 } : fields);
  if (group) join(w, group.id, th.id);
  return th;
}

// Changes a thought's own fields (never its kind, place, time or links). An item left empty is
// removed.
export function update(w, id, fields, now = Date.now()) {
  const th = w.things[id];
  if (!th || (kindOf(th) !== 'room' && shut(w, id))) return null; // a room itself can still be renamed, coloured or unlocked
  // New words carry the spans over (spans.js shift), unless new spans come with them.
  if ('text' in fields && !('spans' in fields) && th.spans) fields = { ...fields, spans: S.shift(th.spans, th.text, fields.text) };
  const next = tidy({ ...th, ...fields, kind: th.kind, edited: now });
  if (!next) { remove(w, id); return null; }
  if (!next.spans) delete th.spans;
  if (isGroup(th)) {
    next.of = th.of;
    if (!next.closed) delete th.closed;
    for (const name of ownFieldsOf(th)) if (!(name in next)) delete th[name]; // a declared field left out (or null) goes
  }
  if (kindOf(th) === 'room') for (const k of ['desc', 'tags', 'rules']) if (!(k in next)) delete th[k];
  Object.assign(th, next);
  placeFields(w, th, fields);
  touch(w);
  return th;
}

// Removes a thought and everything inside it: a room's items and groups; a group's items too, when
// its ontology holds each item in only one group (a train); a fold's folded-away thoughts (it
// stood for them). An item leaves every group it was in, and a group left empty goes. Every link
// touching it goes. Messy thoughts stays.
export function remove(w, id) {
  const th = w.things[id];
  if (!th || id === MESSY || shut(w, id)) return;
  delete w.things[id];
  touch(w);
  const inside = isGroup(th) && membership(th.of) === 'one' && !th.family ? memberIds(w, id) : [];
  const stoodFor = L.from(w, id, 'stands for').map((r) => r.to);
  const holders = groupsOf(w, id);
  L.dropAll(w, id);
  G.drop(w, id);
  D.drop(w, id);
  A.drop(w, id);
  for (const c of P.marksIn(w, id)) remove(w, c); // (folded-away ones too)
  P.dropMark(w, id);
  for (const m of inside) remove(w, m);
  for (const m of stoodFor) remove(w, m);
  for (const g of holders) if (w.things[g.id] && !L.parts(w, g.id).length) { delete w.things[g.id]; L.dropAll(w, g.id); G.drop(w, g.id); A.drop(w, g.id); P.dropMark(w, g.id); forget(w, g.id); }
  forget(w, id);
  delete w.views[id];
  delete w.own[id];
}

// ---- The shared operations ----

// True if `id` is `ancestor`, or somewhere inside it.
export function inside(w, id, ancestor) {
  for (let th = w.things[id]; th; th = w.things[P.home(w, th.id)]) if (th.id === ancestor) return true;
  return false;
}

// An item comes into another room: it leaves its groups in the old one, and what was kept about it
// there is forgotten.
function rehome(w, th, to) {
  const from = P.home(w, th.id);
  for (const g of groupsOf(w, th.id)) if (P.home(w, g.id) === from) leave(w, g.id, th.id);
  forget(w, th.id, from);
  P.setHome(w, th.id, to);
}

// Moves a thought into `into` (a room, or a group). A group moves to another room with its items;
// an item put into a group joins it; an item put into a room gets a train of its own there (at x,
// y: Joyce holds every item in a train), and the rest of its old train stays joined. Never into
// itself. `loose`: an item put into a room gets no train (it is loose there: groups.js moveLoose).
export function move(w, id, into, x = 0, y = 0, { loose = false } = {}) {
  const th = w.things[id], to = w.things[into];
  if (!th || !to || P.home(w, id) === into && !isLeaf(th) || inside(w, into, id) || shut(w, id) || shut(w, into)) return false;
  if (isTwin(to)) return false; // a Twin holds only its two sides: a thought goes to one of them
  if (isGroup(th)) {
    if (kindOf(to) !== 'room') return false;
    const from = P.home(w, id);
    const going = [th, ...within(w, id)];
    const ids = new Set(going.map((m) => m.id));
    for (const m of going) {
      for (const g of groupsOf(w, m.id)) if (!ids.has(g.id) && P.home(w, g.id) === from) leave(w, g.id, m.id);
      forget(w, m.id, from);
    }
    for (const m of going) P.setHome(w, m.id, into);
    setSpot(w, id, { x, y });
    return true;
  }
  if (!isLeaf(th)) return false; // a room never goes inside anything
  if (isGroup(to)) {
    if (holdsDirectly(w, into, id)) return false;
    if (P.home(w, id) !== P.home(w, into)) rehome(w, th, P.home(w, into));
    return join(w, into, id);
  }
  if (kindOf(to) !== 'room') return false;
  if (loose) { rehome(w, th, into); return true; }
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

// A group closes into one thought (its name), and opens back; what it holds, and its order, never
// change. Only how it shows in its own ontology changes: the others always show it as one.
export function closeGroup(w, groupId, title) {
  if (!isGroup(w.things[groupId])) return false;
  update(w, groupId, { closed: true, ...(title != null ? { title } : {}) });
  return true;
}
export function openGroup(w, groupId) {
  const g = w.things[groupId];
  if (!isGroup(g) || !g.closed || shut(w, groupId)) return false;
  delete g.closed;
  touch(w);
  return true;
}

// ---- Shortcuts the screens use ----

// A new room on a floor of the rooms page (`where`: { page }), with no cell yet: the floors
// feature places it (floors.place). `kind`: its ontology ('joyce', 'pessoa', …).
export function addRoom(w, text = 'Untitled', now, where = {}, kind = defaultMode()) {
  const page = Math.max(0, Math.floor(where.page) || 0);
  while (pageCount(w) <= page) addPage(w, now); // a floor asked for is there
  const r = create(w, FLOOR(page), { kind: 'room', name: text }, now);
  if (!r) return null;
  if (typeof kind === 'string' && kind) view(w, r.id).mode = kind;
  return r;
}

// ---- The rooms page's grid ----

// The cells a room covers with its corner at `at` ({ col, row }).
export function cells(r, at) {
  const out = [];
  if (!at) return out;
  const { w, h } = span(r);
  for (let dc = 0; dc < w; dc++) for (let dr = 0; dr < h; dr++) out.push([at.col + dc, at.row + dr]);
  return out;
}

// The room at a cell of a page (other than `except`), or null.
export function roomAt(w, col, row, except = null, page = 0) {
  return roomsOn(w, page).find((r) => r.id !== except && cells(r, cellOf(w, r.id)).some(([c, rr]) => c === col && rr === row)) || null;
}

// ---- Pages ----

// The rooms page's pages: at least one, and enough for every room on them.
// Each floor is a mark of kind context, floor:0 … floor:<n-1>, with no gaps.
export const floorIds = (w) => { const out = []; for (let n = 0; w.things[FLOOR(n)]; n++) out.push(FLOOR(n)); return out; };
export const pageCount = (w) => Math.max(1, floorIds(w).length);
// A floor's own name, given by the maker ("Thesis"), kept on its mark as `title`; '' for none.
// floorName says it in full: "Floor 2 – Thesis", or "Floor 2".
export const floorTitle = (w, page = 0) => (typeof w.things[FLOOR(page)]?.title === 'string' ? w.things[FLOOR(page)].title : '');
export const floorName = (w, page = 0) => { const t = floorTitle(w, page); return t ? `Floor ${page + 1} – ${t}` : `Floor ${page + 1}`; };
// Names floor `page` (an empty name takes it away). False when there is no such floor.
export function nameFloor(w, page, text) {
  const f = w.things[FLOOR(page)];
  if (!isContext(f)) return false;
  const t = oneLine(text).slice(0, 40);
  if (t) f.title = t; else delete f.title;
  f.edited = Date.now();
  touch(w);
  return true;
}
export function addPage(w, now = Date.now()) { const n = pageCount(w); w.things[FLOOR(n)] = floorThing(n, now); return n; }
// The last floor goes (it must hold no rooms). False when it can't.
export function dropPage(w) {
  const n = pageCount(w) - 1;
  if (n < 1 || P.countIn(w, FLOOR(n))) return false;
  delete w.things[FLOOR(n)];
  P.dropMark(w, FLOOR(n));
  return true;
}
// A room goes to floor `page` (no cell yet unless it keeps its own). False when it can't.
// (An archived room keeps the floor it will go back to.)
export function toPage(w, id, page) {
  const home = P.homeRow(w, id);
  if (!room(w, id) || !w.things[FLOOR(page)] || !home || isTwin(w.things[home.context])) return false;
  if (home.context === ARCHIVE) P.setHomePosition(w, id, { ...home.position, floor: page });
  else P.setHome(w, id, FLOOR(page));
  return true;
}
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
    if (L.stoodFor(w, th.id) || isContext(th)) continue; // folded away: its fold speaks for it
    const kind = kindOf(th);
    const text = kind === 'group' ? th.title || '' : kind === 'room' ? th.name || '' : thoughtText(w, th);
    if (!oneLine(text).toLowerCase().includes(q)) continue;
    const r = roomOf(w, kind === 'room' ? th.id : th.id);
    out.push({ id: th.id, kind, text, room: r?.id ?? null, roomName: r?.name ?? '' });
    if (out.length >= most) break;
  }
  return out;
}

// ---- The rooms page: lock, archive, peek, search lights ----

// Locks or unlocks a room: locked, nothing in it can be written, moved or deleted, and its square
// stays where it is.
export function lock(w, id, on = true) {
  const r = room(w, id);
  if (!r) return false;
  return !D.declare(w, id, on ? 'others' : D.NEAREST).why;
}

// Takes a room off the grid to the Archive page (not Messy thoughts, nor a locked room).
export function archive(w, id, now = Date.now()) {
  const r = room(w, id);
  if (!r || id === MESSY || shut(w, id) || !isFloor(P.home(w, id))) return false;
  P.setHome(w, id, ARCHIVE, { at: now, floor: floorOf(w, id) });
  return true;
}

// Brings an archived room back from the Archive, to its old floor with no cell yet: the floors
// feature places it (floors.place).
export function restore(w, id) {
  const r = room(w, id);
  if (!r || !isArchived(w, id)) return false;
  P.setHome(w, id, FLOOR(Math.min(floorOf(w, id), pageCount(w) - 1)));
  return true;
}

// ---- Copying a room ----
// The one rule for a copy of a room: a new room with everything in it copied (its items, its
// groups and the links between them, each ontology's own data, its view and its settings), every
// copied thought a new id, and every mention of an old id inside them (a link's ends, a place)
// changed to the new one, so the copy never shares a thing with the room it came from.
// Its name says it is a copy; it is unlocked, not archived, on the same floor, with no cell yet
// (the floors feature places it: floors.place, nearest the room's cell). Messy thoughts copies
// into an ordinary 2 × 2 room. Returns the new room, or null (no such room, or archived).

// A copy of `v` with every string (or key) that is an old id in `ids` changed to its new id.
function renamed(v, ids) {
  if (typeof v === 'string') return ids[v] ?? v;
  if (Array.isArray(v)) return v.map((x) => renamed(x, ids));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[ids[k] ?? k] = renamed(x, ids);
    return out;
  }
  return v;
}

export function copyRoom(w, id, now = Date.now()) {
  const r = room(w, id);
  if (!r || isArchived(w, id)) return null;
  // Everything inside it, however deep (a Twin's sides and their thoughts).
  const inner = Object.values(w.things).filter((th) => th.id !== id && topRoom(w, th.id)?.id === id);
  const ids = { [id]: uid('r') };
  for (const th of inner) ids[th.id] = uid(kindOf(th)[0]);
  for (const [lid, row] of Object.entries(L.copyFor(w, ids))) L.set(w, lid, row);
  for (const row of Object.values(G.copyFor(w, ids))) G.set(w, row);
  for (const row of A.copyFor(w, ids)) A.set(w, row);
  const fresh = renamed(copy(r), ids);
  Object.assign(fresh, { id: ids[id], at: now, name: `${r.name || 'Untitled'} copy` });
  delete fresh.edited; // (and no distance row: a copy starts for me now)
  if (id === MESSY) fresh.size = 2;
  w.things[fresh.id] = fresh;
  P.setHome(w, fresh.id, FLOOR(floorOf(w, id)));
  for (const th of inner) {
    const c = renamed(copy(th), ids);
    c.id = ids[th.id];
    w.things[c.id] = c;
    P.setHome(w, c.id, ids[P.home(w, th.id)]);
    for (const store of ['views', 'own', 'settings']) if (w[store]?.[th.id]) w[store][c.id] = renamed(copy(w[store][th.id]), ids); // a side's
  }
  for (const th of inner) for (const r of P.of(w, th.id)) { // where every rule put each thing inside, the same in the copy
    if (r.rule != null && ids[r.context]) P.putSpot(w, ids[r.context], ids[th.id], r.rule, r.position ? renamed(copy(r.position), ids) : null);
  }
  if (w.views[id]) w.views[fresh.id] = copy(w.views[id]);
  if (w.own[id]) w.own[fresh.id] = renamed(copy(w.own[id]), ids);
  return fresh;
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
  const nameOf = (m) => ontologies.find((o) => o.id === m)?.name || '';
  const names = isBig(r) ? ontologies.map((o) => o.name)
    : isTwin(r) ? [...new Set(children(w, id).filter((s) => kindOf(s) === 'room').map((s) => nameOf(view(w, s.id).mode)))].filter(Boolean)
      : [nameOf(mode)].filter(Boolean);
  const out = names.map((tag) => ({ tag, auto: true }));
  for (const tag of r.tags || []) if (!out.some((o) => same(o.tag, tag))) out.push({ tag, auto: false });
  return out;
}

// Adds a tag to a room. False if it is empty, or the room has it already. "Group: tag" also puts
// the tag in that group (tagGroup).
export function addTag(w, id, text, ontologies = []) {
  const m = String(text ?? '').match(/^([^:]+):(.+)$/);
  if (m && tidyTag(m[1]) && tidyTag(m[2])) {
    const added = addTag(w, id, m[2], ontologies);
    return setTagGroup(w, m[2], m[1], ontologies) || added;
  }
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

// Every tag on the rooms page (and in the Archive too, with shelf), with how many rooms have it
// (a tag made with + and on no room yet has 0): [{ tag, n }], the ontologies' first (in their order), then the rest by name.
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
  for (const tag of w.tagsMade || []) if (!counts.has(tag.toLowerCase())) counts.set(tag.toLowerCase(), { tag, n: 0 });
  const order = ontologies.map((o) => o.name.toLowerCase());
  const rank = (t) => { const i = order.indexOf(t.tag.toLowerCase()); return i < 0 ? order.length : i; };
  return [...counts.values()].sort((a, b) => rank(a) - rank(b) || a.tag.localeCompare(b.tag));
}

// ---- Tag groups ----
// A tag can be in one group, so tags of a kind sit together: "Ontology" holds the modes' tags
// and can't be changed; the rest are made by putting a tag in one ("Subject: Algebra"). A tag in
// no group is in Other. Group names, like tags, are the same whatever their case.

export const ONTOLOGY = 'Ontology';
const isMode = (tag, ontologies) => ontologies.some((o) => same(o.name, tag));

// The group a tag is in, or null.
export function tagGroup(w, tag, ontologies = []) {
  const t = tidyTag(tag);
  if (!t) return null;
  if (isMode(t, ontologies)) return ONTOLOGY;
  return w.tagGroups?.[t.toLowerCase()] || null;
}

// Puts a tag in a group (an empty group takes it out). Not a mode's tag, nor into Ontology.
// Returns whether anything changed.
export function setTagGroup(w, tag, group, ontologies = []) {
  const t = tidyTag(tag), g = tidyTag(group);
  if (!t || isMode(t, ontologies) || (g && same(g, ONTOLOGY))) return false;
  const groups = (w.tagGroups ||= {});
  const name = [...Object.values(groups), ...(w.groupsMade || [])].find((x) => g && same(x, g)) || g; // an existing group keeps its spelling
  const key = t.toLowerCase();
  if ((groups[key] || '') === name) return false;
  if (name) groups[key] = name; else delete groups[key];
  return true;
}

// The names of the groups there are: Ontology first, then the rest by name.
export const groupNames = (w) => [ONTOLOGY, ...[...new Set([...Object.values(w.tagGroups || {}), ...(w.groupsMade || [])])]
  .filter((g, i, all) => all.findIndex((x) => same(x, g)) === i).sort((a, b) => a.localeCompare(b))];

// Every tag (as allTags) under its group: [{ group, tags: [{ tag, n }] }], Ontology first, then
// the groups by name, then the tags in none (group null). A group made with + shows with no tags;
// other groups with no tags are left out.
export function tagsByGroup(w, ontologies = [], shelf = false) {
  const out = new Map();
  for (const g of w.groupsMade || []) if (!same(g, ONTOLOGY) && !out.has(g.toLowerCase())) out.set(g.toLowerCase(), { group: g, tags: [] });
  for (const t of allTags(w, ontologies, shelf)) {
    const g = tagGroup(w, t.tag, ontologies);
    const key = g ? g.toLowerCase() : '';
    if (!out.has(key)) out.set(key, { group: g, tags: [] });
    out.get(key).tags.push(t);
  }
  const rank = (x) => (x.group == null ? 2 : same(x.group, ONTOLOGY) ? 0 : 1);
  return [...out.values()].sort((a, b) => rank(a) - rank(b) || (a.group || '').localeCompare(b.group || ''));
}

// True if a room has a tag (whatever its case).
export const hasTag = (w, id, tag, ontologies = []) => roomTags(w, id, ontologies).some((o) => same(o.tag, tidyTag(tag)));

// Makes a tag with + before any room has it (it shows with 0 rooms), in a group (or none).
// False if it is empty or a mode's; a tag there already just moves to the group.
export function makeTag(w, text, group = '', ontologies = []) {
  const tag = tidyTag(text);
  if (!tag || isMode(tag, ontologies)) return false;
  const made = (w.tagsMade ||= []);
  const had = allTags(w, ontologies, true).some((t) => same(t.tag, tag));
  if (!had) made.push(tag);
  return setTagGroup(w, tag, group, ontologies) || !had;
}

// Makes a group with + before it has any tags. False if it is empty, Ontology, or there already.
export function makeGroup(w, text) {
  const g = tidyTag(text);
  if (!g || groupNames(w).some((x) => same(x, g))) return false;
  (w.groupsMade ||= []).push(g);
  return true;
}

// ---- Room groups ----
// Rooms side by side on the rooms page can be grouped: a coloured dotted line drawn round them
// (one line round rooms that touch). A group is not a container: nothing moves and nothing is
// inside it. It is written on each of its rooms (`group: { id, name, colour }`, a field of the
// room's mark, so the file keeps it), and a room is in one group at most. A group with no rooms
// left is gone. Its colour is one of the relation inks (base.css --rel-*).

export const GROUP_COLOURS = Object.freeze(['rust', 'slate', 'moss', 'plum', 'amber']);

// A room's group ({ id, name, colour }), or null.
export function roomGroup(w, id) {
  const g = room(w, id)?.group;
  return g && typeof g === 'object' && typeof g.id === 'string' && g.id ? g : null;
}

// Every group with a room on a floor (and in the Archive too, with shelf), by name:
// [{ id, name, colour, rooms: [room ids] }].
export function roomGroups(w, shelf = false) {
  const out = new Map();
  for (const r of shelf ? [...rooms(w), ...archived(w)] : rooms(w)) {
    const g = roomGroup(w, r.id);
    if (!g) continue;
    if (!out.has(g.id)) out.set(g.id, { id: g.id, name: tidyTag(g.name) || 'Group', colour: GROUP_COLOURS.includes(g.colour) ? g.colour : GROUP_COLOURS[0], rooms: [] });
    out.get(g.id).rooms.push(r.id);
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

// Puts rooms `ids` in a new group (a room in another group leaves it): named "Group n" (the
// smallest n not taken), in the colour fewest groups have. Locked rooms are left as they are.
// Returns the group, or null if no room could join.
export function groupRooms(w, ids, { name: called = '', colour = '' } = {}) {
  const rs = [...new Set(ids)].map((id) => room(w, id)).filter((r) => r && !shut(w, r.id));
  if (!rs.length) return null;
  const all = roomGroups(w, true);
  let n = 1;
  while (all.some((g) => same(g.name, `Group ${n}`))) n++;
  const used = (c) => all.filter((g) => g.colour === c).length;
  const pick = GROUP_COLOURS.includes(colour) ? colour : [...GROUP_COLOURS].sort((a, b) => used(a) - used(b))[0];
  const g = { id: uid('grp'), name: tidyTag(called) || `Group ${n}`, colour: pick };
  for (const r of rs) r.group = { ...g };
  return g;
}

// Takes rooms `ids` out of their groups (locked rooms stay). Returns how many left one.
export function ungroupRooms(w, ids) {
  let n = 0;
  for (const id of new Set(ids)) {
    const r = room(w, id);
    if (!r || shut(w, id) || !roomGroup(w, id)) continue;
    delete r.group;
    n++;
  }
  return n;
}

// Renames or recolours group `gid` on every room in it ({ name, colour }; either may be left out).
// Returns whether anything changed.
export function setRoomGroup(w, gid, { name: called, colour } = {}) {
  const nm = called == null ? null : tidyTag(called), col = GROUP_COLOURS.includes(colour) ? colour : null;
  let changed = false;
  for (const r of [...rooms(w), ...archived(w)]) {
    const g = roomGroup(w, r.id);
    if (g?.id !== gid) continue;
    const next = { ...g, ...(nm ? { name: nm } : {}), ...(col ? { colour: col } : {}) };
    if (next.name !== g.name || next.colour !== g.colour) { r.group = next; changed = true; }
  }
  return changed;
}

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

// ---- Carriers: the six tables in and out (tables.js; Law 8) ----

// The six tables of a context (a room, a group with its parts, null for the whole world).
export const tablesOf = (w, root = null, o = {}) => T.read(w, root, o);

// After tables were written by a carrier: every mark is somewhere (Law 2: an item or group in
// `room`, a room on floor `page`), every row's ends are marks (Law 1), no group holds itself.
function settle(w, ids, room, page) {
  P.touched(w); L.touched(w); G.touched(w);
  for (const id of ids) {
    const th = w.things[id];
    if (!th || isContext(th)) continue;
    const at = P.home(w, id), there = w.things[at];
    if (kindOf(th) === 'room') { if (!(isContext(there) || (isTwin(there) && !isTwin(th)))) P.setHome(w, id, FLOOR(page)); }
    else if (kindOf(there) !== 'room' || isTwin(there)) { if (room != null) P.setHome(w, id, room); else delete w.things[id]; }
  }
  P.repair(w);
  L.repair(w, (r) => (r.kind === 'part of' ? isGroup(w.things[r.to]) && P.home(w, r.from) === P.home(w, r.to) : true));
  for (const g of ids) if (isGroup(w.things[g]) && holds(w, g, g)) for (const r of L.to(w, g, 'part of')) if (holds(w, r.from, g)) L.drop(w, r.id);
  G.repair(w);
  A.repair(w);
  D.repair(w, (id) => declarable(w, id));
  touch(w);
}

// Lands a carrier's tables (traum.js read()) as new marks: `root` (the file's context) becomes a
// new room on floor `page`, or, with `into`, the room it pours into (its own fields stay the
// room's). Everything gets a fresh id. Returns { id, ids, told } (told: the file's moments, for
// the log) or { why }.
export function landTables(w, tables, root, { into = null, page = 0, now = Date.now() } = {}) {
  if (into != null && (!room(w, into) || shut(w, into))) return { why: 'The room is locked, or not there.' };
  const rootMark = tables.marks.find((m) => m.id === root);
  let marks = tables.marks;
  const keep = {};
  if (into != null) { keep[root] = into; marks = marks.filter((m) => m.id !== root); }
  else if (!rootMark || rootMark.body?.kind !== 'room') { // a file of loose thoughts: a room to hold them
    const r = addRoom(w, 'Untitled', now, { page });
    keep[root] = r.id;
    marks = marks.filter((m) => m.id !== root);
  }
  const ids = T.renaming({ marks }, keep, () => uid('').slice(0, 14));
  const fresh = new Set(marks.map((m) => ids[m.id]));
  const told = T.write(w, { ...tables, marks }, ids);
  const target = into ?? keep[root] ?? ids[root];
  if (into == null && !P.home(w, target)) P.setHome(w, target, FLOOR(page));
  settle(w, fresh, target, page);
  return { id: target, ids, told };
}

// Writes edited tables (with the world's own ids) over a room or a group with its parts: what the
// scope held and the text no longer has goes; what it has comes back as written. The scope's root
// must stay, as must its kind. Returns { ids } (the marks now in the scope) or { why }.
export function replaceTables(w, root, tables, fileRoot = root) {
  if (!w.things[root] || shut(w, root)) return { why: 'This is locked, or not there.' };
  if (fileRoot !== root) return { why: 'The text is of another room or group.' };
  const rootMark = tables.marks.find((m) => m.id === root);
  if (!rootMark) return { why: 'The text no longer has its own heading, so nothing was changed.' };
  if (rootMark.body?.kind !== kindOf(w.things[root])) return { why: 'A room or group keeps its kind.' };
  const taken = tables.marks.find((m) => m.id !== root && w.things[m.id] && !T.scopeOf(w, root).ids.has(m.id));
  if (taken) return { why: `^${taken.id} is already elsewhere: give a new mark a new id.` };
  const scope = T.scopeOf(w, root);
  const outer = scope.outer ?? root;
  T.clear(w, scope, root);
  const ids = {};
  for (const m of tables.marks) ids[m.id] = m.id;
  for (const t of ['places', 'links']) for (const r of tables[t]) for (const k of ['mark', 'context', 'from', 'to']) if (r[k] != null && !(r[k] in ids) && w.things[r[k]]) ids[r[k]] = r[k];
  T.write(w, tables, ids);
  const now = new Set(tables.marks.map((m) => m.id));
  settle(w, now, kindOf(w.things[root]) === 'room' ? root : outer, floorOf(w, topRoom(w, root)?.id ?? root));
  return { ids: now };
}
