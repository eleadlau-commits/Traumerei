// The rooms and thoughts of Create, as plain data, and the rules that change them. No screen here,
// so it can be tested on its own (tests/model.test.js).
//
// world = {
//   v: 1,
//   rooms:    [{ id, name, at }]                         the grid of rooms, in order
//   thoughts: { [id]: { id, room, train, kind, at, … } } one thought, of a kind (KINDS below):
//             line    { text }                 a passing thought, written until Enter
//             passage { title, body, parts? }  a paragraph or a small article; parts = the thoughts
//                                              of a train folded into it, kept so it can unfold
//             picture { src, text }            a picture (a small JPEG data: URL) and its caption
//   trains:   { [id]: { id, room, x, y, at } }           thoughts joined by time; x, y = where it starts
//   views:    { [room]: { mode, x, y, zoom } }           each room's mode, and where it was looked at
//   places:   { [room]: { [thought]: { x, y } } }        Pessoa: where a thought was dragged to
// }
//
// A thought always belongs to exactly one train, and a train to one room. Within a train the
// thoughts are joined by time (the order they were written), and that order is never broken:
// Joyce shows the train whole, and moves it whole.

export const MESSY = 'messy';
export const MODES = [
  { id: 'joyce', name: 'Joyce' },
  { id: 'pessoa', name: 'Pessoa' },
];
export const DEFAULT_MODE = 'joyce';
export const KINDS = ['line', 'passage', 'picture'];
export const kindOf = (th) => (KINDS.includes(th?.kind) ? th.kind : 'line');

