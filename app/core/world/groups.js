// Groups as shared objects. A group made on purpose (Ctrl+G, or grouped in the tray: `shared`)
// belongs to the ontology that made it, but it is one object for the whole room: every other
// ontology there sees it as one thought, and its thoughts are not loose there as well, so every
// mode counts the same objects. Groups made by the way an ontology lays things out (a Joyce train
// made by writing on, a Russell chapter made by a drop) are layout only: no other mode sees them. Until that ontology places it, it waits in its tray, tagged by the kind of its
// outermost group (a train of trains is a Train); it can be opened there and dragged onto the
// canvas. Its members stay wherever they are in that ontology.
//
// A group made in an ontology's tray (from loose thoughts) stays in the tray too (`loose`), until
// it is dragged onto the canvas.
//
// Where an ontology places a thing by a point is its rule row in the places table (places.js:
// place:<room>:<id>:<of>, position { x, y }), never data of its own (Pessoa does so for every
// thought). No screen here (tests/groups.test.js).
//
// Folding is not grouping: fold(w, room, ids) turns the chosen thoughts into ONE new thought that
// takes their place in every group, of every ontology, that held them. The old thoughts are not
// deleted: the new one stands for them (a 'stands for' link each, links.js), so they stay in the
// world but show nowhere, and go only with the fold (Law 2).

import { kindFor } from './items/index.js';
import * as L from './links.js';
import * as P from './places.js';
import { parentOf, groupsIn, groupsOf, itemsIn, holds, within, isGroup, isLeaf, kindOf, shut, create, remove, leave, membership, memberIds, move, unsetSpot, setSpot, isLooseGroup } from './model.js';

export const isShared = (g) => isGroup(g) && !!g.shared;

// The shared groups no shared group holds, however deep (with something inside), oldest first:
// what a room's other ontologies see of its groups.
export function outermost(w, roomId) {
  const shared = groupsIn(w, roomId).filter((g) => g.shared && itemsIn(w, g.id).length);
  return shared.filter((g) => !shared.some((o) => o !== g && holds(w, o.id, g.id)));
}

// The outermost shared groups another ontology made, which ontology `of` sees as one thought each.
export const foreign = (w, roomId, of) => outermost(w, roomId).filter((g) => g.of !== of);

// Whether a thought is inside a group ontology `of` sees as one thought: it isn't loose there too.
export function inForeign(w, roomId, of) {
  const inside = new Set();
  for (const g of foreign(w, roomId, of)) for (const th of within(w, g.id)) inside.add(th.id);
  return (id) => inside.has(id);
}

// Where ontology `of` placed a foreign group, or null (it waits in the tray).
export const spot = (w, roomId, of, id) => {
  const p = P.spot(w, roomId, id, of);
  return p && Number.isFinite(p.x) ? p : null;
};
// Places a thing at x, y in ontology `of` (its rule row). extra: more of the position (auto).
export function putAt(w, roomId, of, id, x, y, extra = null) {
  if (shut(w, roomId) || !w.things[id]) return false;
  P.putSpot(w, roomId, id, of, { x: Math.round(x), y: Math.round(y), ...(extra || {}) });
  return true;
}
// Ontology `of` forgets where it put a thing (it lays it itself again, or it waits in its tray).
export const unput = (w, roomId, of, id) => P.dropSpot(w, roomId, id, of);
// Every thing ontology `of` placed by a point in a room: Map id → { x, y, … }.
export const spotsOf = (w, roomId, of) => P.spots(w, roomId, of);

// The foreign groups ontology `of` has placed, and those still in its tray.
export const placedForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => spot(w, roomId, of, g.id));
export const trayForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => !spot(w, roomId, of, g.id));

// A thought added away from the canvas (the tray's box, its +) waits in the tray: an ontology that
// places every thought itself (Pessoa, Proust) keeps it there until it is dragged out, that is,
// until it has a spot of its own there. (The others keep a thought in no group in their tray
// anyway.) Kept as a 'tray' rule row: position null (it waits in every such ontology), or
// { in: { [of]: true } } (thrown back in ontology `of`, or read from its tray in a .traum file: it
// waits only there).
export const WAITS = 'tray';
export function wait(w, roomId, id, of = null) {
  if (shut(w, roomId) || parentOf(w, id) !== roomId) return false;
  const has = P.hasSpot(w, roomId, id, WAITS), m = P.spot(w, roomId, id, WAITS);
  if (!of) P.putSpot(w, roomId, id, WAITS, null);
  else if (!has || m) P.putSpot(w, roomId, id, WAITS, { in: { ...(m?.in || {}), [of]: true } });
  return true;
}
// Whether thought `id` still waits in ontology `of`'s tray.
export const waiting = (w, roomId, of, id) => {
  if (!P.hasSpot(w, roomId, id, WAITS)) return false;
  const m = P.spot(w, roomId, id, WAITS);
  return !!(!m || m.in?.[of]) && !spot(w, roomId, of, id);
};

