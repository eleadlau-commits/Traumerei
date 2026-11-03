// Create's world, thought first. There is one kind of object, the thought, and everything is one:
//
//   line     { text }                         a passing thought, written until Enter
//   passage  { title, body }                  a paragraph, or a small article
//   picture  { src, text }                    a picture (a small JPEG data: URL) and its caption
//   train    { x, y, title, folded }          thoughts joined by time, read in the order they were
//                                             written; folded, it shows as one thought (its title)
//   room     { name, tint, light, opacity,    a thought that holds thoughts, seen through a mode;
//              col, row, size, page,          on the rooms page it is a square of size × size cells
//              desc, locked, archived,        at (col, row) of the grid. desc: a line or two about
//              form }                         it. locked: nothing in it can change, and its square
//                                             stays where it is. archived: off the grid, on the
//                                             Archive page (and still found by search).
//                                             form 'borges': a room of rooms (see below).
//                                             page: which page of the rooms page it is on (top only)
//
// Two kinds of room. A mode room holds trains, seen through an ontological mode (Joyce, Pessoa;
// its view's mode): a small room (1 × 1) holds the one it was made with; a big room (Messy
// thoughts, or any 2 × 2 room) holds them all and switches between them inside. A Borges room
// (form: 'borges') holds rooms instead, on a grid of its own like the rooms page: the rooms page's
// own kind, discrete sets each thing is in once. Rooms sit at the top (parent null, the rooms page,
// on one of its pages) or inside a Borges room. Doors (world.doors) link two rooms that are both
// inside Borges rooms (never on the rooms page itself), across Borges rooms too, and thicken with use.
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
//   doors:  { [id]: { a, b, uses, at } }            a door between rooms a and b
//   pages:  n                                       how many pages the rooms page has (at least 1)
// }
//
// No screen here, so it can be tested on its own (tests/model.test.js).

export const MESSY = 'messy';
export const MODES = [
  { id: 'joyce', name: 'Joyce' },
  { id: 'pessoa', name: 'Pessoa' },
];
export const DEFAULT_MODE = 'joyce';
export const BORGES = 'borges'; // the room of rooms
export const KINDS_OF_ROOM = [...MODES.map((m) => ({ id: m.id, name: m.name })), { id: BORGES, name: 'Borges' }];
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
  return { v: 2, things: { [MESSY]: messyRoom(now) }, views: {}, places: {}, doors: {}, pages: 1 };
}

