// Groups as shared objects. A group (a Joyce train, a Russell chapter) belongs to the ontology that
// made it, but it is one object for the whole room: every other ontology there sees it as one
// thought. Until that ontology places it, it waits in its tray, tagged by the kind of its
// outermost group (a train of trains is a Train); it can be opened there and dragged onto the
// canvas. Its members stay wherever they are in that ontology.
//
// A group made in an ontology's tray (from loose thoughts) stays in the tray too (`loose`), until
// it is dragged onto the canvas.
//
// Each ontology that places foreign groups by a point keeps it in its own data: own(w, room, of)[id]
// = { x, y } (Pessoa does so for every thought). No screen here (tests/groups.test.js).
//
// Folding is not grouping: fold(w, room, ids) turns the chosen thoughts into ONE new thought and
// the old ones go, everywhere: the new one takes their place in every group, of every ontology,
// that held them.

import { groupsIn, groupsOf, itemsIn, within, isGroup, isLeaf, kindOf, own, shut, create, remove, leave, membership } from './model.js';

// The groups no group holds (with something inside), oldest first: what a room's other ontologies
// see of its groups.
export const outermost = (w, roomId) => groupsIn(w, roomId).filter((g) => !groupsOf(w, g.id).length && itemsIn(w, g.id).length);

// The outermost groups another ontology made, which ontology `of` sees as one thought each.
export const foreign = (w, roomId, of) => outermost(w, roomId).filter((g) => g.of !== of);

// Where ontology `of` placed a foreign group, or null (it waits in the tray).
export const spot = (w, roomId, of, id) => {
  const p = own(w, roomId, of, false)[id];
  return p && Number.isFinite(p.x) ? p : null;
};
// Places a thing at x, y in ontology `of` (its own data).
export function putAt(w, roomId, of, id, x, y) {
  if (shut(w, roomId)) return false;
  own(w, roomId, of)[id] = { x: Math.round(x), y: Math.round(y) };
  return true;
}

// The foreign groups ontology `of` has placed, and those still in its tray.
export const placedForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => spot(w, roomId, of, g.id));
export const trayForeign = (w, roomId, of) => foreign(w, roomId, of).filter((g) => !spot(w, roomId, of, g.id));

// Whether a group of its own ontology waits in the tray (made there), and taking it out.
export const isLoose = (g) => isGroup(g) && !!g.loose;
export function place(w, id) {
  const g = w.things[id];
  if (!isGroup(g) || !g.loose) return false;
  delete g.loose;
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
  const chosen = [...new Set(ids)].map((id) => w.things[id]).filter((th) => th && th.parent === roomId && (isLeaf(th) || isGroup(th)))
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
  if (leaves.some((th) => kindOf(th) === 'picture')) return { why: 'Pictures can\'t be folded yet.' };
  if (shut(w, roomId)) return { why: 'This room is locked.' };
  return { leaves, gone: [...gone.values()], groups };
}

// Folds the chosen thoughts (and whole groups: everything inside them) into one new thought: a
// line when they are all lines (one line each), else a passage with all their words in order
// (titled by the first group's or passage's title). It takes the place of the old ones in every
// group that held them, of every ontology (a group holding several takes it once, where the first
// was; an ontology that holds a thought in one group only keeps it in the first). It takes the
// first one's place in each ontology's own data (Pessoa's place, say). A chosen group stays and
// holds just the new thought. The old ones are deleted. Returns the new thought, or { why }.
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
  const first = leaves[0];
  if (Number.isFinite(first.dx)) { th.dx = first.dx; th.dy = first.dy; }
  const old = new Set(gone.map((x) => x.id));
  // In every group that held any of them (the chosen groups first): the new one in the first's place.
  const holders = [...groups, ...groupsIn(w, roomId).filter((g) => !groups.includes(g) && !old.has(g.id))];
  const placedIn = new Set();
  for (const g of holders) {
    if (!w.things[g.id]) continue;
    const i = g.members.findIndex((m) => old.has(m));
    if (i < 0 && !groups.includes(g)) continue;
    const one = membership(g.of) === 'one';
    if (one && placedIn.has(g.of)) { g.members = g.members.filter((m) => !old.has(m)); continue; }
    const rest = g.members.filter((m) => !old.has(m));
    g.members = i < 0 ? [...rest, th.id] : [...g.members.slice(0, i).filter((m) => !old.has(m)), th.id, ...g.members.slice(i + 1).filter((m) => !old.has(m))];
    if (one) placedIn.add(g.of);
  }
  // Each ontology's own data: the first old one's place, for the new one.
  for (const data of Object.values(w.own[roomId] || {})) {
    if (!data || typeof data !== 'object' || data[th.id]) continue;
    const from = leaves.find((x) => data[x.id] != null) || gone.find((x) => data[x.id] != null);
    if (from) data[th.id] = JSON.parse(JSON.stringify(data[from.id]));
  }
  for (const x of gone) if (w.things[x.id]) remove(w, x.id);
  // A group the fold left empty goes (without taking anything with it).
  for (const g of groupsIn(w, roomId)) if (!g.members.length) leave(w, g.id, null);
  return th;
}
