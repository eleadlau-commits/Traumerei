// A room as a .traum file and back (FORMAT.md is the spec): the grammar's parts (grammar.js) made
// into a room's thoughts and groups, and a room written out as them. No screen here, so it can be
// tested on its own (tests/traum.test.js).
//
// The file names no mode of its own: `# Objects` lists every thing once (items, whatever their
// kind says of them; groups with made in:, holds:, closed, shared), and each ontology writes and
// reads its own `# In <mode>` section. What isn't understood (a kind, a key, a section) is
// reported and kept with the room (own(w, room, 'traum')), and written back out the next time, so
// a file passes through without loss.
//
// The thoughts are stamped in the file's order, a millisecond apart, so the file's order is the
// Timeline's. Export writes short numbers for ids (^1, ^2, …), the items in the order they were
// written and each group after everything it holds. holds: gives a group's order where its mode
// keeps one (a Russell chapter); a mode that reads by time (a Joyce train) orders them by when
// they were written.

import { parse, keysOf, write, writeValue, writeFront, frontValue, ref } from './grammar.js';
import {
  room, view, create, update, members, groupsIn, roomItems, own, shut, kindOf, isLeaf, isGroup,
  addRoom, seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, join, setOrder,
} from './world.js';

export const FORMAT = 'room/2';
export const GUIDE = 'https://github.com/eleadlau-commits/traumerei/blob/main/app/features/roomfile/FORMAT.md';
const KEPT = 'traum'; // where what wasn't understood is kept with the room: own(w, room, KEPT)

const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---- The room's front matter ----

const NAMED = { room: 'room', description: 'description', desc: 'description', tags: 'tags', tint: 'tint', light: 'light', opacity: 'opacity' };

// The front matter read: { format, room, modes, twin, description, tags, tint, light, opacity,
// settings: { [mode]: { key: value } }, sideSettings: [{ … }, { … }], kept: ['key: raw'] }.
export function frontOf(parts, report = []) {
  const meta = { settings: {}, sideSettings: [{}, {}], kept: [] };
  for (const { key, raw, line } of parts.front) {
    const k = key.toLowerCase();
    if (k === 'format') {
      meta.format = String(frontValue(raw));
      if (meta.format !== FORMAT) report.push(`Line ${line}: this file says format ${meta.format}; it was read as ${FORMAT}.`);
    } else if (k === 'guide') meta.guide = String(frontValue(raw));
    else if (k === 'modes' || k === 'twin') meta[k] = [].concat(frontValue(raw)).map((m) => String(m).trim().toLowerCase()).filter(Boolean);
    else if (k === 'kind') meta.modes = [String(frontValue(raw)).toLowerCase()];
    else if (NAMED[k] === 'tags') meta.tags = [].concat(frontValue(raw)).map(String);
    else if (NAMED[k]) meta[NAMED[k]] = k === 'light' || k === 'opacity' ? frontValue(raw) : String(frontValue(raw));
    else if (/^(left|right)\.[^.]+\..+$/.test(k)) {
      const [side, mode, ...rest] = key.split('.');
      ((meta.sideSettings[side.toLowerCase() === 'left' ? 0 : 1][mode.toLowerCase()]) ||= {})[rest.join('.')] = frontValue(raw);
    } else if (key.includes('.')) {
      const dot = key.indexOf('.');
      (meta.settings[key.slice(0, dot).toLowerCase()] ||= {})[key.slice(dot + 1)] = frontValue(raw);
    } else {
      meta.kept.push(`${key}: ${raw}`);
      report.push(`Line ${line}: Träumerei doesn't know "${key}"; it was kept and will be written back out.`);
    }
  }
  return meta;
}

// The room's own front matter lines: [[key, value]], after format/guide/room and the modes line.
function frontLines(w, roomId, prefix = '') {
  const r = room(w, roomId);
  const out = [];
  if (r.desc) out.push(['description', writeFront(r.desc)]);
  if (r.tags?.length) out.push(['tags', writeFront(r.tags)]);
  for (const k of ['tint', 'light', 'opacity']) if (r[k] != null) out.push([k, writeFront(r[k])]);
  for (const [of, set] of Object.entries(w.settings?.[roomId] || {})) {
    for (const [k, v] of Object.entries(set || {})) if (v !== undefined) out.push([`${prefix}${of}.${k}`, writeFront(v)]);
  }
  return out;
}

// ---- The modes a room is seen through ----

