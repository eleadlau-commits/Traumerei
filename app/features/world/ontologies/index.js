// Ontologies: the ways a room can see its thoughts. Each is one file here, or an item another
// feature adds to the slot 'world.ontologies' (so switching that feature off takes the mode away).
// A room whose ontology is missing is seen through Pessoa. An ontology is shaped:
//
//   id, name, note        'pessoa', 'Pessoa', 'each thought on its own'
//   icon                  (optional) its hairline icon in the rail: an SVG drawing on a 24 × 24 grid
//   order                 where it sits in lists (lower first; the built-in ones are 10, 20)
//   groups                null, or { form, name, membership, order }: the groups it makes (Joyce: trains),
//                         whether an item can be in 'one' of them or in 'many', and order: 'kept'
//                         when its items stay in the order they were put in, not time (model.js)
//   units(w, room)        what is on its canvas: items, and groups shown as one thought
//   point(w, room, id)    where a thought sits ({ x, y }, world units)
//   drop(w, room, id, x, y)   a thought dragged to x, y: where it now sits
//   draftPoint(w, room)   (optional) where a thought being written shows
//   tray(w, room)         (optional) thoughts it hasn't placed yet; leave it out for no tray. A
//                         folded group another ontology made is one thought here
//                         (foldedFrom() in model.js), and waits in the tray until placed. The
//                         tray shows along the foot of the room; a thought dragged out of it onto
//                         the canvas goes to drop()
//   placed(w, room, id)   (optional) whether it has laid a thought out yet; without it, every
//                         thought counts as laid out. Folding a group in a big room asks Replace
//                         or Keep both when another ontology there has laid out its thoughts
//   live                  (optional) true: a drag calls drop() as it goes and redraws (Joyce's
//                         line follows); otherwise the thought moves and drop() comes at the end
//   draw(c)               (optional) its own canvas: DOM nodes to show. Without it, each unit
//                         floats at its point. c is the room feature: world, roomId, sel, isSel(id),
//                         found, draft, prefs, setting(key), el, thoughtNode(th), draftNode(). A node marked
//                         data-thought is one thought; one marked data-group (with no
//                         data-thought, or for a folded group) is the whole group, which a
//                         double-click chooses; one marked data-measure="id" has its size
//                         passed to measured() under that id (Russell: a chapter's name)
//   tag(w, id)            (optional) a thought's tag in the room's Timeline ({ id, name }, or
//                         null): Joyce, its train
//   settings              (optional) its settings: sliders { key, label, min, max, step, default },
//                         switches { key, label, type: 'switch', default }, or choices
//                         { key, label, type: 'choice', options: [[value, word]], default }, or lists
//                         of words { key, label, type: 'list', default: [...], word?: RegExp, note? }. Each room keeps its
//                         own (the ⚙ beside the mode's name in the rail); the global ones are under
//                         Settings → Rooms → Inside a room. Read in the room with c.setting(key)
//   settingChanged(w, room, key, before, after)   (optional) one of a room's settings was just
//                         changed in its ⚙ (Russell: a relation renamed is renamed on its arrows)
//   group(w, room, items, now)   (optional) Ctrl+G: its own way to make one group of these items
//                         (thoughts, oldest first); returns the group, or null. Without it, a new
//                         group of this ontology where the first one is, which they all join
//   ungroup(w, room, items, now) (optional) Ctrl+Shift+G: its own way to take these items out of
//                         their groups; returns how many came out. Without it, each leaves its
//                         groups of this ontology (Joyce gives each a train of its own instead)
//   moves                 (optional) [{ id, label, run(c), when?(c) }], its own actions. They
//                         show as words in the pop-up of what is chosen, those whose when(c) is
//                         true (all of them, without when). c.sel is what is chosen
//   begin(w, room, draft, now)   (optional) a thought is kept with no group to go on with: makes
//                         the group it joins and returns it, or null to leave the thought loose
//                         (it waits in the tray). draft is { x, y, for? }: where it was written,
//                         and whatever a move put in for (c.write({ x, y, for }) starts one).
//                         Without it, a Joyce train at x, y. An ontology without groups writes
//                         into Joyce's trains
//   press(c, e)           (optional) a press on the canvas, before the room's own: return true when
//                         it took it (Russell: a drag from a chapter's foot draws an arrow)
//   open(c, id)           (optional) a tap on a thought or group, before the room chooses it: return
//                         true when it took it (Russell: a closed chapter opens as a document)
//   props(c, th)          (optional) more rows (DOM nodes) for the pop-up of what is chosen
//                         (Russell: what a chapter forgets about each parent)
//   blocks(w, room)       (optional) clear space (clear.js): what moves together, as
//                         [{ id, thoughts, group?, tail?, hand, at }]; hand: placed by hand.
//                         Without it, each unit is a block, none by hand
//   shift(w, room, id, dx, dy)   (optional) moves a block by dx, dy; without it, drop() to point + d
//   measured(sizes)       (optional) each thought's size as drawn (Map id → { w, h }, world units),
//                         after each drawing; return true to be drawn again (Joyce: steps fit text)
//   Every ontology also has the setting 'overlap' (clear.js): whether what was placed by hand
//   can be overlapped, or stays clear while the rest moves around it.
//
// Its own data in a room lives in own(w, room, id) (model.js), saved with the world. Thoughts
// themselves are shared by every ontology.