// Moves a thought or a group to another room (Move to…, Ctrl+M) so that it lands in that room's
// loose tray in every mode: a thought goes with no train; a group keeps what it holds and waits in
// its own mode's tray (loose); every thought it carries waits in the tray of the modes that place
// every thought themselves (Pessoa, Proust), until it is dragged out. True when it went.
export function moveLoose(w, id, into) {
  const th = w.things[id];
  if (!th || kindOf(w.things[into]) !== 'room' || !move(w, id, into, 0, 0, { loose: true })) return false;
  if (isGroup(th)) unsetSpot(w, id);
  for (const m of [th, ...(isGroup(th) ? within(w, id) : [])]) if (isLeaf(m)) wait(w, into, m.id);
  return true;
}

// Whether a group of its own ontology waits in the tray (made there), and taking it out.
export const isLoose = (w, id) => isLooseGroup(w, id);
export function place(w, id) {
  if (!isLooseGroup(w, id)) return false;
  return setSpot(w, id, {});
}

// Throw back (Ctrl+Shift+Backspace): ontology `of` takes a thing it placed back into its tray. It
// leaves every group of `of` that holds it (a train, a chapter; one left empty goes); a group of
// `of`'s own then waits in the tray (loose), and another mode's group loses its spot. A thought
// inside another mode's shared group can't go alone (the group stands for it). True when it went.
// `lays` (Pessoa, Proust: they place every thought themselves): a plain thought loses its spot
// there and waits in `of`'s tray (wait), as one added from the tray does, until dragged out.
export function unplace(w, roomId, of, id, { lays = false } = {}) {
  const th = w.things[id];
  if (!th || parentOf(w, th.id) !== roomId || shut(w, roomId) || !(isLeaf(th) || isGroup(th))) return false;
  if (inForeign(w, roomId, of)(id)) return false;
  const mine = isGroup(th) && th.of === of;
  const theirs = isGroup(th) && !mine;
  const holders = groupsOf(w, id, of);
  if (!mine && !theirs && lays) {
    if (waiting(w, roomId, of, id)) return false; // in the tray already
    for (const g of holders) leave(w, g.id, id);
    unput(w, roomId, of, id);
    return wait(w, roomId, id, of);
  }
  const spotted = theirs && !!spot(w, roomId, of, id);
  if (!holders.length && !spotted && !(mine && !isLooseGroup(w, id))) return false; // in the tray already
  for (const g of holders) leave(w, g.id, id);
  if (theirs) unput(w, roomId, of, id);
  if (mine) unsetSpot(w, id);
  return true;
}

// The kind word a thought shows in a tray: a group's ontology's name for its groups ("Train",
// "Chapter"), or '' for a single thought. names: { [ontology]: word }.
export const kindTag = (th, names = {}) => (isGroup(th) ? names[th.of] || 'Group' : '');

// ---- Fold: many thoughts become one ----

// The words of one thought, for a fold.
const wordsOf = (th) => (kindOf(th) === 'passage' ? [th.title, th.body].filter(Boolean).join('\n') : th.text || '');

// What folding `ids` would take: { leaves, gone, groups } (leaves: the thoughts whose words are
// folded, in order; gone: every thought that goes; groups: the chosen groups, which stay and hold
// the new thought), or { why } when it can't be folded.
export function foldPlan(w, roomId, ids) {
  const chosen = [...new Set(ids)].map((id) => w.things[id]).filter((th) => th && parentOf(w, th.id) === roomId && (isLeaf(th) || isGroup(th)))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const groups = chosen.filter(isGroup);
  const leaves = [], gone = new Map();
  for (const th of chosen) {
    if (isGroup(th)) {
      for (const x of within(w, th.id)) gone.set(x.id, x);
      for (const x of itemsIn(w, th.id)) if (!leaves.includes(x)) leaves.push(x);
    } else if (!leaves.includes(th)) { leaves.push(th); gone.set(th.id, th); }
  }
  for (const g of groups) gone.delete(g.id); // a chosen group stays, holding the new thought
  if (leaves.length < 2) return { why: leaves.length ? 'One thought: nothing to fold.' : 'Nothing here to fold.' };
  // Only words fold: a line or a passage (a picture, or any kind a plugin adds, can't yet).
  const other = leaves.find((th) => kindOf(th) !== 'line' && kindOf(th) !== 'passage');
  if (other) return { why: `${kindFor(kindOf(other)).name}s can't be folded yet.` };
  if (shut(w, roomId)) return { why: 'This room is locked.' };
  return { leaves, gone: [...gone.values()], groups };
}