// A saved world, brought up to date and repaired: the messy room always exists; a train whose
// room is gone goes to the messy room, a room whose room is gone goes to the top, and a line,
// passage or picture whose train is gone is dropped.
export function loadWorld(saved, now = Date.now()) {
  let w = saved && typeof saved === 'object' ? saved : {};
  if (w.v !== 2) w = fromV1(w, now);
  w = Object.assign(emptyWorld(now), w);
  for (const key of ['things', 'views', 'places', 'doors']) if (!w[key] || typeof w[key] !== 'object') w[key] = {};
  w.pages = Math.max(1, Math.floor(+w.pages) || 1);
  if (!w.things[MESSY]) w.things[MESSY] = messyRoom(now);
  for (const th of Object.values(w.things)) {
    const p = w.things[th.parent];
    if (kindOf(th) === 'room' && th.parent != null && !isBorges(p)) th.parent = null; // rooms sit only at the top or in a Borges room
    else if (kindOf(th) === 'train' && isBorges(p)) th.parent = MESSY;
    if (th.parent == null || w.things[th.parent]) continue;
    if (kindOf(th) === 'room') th.parent = null;
    else if (kindOf(th) === 'train') th.parent = MESSY;
    else delete w.things[th.id];
  }
  const messy = w.things[MESSY];
  messy.size = 2;
  messy.parent = null;
  delete messy.page;
  delete messy.form;
  if (messy.col == null) { messy.col = 0; messy.row = 0; }
  for (const [id, d] of Object.entries(w.doors)) if (!room(w, d?.a) || !room(w, d?.b) || d.a === d.b) delete w.doors[id];
  tidyDoors(w);
  gridAll(w);
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

export const isBorges = (th) => kindOf(th) === 'room' && th.form === BORGES;
// A big room (Messy thoughts, or any 2 × 2 mode room) switches between the modes inside; a small
// one keeps the mode it was made with.
export const isBig = (th) => kindOf(th) === 'room' && !isBorges(th) && (th.id === MESSY || (th.size || 1) > 1);

export const children = (w, id) => Object.values(w.things).filter((th) => th.parent === id).sort(byTime);

// The rooms at the top (the rooms page, every page), oldest first; archived ones are on the Archive page.
export const rooms = (w) => children(w, null).filter((th) => kindOf(th) === 'room' && !th.archived);
// Every archived room, wherever it was.
export const archived = (w) => Object.values(w.things).filter((th) => kindOf(th) === 'room' && th.archived).sort(byTime);
// Every room that holds thoughts (not a Borges room), not archived: where a thought can be moved to.
export const modeRooms = (w) => Object.values(w.things).filter((th) => kindOf(th) === 'room' && !isBorges(th) && !th.archived).sort(byTime);
// The rooms on one grid: inside a Borges room, or on one page of the rooms page (parent null).
export const roomsIn = (w, parent = null, page = 0) => children(w, parent)
  .filter((th) => kindOf(th) === 'room' && !th.archived && (parent != null || (th.page || 0) === page));
// The rooms a room is inside, from the top down (not itself).
export function roomPath(w, id) {
  const out = [];
  for (let th = w.things[w.things[id]?.parent]; th; th = w.things[th.parent]) if (kindOf(th) === 'room') out.unshift(th);
  return out;
}

// True if `id` is a locked room, or is somewhere inside one: then nothing about it can change.
export function shut(w, id) {
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (kindOf(th) === 'room' && th.locked) return true;
  return false;
}

// The room at the top (on the rooms page, or archived) that a thought is in.
export function topRoom(w, id) {
  let top = null;
  for (let th = w.things[id]; th; th = w.things[th.parent]) if (kindOf(th) === 'room') top = th;
  return top;
}

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
export const DESC = 280; // a room's description, at most this many letters
const clamp01 = (v, d) => (Number.isFinite(+v) ? Math.min(1, Math.max(0, +v)) : d);

// A line, passage or picture keeps where it was dragged to in its train (dx, dy from the train's
// corner), and when it was last changed.
function spot(f, out) {
  if (Number.isFinite(f.dx) && Number.isFinite(f.dy)) { out.dx = Math.round(f.dx); out.dy = Math.round(f.dy); }
  if (Number.isFinite(f.edited)) out.edited = f.edited;
  return out;
}

// A thought's own fields, tidied; null when a line, passage or picture would be empty.
function tidy(f) {
  const kind = kindOf(f);
  if (kind === 'line') {
    const text = lines(String(f.text ?? '').split('\n').map(oneLine).join('\n'));
    return text ? spot(f, { kind, text }) : null;
  }
  if (kind === 'passage') {
    const title = oneLine(f.title), body = lines(f.body);
    return title || body ? spot(f, { kind, title, body }) : null;
  }
  if (kind === 'picture') {
    const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
    return src ? spot(f, { kind, src, text: oneLine(f.text) }) : null;
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
  const desc = lines(f.desc).slice(0, DESC);
  if (desc) out.desc = desc;
  if (f.locked) out.locked = true;
  if (f.archived) { out.archived = true; delete out.col; delete out.row; }
  if (f.form === BORGES) out.form = BORGES;
  if (Number.isInteger(f.page) && f.page > 0) out.page = f.page;
  return out;
}

// What can sit inside what: lines, passages and pictures in trains, trains in mode rooms, rooms
// in Borges rooms or at the top (null).
export function canHold(w, parent, kind) {
  const p = parent == null ? null : w.things[parent];
  if (parent != null && !p) return false;
  if (LEAVES.includes(kind)) return kindOf(p) === 'train' && p != null;
  if (kind === 'train') return p != null && kindOf(p) === 'room' && !isBorges(p);
  if (kind === 'room') return p == null || isBorges(p);
  return false;
}

// Puts a new thought inside `parent`. Returns it, or null (adding nothing) if it would be empty
// or can't go there.
export function create(w, parent, fields, now = Date.now()) {
  const th = tidy(fields);
  if (!th || !canHold(w, parent, th.kind) || (parent != null && shut(w, parent))) return null;
  Object.assign(th, { id: uid(th.kind[0]), parent: parent ?? null, at: now });
  w.things[th.id] = th;
  return th;
}

// Changes a thought's own fields (never its kind, place or time). A line, passage or picture
// left empty is removed.
export function update(w, id, fields, now = Date.now()) {
  const th = w.things[id];
  if (!th || (kindOf(th) !== 'room' && shut(w, id))) return null; // a room itself can still be renamed, coloured or unlocked
  const next = tidy({ ...th, ...fields, kind: th.kind, edited: now });
  if (!next) { remove(w, id); return null; }
  if (kindOf(th) === 'train' && !next.folded) delete th.folded;
  if (kindOf(th) === 'room') for (const k of ['desc', 'locked', 'archived', 'page', 'col', 'row']) if (!(k in next)) delete th[k];
  Object.assign(th, next);
  return th;
}

// Removes a thought and everything inside it; a train left empty goes too. Messy thoughts stays.
export function remove(w, id) {
  const th = w.things[id];
  if (!th || id === MESSY || shut(w, id)) return;
  for (const c of children(w, id)) remove(w, c.id);
  delete w.things[id];
  for (const r of Object.keys(w.places)) delete w.places[r][id];
  delete w.views[id];
  for (const [d, door] of Object.entries(w.doors || {})) if (door.a === id || door.b === id) delete w.doors[d];
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
  if (!th || !w.things[into] || th.parent === into || inside(w, into, id) || shut(w, id) || shut(w, into)) return false;
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
  if (kindOf(t) !== 'train' || !t.folded || shut(w, trainId)) return false;
  delete t.folded;
  return true;
}

// ---- Shortcuts the screens use ----

// A new room on a grid (`where`: { parent, page }), in `cell` if it is free, or the first free one.
// `kind`: a mode ('joyce', 'pessoa') or BORGES.
export function addRoom(w, text = 'Untitled', now, cell = null, cols = 6, where = {}, kind = DEFAULT_MODE) {
  const parent = where.parent ?? null, page = parent == null ? where.page || 0 : 0;
  const r = create(w, parent, { kind: 'room', name: text, ...(cell || {}), page, ...(kind === BORGES ? { form: BORGES } : {}) }, now);
  if (!r) return null;
  if (kind !== BORGES && MODES.some((m) => m.id === kind)) view(w, r.id).mode = kind;
  if (!cell || !placeRoom(w, r.id, cell.col, cell.row, cols)) {
    delete r.col; delete r.row;
    gridRooms(w, cols, parent, page);
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

// The room at a cell of a grid (other than `except`), or null.
export function roomAt(w, col, row, except = null, parent = null, page = 0) {
  return roomsIn(w, parent, page).find((r) => r.id !== except && r.col != null && cells(r).some(([c, rr]) => c === col && rr === row)) || null;
}

// Puts a room at (col, row) of its own grid if all its cells are free. Returns whether it moved.
export function placeRoom(w, id, col, row, cols = Infinity) {
  const r = room(w, id);
  if (!r || r.locked || r.archived || col < 0 || row < 0 || col + (r.size || 1) > cols) return false;
  const want = cells({ ...r, col, row });
  if (want.some(([c, rr]) => roomAt(w, c, rr, id, r.parent ?? null, r.page || 0))) return false;
  r.col = col;
  r.row = row;
  return true;
}

// Every grid's rooms given a place.
export function gridAll(w, cols = 6) {
  const grids = new Set();
  for (const th of Object.values(w.things)) if (kindOf(th) === 'room' && !th.archived) grids.add(`${th.parent ?? ''}|${th.parent == null ? th.page || 0 : 0}`);
  for (const g of grids) {
    const [p, page] = g.split('|');
    gridRooms(w, cols, p || null, +page);
  }
}

// Gives every room on one grid without a place the first free cell (left to right, top to bottom,
// `cols` wide), and returns the grid's rooms.
export function gridRooms(w, cols = 6, parent = null, page = 0) {
  const all = roomsIn(w, parent, page).sort((a, b) => (b.id === MESSY) - (a.id === MESSY));
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
  return roomsIn(w, parent, page);
}

// ---- Rooms of rooms, pages and doors ----

// Puts a room into a Borges room (or at the top, on `page`), at the first free cell there.
export function putRoom(w, id, into = null, cols = 6, page = 0) {
  const r = room(w, id);
  const p = into == null ? null : room(w, into);
  if (!r || id === MESSY || r.locked || (into != null && (!isBorges(p) || inside(w, into, id) || shut(w, into)))) return false;
  r.parent = into ?? null;
  delete r.col; delete r.row; delete r.archived;
  if (into == null && page > 0) r.page = page; else delete r.page;
  gridRooms(w, cols, r.parent, r.page || 0);
  tidyDoors(w);
  return true;
}

// Merges two rooms. Dropped on a Borges room, a room goes inside it; otherwise a new Borges room
// takes the second room's cell and holds both. Returns the Borges room, or null.
export function merge(w, a, b, now = Date.now(), cols = 6) {
  const A = room(w, a), B = room(w, b);
  if (!A || !B || a === b || a === MESSY || b === MESSY || A.locked || B.locked || inside(w, b, a)) return null;
  if (isBorges(B)) return putRoom(w, a, b, cols) ? B : null;
  const where = { parent: B.parent ?? null, page: B.page || 0 };
  const C = create(w, where.parent, { kind: 'room', name: 'Untitled', form: BORGES, size: B.size || 1, page: where.page }, now);
  if (!C) return null;
  const at = { col: B.col, row: B.row };
  B.parent = C.id; delete B.page; B.col = 0; B.row = 0;
  A.parent = C.id; delete A.page; delete A.col; delete A.row;
  if (at.col != null) { C.col = at.col; C.row = at.row; }
  gridRooms(w, cols, C.id, 0);
  gridRooms(w, cols, where.parent, where.page);
  return C;
}

// The rooms page's pages: at least one, and enough for every room on them.
export const pageCount = (w) => Math.max(w.pages || 1, ...rooms(w).map((r) => (r.page || 0) + 1));
export function addPage(w) { w.pages = pageCount(w) + 1; return w.pages - 1; }

// A room can have doors only while it is inside a Borges room (never on the rooms page itself).
export const canDoor = (w, id) => !!room(w, id) && isBorges(w.things[w.things[id].parent]);
// Takes away the doors of rooms that can no longer have them (moved out to the rooms page).
export function tidyDoors(w) {
  for (const [id, d] of Object.entries(w.doors || {})) if (!canDoor(w, d.a) || !canDoor(w, d.b)) delete w.doors[id];
}
// A door between two rooms inside Borges rooms (never a room and itself, never twice). Returns it.
export function addDoor(w, a, b, now = Date.now()) {
  if (!canDoor(w, a) || !canDoor(w, b) || a === b) return null;
  w.doors ||= {};
  const had = Object.values(w.doors).find((d) => (d.a === a && d.b === b) || (d.a === b && d.b === a));
  if (had) return had;
  const d = { id: uid('d'), a, b, uses: 0, at: now };
  w.doors[d.id] = d;
  return d;
}
export function removeDoor(w, id) { if (w.doors?.[id]) { delete w.doors[id]; return true; } return false; }
// A room's doors: each with the room on its other side.
export const doorsOf = (w, id) => Object.values(w.doors || {})
  .filter((d) => d.a === id || d.b === id)
  .map((d) => ({ door: d, other: room(w, d.a === id ? d.b : d.a) }))
  .filter((x) => x.other)
  .sort((x, y) => y.door.uses - x.door.uses || x.door.at - y.door.at);
// Going through a door wears it in.
export function useDoor(w, id) { const d = w.doors?.[id]; if (d) d.uses = (d.uses || 0) + 1; return d || null; }
// How thick a door's line is drawn, from how often it has been gone through.
export const doorWidth = (d) => 1 + 1.4 * Math.log2(1 + (d?.uses || 0));
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
  if (shut(w, roomId)) return;
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

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---- Joyce: each thought of a train on its own, joined by a line ----

// How far below the one before a thought sits, until it is dragged somewhere else.
export const STEP = { line: 58, passage: 190, picture: 270, train: 190 };
const LINE = 29; // each extra line of a thought written over several lines

// How far below a thought the next one sits.
export function stepAfter(th) {
  const kind = kindOf(th);
  if (kind !== 'line') return STEP[kind];
  return STEP.line + LINE * ((String(th.text || '').match(/\n/g) || []).length);
}

// Where each thought of a train sits ({ id: {x, y} }, world units): where it was dragged to, or
// a step below the one before.
export function trainSpots(w, trainId) {
  const t = w.things[trainId];
  const out = {};
  if (!t) return out;
  let x = t.x, y = t.y - STEP.line;
  let step = STEP.line;
  for (const th of trainThoughts(w, trainId)) {
    if (Number.isFinite(th.dx)) { x = t.x + th.dx; y = t.y + th.dy; }
    else y += step;
    out[th.id] = { x, y };
    step = stepAfter(th);
  }
  return out;
}

// Where the next thought of a train goes.
export function nextSpot(w, trainId) {
  const all = trainThoughts(w, trainId);
  const t = w.things[trainId];
  if (!all.length) return { x: t.x, y: t.y };
  const last = all[all.length - 1];
  const p = trainSpots(w, trainId)[last.id];
  return { x: p.x, y: p.y + stepAfter(last) };
}

// Drags one thought of a train to (x, y); its train stays joined.
export function nudge(w, id, x, y, now = Date.now()) {
  const th = w.things[id];
  const t = th && w.things[th.parent];
  if (!t || !isLeaf(th) || kindOf(t) !== 'train' || shut(w, id)) return false;
  th.dx = Math.round(x - t.x);
  th.dy = Math.round(y - t.y);
  th.edited = now;
  return true;
}

// How slack the line between two thoughts is (0 taut … 1 loose): thoughts written close together
// are joined taut; a longer pause leaves slack. Pulled far apart, the line goes straight again.
export const PAUSE = { quick: 20, long: 3600 }; // seconds
export function slack(a, b, dist = 0, tension = 0.5) {
  const gap = Math.max(0, ((b.at ?? 0) - (a.at ?? 0)) / 1000);
  const fromTime = Math.min(1, Math.log1p(gap / PAUSE.quick) / Math.log1p(PAUSE.long / PAUSE.quick));
  const pulled = Math.max(0, Math.min(1, 1 - (dist - STEP.line) / 520));
  return Math.max(0, Math.min(1, fromTime * pulled * (1 - tension) * 2));
}

// The line from p to q with that slack, as an SVG path: straight when taut, a soft curve when loose.
export function strand(p, q, k) {
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  const bow = k * Math.max(26, d * 0.42);
  const cx = mx + (-dy / d) * bow, cy = my + (dx / d) * bow;
  const r = (v) => Math.round(v * 10) / 10;
  return k < 0.02 ? `M${r(p.x)} ${r(p.y)}L${r(q.x)} ${r(q.y)}` : `M${r(p.x)} ${r(p.y)}Q${r(cx)} ${r(cy)} ${r(q.x)} ${r(q.y)}`;
}

// ---- The timeline: a room's thoughts on one line, in the order they were last changed ----

export const lastChanged = (th) => Math.max(th.at ?? 0, th.edited ?? 0);
export function timeline(w, roomId) {
  return roomTrains(w, roomId)
    .flatMap((t) => trainThoughts(w, t.id).map((th) => ({ th, train: t })))
    .sort((a, b) => lastChanged(a.th) - lastChanged(b.th) || byTime(a.th, b.th));
}

// A train as a tag: its title, or its first words.
export function tagName(w, trainId) {
  const t = w.things[trainId];
  if (!t) return '';
  if (t.title) return t.title;
  const first = trainThoughts(w, trainId)[0];
  const words = first ? thoughtText(w, first).split(/\s+/).slice(0, 3).join(' ') : '';
  return words || 'A train';
}

// ---- Search: every thought, train and room whose words hold the query ----

export function search(w, query, most = 30) {
  const q = oneLine(query).toLowerCase();
  if (!q) return [];
  const out = [];
  for (const th of Object.values(w.things).sort(byTime).reverse()) {
    const kind = kindOf(th);
    const text = kind === 'train' ? th.title || '' : kind === 'room' ? th.name || '' : thoughtText(w, th);
    if (!oneLine(text).toLowerCase().includes(q)) continue;
    const r = roomOf(w, kind === 'room' ? th.id : th.id);
    out.push({ id: th.id, kind, text, room: r?.id ?? null, roomName: r?.name ?? '' });
    if (out.length >= most) break;
  }
  return out;
}

// A room's size on the grid (1 or 2 cells a side), if the cells it would take are free.
export function sizeRoom(w, id, size, cols = Infinity) {
  const r = room(w, id);
  if (!r || r.locked) return false;
  const was = r.size || 1;
  r.size = size === 2 ? 2 : 1;
  if (r.col == null || placeRoom(w, id, r.col, r.row, cols)) return true;
  r.size = was;
  return false;
}

// ---- The rooms page: lock, archive, peek, search lights ----

// Locks or unlocks a room: locked, nothing in it can be written, moved or deleted, and its square
// stays where it is.
export function lock(w, id, on = true) {
  const r = room(w, id);
  if (!r) return false;
  if (on) r.locked = true; else delete r.locked;
  return true;
}

// Takes a room off the grid to the Archive page (not Messy thoughts, nor a locked room).
export function archive(w, id) {
  const r = room(w, id);
  if (!r || id === MESSY || r.locked || r.archived) return false;
  r.archived = true;
  delete r.col;
  delete r.row;
  return true;
}

// Brings an archived room back to the grid: to `cell` if it is free, or the first free one.
export function restore(w, id, cell = null, cols = 6) {
  const r = room(w, id);
  if (!r || !r.archived) return false;
  delete r.archived;
  if (r.parent != null && !isBorges(w.things[r.parent])) { r.parent = null; delete r.page; tidyDoors(w); }
  if (!cell || !placeRoom(w, id, cell.col, cell.row, cols)) gridRooms(w, cols, r.parent ?? null, r.page || 0);
  return true;
}

// The last few things written in a room (newest last), as plain text, for its square's peek.
export function peek(w, roomId, most = 3) {
  if (isBorges(w.things[roomId])) return children(w, roomId).filter((th) => kindOf(th) === 'room').slice(0, most).map((r) => r.name);
  return roomThoughts(w, roomId).slice(-most).map((th) => oneLine(thoughtText(w, th))).filter(Boolean);
}

// Search lights: for each room on a grid (inside `parent`, or at the top), how many of its
// thoughts (and rooms) hold the query.
export function roomHits(w, query, parent = null) {
  const out = {};
  for (const f of search(w, query, Infinity)) {
    let at = null;
    for (let th = w.things[f.id]; th; th = w.things[th.parent]) if (kindOf(th) === 'room' && (th.parent ?? null) === parent) { at = th; break; }
    if (at) out[at.id] = (out[at.id] || 0) + 1;
  }
  return out;
}

// A Borges room's peek: the names of the rooms it holds.
export const holds = (w, id) => children(w, id).filter((th) => kindOf(th) === 'room');