import { declareGroups, create, join, leave, groupsOf, members, isGroup, isLeaf } from '../model.js';
import joyce from './joyce.js';
import pessoa from './pessoa.js';
import russell from './russell.js';

export const BUILT_IN = [joyce, pessoa, russell];
export const FALLBACK = 'pessoa';

const NEEDS = { id: 'string', name: 'string', note: 'string', units: 'function', point: 'function', drop: 'function' };
const MAY = { group: 'function', ungroup: 'function', draftPoint: 'function', tray: 'function', draw: 'function', placed: 'function', tag: 'function', blocks: 'function', shift: 'function', measured: 'function', begin: 'function', press: 'function', props: 'function', settingChanged: 'function' };

// What an ontology lacks (names of its parts), or [] when it is whole.
export function missing(o) {
  if (!o || typeof o !== 'object') return ['everything'];
  const out = Object.entries(NEEDS).filter(([k, t]) => typeof o[k] !== t || (t === 'string' && !o[k])).map(([k]) => k);
  for (const [k, t] of Object.entries(MAY)) if (o[k] != null && typeof o[k] !== t) out.push(k);
  if (o.groups != null && !['one', 'many'].includes(o.groups.membership)) out.push('groups');
  for (const k of ['settings', 'moves']) if (o[k] != null && !Array.isArray(o[k])) out.push(k);
  if (Array.isArray(o.moves) && o.moves.some((m) => !m || typeof m.label !== 'string' || typeof m.run !== 'function')) out.push('moves');
  return out;
}

// Every ontology there is: the built-in ones, then whole ones from the slot, each id once, in order.
// Their groups' rules go to the model.
export function gather(extra = [], warn = () => {}) {
  const seen = new Set();
  const out = [];
  for (const o of [...BUILT_IN, ...extra]) {
    const lacks = missing(o);
    if (lacks.length) { warn(o, lacks); continue; }
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
    declareGroups(o.id, o.groups);
  }
  return out.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}

// ---- Ctrl+G and Ctrl+Shift+G: grouping what is chosen, each ontology by its own rule ----

// The items among `ids` in the room (a group counts as its items), each once, oldest first.
function itemsOf(w, roomId, ids) {
  const out = new Map();
  for (const id of ids) {
    const th = w.things[id];
    if (isGroup(th)) for (const m of members(w, id)) out.set(m.id, m);
    else if (isLeaf(th) && th.parent === roomId) out.set(id, th);
  }
  return [...out.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

// Makes one group of ontology `o` of the chosen things: its own group(), or a new group where the
// first one is, which they all join. Null when it makes none (an ontology without groups, or
// nothing to group).
export function groupChosen(o, w, roomId, ids, now = Date.now()) {
  if (!o?.groups) return null;
  const items = itemsOf(w, roomId, ids);
  if (!items.length) return null;
  if (o.group) return o.group(w, roomId, items, now) || null;
  let at = null;
  try { at = o.point(w, roomId, items[0].id); } catch { at = null; }
  const g = create(w, roomId, { kind: 'group', of: o.id, x: Math.round(at?.x || 0), y: Math.round(at?.y || 0) }, now);
  if (!g) return null;
  for (const th of items) join(w, g.id, th.id);
  return members(w, g.id).length ? g : null;
}

// Takes the chosen things out of their groups of ontology `o`: its own ungroup(), or each leaves
// them (a group left empty goes). Returns how many came out.
export function ungroupChosen(o, w, roomId, ids, now = Date.now()) {
  if (!o?.groups) return 0;
  const items = itemsOf(w, roomId, ids);
  if (o.ungroup) return o.ungroup(w, roomId, items, now) || 0;
  let n = 0;
  for (const th of items) {
    const gs = groupsOf(w, th.id, o.id).filter((g) => g.parent === roomId);
    for (const g of gs) leave(w, g.id, th.id);
    if (gs.length) n++;
  }
  return n;
}