// The ontologies a room holds, its own first: a small room's one, or every one for a big room.
export function modesOf(w, roomId, ontologies = []) {
  const r = room(w, roomId);
  const mine = view(w, roomId).mode;
  if (r?.size === 2 || r?.id === 'messy') return [mine, ...ontologies.map((o) => o.id).filter((id) => id !== mine)];
  return [mine];
}
const ontology = (ontologies, id) => ontologies.find((o) => o.id === id) || null;
// The ontology whose groups a group with no made in: belongs to: the room's first mode with groups,
// or Joyce's trains.
const groupMode = (modes, ontologies) => modes.find((m) => ontology(ontologies, m)?.groups) || DEFAULT_MODE;

// ---- Objects ----

// The items, then each group after everything it holds: in the order they were written.
export function objectOrder(w, roomId) {
  const items = roomItems(w, roomId);
  const groups = groupsIn(w, roomId).filter((g) => members(w, g.id).length);
  const keyOf = new Map();
  const depth = new Map();
  const visit = (g, seen = new Set()) => {
    if (keyOf.has(g.id)) return keyOf.get(g.id);
    if (seen.has(g.id)) return g.at;
    seen.add(g.id);
    let k = g.at, d = 0;
    for (const m of members(w, g.id)) {
      if (isGroup(m)) { k = Math.max(k, visit(m, seen)); d = Math.max(d, depth.get(m.id) + 1); } else k = Math.max(k, m.at);
    }
    keyOf.set(g.id, k);
    depth.set(g.id, d);
    return k;
  };
  groups.forEach((g) => visit(g));
  return [
    ...items.map((th) => ({ th, key: th.at, rank: -1 })),
    ...groups.map((g) => ({ th: g, key: keyOf.get(g.id), rank: depth.get(g.id) })),
  ].sort((a, b) => a.key - b.key || a.rank - b.rank || byTime(a.th, b.th)).map((e) => e.th);
}

// One thing as an object: { id, kind, title, lines }. ids: thing id → file id. pictures (optional):
// short references in place of each picture's data.
function writeObject(w, roomId, th, ids, pictures) {
  const id = ids.get(th.id);
  if (isGroup(th)) {
    const lines = [`made in: ${th.of}`, `holds: ${members(w, th.id).map((m) => ref(ids.get(m.id))).join(' ')}`];
    if (th.closed) lines.push('closed');
    if (th.shared) lines.push('shared');
    lines.push(...(own(w, roomId, KEPT, false).keys?.[th.id] || []));
    return { id, kind: 'group', title: th.title || '', lines };
  }
  const kind = ITEMS[kindOf(th)];
  const out = kind?.traum?.write ? kind.traum.write(th) : { body: kind?.text(th) || '' };
  let body = String(out.body ?? '');
  if (pictures && th.src && body === th.src) body = pictures.ref(th.src);
  return { id, kind: kind?.traum ? kindOf(th) : 'line', title: out.title || '', lines: body ? body.split('\n') : [] };
}

// Ids for a room's things in a file: short numbers in order, skipping any id a kept object uses.
export function fileIds(things, taken = new Set()) {
  const ids = new Map();
  let n = 0;
  for (const th of things) {
    do n++; while (taken.has(String(n)));
    ids.set(th.id, String(n));
  }
  return ids;
}

// ---- Taking a room out ----

// The room as a .traum file. pictures (optional): short references in place of each picture's data
// (the source editor's). sections(w, roomId, ids, modes): the # In <mode> sections ([{ name, lines }]).
export function exportRoom(w, roomId, { ontologies = [], pictures = null, sections = placementSections } = {}) {
  const r = room(w, roomId);
  if (!r) return '';
  const kept = own(w, roomId, KEPT, false);
  const modes = modesOf(w, roomId, ontologies);
  const front = [['format', FORMAT], ['guide', GUIDE], ['room', writeFront(r.name || 'Untitled')], ['modes', writeFront(modes)],
    ...frontLines(w, roomId), ...(kept.front || []).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i), l.slice(i + 1).trim()]; })];
  const things = objectOrder(w, roomId);
  const ids = fileIds(things, new Set((kept.objects || []).map((o) => o.id)));
  const objects = [...things.map((th) => writeObject(w, roomId, th, ids, pictures)), ...(kept.objects || [])];
  return write({ front, objects, sections: [...sections(w, roomId, ids, modes, ontologies), ...(kept.sections || [])] });
}

// The # In <mode> sections (none yet).
export function placementSections() { return []; }

// ---- Bringing objects in ----

