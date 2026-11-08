// The links table: the kernel's third table (KERNEL.md), and the only structure there is (Law 4).
// A row joins two marks with a kind:
//
//   part of     from a member to the group that holds it, with `order` (a rank: members read in
//               rank order where the group's rule keeps its order, else by time)
//   stands for  from a fold to a mark it folded away: the folded mark stays in the world (Law 2)
//               but shows nowhere, since the fold stands for it
//   relation    from a child to its parent (an arrow drawn in Russell, a link in Proust), with
//               `rule` (whose arrows these are), `label` (the relation's name, '' unnamed) and
//               `note` (the arrow's own words)
//
// w.links = { [id]: { from, to, kind, order?, rule?, label?, note? } }. Ids say what a row is, so
// there is one row per (kind, from, to, rule): part:<group>:<member> · for:<fold>:<mark> ·
// rel:<rule>:<child>:<parent>. Reads are served from an index (by from, by to, by rule) kept up to
// date by the writes here; anything that writes to the table behind this file's back (the moments
// log replaying a row) says so with touched(). No screen here (tests/links.test.js).

export const KINDS = Object.freeze(['part of', 'stands for', 'relation']);

export const partId = (group, member) => `part:${group}:${member}`;
export const forId = (fold, mark) => `for:${fold}:${mark}`;
export const relId = (rule, child, parent) => `rel:${rule}:${child}:${parent}`;

export const table = (w) => (w.links ||= {});

// ---- The index ----

const INDEX = new WeakMap(); // w.links → { from: Map id → Set link ids, to: …, rule: … }
const put = (map, key, id) => { let s = map.get(key); if (!s) map.set(key, (s = new Set())); s.add(id); };
const pull = (map, key, id) => { const s = map.get(key); if (s) { s.delete(id); if (!s.size) map.delete(key); } };
const enter = (ix, id, r) => { put(ix.from, r.from, id); put(ix.to, r.to, id); if (r.rule != null) put(ix.rule, r.rule, id); };
const leave = (ix, id, r) => { pull(ix.from, r.from, id); pull(ix.to, r.to, id); if (r.rule != null) pull(ix.rule, r.rule, id); };

function index(w) {
  const t = table(w);
  let ix = INDEX.get(t);
  if (!ix) {
    ix = { from: new Map(), to: new Map(), rule: new Map() };
    for (const [id, r] of Object.entries(t)) if (r) enter(ix, id, r);
    INDEX.set(t, ix);
  }
  return ix;
}
// The table was written to by other hands (the log replaying rows): the index is made afresh.
export const touched = (w) => { if (w.links) INDEX.delete(w.links); };

const withId = (t, id) => ({ id, ...t[id] });
const pickRows = (w, ids, kind) => {
  if (!ids) return [];
  const t = table(w), out = [];
  for (const id of ids) { const r = t[id]; if (r && (kind == null || r.kind === kind)) out.push(withId(t, id)); }
  return out;
};

// ---- Reading: every row carries its id ----

export const get = (w, id) => (table(w)[id] ? withId(table(w), id) : null);
export const has = (w, id) => !!table(w)[id];
export const from = (w, mark, kind = null) => pickRows(w, index(w).from.get(mark), kind);
export const to = (w, mark, kind = null) => pickRows(w, index(w).to.get(mark), kind);
export const ofRule = (w, rule) => pickRows(w, index(w).rule.get(rule), null);
export const all = (w) => Object.keys(table(w)).map((id) => withId(table(w), id));
export const count = (w) => Object.keys(table(w)).length;

// The part-of rows into a group, in rank order.
export const parts = (w, group) => to(w, group, 'part of').sort((a, b) => a.order - b.order || (a.from < b.from ? -1 : 1));
// The groups a mark is part of (their ids).
export const holders = (w, mark) => from(w, mark, 'part of').map((r) => r.to);
// Whether a mark is folded away: some fold stands for it.
export const stoodFor = (w, mark) => { const s = index(w).to.get(mark); if (!s) return false; const t = table(w); for (const id of s) if (t[id]?.kind === 'stands for') return true; return false; };

// ---- Writing ----

