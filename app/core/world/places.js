// The places table: the kernel's second table (KERNEL.md). A row says that a mark sits in a
// context, and where a rule puts it there (phase 4: rules keep no state of their own):
//
//   { mark, context, rule?, position?, pinned? }
//
// A context is a mark that holds marks: a room, a floor (`floor:<n>`), the Archive (`archive`), a
// Twin holding its sides. Every mark but a context of the top (a floor, the Archive) has exactly
// one home row: the row with no rule, saying which context it is in (what was `parent`, `page`
// and `archived` before this table). Rows with a rule are where that rule puts the mark in the
// context; no such row means the mark is loose there under that rule (Law 2: it is never lost,
// only unplaced). Removing a place never removes a mark.
//
// w.places = { [id]: row }. Ids say what a row is: place:<context>:<mark> for a home row,
// place:<context>:<mark>:<rule> for a rule's. Reads are served from an index (by mark, by
// context) kept up to date by the writes here; anything that writes to the table behind this
// file's back (the moments log replaying a row) says so with touched(). No screen here
// (tests/places.test.js).

export const homeId = (context, mark) => `place:${context}:${mark}`;
export const ruleId = (context, mark, rule) => `place:${context}:${mark}:${rule}`;
export const idOf = (r) => (r.rule == null ? homeId(r.context, r.mark) : ruleId(r.context, r.mark, r.rule));

export const table = (w) => (w.places ||= {});

// ---- The index ----

const INDEX = new WeakMap(); // w.places → { mark: Map id → Set row ids, context: …, home: Map mark → row id }
const put = (map, key, id) => { let s = map.get(key); if (!s) map.set(key, (s = new Set())); s.add(id); };
const pull = (map, key, id) => { const s = map.get(key); if (s) { s.delete(id); if (!s.size) map.delete(key); } };
const enter = (ix, id, r) => { put(ix.mark, r.mark, id); put(ix.context, r.context, id); if (r.rule == null) ix.home.set(r.mark, id); };
const leave = (ix, id, r) => { pull(ix.mark, r.mark, id); pull(ix.context, r.context, id); if (r.rule == null && ix.home.get(r.mark) === id) ix.home.delete(r.mark); };

function index(w) {
  const t = table(w);
  let ix = INDEX.get(t);
  if (!ix) {
    ix = { mark: new Map(), context: new Map(), home: new Map() };
    for (const [id, r] of Object.entries(t)) if (r) enter(ix, id, r);
    INDEX.set(t, ix);
  }
  return ix;
}
// The table was written to by other hands (the log replaying rows): the index is made afresh.
export const touched = (w) => { if (w.places) { INDEX.delete(w.places); VERSION.set(w.places, { base: ++clock, ctx: new Map() }); } };
// A context's version: a number from one clock that changes with every write of a row in it (a
// rule's layout of the context remembers it, so it lays out again only after a change: rules.js).
const VERSION = new WeakMap();
let clock = 0;
const versions = (t) => { let v = VERSION.get(t); if (!v) VERSION.set(t, (v = { base: ++clock, ctx: new Map() })); return v; };
const bump = (t, context) => versions(t).ctx.set(context, ++clock);
export const version = (w, context) => { const v = versions(table(w)); return Math.max(v.base, v.ctx.get(context) || 0); };

const withId = (t, id) => ({ id, ...t[id] });

// ---- Reading ----

export const get = (w, id) => (table(w)[id] ? withId(table(w), id) : null);
export const has = (w, id) => !!table(w)[id];
export const all = (w) => Object.keys(table(w)).map((id) => withId(table(w), id));
export const count = (w) => Object.keys(table(w)).length;
// Every row of a mark, every row in a context (a rule's only, when given).
export const of = (w, mark) => [...(index(w).mark.get(mark) || [])].map((id) => withId(table(w), id));
export const inContext = (w, context, rule = undefined) => {
  const t = table(w), out = [];
  for (const id of index(w).context.get(context) || []) { const r = t[id]; if (r && (rule === undefined || (r.rule ?? null) === rule)) out.push(withId(t, id)); }
  return out;
};
// The context a mark is in (its home row's), or null for a context of the top or a mark nowhere.
export const home = (w, mark) => { const id = index(w).home.get(mark); return id ? table(w)[id].context : null; };
export const homeRow = (w, mark) => { const id = index(w).home.get(mark); return id ? withId(table(w), id) : null; };
// The ids of the marks whose home is `context` (in no order).
export function marksIn(w, context) {
  const t = table(w), out = [];
  for (const id of index(w).context.get(context) || []) { const r = t[id]; if (r && r.rule == null) out.push(r.mark); }
  return out;
}
// How many marks are at home in a context (without making the list).
export function countIn(w, context) {
  let n = 0;
  const t = table(w);
  for (const id of index(w).context.get(context) || []) if (t[id]?.rule == null) n++;
  return n;
}

