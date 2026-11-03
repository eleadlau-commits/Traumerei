// Ontologies: the ways a room can see its thoughts. Each is one file here, or an item another
// feature adds to the slot 'create.ontologies' (so switching that feature off takes the mode away).
// A room whose ontology is missing is seen through Pessoa. An ontology is shaped:
//
//   id, name, note        'pessoa', 'Pessoa', 'each thought on its own'
//   order                 where it sits in lists (lower first; the built-in ones are 10, 20)
//   groups                null, or { form, name, membership }: the groups it makes (Joyce: trains)
//                         and whether an item can be in 'one' of them or in 'many' (model.js)
//   units(w, room)        what is on its canvas: items, and groups shown as one thought
//   point(w, room, id)    where a thought sits ({ x, y }, world units)
//   drop(w, room, id, x, y)   a thought dragged to x, y: where it now sits
//   draftPoint(w, room)   (optional) where a thought being written shows
//   tray(w, room)         (optional) thoughts it hasn't placed yet; leave it out for no tray. A
//                         folded group another ontology made is one thought here
//                         (foldedFrom() in model.js), and waits in the tray until placed
//   placed(w, room, id)   (optional) whether it has laid a thought out yet; without it, every
//                         thought counts as laid out. Folding a group in a big room asks Replace
//                         or Keep both when another ontology there has laid out its thoughts
//   live                  (optional) true: a drag calls drop() as it goes and redraws (Joyce's
//                         line follows); otherwise the thought moves and drop() comes at the end
//   draw(c)               (optional) its own canvas: DOM nodes to show. Without it, each unit
//                         floats at its point. c is Create: world, roomId, sel, isSel(id),
//                         found, draft, prefs, setting(key), el, thoughtNode(th), draftNode(). A node marked
//                         data-thought is one thought; one marked data-group (with no
//                         data-thought, or for a folded group) is the whole group, which a
//                         double-click chooses
//   tag(w, id)            (optional) a thought's tag in the room's Timeline ({ id, name }, or
//                         null): Joyce, its train
//   settings              (optional) its settings: sliders { key, label, min, max, step, default }
//                         or switches { key, label, type: 'switch', default }. Each room keeps its
//                         own (the ⚙ beside the mode's name in the rail); the global ones are under
//                         Settings → Rooms → Inside a room. Read in the room with c.setting(key)
//   moves                 (optional) [{ id, label, run(create) }], its own actions
//   blocks(w, room)       (optional) clear space (clear.js): what moves together, as
//                         [{ id, thoughts, group?, tail?, hand, at }]; hand: placed by hand.
//                         Without it, each unit is a block, none by hand
//   shift(w, room, id, dx, dy)   (optional) moves a block by dx, dy; without it, drop() to point + d
//   Every ontology also has the setting 'overlap' (clear.js): whether what was placed by hand
//   can be overlapped, or stays clear while the rest moves around it.
//
// Its own data in a room lives in own(w, room, id) (model.js), saved with the world. Thoughts
// themselves are shared by every ontology.

import { declareGroups } from '../model.js';
import joyce from './joyce.js';
import pessoa from './pessoa.js';

export const BUILT_IN = [joyce, pessoa];
export const FALLBACK = 'pessoa';

const NEEDS = { id: 'string', name: 'string', note: 'string', units: 'function', point: 'function', drop: 'function' };
const MAY = { draftPoint: 'function', tray: 'function', draw: 'function', placed: 'function', tag: 'function', blocks: 'function', shift: 'function' };

// What an ontology lacks (names of its parts), or [] when it is whole.
export function missing(o) {
  if (!o || typeof o !== 'object') return ['everything'];
  const out = Object.entries(NEEDS).filter(([k, t]) => typeof o[k] !== t || (t === 'string' && !o[k])).map(([k]) => k);
  for (const [k, t] of Object.entries(MAY)) if (o[k] != null && typeof o[k] !== t) out.push(k);
  if (o.groups != null && !['one', 'many'].includes(o.groups.membership)) out.push('groups');
  for (const k of ['settings', 'moves']) if (o[k] != null && !Array.isArray(o[k])) out.push(k);
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