let counter = 0;
export function uid(prefix = 'x') {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyWorld(now = Date.now()) {
  return {
    v: 1,
    rooms: [{ id: MESSY, name: 'Messy thoughts', at: now }],
    thoughts: {},
    trains: {},
    views: {},
    places: {},
  };
}

// A saved world, repaired: anything missing comes back, and the messy room always exists.
export function loadWorld(saved, now = Date.now()) {
  const w = Object.assign(emptyWorld(now), saved && typeof saved === 'object' ? saved : {});
  if (!Array.isArray(w.rooms)) w.rooms = [];
  if (!w.rooms.some((r) => r.id === MESSY)) w.rooms.unshift({ id: MESSY, name: 'Messy thoughts', at: now });
  for (const key of ['thoughts', 'trains', 'views', 'places']) if (!w[key] || typeof w[key] !== 'object') w[key] = {};
  const rooms = new Set(w.rooms.map((r) => r.id));
  for (const t of Object.values(w.trains)) if (!rooms.has(t.room)) t.room = MESSY;
  for (const th of Object.values(w.thoughts)) {
    const train = w.trains[th.train];
    if (!train) delete w.thoughts[th.id];
    else th.room = train.room;
  }
  return w;
}

export const room = (w, id) => w.rooms.find((r) => r.id === id) || null;

export function addRoom(w, name = 'Untitled', now = Date.now()) {
  const r = { id: uid('r'), name: String(name).trim() || 'Untitled', at: now };
  w.rooms.push(r);
  return r;
}

export function renameRoom(w, id, name) {
  const r = room(w, id);
  if (r && String(name).trim()) r.name = String(name).trim();
}

export function view(w, roomId) {
  if (!w.views[roomId]) w.views[roomId] = { mode: DEFAULT_MODE, x: 0, y: 0, zoom: 1 };
  return w.views[roomId];
}

export function startTrain(w, roomId, x, y, now = Date.now()) {
  const t = { id: uid('t'), room: roomId, x, y, at: now };
  w.trains[t.id] = t;
  return t;
}

export function addThought(w, trainId, text, now = Date.now()) {
  return addThing(w, trainId, { kind: 'line', text }, now);
}

// Adds a thought of any kind to a train. Returns null (and adds nothing) if it would be empty.
export function addThing(w, trainId, fields, now = Date.now()) {
  const train = w.trains[trainId];
  const th = tidy(fields);
  if (!train || !th) return null;
  Object.assign(th, { id: uid('h'), room: train.room, train: trainId, at: now });
  w.thoughts[th.id] = th;
  return th;
}

// Changes a thought's words (or picture); one left empty is deleted.
export function updateThing(w, id, fields) {
  const th = w.thoughts[id];
  if (!th) return null;
  const next = tidy({ ...th, ...fields });
  if (!next) { deleteThought(w, id); return null; }
  Object.assign(th, next);
  return th;
}

export function deleteThought(w, id) {
  const th = w.thoughts[id];
  if (!th) return;
  delete w.thoughts[id];
  if (w.places[th.room]) delete w.places[th.room][id];
  if (!trainThoughts(w, th.train).length) delete w.trains[th.train];
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const lines = (s) => String(s ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

function tidy(f) {
  const kind = kindOf(f);
  if (kind === 'line') {
    const text = oneLine(f.text);
    return text ? { kind, text } : null;
  }
  if (kind === 'passage') {
    const title = oneLine(f.title), body = lines(f.body);
    if (!title && !body) return null;
    const out = { kind, title, body };
    if (Array.isArray(f.parts) && f.parts.length) out.parts = f.parts;
    return out;
  }
  const src = typeof f.src === 'string' && f.src.startsWith('data:image/') ? f.src : '';
  return src ? { kind, src, text: oneLine(f.text) } : null;
}

// The words of a thought, as plain text (a picture gives its caption).
export function thoughtText(th) {
  const k = kindOf(th);
  if (k === 'passage') return [th.title, th.body].filter(Boolean).join(' — ');
  return th.text || '';
}

// Folds a whole train into one thought: a passage whose body is the train's thoughts in order,
// named `title`. The thoughts are kept inside it (parts), so unfold() can bring them back.
export function foldTrain(w, trainId, title = '', now = Date.now()) {
  const all = trainThoughts(w, trainId);
  if (all.length < 2) return null;
  const parts = all.map(({ room: _r, train: _t, ...rest }) => rest);
  const body = all.map((th) => (kindOf(th) === 'picture' ? (th.text ? `[${th.text}]` : '[picture]') : thoughtText(th))).join('\n');
  for (const th of all) delete w.thoughts[th.id];
  const t = w.trains[trainId];
  if (w.places[t.room]) for (const th of all) delete w.places[t.room][th.id];
  return addThing(w, trainId, { kind: 'passage', title, body, parts }, all[0].at);
}

// The reverse: a folded passage becomes its train of thoughts again, where it was.
export function unfold(w, thoughtId) {
  const th = w.thoughts[thoughtId];
  if (!th || !th.parts?.length) return false;
  delete w.thoughts[thoughtId];
  for (const p of th.parts) w.thoughts[p.id] = { ...p, room: th.room, train: th.train };
  return true;
}

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

export const trainThoughts = (w, trainId) =>
  Object.values(w.thoughts).filter((th) => th.train === trainId).sort(byTime);

export const roomThoughts = (w, roomId) =>
  Object.values(w.thoughts).filter((th) => th.room === roomId).sort(byTime);

// The room's trains, oldest first, leaving out any with no thoughts.
export function roomTrains(w, roomId) {
  const used = new Set(roomThoughts(w, roomId).map((th) => th.train));
  return Object.values(w.trains).filter((t) => t.room === roomId && used.has(t.id)).sort(byTime);
}

// The latest thought written in a room (or null): "lit" rooms are the ones written in lately.
export function lastWritten(w, roomId) {
  const all = roomThoughts(w, roomId);
  return all.length ? all[all.length - 1].at : null;
}

// Moves a whole train, every thought with it, into another room, at x, y there.
export function moveTrain(w, trainId, toRoom, x, y) {
  const t = w.trains[trainId];
  if (!t || !room(w, toRoom) || t.room === toRoom) return false;
  const from = t.room;
  t.room = toRoom;
  t.x = x;
  t.y = y;
  for (const th of trainThoughts(w, trainId)) {
    th.room = toRoom;
    if (w.places[from]) delete w.places[from][th.id];
  }
  return true;
}

// Moves one thought into another room. It leaves its train (the rest of the train keeps its
// order) and starts a train of its own there, at x, y.
export function moveThought(w, thoughtId, toRoom, x, y) {
  const th = w.thoughts[thoughtId];
  if (!th || !room(w, toRoom) || th.room === toRoom) return false;
  const from = th.room;
  const old = th.train;
  const t = startTrain(w, toRoom, x, y, th.at);
  th.train = t.id;
  th.room = toRoom;
  if (w.places[from]) delete w.places[from][th.id];
  if (!trainThoughts(w, old).length) delete w.trains[old];
  return true;
}

// ---- Where things go ----

// Pessoa's loose spiral: the i-th thought (in time order) sits on an Archimedean spiral
// r = bθ, spaced evenly along its length, nudged a little by its id so it doesn't look ruled.
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

export function pessoaPoint(w, roomId, thoughtId) {
  const placed = w.places[roomId]?.[thoughtId];
  if (placed) return placed;
  const i = roomThoughts(w, roomId).findIndex((th) => th.id === thoughtId);
  return spiralPoint(i < 0 ? roomThoughts(w, roomId).length : i, thoughtId);
}

export function placeThought(w, roomId, thoughtId, x, y) {
  (w.places[roomId] ||= {})[thoughtId] = { x, y };
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
