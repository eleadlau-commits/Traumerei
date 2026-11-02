// Create's world, thought first. There is one kind of object, the thought, and everything is one:
//
//   line     { text }                         a passing thought, written until Enter
//   passage  { title, body }                  a paragraph, or a small article
//   picture  { src, text }                    a picture (a small JPEG data: URL) and its caption
//   train    { x, y, title, folded }          thoughts joined by time, read in the order they were
//                                             written; folded, it shows as one thought (its title)
//   room     { name, tint, light, opacity,    a thought that holds thoughts, seen through a mode;
//              col, row, size }               on the rooms page it is a square of size × size cells
//                                             at (col, row) of the grid
//
// Every thought has { id, kind, parent, at }. `parent` is the thought it sits inside: a line,
// passage or picture sits in a train; a train sits in a room; a room sits in a room, or at the top
// (parent null) where the rooms page shows it. So moving, folding, naming and tinting are the same
// few operations whatever the thought is. A train's order is time, and is never broken.
//
// world = {
//   v: 2,
//   things: { [id]: thought },
//   views:  { [room]: { mode, x, y, zoom } }        each room's mode and where it was looked at
//   places: { [room]: { [thought]: { x, y } } }     Pessoa: where a thought was dragged to
// }
//
// No screen here, so it can be tested on its own (tests/model.test.js).

export const MESSY = 'messy';
export const MODES = [
  { id: 'joyce', name: 'Joyce' },
  { id: 'pessoa', name: 'Pessoa' },
];
export const DEFAULT_MODE = 'joyce';
export const LEAVES = ['line', 'passage', 'picture'];
export const KINDS = [...LEAVES, 'train', 'room'];
export const kindOf = (th) => (KINDS.includes(th?.kind) ? th.kind : 'line');
export const isLeaf = (th) => LEAVES.includes(kindOf(th));

