// Relations: named arrows between the groups of one ontology, kept apart from any one ontology so
// each that joins its groups can use them (Russell's tree now; a network that allows loops later).
// No screen here.
//
// An arrow goes from a parent to a child. It has a relation, how the child stands to its parent,
// and a short label. A relation's name is any words or signs ("forgets", "is a case of", "⊂", "≅"),
// or nothing: an unnamed arrow. Only [[ and ]] are refused, since room Markdown writes an arrow's
// parent in them. Each room keeps its own list of relations (a 'list' setting of the ontology,
// RELATIONS); the first is the one a new arrow gets. A node has any number of parents.
//
// The arrows are the ontology's own data in the room: own(w, room, of)[child] = { parents, labels,
// rel }, where labels is { [parent]: text } and rel { [parent]: relation } ('' or missing: unnamed).
//
// arrowsOf({ of, isNode, nodes, word, loops }) gives the functions for one ontology:
//   of                 the ontology's id (where its arrows are kept, and its settings)
//   isNode(w, room, id)   whether an id can be joined by arrows (Russell: a chapter)
//   nodes(w, room)     the nodes, in the order arrows() lists them
//   word               a node in words ('chapter'), for the reasons an arrow is refused
//   loops              true to allow loops (an arrow back up to an ancestor); false refuses them
//   changed(w, room)   (optional) called after an arrow is drawn or taken away
//   store              (optional) where in the room's own data the arrows are kept (own(w, room,
//                      store)); the ontology's id when left out. Proust keeps its places under its
//                      id, so its links go elsewhere
//   setting            (optional) the room setting that holds its relations (RELATIONS when left
//                      out): its default is what a room with none has
//   words              (optional) { join, self }: why an arrow between these can't be drawn, and
//                      why one from a node to itself can't, in the ontology's own words

import { own, roomSetting, shut } from '../model.js';

// ---- Names ----

// A relation's name: any words or signs on one line, spaces made single ('' for an unnamed arrow).
// null if refused (it has [[ or ]] in it).
export function relationName(x) {
  const t = String(x ?? '').replace(/\s+/g, ' ').trim();
  return /\[\[|\]\]/.test(t) ? null : t;
}

// A list written with commas ("forgets, is a case of, ⊂", or in [ ]), split into its names. A name
// with a comma in it goes in double quotes: "less, or equal".
export function splitList(text) {
  const s = String(text ?? '').replace(/^\s*\[(.*)\]\s*$/s, '$1');
  const out = [];
  let now = '', quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(now); now = ''; }
    else now += ch;
  }
  out.push(now);
  return out.map((x) => x.trim());
}

// A list of names written back with commas, a name with a comma in it in quotes.
export const listText = (names) => names.map((n) => (n.includes(',') ? `"${n}"` : n)).join(', ');

// ---- A relation's ends ----
// In a room's list, a relation may end with the ends its links take: "leads to ->" (an arrow),
// "is equivalent to <->" (an arrow both ways), "related to --" (a plain line). Without a mark it
// takes the ontology's own (Russell: always an arrow; Proust: a plain line). The name itself is
// what comes before the mark.
const MARKS = { '--': 'none', '->': 'arrow', '<->': 'both' };
export const ENDS_MARK = { none: '--', arrow: '->', both: '<->' };
const MARKED = /\s*(<->|->|--)\s*$/;

// One entry of a list: { name, ends } (ends null when it has no mark).
export function relationEntry(x) {
  const s = String(x ?? '');
  const m = s.match(MARKED);
  return { name: relationName(m ? s.slice(0, m.index) : s), ends: m ? MARKS[m[1]] : null };
}

// A list of relations made tidy, each with its ends mark kept when it had one: "leads to ->".
// Each name once (whatever its case), none empty. Never empty: `fallback` when nothing is left.
export function cleanRelationList(v, fallback = RELATIONS.default) {
  const out = [], seen = new Set();
  for (const x of Array.isArray(v) ? v : splitList(v)) {
    const { name, ends } = relationEntry(x);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(ends ? `${name} ${ENDS_MARK[ends]}` : name);
  }
  return out.length ? out : [...fallback];
}

// A list of relations made tidy: from a list, or names with commas (splitList); each once
// (whatever its case), none empty, ends marks left off. Never empty: "forgets" (or `fallback`)
// when nothing is left.
export function cleanRelations(v, fallback = RELATIONS.default) {
  return cleanRelationList(v, fallback).map((x) => relationEntry(x).name);
}

// Each relation's ends in a room's list: { [name]: 'none' | 'arrow' | 'both' }, `none` for one
// with no mark.
export function relationEnds(v, none = 'arrow') {
  const out = {};
  for (const x of cleanRelationList(v)) { const { name, ends } = relationEntry(x); out[name] = ends || none; }
  return out;
}