// Folds the chosen thoughts (and whole groups: everything inside them) into one new thought: a
// line when they are all lines (one line each), else a passage with all their words in order
// (titled by the first group's or passage's title). It takes the place of the old ones in every
// group that held them, of every ontology (a group holding several takes it once, where the first
// was; an ontology that holds a thought in one group only keeps it in the first). It takes the
// first one's place in each ontology's own data (Pessoa's place, say). A chosen group stays and
// holds just the new thought. The folded thoughts stay in the world, stood for by the new one
// (folded away: in no group, with no place, shown nowhere); the groups inside a chosen group go.
// Returns the new thought, or { why }.
export function fold(w, roomId, ids, now = Date.now()) {
  const plan = foldPlan(w, roomId, ids);
  if (plan.why) return plan;
  const { leaves, gone, groups } = plan;
  const lines = leaves.every((th) => kindOf(th) === 'line');
  const title = groups.find((g) => g.title)?.title || leaves.find((th) => kindOf(th) === 'passage' && th.title)?.title || '';
  const fields = lines ? { kind: 'line', text: leaves.map(wordsOf).join('\n') }
    : { kind: 'passage', title, body: leaves.filter((th) => !(title && th.title === title && !th.body)).map((th) => (th.title === title ? th.body || '' : wordsOf(th))).filter(Boolean).join('\n\n') };
  const th = create(w, roomId, fields, Math.min(...leaves.map((x) => x.at ?? now)));
  if (!th) return { why: 'Nothing here to fold.' };
  const old = new Set(gone.map((x) => x.id));
  // In every group that held any of them (the chosen groups first): the new one in the first's place.
  const holders = [...groups, ...groupsIn(w, roomId).filter((g) => !groups.includes(g) && !old.has(g.id))];
  const placedIn = new Set();
  for (const g of holders) {
    if (!w.things[g.id]) continue;
    const rows = L.parts(w, g.id);
    const first = rows.find((r) => old.has(r.from));
    if (!first && !groups.includes(g)) continue;
    for (const r of rows) if (old.has(r.from)) L.drop(w, r.id);
    const one = membership(g.of) === 'one';
    if (one && placedIn.has(g.of)) continue;
    L.join(w, g.id, th.id, first ? first.order : null);
    if (one) placedIn.add(g.of);
  }
  // Where each rule put them: the first old one's place, for the new one (its rule rows).
  const rules = new Map();
  for (const x of [...leaves, ...gone]) for (const r of P.of(w, x.id)) if (r.rule != null && r.context === roomId && !(isGroup(x) && r.rule === x.of) && !rules.has(r.rule)) rules.set(r.rule, r); // (a group's own spot is not a thought's)
  for (const [rule, r] of rules) if (!P.hasSpot(w, roomId, th.id, rule)) P.putSpot(w, roomId, th.id, rule, r.position ? JSON.parse(JSON.stringify(r.position)) : null);
  // The folded thoughts: stood for by the new one, out of every group, their places forgotten.
  // The groups inside a chosen group go (their thoughts are stood for, not deleted with them).
  for (const x of gone) {
    if (!w.things[x.id]) continue;
    if (isGroup(x)) { L.dropAll(w, x.id); remove(w, x.id); continue; }
    for (const r of [...L.from(w, x.id), ...L.to(w, x.id)]) if (r.kind !== 'stands for') L.drop(w, r.id); // (what it stands for itself, it keeps)
    L.set(w, L.forId(th.id, x.id), { from: th.id, to: x.id, kind: 'stands for' });
    for (const r of P.of(w, x.id)) if (r.rule != null) P.drop(w, r.id);
  }
  // A group the fold left empty goes (without taking anything with it).
  for (const g of groupsIn(w, roomId)) if (!memberIds(w, g.id).length) leave(w, g.id, null);
  return th;
}
