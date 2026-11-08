// Rules: the kernel's view of an ontology (KERNEL.md, Rules). A rule is a pure function of the
// tables with no state of its own: where it puts a mark is a rule row of the places table
// (places.js), what it joins is a row of the links table (links.js), and nothing else is kept.
// Every ontology, built in or from a plugin, is seen through this one contract:
//
//   layout(w, context)          Map mark → { x, y }: where each unit sits under the rule, from
//                               the rows. Remembered per context until the tables change (the
//                               places row versions of that context, the links table's, the
//                               marks'), so drawing again costs nothing; a change lays out afresh
//                               (budget: 50 ms for 1,500 marks; a mode switch 100 ms, cold).
//   admit(w, proposal)          { ok: true } or { ok: false, reason }: a position or a link the
//                               rule won't take, said in words (Russell refuses a loop). Never
//                               changes anything.
//   moves(w, context, mark)     what the rule offers to do with a chosen mark: [{ id, label }].
//   draws(w, context)           what it draws beside the marks, as data: { lines: [[mark…]],
//                               arrows: [{ from, to, label }] } (no screen here).
//
// Law 3 (a rule may constrain, never destroy) is held two ways (tests/rules.test.js): the four
// reads above run on a frozen world, so a rule that wrote anything would throw; and a rule's
// moves (drop, shift, throw back, group, ungroup) never take away a thought or a link that is not
// a group's own membership.

import * as P from './places.js';
import * as L from './links.js';
import { shut, marksVersion, parentOf, isGroup, roomTrains, members } from './model.js';
import { netFor } from './ontologies/relations.js';

const MEMO = new WeakMap(); // ontology → Map context → { key, map }

// The tables' state for one context, as one key: equal keys mean nothing that a layout reads changed.
const keyOf = (w, context) => `${P.version(w, context)}|${L.version(w)}|${marksVersion(w)}`;

// Where each unit sits under ontology `o` in `context`: its own layout(w, context) when it has
// one (a whole room at once), else each unit's point().
function lay(o, w, context) {
  const out = new Map();
  if (typeof o.layout === 'function') {
    const all = o.layout(w, context);
    for (const [id, p] of all instanceof Map ? all : Object.entries(all || {})) if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.set(id, { x: p.x, y: p.y });
    return out;
  }
  for (const u of o.units(w, context)) {
    const p = o.point(w, context, u.id);
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) out.set(u.id, { x: p.x, y: p.y });
  }
  return out;
}

export function layout(o, w, context) {
  let byContext = MEMO.get(o);
  if (!byContext) MEMO.set(o, (byContext = new Map()));
  const key = keyOf(w, context);
  const had = byContext.get(context);
  if (had && had.key === key && had.w === w) return had.map;
  const map = lay(o, w, context);
  byContext.set(context, { key, w, map });
  return map;
}
// Forget every remembered layout (a rule's measuring changed its steps: Joyce's heights).
export const forget = (o) => MEMO.delete(o);

// A proposal: { kind: 'place', mark, context, position? } or { kind: 'link', from, to, link,
// rule? } (link: 'part of', 'relation', …). The rule's own admit() speaks first; then the
// rules every rule shares: the mark and context are there, the context is not locked, a mark is
// placed only in the context it is in, and a relation passes its arrows' rule (loops refused).
export function admit(o, w, p = {}) {
  const no = (reason) => ({ ok: false, reason });
  if (typeof o.admit === 'function') {
    const own = o.admit(w, p);
    if (own && own.ok === false) return no(own.reason || `${o.name} won't take that`);
  }
  if (p.kind === 'place') {
    if (!w.things[p.mark] || !w.things[p.context]) return no('No such mark or context');
    if (shut(w, p.context)) return no('The context is locked');
    if (P.home(w, p.mark) !== p.context) return no('The mark is not in that context');
    if (p.position != null && (!Number.isFinite(p.position.x) || !Number.isFinite(p.position.y))) return no(`${o.name} places a mark at a point`);
    return { ok: true };
  }
  if (p.kind === 'link') {
    if (!w.things[p.from] || !w.things[p.to]) return no('No such mark');
    if (p.from === p.to) return no('A mark is not linked to itself');
    const room = parentOf(w, p.from);
    if (room == null || room !== parentOf(w, p.to)) return no('Both marks must be in one room');
    if (shut(w, room)) return no('The room is locked');
    if (p.link === 'part of' && !(isGroup(w.things[p.to]) && w.things[p.to].of === o.id)) return no(`Only a group of ${o.name}'s holds marks here`);
    if (p.link === 'relation' && typeof o.admit !== 'function') { // (a rule with its own admit said its word on arrows above)
      const net = netFor(p.rule || o.id);
      if (!net) return no(`${o.name} draws no arrows`);
      const why = net.whyNot(w, room, p.to, p.from);
      if (why) return no(why);
    }
    return { ok: true };
  }
  return no('A rule is asked to place a mark or to link two');
}

// What the rule offers for a chosen mark: its moves (by label), and the ones every rule with
// groups and a tray has.
export function moves(o, w, context, mark) {
  if (!w.things[mark] || P.home(w, mark) !== context) return [];
  const out = [];
  const placed = o.placed ? o.placed(w, context, mark) : true;
  if (o.tray && !placed) out.push({ id: 'place', label: `Place in ${o.name}` });
  if (o.unplace && placed) out.push({ id: 'throw-back', label: 'Throw back into the tray' });
  if (o.groups) out.push({ id: 'group', label: `Make a ${o.groups.name.toLowerCase()}` });
  if (o.groups && isGroup(w.things[mark]) && w.things[mark].of === o.id) out.push({ id: 'ungroup', label: `Undo the ${o.groups.name.toLowerCase()}` });
  for (const m of o.moves || []) out.push({ id: m.id || m.label, label: m.label });
  return out;
}

// What the rule draws beside the marks, as data: a line through each of its trains' marks (a
// rule whose groups keep one membership and an order: Joyce), and its arrows (relation rows
// under its store).
export function draws(o, w, context) {
  const lines = o.id === 'joyce' ? roomTrains(w, context).filter((t) => !t.closed).map((t) => members(w, t.id).map((m) => m.id)) : [];
  const net = netFor(o.id) || netFor(`${o.id}-links`);
  const store = net?.store;
  const arrows = store ? L.ofRule(w, store).filter((r) => parentOf(w, r.from) === context).map((r) => ({ from: r.from, to: r.to, label: r.label || '' })) : [];
  return { lines, arrows };
}

// The ontology as a rule: the four parts above, bound to it.
export const asRule = (o) => Object.freeze({
  id: o.id, name: o.name,
  layout: (w, context) => layout(o, w, context),
  admit: (w, proposal) => admit(o, w, proposal),
  moves: (w, context, mark) => moves(o, w, context, mark),
  draws: (w, context) => draws(o, w, context),
});