// The setting that holds a room's relations. clean: how a written list is read; text: how it is
// written back (the room's ⚙ uses both).
export const RELATIONS = {
  key: 'relations', label: 'Relations', type: 'list', default: ['forgets'], clean: cleanRelations, text: listText,
  note: 'Any words or signs. A new arrow gets the first.',
};

// An arrow's relation as it is shown beside its label: '' when unnamed, or when the room has only
// that one relation (then every arrow is the same, and the word says nothing).
export const relationShown = (names, rel) => (!rel || (names.length === 1 && names[0] === rel) ? '' : rel);

// The room's list with a new name added at its end (the same list if it is already there, in any
// case, or can't be a name). The others keep their ends marks.
export function withRelation(names, name, fallback = RELATIONS.default) {
  const t = relationName(name);
  const list = cleanRelationList(names, fallback);
  return t && !list.some((n) => relationEntry(n).name.toLowerCase() === t.toLowerCase()) ? [...list, t] : list;
}

// ---- Arrows ----

const tidy = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

export function arrowsOf({ of, isNode, nodes, word = 'node', loops = false, changed = () => {}, store = of, setting = RELATIONS, words = {} }) {
  const put = (w, roomId, child, { parents, labels, rel }) => { own(w, roomId, store)[child] = { parents, labels, rel }; };

  // A room's relations, the first the one a new arrow gets (globals: the global settings, for a
  // room with none).
  const relations = (w, roomId, globals = {}) => cleanRelations(roomSetting(w, roomId, of, setting, globals), setting.default);

  // After a room's relations change from one list to another of the same length, a relation renamed
  // in place is renamed on its arrows too. Returns how many arrows changed.
  function renameRelations(w, roomId, before, after) {
    const a = cleanRelations(before, setting.default), b = cleanRelations(after, setting.default);
    if (a.length !== b.length) return 0;
    const map = new Map(a.map((x, i) => [x, b[i]]).filter(([x, y]) => x !== y));
    if (!map.size) return 0;
    let n = 0;
    for (const data of Object.values(own(w, roomId, store, false))) {
      for (const [p, r] of Object.entries(data?.rel || {})) if (map.has(r)) { data.rel[p] = map.get(r); n++; }
    }
    return n;
  }

  // The arrows into a node: { parents, labels, rel }, only from nodes still there. rel has every
  // parent ('' for an unnamed arrow); labels only those with one.
  function arrowsInto(w, roomId, id) {
    const a = own(w, roomId, store, false)[id];
    const parents = (a?.parents || []).filter((p) => p !== id && isNode(w, roomId, p));
    const labels = {}, rel = {};
    for (const p of parents) {
      if (a.labels?.[p]) labels[p] = a.labels[p];
      rel[p] = typeof a.rel?.[p] === 'string' ? a.rel[p] : '';
    }
    return { parents, labels, rel };
  }

  const parentsOf = (w, roomId, id) => arrowsInto(w, roomId, id).parents;
  const childrenOf = (w, roomId, id) => nodes(w, roomId).filter((g) => parentsOf(w, roomId, g.id).includes(id)).map((g) => g.id);
  const labelOf = (w, roomId, parent, child) => arrowsInto(w, roomId, child).labels[parent] || '';
  // An arrow's relation ('' when unnamed).
  const relationOf = (w, roomId, parent, child) => arrowsInto(w, roomId, child).rel[parent] ?? '';

  // Every arrow in the room: [{ from, to, label, rel }] (rel: '' when unnamed).
  function arrows(w, roomId) {
    const out = [];
    for (const g of nodes(w, roomId)) {
      const { parents, labels, rel } = arrowsInto(w, roomId, g.id);
      for (const p of parents) out.push({ from: p, to: g.id, label: labels[p] || '', rel: rel[p] });
    }
    return out;
  }

  // True if `a` is `b` or one of b's ancestors.
  function above(w, roomId, a, b, seen = new Set()) {
    if (a === b) return true;
    if (seen.has(b)) return false;
    seen.add(b);
    return parentsOf(w, roomId, b).some((p) => above(w, roomId, a, p, seen));
  }

  // Why an arrow from parent to child can't be drawn, or '' when it can.
  function whyNot(w, roomId, parent, child) {
    if (parent === child) return words.self || `A ${word} can't be its own parent.`;
    if (!isNode(w, roomId, parent) || !isNode(w, roomId, child)) return words.join || `Arrows join two ${word}s.`;
    if (parentsOf(w, roomId, child).includes(parent)) return 'That arrow is already there.';
    if (!loops && above(w, roomId, child, parent)) return 'That arrow would make a loop.';
    return '';
  }

  // Draws an arrow from parent to child, with a label and a relation (left out: the room's first;
  // '' for an unnamed arrow). Returns '' when drawn, or why not.
  function link(w, roomId, parent, child, label = '', relation) {
    const why = whyNot(w, roomId, parent, child);
    if (why || shut(w, roomId)) return why || 'This room is locked.';
    const a = arrowsInto(w, roomId, child);
    a.parents.push(parent);
    if (tidy(label)) a.labels[parent] = tidy(label);
    a.rel[parent] = relation == null ? relations(w, roomId)[0] : relationName(relation) ?? '';
    put(w, roomId, child, a);
    changed(w, roomId);
    return '';
  }

  function unlink(w, roomId, parent, child) {
    if (shut(w, roomId)) return false;
    const { parents, labels, rel } = arrowsInto(w, roomId, child);
    if (!parents.includes(parent)) return false;
    delete labels[parent];
    delete rel[parent];
    put(w, roomId, child, { parents: parents.filter((p) => p !== parent), labels, rel });
    changed(w, roomId);
    return true;
  }

  // An arrow's label ('' takes it away).
  function setLabel(w, roomId, parent, child, text) {
    if (shut(w, roomId)) return false;
    const a = arrowsInto(w, roomId, child);
    if (!a.parents.includes(parent)) return false;
    const t = tidy(text);
    if (t) a.labels[parent] = t; else delete a.labels[parent];
    put(w, roomId, child, a);
    return true;
  }

  // An arrow's relation ('' for an unnamed arrow). A name with [[ or ]] in it is refused (false).
  function setRelation(w, roomId, parent, child, relation) {
    if (shut(w, roomId)) return false;
    const a = arrowsInto(w, roomId, child);
    const name = relationName(relation);
    if (!a.parents.includes(parent) || name == null) return false;
    a.rel[parent] = name;
    put(w, roomId, child, a);
    return true;
  }

  // A node just made, given its first parent (no checks: it has no arrows yet).
  function adopt(w, roomId, child, parent) {
    put(w, roomId, child, { parents: [parent], labels: {}, rel: { [parent]: relations(w, roomId)[0] } });
  }

  // In a .traum file (the roomfile feature): the arrow: lines of any ontology that uses these
  // arrows, `arrow: ^from -> ^to | relation | label`. c: the roomfile feature's helpers
  // (ref, writeArrow; thing, report). traumLines gives the lines; traumArrows draws the arrows read
  // ([{ from, to, rel, label, line }], from and to as ids), through this ontology's own rules, and
  // reports each it refuses.
  const traumLines = (w, roomId, c) => arrows(w, roomId).filter((a) => c.ref(a.from) && c.ref(a.to))
    .map((a) => `arrow: ${c.writeArrow({ from: c.ref(a.from), to: c.ref(a.to), rel: a.rel, label: a.label })}`);
  // When editing (c.scope: the ids the text holds), the arrows touching those are made to read as
  // the list does: one not in it is taken away, a changed relation or label is changed, and each
  // change is said (c.change(words), with c.name(id) for a node's name).
  function traumArrows(w, roomId, list, c) {
    let fresh = list;
    if (c.scope) {
      const want = new Map(list.map((a) => [`${a.from}>${a.to}`, a]));
      const name = (id) => c.name?.(id) || id;
      for (const a of arrows(w, roomId)) {
        if (!c.scope.has(a.from) && !c.scope.has(a.to)) continue;
        const x = want.get(`${a.from}>${a.to}`);
        if (!x) { unlink(w, roomId, a.from, a.to); c.change?.(`The arrow from ${name(a.from)} to ${name(a.to)} is taken away`); continue; }
        want.delete(`${a.from}>${a.to}`);
        if ((x.rel ?? '') !== a.rel && setRelation(w, roomId, a.from, a.to, x.rel ?? '')) c.change?.(`${name(a.from)} → ${name(a.to)}: ${a.rel || 'no relation'} becomes ${x.rel || 'no relation'}`);
        if (tidy(x.label) !== a.label && setLabel(w, roomId, a.from, a.to, x.label || '')) c.change?.(`${name(a.from)} → ${name(a.to)}: label ${a.label ? `"${a.label}"` : 'none'} becomes ${tidy(x.label) ? `"${tidy(x.label)}"` : 'none'}`);
      }
      fresh = [...want.values()];
    }
    for (const a of fresh) {
      const why = link(w, roomId, a.from, a.to, a.label || '', a.rel ?? '');
      if (why) c.report(a.line, `the arrow wasn't drawn: ${why[0].toLowerCase()}${why.slice(1).replace(/\.$/, '')}.`);
      else if (c.scope) c.change?.(`A new arrow from ${c.name?.(a.from) || a.from} to ${c.name?.(a.to) || a.to}`);
    }
  }

  return {
    relations, renameRelations, arrowsInto, parentsOf, childrenOf, labelOf, relationOf, arrows, above, whyNot,
    link, unlink, setLabel, setRelation, adopt, traumLines, traumArrows,
  };
}