let counter = 0;
export function uid(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const messyRoom = (now) => ({ id: MESSY, kind: 'room', parent: null, at: now, name: 'Messy thoughts', col: 0, row: 0, size: 2 });

export function emptyWorld(now = Date.now()) {
  return { v: 2, things: { [MESSY]: messyRoom(now) }, views: {}, places: {} };
}

// A saved world, brought up to date and repaired: the messy room always exists; a train whose
// room is gone goes to the messy room, a room whose room is gone goes to the top, and a line,
// passage or picture whose train is gone is dropped.
export function loadWorld(saved, now = Date.now()) {
  let w = saved && typeof saved === 'object' ? saved : {};
  if (w.v !== 2) w = fromV1(w, now);
  w = Object.assign(emptyWorld(now), w);
  for (const key of ['things', 'views', 'places']) if (!w[key] || typeof w[key] !== 'object') w[key] = {};
  if (!w.things[MESSY]) w.things[MESSY] = messyRoom(now);
  for (const th of Object.values(w.things)) {
    if (th.parent == null || w.things[th.parent]) continue;
    if (kindOf(th) === 'room') th.parent = null;
    else if (kindOf(th) === 'train') th.parent = MESSY;
    else delete w.things[th.id];
  }
  const messy = w.things[MESSY];
  messy.size = 2;
  if (messy.col == null) { messy.col = 0; messy.row = 0; }
  gridRooms(w);
  return w;
}

// The first prototype's shape (rooms, trains and thoughts kept apart), turned into thoughts.
function fromV1(old, now) {
  const w = emptyWorld(now);
  for (const r of old.rooms || []) w.things[r.id] = { id: r.id, kind: 'room', parent: null, at: r.at ?? now, name: r.name };
  for (const t of Object.values(old.trains || {})) w.things[t.id] = { id: t.id, kind: 'train', parent: t.room, at: t.at ?? now, x: t.x, y: t.y, title: '' };
  for (const th of Object.values(old.thoughts || {})) {
    const { room: _room, train, parts, ...rest } = th;
    if (parts?.length) { // a folded passage: its parts come back, and the train is folded
      const t = w.things[train];
      if (t) Object.assign(t, { folded: true, title: th.title || '' });
      for (const p of parts) w.things[p.id] = { ...p, kind: kindOf(p), parent: train };
    } else w.things[th.id] = { ...rest, kind: kindOf(th), parent: train };
  }
  w.views = old.views || {};
  w.places = old.places || {};
  return w;
}

// ---- Reading ----

export const thing = (w, id) => w.things[id] || null;
export const room = (w, id) => (kindOf(w.things[id]) === 'room' ? w.things[id] : null);

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

export const children = (w, id) => Object.values(w.things).filter((th) => th.parent === id).sort(byTime);

// The rooms at the top (the rooms page), oldest first.
export const rooms = (w) => children(w, null).filter((th) => kindOf(th) === 'room');

// The room a thought is in (itself, if it is a room).
export function roomOf(w, id) {
  let th = w.things[id];
  while (th && kindOf(th) !== 'room') th = w.things[th.parent];
  return th || null;
}

export const trainThoughts = (w, trainId) => children(w, trainId).filter(isLeaf);
export const roomTrains = (w, roomId) =>
  children(w, roomId).filter((th) => kindOf(th) === 'train' && trainThoughts(w, th.id).length);

// Every line, passage and picture in a room, in time order.
export const roomThoughts = (w, roomId) => roomTrains(w, roomId).flatMap((t) => trainThoughts(w, t.id)).sort(byTime);

// What floats in Pessoa: each thought on its own, but a folded train as the one thought it is.
export const roomUnits = (w, roomId) =>
  roomTrains(w, roomId).flatMap((t) => (t.folded ? [t] : trainThoughts(w, t.id))).sort(byTime);

export function lastWritten(w, roomId) {
  const all = roomThoughts(w, roomId);
  return all.length ? Math.max(...all.map((th) => th.at)) : null;
}

export function view(w, roomId) {
  if (!w.views[roomId]) w.views[roomId] = { mode: DEFAULT_MODE, x: 0, y: 0, zoom: 1 };
  return w.views[roomId];
}

// The words of a thought, as plain text.
export function thoughtText(w, th) {
  switch (kindOf(th)) {
    case 'passage': return [th.title, th.body].filter(Boolean).join(' — ');
    case 'picture': return th.text ? `[${th.text}]` : '[picture]';
    case 'train': return trainThoughts(w, th.id).map((x) => thoughtText(w, x)).join('\n');
    case 'room': return th.name || '';
    default: return th.text || '';
  }
}

// ---- Making and changing thoughts ----

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lines = (s) => String(s ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const clamp01 = (v, d) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : d);

// A thought's own fields, tidied; null when a line, passage or picture would be empty.
function tidy(f) {
  const kind = kindOf(f);
  if (kind === 'line') {
    const text = oneLine(f.text);
    return text ? { kind, text } : null;
  }
  if (kind === 'passage') {
    const title = oneLine(f.title), body = lines(f.body);
    return title || body ? { kind, title, body } : null;
  }
  if (kind === 'picture') {
    const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
    return src ? { kind, src, text: oneLine(f.text) } : null;
  }
  if (kind === 'train') {
    const out = { kind, x: Math.round(+f.x || 0), y: Math.round(+f.y || 0), title: oneLine(f.title) };
    if (f.folded) out.folded = true;
    return out;
  }
  const out = { kind, name: oneLine(f.name) || 'Untitled' };
  if (typeof f.tint === 'string' && /^#[0-9a-f]{6}$/i.test(f.tint)) out.tint = f.tint;
  if (f.light != null) out.light = clamp01(f.light, 0.5);
  if (f.opacity != null) out.opacity = clamp01(f.opacity, 1);
  if (Number.isInteger(f.col) && Number.isInteger(f.row) && f.col >= 0 && f.row >= 0) { out.col = f.col; out.row = f.row; }
  out.size = f.size === 2 ? 2 : 1;
  return out;
}

// What can sit inside what: lines, passages and pictures in trains, trains in rooms, rooms in
// rooms or at the top (null).
export function canHold(w, parent, kind) {
  const p = parent == null ? null : w.things[parent];
  if (parent != null && !p) return false;
  if (LEAVES.includes(kind)) return kindOf(p) === 'train' && p != null;
  if (kind === 'train') return p != null && kindOf(p) === 'room';
  if (kind === 'room') return p == null || kindOf(p) === 'room';
  return false;
}

// Puts a new thought inside `parent`. Returns it, or null (adding nothing) if it would be empty
// or can't go there.
export function create(w, parent, fields, now = Date.now()) {
  const th = tidy(fields);
  if (!th || !canHold(w, parent, th.kind)) return null;
  Object.assign(th, { id: uid(th.kind[0]), parent: parent ?? null, at: now });
  w.things[th.id] = th;
  return th;
}

// Changes a thought's own fields (never its kind, place or time). A line, passage or picture
// left empty is removed.
export function update(w, id, fields) {
  const th = w.things[id];
  if (!th) return null;
  const next = tidy({ ...th, ...fields, kind: th.kind });
  if (!next) { remove(w, id); return null; }
  if (kindOf(th) === 'train' && !next.folded) delete th.folded;
  Object.assign(th, next);
  return th;
}

// Removes a thought and everything inside it; a train left empty goes too. Messy thoughts stays.
export function remove(w, id) {
  const th = w.things[id];
  if (!th || id === MESSY) return;
  for (const c of children(w, id)) remove(w, c.id);
  delete w.things[id];
  for (const r of Object.keys(w.places)) delete w.places[r][id];
  delete w.views[id];
  const p = w.things[th.parent];
  if (p && kindOf(p) === 'train' && !children(w, p.id).length) remove(w, p.id);
}

// ---- The shared operations ----

// True if `id` is `ancestor`, or somewhere inside it.
export function inside(w, id, ancestor) {
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (th.id === ancestor) return true;
  return false;
}

// Moves a thought into `into` (a room, or a train). A train or a room just changes parent; a
// line, passage or picture put into a room gets a train of its own there (at x, y), and the rest
// of its old train stays joined. Never into itself.
export function move(w, id, into, x = 0, y = 0) {
  const th = w.things[id];
  if (!th || !w.things[into] || th.parent === into || inside(w, into, id)) return false;
  const fromRoom = roomOf(w, kindOf(th) === 'room' ? th.parent : id);
  let target = into;
  if (isLeaf(th) && kindOf(w.things[into]) === 'room') target = create(w, into, { kind: 'train', x, y }, th.at)?.id;
  if (!target || !canHold(w, target, kindOf(th))) return false;
  const old = th.parent;
  th.parent = target;
  if (kindOf(th) === 'train') { th.x = Math.round(x); th.y = Math.round(y); }
  if (fromRoom && w.places[fromRoom.id]) {
    delete w.places[fromRoom.id][id];
    for (const c of children(w, id)) delete w.places[fromRoom.id][c.id];
  }
  const was = w.things[old];
  if (was && kindOf(was) === 'train' && !children(w, old).length) remove(w, old);
  return true;
}

// Names a thought: a room's name, a train's or a passage's title.
export function name(w, id, text) {
  const th = w.things[id];
  if (th) update(w, id, kindOf(th) === 'room' ? { name: text } : { title: text });
}

// A train folds into one thought, and unfolds back; its thoughts and their order never change.
export function fold(w, trainId, title) {
  if (kindOf(w.things[trainId]) !== 'train') return false;
  update(w, trainId, { folded: true, ...(title != null ? { title } : {}) });
  return true;
}
export function unfold(w, trainId) {
  const t = w.things[trainId];
  if (kindOf(t) !== 'train' || !t.folded) return false;
  delete t.folded;
  return true;
}

// ---- Shortcuts the screens use ----

export function addRoom(w, text = 'Untitled', now, cell = null, cols = 6) {
  const r = create(w, null, { kind: 'room', name: text, ...(cell || {}) }, now);
  if (r && (!cell || !placeRoom(w, r.id, cell.col, cell.row, cols))) {
    delete r.col; delete r.row;
    gridRooms(w, cols);
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

// The room at a cell (other than `except`), or null.
export function roomAt(w, col, row, except = null) {
  return rooms(w).find((r) => r.id !== except && r.col != null && cells(r).some(([c, rr]) => c === col && rr === row)) || null;
}

// Puts a top-level room at (col, row) if all its cells are free. Returns whether it moved.
export function placeRoom(w, id, col, row, cols = Infinity) {
  const r = room(w, id);
  if (!r || col < 0 || row < 0 || col + (r.size || 1) > cols) return false;
  const want = cells({ ...r, col, row });
  if (want.some(([c, rr]) => roomAt(w, c, rr, id))) return false;
  r.col = col;
  r.row = row;
  return true;
}

// Gives every top-level room without a place the first free cell (left to right, top to bottom,
// `cols` wide), and returns the rooms.
export function gridRooms(w, cols = 6) {
  const all = rooms(w).sort((a, b) => (b.id === MESSY) - (a.id === MESSY));
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
  return rooms(w);
}
export const startTrain = (w, roomId, x, y, now) => create(w, roomId, { kind: 'train', x, y }, now);
export const addThought = (w, trainId, text, now) => create(w, trainId, { kind: 'line', text }, now);

// ---- Where things go ----

// Pessoa's loose spiral: the i-th thought (in time order) sits on an Archimedean spiral r = bθ,
// spaced evenly along its length, nudged a little by its id so it doesn't look ruled.
export const SPIRAL = { step: 230, gap: 190 }; // px between neighbours along the spiral; between turns
export function spiralPoint(i, id = '') {
  const b = SPIRAL.gap / (2 * Math.PI);
  const theta = Math.sqrt((2 * SPIRAL.step * (i + 0.6)) / b);
  const r = b * theta;
  const h = hash(id);
  const jx = ((h & 0xff) / 255 - 0.5) * 36;
  const jy = (((h >> 8) & 0xff) / 255 - 0.5) * 28;
  return { x: r * Math.cos(theta) + jx, y: r * Math.sin(theta) + jy };
}

export function pessoaPoint(w, roomId, id) {
  const placed = w.places[roomId]?.[id];
  if (placed) return placed;
  const units = roomUnits(w, roomId);
  const i = units.findIndex((u) => u.id === id);
  return spiralPoint(i < 0 ? units.length : i, id);
}

export function place(w, roomId, id, x, y) {
  (w.places[roomId] ||= {})[id] = { x, y };
}

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

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