// The file's objects made in a room: items and groups (with what each holds), stamped from `now`
// in the file's order. Returns { ids: Map(file id → thing id), made: { groups, thoughts, pictures },
// report, relations: [the relation objects, for the placement sections] }. An object of a kind
// Träumerei doesn't know, and a key it doesn't know, is reported and kept with the room.
export function bringObjects(w, roomId, parts, { modes = [], ontologies = [], now = Date.now(), report = [], fetched = null } = {}) {
  const ids = new Map();
  const made = { groups: 0, thoughts: 0, pictures: 0 };
  const kept = { objects: [], keys: {} };
  const relations = [];
  const groups = []; // [{ g, holds: [values], line, obj }]
  const defaultOf = groupMode(modes, ontologies);
  let t = now;
  for (const obj of parts.objects) {
    if (ids.has(obj.id)) { report.push(`Line ${obj.line}: ^${obj.id} is used twice; the second one was left out.`); continue; }
    if (obj.kind === 'group') {
      const { keys, other } = keysOf(obj);
      const fields = { kind: 'group', of: defaultOf, title: obj.title || '' };
      const holds = [];
      const rest = [];
      let line = obj.line;
      for (const k of keys) {
        if (k.key === 'made in') {
          const of = String(k.values[0]?.v ?? '').toLowerCase();
          if (of) fields.of = of;
        } else if (k.key === 'holds') { holds.push(...k.values); line = k.line; } else if (k.key === 'closed' && k.flag) fields.closed = true;
        else if (k.key === 'shared' && k.flag) fields.shared = true;
        else { rest.push(k.flag ? k.key : `${k.key}: ${k.raw}`); report.push(`Line ${k.line}: a group's "${k.key}" isn't known; it was kept and will be written back out.`); }
      }
      for (const o of other) report.push(`Line ${o.line}: "${o.text.trim().slice(0, 40)}" isn't a key line (key: values), so it was left out.`);
      const g = create(w, roomId, fields, t++);
      if (!g) { report.push(`Line ${obj.line}: ^${obj.id} couldn't be made.`); continue; }
      ids.set(obj.id, g.id);
      if (rest.length) kept.keys[g.id] = rest;
      groups.push({ g, holds, line, obj });
      continue;
    }
    if (obj.kind === 'relation') { relations.push(obj); continue; }
    const kind = ITEMS[obj.kind];
    if (!kind?.traum?.read) {
      kept.objects.push({ id: obj.id, kind: obj.kind, title: obj.title || '', lines: obj.lines });
      report.push(`Line ${obj.line}: Träumerei doesn't know the kind "${obj.kind}"; ^${obj.id} was kept and will be written back out.`);
      continue;
    }
    let fields = kind.traum.read({ title: obj.title || '', body: obj.lines.join('\n') });
    if (fields.kind === 'picture' && !fields.src) fields = fetched?.(obj, fields) || unfetched(fields, obj.line, report);
    const th = create(w, roomId, fields, t++);
    if (!th) { report.push(`Line ${obj.line}: ^${obj.id} is empty, so it was left out.`); continue; }
    ids.set(obj.id, th.id);
    made.thoughts++;
    if (kindOf(th) === 'picture') made.pictures++;
  }
  // What each group holds, in its order (a group that keeps its order keeps the file's).
  for (const { g, holds, line, obj } of groups) {
    const order = [];
    for (const v of holds) {
      if (v.t !== 'ref') { report.push(`Line ${line}: "${writeValue(v)}" in ^${obj.id}'s holds isn't a ^reference, so it was left out.`); continue; }
      const id = ids.get(v.id);
      if (!id) { report.push(`Line ${line}: ^${obj.id} holds ^${v.id}, which isn't in the file.`); continue; }
      if (join(w, g.id, id)) order.push(id);
      else if (!w.things[g.id]?.members.includes(id)) report.push(`Line ${line}: ^${obj.id} can't hold ^${v.id} (a group can't hold itself, or a group that holds it).`);
    }
    if (w.things[g.id]) setOrder(w, g.id, order);
  }
  // A group left with nothing in it goes.
  for (const { g, obj } of groups) {
    if (!w.things[g.id]) continue;
    if (!members(w, g.id).length) {
      delete w.things[g.id];
      ids.delete(obj.id);
      delete kept.keys[g.id];
      report.push(`Line ${obj.line}: ${obj.title ? `"${obj.title}"` : `^${obj.id}`} holds nothing, so it was left out.`);
    } else made.groups++;
  }
  return { ids, made, report, relations, kept };
}

// A picture that couldn't be brought in, as a line that says so.
export function unfetched(f, line, report) {
  const where = f.url || 'its data';
  report?.push(`Line ${line}: the picture at ${where.length > 60 ? where.slice(0, 57) + '…' : where} couldn't be fetched, so a line says so.`);
  return { kind: 'line', text: `A picture couldn't be fetched${f.text ? `: ${f.text}` : ''} (${f.url || 'unreadable data'})` };
}