const tidy = (r) => {
  const out = { from: r.from, to: r.to, kind: r.kind };
  if (Number.isFinite(r.order)) out.order = r.order;
  if (r.rule != null) out.rule = String(r.rule);
  if (r.label) out.label = String(r.label);
  if (r.note) out.note = String(r.note);
  return out;
};

// Puts a row in the table under its id (a row there already is replaced). Returns the row.
export function set(w, id, row) {
  const t = table(w), ix = index(w);
  if (t[id]) leave(ix, id, t[id]);
  const r = tidy(row);
  t[id] = r;
  enter(ix, id, r);
  return withId(t, id);
}
// Takes a row out. True if there was one.
export function drop(w, id) {
  const t = table(w);
  if (!t[id]) return false;
  leave(index(w), id, t[id]);
  delete t[id];
  return true;
}
// Changes a row's fields (not its ends or kind). False if there is no such row.
export function amend(w, id, fields) {
  const r = table(w)[id];
  if (!r) return false;
  set(w, id, { ...r, ...fields, from: r.from, to: r.to, kind: r.kind });
  return true;
}
// Every row touching a mark goes. Returns how many.
export function dropAll(w, mark) {
  const ix = index(w);
  const ids = new Set([...(ix.from.get(mark) || []), ...(ix.to.get(mark) || [])]);
  for (const id of ids) drop(w, id);
  return ids.size;
}

// A part-of row from `member` into `group`, ranked at the end (or at `order`). Its id.
export function join(w, group, member, order = null) {
  const id = partId(group, member);
  if (has(w, id)) return id;
  const rank = order ?? Math.max(-1, ...parts(w, group).map((r) => r.order)) + 1;
  set(w, id, { from: member, to: group, kind: 'part of', order: rank });
  return id;
}
// A rank just before `before` (a part-of row into the same group): between it and the one before.
export function rankBefore(w, group, before) {
  const list = parts(w, group);
  const i = list.findIndex((r) => r.from === before);
  if (i < 0) return Math.max(-1, ...list.map((r) => r.order)) + 1;
  return i === 0 ? list[0].order - 1 : (list[i - 1].order + list[i].order) / 2;
}
// The members of a group ranked as `ids` gives; those left out keep their places after them.
export function rank(w, group, ids) {
  const list = parts(w, group);
  const have = new Set(list.map((r) => r.from));
  const listed = [...new Set(ids)].filter((m) => have.has(m));
  const rest = list.map((r) => r.from).filter((m) => !listed.includes(m));
  [...listed, ...rest].forEach((m, i) => amend(w, partId(group, m), { order: i }));
}
// Every part-of row from `was` is from `now` instead (same group, same rank): a new mark takes
// an old one's place everywhere. Rows the new mark has already are left as they are.
export function replace(w, was, now) {
  for (const r of from(w, was, 'part of')) {
    drop(w, r.id);
    if (!has(w, partId(r.to, now))) set(w, partId(r.to, now), { from: now, to: r.to, kind: 'part of', order: r.order });
  }
}

// A copy of the rows touching `ids` (a map old id → new id), with every end renamed; rows whose
// ends are not all in the map are left out (a copied room shares nothing with the room it came from).
export function copyFor(w, ids) {
  const out = {};
  for (const [id, r] of Object.entries(table(w))) {
    if (!r || !(ids[r.from] && ids[r.to])) continue;
    const row = { ...r, from: ids[r.from], to: ids[r.to] };
    const nid = r.kind === 'part of' ? partId(row.to, row.from) : r.kind === 'stands for' ? forId(row.from, row.to) : r.kind === 'relation' ? relId(r.rule, row.from, row.to) : id;
    out[nid] = row;
  }
  return out;
}

// A saved table, repaired against the marks there are: a row of no kind, or with an end that is
// gone, goes. `ok(row)`: the world's own rule for a row (a part-of row needs a group), or it goes.
export function repair(w, ok = () => true) {
  const t = table(w);
  for (const [id, r] of Object.entries(t)) {
    if (!r || typeof r !== 'object' || !KINDS.includes(r.kind) || !w.things[r.from] || !w.things[r.to] || r.from === r.to || !ok(r)) delete t[id];
    else t[id] = tidy(r);
  }
  touched(w);
  return t;
}
