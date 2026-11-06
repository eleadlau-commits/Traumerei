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
// keeps one (a Russell chapter); a mode that reads by time (a Joyce train) orders its thoughts by
// when they were written, and the groups it holds where holds: puts them (keepHeldOrder).

import { parse, keysOf, write, writeValue, writeFront, frontValue, ref, readArrow, writeArrow, readLink, writeLink, LINK_ENDS } from './grammar.js';
import {
  room, view, create, update, members, groupsIn, roomItems, own, shut, kindOf, isLeaf, isGroup,
  addRoom, seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, join, setOrder, isTwin, addTwin, sides,
} from './world.js';

export const FORMAT = 'room/2';
export const GUIDE = 'https://github.com/eleadlau-commits/traumerei/blob/main/app/features/roomfile/FORMAT.md';
export const KEPT = 'traum'; // where what wasn't understood is kept with the room: own(w, room, KEPT)

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
  if (!prefix) { // a Twin's side writes only its settings (left.mode.key)
    if (r.desc) out.push(['description', writeFront(r.desc)]);
    if (r.tags?.length) out.push(['tags', writeFront(r.tags)]);
    for (const k of ['tint', 'light', 'opacity']) if (r[k] != null) out.push([k, writeFront(r[k])]);
  }
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
export const ontology = (ontologies, id) => ontologies.find((o) => o.id === id) || null;
// The ontology whose groups a group with no made in: belongs to: the room's first mode with groups,
// or Joyce's trains.
export const groupMode = (modes, ontologies) => modes.find((m) => ontology(ontologies, m)?.groups) || DEFAULT_MODE;

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
export function writeObject(w, roomId, th, ids, pictures) {
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
export function exportRoom(w, roomId, o = {}) { return roomText(w, roomId, o).text; }

// The same, with the ids it gave: { text, ids: Map(thing id → file id) }.
export function roomText(w, roomId, { ontologies = [], pictures = null, sections = placementSections } = {}) {
  const r = room(w, roomId);
  if (!r) return { text: '', ids: new Map() };
  const kept = own(w, roomId, KEPT, false);
  const twin = isTwin(r) ? sides(w, roomId) : null;
  const modes = twin ? twin.map((s) => view(w, s.id).mode) : modesOf(w, roomId, ontologies);
  const front = [['format', FORMAT], ['guide', GUIDE], ['room', writeFront(r.name || 'Untitled')], [twin ? 'twin' : 'modes', writeFront(modes)],
    ...frontLines(w, roomId), ...(twin ? twin.flatMap((s, k) => frontLines(w, s.id, `${SIDES[k].toLowerCase()}.`)) : []),
    ...(kept.front || []).map((l) => { const i = l.indexOf(':'); return [l.slice(0, i), l.slice(i + 1).trim()]; })];
  // A Twin's things: the left side's, then the right's, in one list.
  const rooms = twin || [r];
  const things = rooms.flatMap((x) => objectOrder(w, x.id).map((th) => ({ th, at: x.id })));
  const keptObjects = [...(kept.objects || []), ...(twin || []).flatMap((s) => own(w, s.id, KEPT, false).objects || [])];
  const ids = fileIds(things.map((x) => x.th), new Set(keptObjects.map((o) => o.id)));
  const objects = [...things.map(({ th, at }) => writeObject(w, at, th, ids, pictures)), ...keptObjects];
  const placed = twin
    ? twin.flatMap((s, k) => sections(w, s.id, ids, [modes[k]], ontologies).map((x) => ({ ...x, name: x.name.replace(/^In /, `${SIDES[k]}: `) })))
    : sections(w, roomId, ids, modes, ontologies);
  return { text: write({ front, objects, sections: [...placed, ...(kept.sections || [])] }), ids };
}
const SIDES = ['Left', 'Right'];

// The # In <mode> sections: each mode's own lines (its traum.write), then the lines kept from a
// file that it didn't understand.
export function placementSections(w, roomId, ids, modes, ontologies) {
  const kept = own(w, roomId, KEPT, false).modeLines || {};
  const c = { ref: (id) => (ids.has(id) ? ref(ids.get(id)) : null), writeArrow, writeLink };
  const out = [];
  for (const m of modes) {
    const o = ontology(ontologies, m);
    const lines = [...(o?.traum ? o.traum.write(w, roomId, c) : []), ...(kept[m] || [])];
    if (lines.length) out.push({ name: `In ${m}`, lines });
  }
  return out;
}

// ---- Bringing objects in ----

// A group that orders what it holds by time (a Joyce train) puts a group it holds by that group's
// own stamp, which the file doesn't write. So where the time order isn't holds:'s, the groups held
// are stamped again to sit where holds: puts them: between the thoughts on either side.
function keepHeldOrder(w, groupId, order) {
  const held = order.map((id) => w.things[id]).filter(Boolean);
  if (members(w, groupId).every((th, k) => th === held[k])) return;
  for (let i = 0; i < held.length;) {
    if (!isGroup(held[i])) { i++; continue; }
    let j = i;
    while (j < held.length && isGroup(held[j])) j++;
    const run = held.slice(i, j);
    let lo = i > 0 ? held[i - 1].at : null, hi = j < held.length ? held[j].at : null;
    if (lo == null && hi == null) { const ats = run.map((g) => g.at).sort((a, b) => a - b); run.forEach((g, k) => { g.at = ats[k]; }); }
    else {
      if (lo == null) lo = hi - 1;
      if (hi == null || hi <= lo) hi = lo + 1;
      run.forEach((g, k) => { g.at = lo + ((hi - lo) * (k + 1)) / (run.length + 1); });
    }
    i = j;
  }
}

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
    if (w.things[g.id]) { setOrder(w, g.id, order); keepHeldOrder(w, g.id, order); }
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
export function keep(w, roomId, kept, meta, unread) {
  const sections = unread?.sections;
  kept.objects.push(...(unread?.objects || []));
  const modeLines = unread?.modeLines || {};
  const has = kept.objects.length || Object.keys(kept.keys).length || meta?.kept?.length || sections?.length || Object.keys(modeLines).length;
  if (!has) return;
  const data = own(w, roomId, KEPT);
  if (meta?.kept?.length) data.front = [...new Set([...(data.front || []), ...meta.kept])];
  if (kept.objects.length) data.objects = [...(data.objects || []), ...kept.objects];
  if (Object.keys(kept.keys).length) data.keys = { ...(data.keys || {}), ...kept.keys };
  if (sections?.length) data.sections = [...(data.sections || []), ...sections];
  for (const [m, lines] of Object.entries(modeLines)) (data.modeLines ||= {})[m] = [...(data.modeLines?.[m] || []), ...lines];
}

// A relation object read: { from: [values], to: [values], rel, label, of, ends }, from its keys
// (from:, to:, label:, made in:, ends:) and its title (the relation's name). ends: is written
// none, arrow or both (or --, -> or <->); null when it has none.
const ENDS_WORD = { none: 'none', arrow: 'arrow', both: 'both', ...LINK_ENDS };
function relationOf(obj, report) {
  const { keys } = keysOf(obj);
  const out = { from: [], to: [], rel: obj.title || '', label: '', of: null, ends: null, line: obj.line };
  for (const k of keys) {
    if (k.key === 'from' || k.key === 'to') out[k.key].push(...k.values);
    else if (k.key === 'label') out.label = k.values.length === 1 && k.values[0].t === 'text' ? k.values[0].v : k.raw;
    else if (k.key === 'made in') out.of = String(k.values[0]?.v ?? '').toLowerCase();
    else if (k.key === 'ends') {
      const e = ENDS_WORD[String(k.raw).trim().toLowerCase()];
      if (e) out.ends = e; else report.push(`Line ${k.line}: a relation's ends are none, arrow or both (or --, -> or <->); "${String(k.raw).trim()}" was left out.`);
    }
    else report.push(`Line ${k.line}: a relation's "${k.key}" isn't known, so it was left out.`);
  }
  return out;
}

// The # In <mode> sections read, each by its mode's traum.read (called for every mode of the room,
// with no lines when the file has no section for it, so it can place new things itself). Returns
// what it didn't understand, to keep: { sections: [{ name, lines }], objects: [relation objects
// no mode took], modeLines: { [mode]: [lines] } }.
export function readSections(w, roomId, parts, { ids = new Map(), relations = [], ontologies = [], modes = [], report = [], at = null, scope = null, change = null, name = null, fresh: freshIds = null } = {}) {
  const unread = { sections: [], objects: [], modeLines: {} };
  const byMode = {};
  for (const s of parts.sections) {
    const m = /^(?:in|left:|right:)\s+(\S+)$/i.exec(s.name); // a Twin's side's section, brought into a room, is its mode's
    const mode = m?.[1].toLowerCase();
    if (!mode || !modes.includes(mode) || !ontology(ontologies, mode)?.traum) {
      unread.sections.push({ name: s.name, lines: s.lines.map((l) => l.text) });
      report.push(`Line ${s.line}: ${!mode ? `"# ${s.name}" isn't a section Träumerei knows` : !modes.includes(mode) ? `"${mode}" isn't one of this room's modes` : `${mode} doesn't read its section yet`}; it was kept and will be written back out.`);
      continue;
    }
    (byMode[mode] ||= []).push(...s.lines);
  }
  const fresh = freshIds || new Set(ids.values());
  const helpers = (mode) => {
    const say = (line, words) => report.push(`Line ${line}: ${words}`);
    const thing = (v, line) => {
      if (v?.t !== 'ref') { say(line, `"${writeValue(v)}" isn't a ^reference.`); return null; }
      const id = ids.get(v.id);
      if (!id) { say(line, `^${v.id} isn't in the file.`); return null; }
      if (v.occ || v.span != null) say(line, `${mode} doesn't use occurrences or spans; ${writeValue(v)} was read as ^${v.id}.`);
      return id;
    };
    const arrow = (a, line) => {
      const from = thing(a.from, line), to = thing(a.to, line);
      return from && to ? { from, to, rel: a.rel, label: a.label, line, ...(a.ends ? { ends: a.ends } : {}) } : null;
    };
    return {
      thing, report: say, fresh, at, scope, change, name,
      keep(l) {
        (unread.modeLines[mode] ||= []).push(l.text ?? (l.flag ? l.key : `${l.key}: ${l.raw}`));
        say(l.line, l.key ? `${mode} doesn't know "${l.key}"; it was kept and will be written back out.` : `"${String(l.text).trim().slice(0, 40)}" isn't a line of the form key: values; it was kept.`);
      },
      arrow(l) {
        const a = readArrow(l.raw);
        if (!a) { say(l.line, 'an arrow is written ^from -> ^to | relation | label.'); return null; }
        return arrow(a, l.line);
      },
      // A link: line, { from, to, ends, rel, label, line } (from and to as ids), or null (said why).
      link(l) {
        const a = readLink(l.raw);
        if (a?.bad) { say(l.line, `a link's ends are --, -> or <->, not "${a.bad}"; it was left out.`); return null; }
        if (!a) { say(l.line, 'a link is written ^a -- ^b | relation | label (or -> or <-> between them).'); return null; }
        return arrow(a, l.line);
      },
      relations: [],
      fromRelation: arrow,
    };
  };
  const cs = Object.fromEntries(modes.filter((m) => ontology(ontologies, m)?.traum).map((m) => [m, helpers(m)]));
  // Relation objects with one end each go to their mode as arrows; the rest are kept.
  const arrowMode = modes.find((m) => ontology(ontologies, m)?.groups && cs[m]);
  for (const obj of relations) {
    const r = relationOf(obj, report);
    const mode = r.of || arrowMode;
    if (r.from.length !== 1 || r.to.length !== 1 || !cs[mode]) {
      unread.objects.push({ id: obj.id, kind: obj.kind, title: obj.title || '', lines: obj.lines });
      report.push(`Line ${obj.line}: relation ^${obj.id} ${!cs[mode] ? `is for ${mode || 'no mode'}, which doesn't read relations here` : 'joins more than two things, which no mode here reads yet'}; it was kept and will be written back out.`);
      continue;
    }
    const a = cs[mode].fromRelation({ from: r.from[0], to: r.to[0], rel: r.rel, label: r.label, ends: r.ends }, obj.line);
    if (a) cs[mode].relations.push(a);
  }
  for (const [m, c] of Object.entries(cs)) ontology(ontologies, m).traum.read(w, roomId, byMode[m] || [], c);
  return unread;
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
export function importInto(w, roomId, parts, { ontologies = [], now = Date.now(), fetched = null, at = null, read = readSections } = {}) {
  const report = [...parts.report];
  if (!room(w, roomId) || shut(w, roomId)) { report.push('This room is locked, so nothing was brought in.'); return { report, made: { groups: 0, thoughts: 0, pictures: 0 } }; }
  const modes = modesOf(w, roomId, ontologies);
  const got = bringObjects(w, roomId, parts, { modes, ontologies, now, report, fetched });
  const unread = read(w, roomId, parts, { ids: got.ids, relations: got.relations, ontologies, modes, report, at });
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
  const unknown = (m) => report.push(`There is no mode called "${m}", so ${ontology(ontologies, DEFAULT_MODE)?.name || DEFAULT_MODE} is used instead.`);
  const none = { groups: 0, thoughts: 0, pictures: 0 };
  if (meta.twin) return importTwin(w, parts, meta, report, { ontologies, now, page, globals, name, fetched, read, known, unknown });
  let modes = (meta.modes || []).filter((m) => known(m) || (unknown(m), false));
  if (!modes.length) modes = [DEFAULT_MODE];
  const r = addRoom(w, meta.room || name, now, { page }, modes[0]);
  if (!r) return { room: null, report: [...report, 'A room couldn\'t be made.'], made: none };
  if (modes.length > 1) r.size = 2;
  dress(w, r.id, meta, now, globals);
  const got = bringObjects(w, r.id, parts, { modes, ontologies, now: now + 1, report, fetched });
  const unread = read(w, r.id, parts, { ids: got.ids, relations: got.relations, ontologies, modes, report });
  keep(w, r.id, got.kept, meta, unread);
  frame(w, r.id, ontologies);
  return { room: r, report, made: got.made, ids: got.ids };
}

// The front matter's name, description, tags, colour and settings on a new room.
function dress(w, roomId, meta, now, globals) {
  const fields = {};
  if (meta.description) fields.desc = meta.description;
  if (meta.tags?.length) fields.tags = meta.tags;
  for (const k of ['tint', 'light', 'opacity']) if (meta[k] != null) fields[k] = meta[k];
  update(w, roomId, fields, now);
  seedRoomSettings(w, roomId, globals);
  for (const [of, set] of Object.entries(meta.settings)) for (const [k, v] of Object.entries(set)) setRoomSetting(w, roomId, of, k, v);
}

// A Twin from the file (twin: [left, right]): its # Left: and # Right: sections say which side
// each object is on. A group takes everything it holds to its side (and a thing held goes where its
// group goes); what no section places is on the left, in the shared tray.
function importTwin(w, parts, meta, report, { ontologies, now, page, globals, name, fetched, read, known, unknown }) {
  const modes = [0, 1].map((k) => { const m = meta.twin[k] || DEFAULT_MODE; return known(m) ? m : (unknown(m), DEFAULT_MODE); });
  const t = addTwin(w, meta.room || name, now, { page }, modes);
  const none = { groups: 0, thoughts: 0, pictures: 0 };
  if (!t) return { room: null, report: [...report, 'A room couldn\'t be made.'], made: none };
  dress(w, t.id, { ...meta, settings: {} }, now, {});
  const both = sides(w, t.id);
  // Which side each section is.
  const sectionsOf = [[], []], other = [];
  for (const s of parts.sections) {
    const m = /^(left|right):\s*(\S+)$/i.exec(s.name);
    if (!m) { other.push(s); continue; }
    const k = m[1].toLowerCase() === 'left' ? 0 : 1;
    if (m[2].toLowerCase() !== modes[k]) report.push(`Line ${s.line}: the ${SIDES[k].toLowerCase()} side is ${modes[k]} (twin: says so), so "# ${s.name}" was read as its section.`);
    sectionsOf[k].push({ ...s, name: `In ${modes[k]}` });
  }
  // Each object's side: the first side whose section names it, carried along what groups hold.
  const side = new Map();
  const refsIn = (vs, out = []) => { for (const v of vs) { if (v.t === 'ref') out.push(v.id); if (v.t === 'list') refsIn(v.v, out); } return out; };
  for (const k of [0, 1]) {
    for (const s of sectionsOf[k]) {
      for (const l of s.lines) {
        const ids = l.key === 'arrow' || l.key === 'link' ? (/\^(\S+?)\s*(?:<->|->|--)\s*\^(\S+)/.exec(l.raw) || []).slice(1) : refsIn(l.values || []);
        for (const id of ids) {
          if (side.has(id) && side.get(id) !== k) report.push(`Line ${l.line}: ^${id} is placed on both sides; it stays on the ${SIDES[side.get(id)].toLowerCase()}.`);
          else side.set(id, k);
        }
      }
    }
  }
  const holds = new Map(parts.objects.filter((o) => o.kind === 'group').map((o) => [o.id, refsIn(keysOf(o).keys.filter((x) => x.key === 'holds').flatMap((x) => x.values))]));
  const links = new Map(); // id → ids joined to it by holds, both ways
  const tie = (a, b) => { (links.get(a) || links.set(a, []).get(a)).push(b); (links.get(b) || links.set(b, []).get(b)).push(a); };
  for (const [g, ms] of holds) for (const m of ms) tie(g, m);
  for (const o of parts.objects.filter((x) => x.kind === 'relation')) for (const id of refsIn(keysOf(o).keys.filter((x) => x.key === 'from' || x.key === 'to').flatMap((x) => x.values))) tie(o.id, id);
  const seen = new Set();
  for (const o of parts.objects) {
    if (seen.has(o.id)) continue;
    const group = [], stack = [o.id];
    while (stack.length) { const id = stack.pop(); if (seen.has(id)) continue; seen.add(id); group.push(id); stack.push(...(links.get(id) || [])); }
    const k = group.map((id) => side.get(id)).find((x) => x != null) ?? 0;
    for (const id of group) side.set(id, k);
  }
  const made = { ...none };
  const ids = new Map();
  let at = now + 1;
  for (const k of [0, 1]) {
    const s = both[k];
    seedRoomSettings(w, s.id, globals);
    for (const [of, set] of Object.entries({ ...(meta.settings[modes[k]] ? { [modes[k]]: meta.settings[modes[k]] } : {}), ...meta.sideSettings[k] })) {
      for (const [key, v] of Object.entries(set)) setRoomSetting(w, s.id, of, key, v);
    }
    const mine = { ...parts, objects: parts.objects.filter((o) => side.get(o.id) === k), sections: sectionsOf[k] };
    const got = bringObjects(w, s.id, mine, { modes: [modes[k]], ontologies, now: at, report, fetched });
    at += mine.objects.length + 1;
    const unread = read(w, s.id, mine, { ids: got.ids, relations: got.relations, ontologies, modes: [modes[k]], report });
    keep(w, s.id, got.kept, null, { ...unread, sections: [] });
    if (unread.sections.length) keep(w, t.id, { objects: [], keys: {} }, null, { sections: unread.sections });
    frame(w, s.id, ontologies);
    for (const x of Object.keys(made)) made[x] += got.made[x];
    for (const [a, b] of got.ids) ids.set(a, b);
  }
  for (const s of other) report.push(`Line ${s.line}: "# ${s.name}" isn't a section a Twin knows (# Left: mode, # Right: mode); it was kept and will be written back out.`);
  keep(w, t.id, { objects: [], keys: {} }, meta, { sections: other.map((s) => ({ name: s.name, lines: s.lines.map((l) => l.text) })) });
  return { room: t, report, made, ids };
}

// A new room opens looking at what arrived: the middle of its thoughts as its mode places them,
// zoomed out (not below half) so most of them fit. box: the screen's room for them (px).
export function frame(w, roomId, ontologies = [], box = { w: 1100, h: 640 }) {
  const o = ontology(ontologies, view(w, roomId).mode);
  if (typeof o?.units !== 'function' || typeof o?.point !== 'function') return;
  const ps = o.units(w, roomId).map((u) => o.point(w, roomId, u.id)).filter(Boolean);
  if (!ps.length) return;
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 340, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 80;
  const zoom = Math.max(0.5, Math.min(1, box.w / (x1 - x0), box.h / (y1 - y0)));
  Object.assign(view(w, roomId), { x: Math.round((x0 + x1) / 2), y: Math.round(zoom < 0.6 ? y0 + box.h / zoom / 2 : (y0 + y1) / 2), zoom: Math.round(zoom * 100) / 100 });
}

// A file name for a room: its name, without what file systems refuse.
export const fileName = (name) => `${String(name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'}.traum`;

export { parse };