// What wasn't understood, kept with the room so it is written back out.
function keep(w, roomId, kept, meta, unread) {
  const sections = unread?.sections;
  kept.objects.push(...(unread?.objects || []));
  const has = kept.objects.length || Object.keys(kept.keys).length || meta?.kept?.length || sections?.length;
  if (!has) return;
  const data = own(w, roomId, KEPT);
  if (meta?.kept?.length) data.front = [...new Set([...(data.front || []), ...meta.kept])];
  if (kept.objects.length) data.objects = [...(data.objects || []), ...kept.objects];
  if (Object.keys(kept.keys).length) data.keys = { ...(data.keys || {}), ...kept.keys };
  if (sections?.length) data.sections = [...(data.sections || []), ...sections];
}

// The placement sections read (none yet). Returns what it didn't understand, to keep: { sections:
// [{ name, lines }], objects: [relation objects it didn't take] }.
export function readSections(w, roomId, parts, { relations = [], report = [] } = {}) {
  const sections = [];
  for (const s of parts.sections) {
    sections.push({ name: s.name, lines: s.lines.map((l) => l.text) });
    report.push(`Line ${s.line}: the section "# ${s.name}" isn't read yet; it was kept and will be written back out.`);
  }
  for (const o of relations) report.push(`Line ${o.line}: relation ^${o.id} isn't read yet; it was kept and will be written back out.`);
  return { sections, objects: relations.map((o) => ({ id: o.id, kind: o.kind, title: o.title || '', lines: o.lines })) };
}

// ---- Bringing a file in ----

// How many things the file holds: { groups, thoughts, pictures, text }.
export function summary(parts) {
  const n = { groups: 0, thoughts: 0, pictures: 0 };
  for (const o of parts.objects) {
    if (o.kind === 'group') n.groups++;
    else if (ITEMS[o.kind]) { n.thoughts++; if (o.kind === 'picture') n.pictures++; }
  }
  return { ...n, text: say(n) };
}
export const say = (n) => [plural(n.groups, 'group'), plural(n.thoughts, 'thought'), ...(n.pictures ? [plural(n.pictures, 'picture')] : [])].join(', ');

// The file's objects and placement added to a room (the front matter is for new rooms only).
// Returns { report, made }.
export function importInto(w, roomId, parts, { ontologies = [], now = Date.now(), fetched = null, read = readSections } = {}) {
  const report = [...parts.report];
  if (!room(w, roomId) || shut(w, roomId)) { report.push('This room is locked, so nothing was brought in.'); return { report, made: { groups: 0, thoughts: 0, pictures: 0 } }; }
  const modes = modesOf(w, roomId, ontologies);
  const got = bringObjects(w, roomId, parts, { modes, ontologies, now, report, fetched });
  const unread = read(w, roomId, parts, { ids: got.ids, relations: got.relations, ontologies, modes, report });
  keep(w, roomId, got.kept, null, unread);
  return { report, made: got.made, ids: got.ids };
}

// A new room from the file, on a floor of the rooms page (with no cell yet: the floors feature
// places it), with the file's name, modes, description, tags, colour and settings. globals: the
// settings a new room starts from. Returns { room, report, made }.
export function importRoom(w, parts, { ontologies = [], now = Date.now(), page = 0, globals = {}, name = 'Untitled', fetched = null, read = readSections } = {}) {
  const report = [...parts.report];
  const meta = frontOf(parts, report);
  const known = (m) => ontologies.some((o) => o.id === m);
  let modes = (meta.modes || []).filter((m) => {
    if (known(m)) return true;
    report.push(`There is no mode called "${m}", so the room isn't seen through it.`);
    return false;
  });
  if (!modes.length) modes = [DEFAULT_MODE];
  const r = addRoom(w, meta.room || name, now, { page }, modes[0]);
  if (!r) return { room: null, report: [...report, 'A room couldn\'t be made.'], made: { groups: 0, thoughts: 0, pictures: 0 } };
  if (modes.length > 1) r.size = 2;
  const fields = {};
  if (meta.description) fields.desc = meta.description;
  if (meta.tags?.length) fields.tags = meta.tags;
  for (const k of ['tint', 'light', 'opacity']) if (meta[k] != null) fields[k] = meta[k];
  update(w, r.id, fields, now);
  seedRoomSettings(w, r.id, globals);
  for (const [of, set] of Object.entries(meta.settings)) for (const [k, v] of Object.entries(set)) setRoomSetting(w, r.id, of, k, v);
  const got = bringObjects(w, r.id, parts, { modes, ontologies, now: now + 1, report, fetched });
  const unread = read(w, r.id, parts, { ids: got.ids, relations: got.relations, ontologies, modes, report });
  keep(w, r.id, got.kept, meta, unread);
  return { room: r, report, made: got.made, ids: got.ids };
}

// A file name for a room: its name, without what file systems refuse.
export const fileName = (name) => `${String(name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'}.traum`;

export { parse };