// ---- Where a rule puts a mark (phase 4: rules keep no state of their own) ----
// A rule's position for a mark in a context: Pessoa's and Proust's { x, y } (auto: laid by the
// rule, not by hand), a Joyce train's { x, y, hand? }, a train's thought's { dx, dy } off its
// line, a room's cell { col, row } under 'borges', a Twin's side { side } under 'twin', and
// 'tray': a thought that waits in the tray of every rule that lays thoughts itself. A rule reads
// these rows and proposes new ones; it never keeps a copy (Law 3: tests/rules.test.js).

export const spot = (w, context, mark, rule) => table(w)[ruleId(context, mark, rule)]?.position ?? null;
export const hasSpot = (w, context, mark, rule) => !!table(w)[ruleId(context, mark, rule)];
export const putSpot = (w, context, mark, rule, position = null) => set(w, { mark, context, rule, position });
export const dropSpot = (w, context, mark, rule) => drop(w, ruleId(context, mark, rule));
// Every mark a rule has a row for in a context: Map mark → position (null for a row without one).
export function spots(w, context, rule) {
  const t = table(w), out = new Map();
  for (const id of index(w).context.get(context) || []) { const r = t[id]; if (r && r.rule === rule) out.set(r.mark, r.position ?? null); }
  return out;
}
// Every row of one rule, anywhere (a rule renamed or gone).
export const ofRule = (w, rule) => all(w).filter((r) => r.rule === rule);

// ---- Writing ----

const tidy = (r) => {
  const out = { mark: String(r.mark), context: String(r.context) };
  if (r.rule != null) out.rule = String(r.rule);
  if (r.position != null && typeof r.position === 'object') out.position = { ...r.position };
  if (r.pinned) out.pinned = true;
  return out;
};

// Puts a row in the table under its own id (one there already is replaced). Returns the row.
export function set(w, row) {
  const r = tidy(row);
  const id = idOf(r), t = table(w), ix = index(w);
  if (t[id]) { leave(ix, id, t[id]); bump(t, t[id].context); }
  t[id] = r;
  enter(ix, id, r);
  bump(t, r.context);
  return withId(t, id);
}
// Takes a row out. True if there was one. (A mark's home row goes only as it gets another, or
// as the mark itself is deleted: the callers here keep that true, and the laws test it.)
export function drop(w, id) {
  const t = table(w);
  if (!t[id]) return false;
  leave(index(w), id, t[id]);
  bump(t, t[id].context);
  delete t[id];
  return true;
}

// The mark's home is `context` now (with `position`, when given): its old home row goes, and
// the rule rows of its old context with it (it is in a new place; the rules there place it
// afresh). Returns the new row.
export function setHome(w, mark, context, position = null) {
  const was = homeRow(w, mark);
  if (was && was.context !== context) for (const r of of(w, mark)) if (r.context === was.context) drop(w, r.id);
  return set(w, { mark, context, position: position ?? (was?.context === context ? was.position : null) });
}
// Changes the position on a mark's home row (null: none). False if it has no home.
export function setHomePosition(w, mark, position) {
  const r = homeRow(w, mark);
  if (!r) return false;
  set(w, { ...r, position });
  return true;
}

// Every row of a mark goes (it was deleted), and every row in it as a context goes too (only
// when it held nothing: a context's marks are deleted with it first). Returns how many.
export function dropMark(w, mark) {
  const ix = index(w);
  const ids = new Set([...(ix.mark.get(mark) || []), ...[...(ix.context.get(mark) || [])].filter((id) => table(w)[id]?.rule != null)]);
  for (const id of ids) drop(w, id);
  return ids.size;
}

// A saved table, repaired against the marks there are: a row whose mark or context is gone, or
// a second home for a mark, goes. `ok(row)`: the world's own rule for a row, or it goes.
export function repair(w, ok = () => true) {
  const t = table(w);
  const homes = new Set();
  for (const [id, r] of Object.entries(t)) {
    if (!r || typeof r !== 'object' || !w.things[r.mark] || !w.things[r.context] || r.mark === r.context || !ok(r)) { delete t[id]; continue; }
    const row = tidy(r), want = idOf(row);
    if (row.rule == null) { if (homes.has(row.mark)) { delete t[id]; continue; } homes.add(row.mark); }
    if (want !== id) { delete t[id]; t[want] = row; } else t[id] = row;
  }
  touched(w);
  return t;
}
