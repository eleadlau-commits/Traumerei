// Editing a room, or one group, as .traum text in the source editor: written out, changed, and put
// back in place. No screen here (tests/edit.test.js); Roomfile.js hands it to the source editor.
//
// The text's ids are the room's own for the whole session (open() keeps the map), so Apply knows
// each object it reads: an id it gave is that thing, changed in place (its id, time, glow, the
// groups it is in and its place all stay); an id it didn't give is a new thing. A group's holds:
// is what it holds now. What was in the text and is gone is deleted (a thought another group still
// holds only leaves this one); for the whole room, only when asked (removeMissing). Each mode's
// section lines are read with the things the text holds as their scope, so an arrow taken out of
// the text is taken away. Apply is one step for the caller to save.

import { keysOf, keyLine, readArrow, readLink } from './grammar.js';
import {
  roomText, objectOrder, writeObject, placementSections, frontOf, readSections, keep, unfetched,
  modesOf, groupMode, ontology, KEPT,
} from './traum.js';
import { write as writeParts } from './grammar.js';
import {
  room, view, create, update, members, own, shut, kindOf, isLeaf, isGroup, ITEMS, kindFor, join, setOrder,
  groupsOf, remove, setRoomSetting, chapterName, broken, within,
} from './world.js';

const oneLine = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const tidyLines = (x) => String(x ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// An item's words as the world keeps them, so a thought typed the same reads as the same.
function sameKey(f) {
  const kind = ITEMS[f.kind] ? f.kind : 'line';
  const t = ITEMS[kind].tidy(f, { oneLine, lines: tidyLines });
  return t ? kind + '\u0000' + JSON.stringify(t) : null;
}
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// ---- Pictures in the window ----

// Short references (picture:3) in place of each picture's data, read back as the same pictures.
// full(text) puts the data back (to download).
export function shortPictures() {
  const bySrc = new Map(), byRef = new Map();
  return {
    ref(src) {
      if (!bySrc.has(src)) { const r = `picture:${bySrc.size + 1}`; bySrc.set(src, r); byRef.set(r, src); }
      return bySrc.get(src);
    },
    src: (r) => byRef.get(String(r).trim()) || null,
    full: (text) => String(text).replace(/^picture:\d+$/gm, (m) => byRef.get(m) || m),
  };
}

// ---- Writing it out ----

// The things a group scope holds: the group and everything inside it.
const scopeOf = (w, groupId) => new Set([groupId, ...within(w, groupId).map((th) => th.id)]);

// A section line kept for a group's text: one about something the group holds. A line listing
// only references keeps those it holds; an arrow is kept when either end is held.
function forScope(line, inScope) {
  const kl = keyLine(line);
  if (!kl) return null;
  if (kl.key === 'arrow' || kl.key === 'link') {
    const a = kl.key === 'arrow' ? readArrow(kl.raw) : readLink(kl.raw);
    return a?.from && (inScope(a.from.id) || inScope(a.to.id)) ? line : null;
  }
  const refs = kl.values.filter((v) => v.t === 'ref');
  if (!refs.length) return null;
  if (refs.length === kl.values.length) {
    const mine = refs.filter((v) => inScope(v.id));
    return mine.length ? `${kl.key}: ${mine.map((v) => `^${v.id}${v.occ ? `#${v.occ}` : ''}`).join(' ')}` : null;
  }
  return inScope(refs[0].id) ? line : null;
}

// The text to edit, and the session that reads it back: { text, ids, back, scope, groupId }.
// ids: thing id → file id for the whole room; scope: the things the text holds (null: the room).
export function open(w, roomId, { scope = 'room', groupId = null, ontologies = [], pictures = null } = {}) {
  const whole = roomText(w, roomId, { ontologies, pictures });
  const ids = whole.ids;
  const back = new Map([...ids].map(([a, b]) => [b, a]));
  if (scope !== 'group') return { text: whole.text, ids, back, scope: null, groupId: null };
  const held = scopeOf(w, groupId);
  const things = objectOrder(w, roomId).filter((th) => held.has(th.id));
  const inScope = (fileId) => held.has(back.get(fileId));
  const sections = placementSections(w, roomId, ids, modesOf(w, roomId, ontologies), ontologies)
    .map((s) => ({ name: s.name, lines: s.lines.map((l) => forScope(l, inScope)).filter(Boolean) }))
    .filter((s) => s.lines.length);
  const text = writeParts({ objects: things.map((th) => writeObject(w, roomId, th, ids, pictures)), sections });
  return { text, ids, back, scope: held, groupId };
}

// ---- Reading it back ----

// The front matter's changes to the room: [{ key, from, to, text }], when the text has front matter.
function metaChanges(w, roomId, parts, report) {
  if (!parts.front.length) return [];
  const meta = frontOf(parts, []);
  const r = room(w, roomId);
  const out = [];
  const say = (v) => (v == null || v === '' ? 'nothing' : Array.isArray(v) ? (v.length ? v.join(', ') : 'nothing') : JSON.stringify(v));
  const diff = (k, label, from, to) => { if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) out.push({ key: k, from, to, text: `${label}: ${say(from)} → ${say(to)}` }); };
  if (meta.room != null) diff('name', 'Name', r.name, oneLine(meta.room) || 'Untitled');
  diff('desc', 'Description', r.desc || '', meta.description ? tidyLines(meta.description) : '');
  diff('tags', 'Tags', r.tags || [], meta.tags || []);
  for (const k of ['tint', 'light', 'opacity']) diff(k, k[0].toUpperCase() + k.slice(1), r[k] ?? null, meta[k] ?? null);
  for (const [of, set] of Object.entries(meta.settings)) {
    for (const [k, v] of Object.entries(set)) {
      const now = w.settings?.[roomId]?.[of]?.[k];
      if (JSON.stringify(now ?? null) !== JSON.stringify(v ?? null)) out.push({ key: `setting:${of}.${k}`, of, k, from: now, to: v, text: `${of}.${k}: ${say(now)} → ${say(v)} (Ctrl+Z doesn't take settings back)` });
    }
  }
  const mode = view(w, roomId).mode;
  if (meta.modes && meta.modes[0] !== mode) report.push(`The room's modes stay as they are: modes: can't change here.`);
  return out;
}

const named = (w, id) => {
  const th = w.things[id];
  if (!th) return 'something';
  if (isGroup(th)) return th.title ? `"${th.title}"` : `an untitled ${th.of === 'russell' ? 'chapter' : 'group'}`;
  const t = oneLine(kindFor(kindOf(th)).text(th) || '');
  return `"${t.length > 30 ? t.slice(0, 29) + '…' : t}"`;
};

// Puts the text in the world. session: open()'s. Returns { changes: [words], report, counts:
// { kept, changed, made, deleted }, missing: [thing ids not in the text], blocked }.
export function apply(w, roomId, session, parts, { ontologies = [], pictures = null, now = Date.now(), removeMissing = false } = {}) {
  const report = [...parts.report];
  const changes = [];
  const counts = { kept: 0, changed: 0, made: 0, deleted: 0 };
  const out = { changes, report, counts, missing: [], blocked: false };
  if (!room(w, roomId)) { report.push('That room isn\'t there any more.'); out.blocked = true; return out; }
  if (shut(w, roomId)) { report.push('This room is locked, so nothing can change.'); out.blocked = true; return out; }
  if (session.groupId && !isGroup(w.things[session.groupId])) { report.push('That group isn\'t there any more.'); out.blocked = true; return out; }
  const modes = modesOf(w, roomId, ontologies);
  const meta = session.scope ? [] : metaChanges(w, roomId, parts, report);
  if (session.scope && parts.front.length) report.push('The front matter is for the whole room; here it was left out.');

  // The thing an id means: one the text makes, or one the session gave.
  const ids = new Map();
  const existing = (fileId) => { const id = session.back.get(fileId); const th = id && w.things[id]; return th && th.parent === roomId ? id : null; };
  const fresh = new Set();
  const kept = { objects: [], keys: {} };
  const groups = [];
  const relations = [];
  let t = now;
  const defaultOf = groupMode(modes, ontologies);
  for (const obj of parts.objects) {
    if (ids.has(obj.id)) { report.push(`Line ${obj.line}: ^${obj.id} is used twice; the second one was left out.`); continue; }
    const had = existing(obj.id);
    if (obj.kind === 'group') {
      const { keys, other } = keysOf(obj);
      const f = { title: obj.title || '', closed: false, shared: false, of: null, holds: [], line: obj.line, rest: [] };
      for (const k of keys) {
        if (k.key === 'made in') f.of = String(k.values[0]?.v ?? '').toLowerCase();
        else if (k.key === 'holds') { f.holds.push(...k.values); f.line = k.line; } else if (k.key === 'closed' && k.flag) f.closed = true;
        else if (k.key === 'shared' && k.flag) f.shared = true;
        else { f.rest.push(k.flag ? k.key : `${k.key}: ${k.raw}`); report.push(`Line ${k.line}: a group's "${k.key}" isn't known; it was kept and will be written back out.`); }
      }
      for (const o of other) report.push(`Line ${o.line}: "${o.text.trim().slice(0, 40)}" isn't a key line (key: values), so it was left out.`);
      let g = had && isGroup(w.things[had]) ? w.things[had] : null;
      if (g) {
        if (f.of && f.of !== g.of) report.push(`Line ${obj.line}: a group stays in the mode that made it (${g.of}); made in: ${f.of} was left as it is.`);
        if (f.title !== (g.title || '')) { changes.push(`${named(w, g.id)} is renamed "${f.title}"`); update(w, g.id, { title: f.title }, now); }
        if (f.closed !== !!g.closed) { changes.push(`${named(w, g.id)} is ${f.closed ? 'closed' : 'open'}`); update(w, g.id, { closed: f.closed }, now); }
        if (f.shared !== !!g.shared) { if (f.shared) g.shared = true; else delete g.shared; changes.push(`${named(w, g.id)} is ${f.shared ? 'shared with the other modes' : 'no longer shared'}`); }
      } else {
        g = create(w, roomId, { kind: 'group', of: f.of || defaultOf, title: f.title, closed: f.closed, shared: f.shared }, t++);
        if (!g) { report.push(`Line ${obj.line}: ^${obj.id} couldn't be made.`); continue; }
        fresh.add(g.id);
        changes.push(`A new group: ${named(w, g.id)}`);
      }
      ids.set(obj.id, g.id);
      const keysNow = own(w, roomId, KEPT, false).keys?.[g.id] || [];
      if (f.rest.length || keysNow.length) { if (JSON.stringify(f.rest) !== JSON.stringify(keysNow)) ((own(w, roomId, KEPT).keys ||= {})[g.id] = f.rest); }
      groups.push({ g, f, obj });
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
    if (fields.kind === 'picture' && !fields.src) {
      const src = /^picture:\d+$/.test(fields.url || '') ? pictures?.src(fields.url) : null;
      if (src) { const { url, ...rest } = fields; fields = { ...rest, src }; } else fields = unfetched(fields, obj.line, report);
    }
    const th = had && isLeaf(w.things[had]) ? w.things[had] : null;
    if (th && kindOf(th) === fields.kind) {
      if (sameKey(th) === sameKey(fields)) counts.kept++;
      else if (update(w, th.id, fields, now)) { counts.changed++; changes.push(`${named(w, th.id)} is changed`); } else { report.push(`Line ${obj.line}: ^${obj.id} is empty; it was left as it was.`); }
      ids.set(obj.id, th.id);
      continue;
    }
    const made = create(w, roomId, fields, th ? th.at : t++);
    if (!made) { report.push(`Line ${obj.line}: ^${obj.id} is empty, so it was left out.`); continue; }
    if (th) { // a thought of another kind now: the new one takes its place everywhere
      for (const g of groupsOf(w, th.id)) g.members = g.members.map((m) => (m === th.id ? made.id : m));
      for (const data of Object.values(w.own[roomId] || {})) if (data && typeof data === 'object' && data[th.id] != null) data[made.id] = data[th.id];
      if (Number.isFinite(th.dx)) { made.dx = th.dx; made.dy = th.dy; }
      remove(w, th.id);
      counts.changed++;
      changes.push(`${named(w, made.id)} is now a ${ITEMS[fields.kind]?.name.toLowerCase() || fields.kind}`);
    } else { counts.made++; fresh.add(made.id); }
    ids.set(obj.id, made.id);
  }
  const resolve = (v) => (v.t === 'ref' ? ids.get(v.id) || existing(v.id) : null);

  // What each group holds: the text's list, the new ones joined before the old ones leave.
  for (const { g, f, obj } of groups) {
    if (!w.things[g.id]) continue;
    const want = [];
    for (const v of f.holds) {
      const id = resolve(v);
      if (!id) { report.push(`Line ${f.line}: ${v.t === 'ref' ? `^${obj.id} holds ^${v.id}, which isn't in the room` : `"${v.v}" in ^${obj.id}'s holds isn't a ^reference`}.`); continue; }
      if (g.members.includes(id) || join(w, g.id, id)) want.push(id);
      else report.push(`Line ${f.line}: ^${obj.id} can't hold ^${v.id} (a group can't hold itself, or a group that holds it).`);
    }
    if (!want.length) { report.push(`Line ${obj.line}: ${named(w, g.id)} holds nothing, so it was left as it was.`); continue; }
    const gone = g.members.filter((m) => !want.includes(m));
    g.members = want;
    if (gone.length && !fresh.has(g.id)) changes.push(`${plural(gone.length, 'thing')} ${gone.length === 1 ? 'leaves' : 'leave'} ${named(w, g.id)}`);
    setOrder(w, g.id, want);
  }

  // What was in the text and is gone: deleted (for the whole room, only when asked).
  const inText = new Set(ids.values());
  const was = session.scope || new Set(session.back.values());
  out.missing = [...was].filter((id) => w.things[id] && !inText.has(id) && w.things[id].parent === roomId);
  if (session.scope || removeMissing) {
    const missing = out.missing.map((id) => w.things[id]);
    for (const g of missing.filter(isGroup)) {
      if (!w.things[g.id]) continue;
      changes.push(`${named(w, g.id)} is deleted (what it holds stays, unless it is gone from the text too)`);
      g.members = [];
      remove(w, g.id);
    }
    for (const th of missing.filter(isLeaf)) {
      if (!w.things[th.id]) continue;
      if (groupsOf(w, th.id).length && session.scope) continue; // another group still holds it
      remove(w, th.id);
      counts.deleted++;
    }
    if (counts.deleted) changes.push(`${plural(counts.deleted, 'thought')} deleted`);
  } else if (out.missing.length) changes.push(`Not in the text, left as ${out.missing.length === 1 ? 'it is' : 'they are'}: ${out.missing.slice(0, 6).map((id) => named(w, id)).join(', ')}${out.missing.length > 6 ? ` and ${out.missing.length - 6} more` : ''}`);

  // Each mode's lines, with the things the text holds as their scope.
  const sectionIds = new Map([...session.back].filter(([, id]) => w.things[id]));
  for (const [a, b] of ids) sectionIds.set(a, b);
  const unread = readSections(w, roomId, parts, {
    ids: sectionIds, relations, ontologies, modes, report, fresh, scope: inText,
    change: (words) => changes.push(words), name: (id) => (isGroup(w.things[id]) ? `"${chapterName(w, id)}"` : named(w, id)),
  });

  // The front matter, for the whole room.
  for (const m of meta) {
    const r = room(w, roomId);
    changes.push(m.text);
    if (m.key.startsWith('setting:')) setRoomSetting(w, roomId, m.of, m.k, m.to);
    else if (m.to == null || (m.key === 'desc' && !m.to)) delete r[m.key];
    else update(w, roomId, { [m.key]: m.to }, now);
  }
  // What wasn't understood: the room's text replaces what was kept; a group's adds to it.
  if (!session.scope && w.own[roomId]?.[KEPT]) {
    const data = own(w, roomId, KEPT);
    for (const k of ['objects', 'sections', 'modeLines']) delete data[k];
    if (parts.front.length) data.front = frontOf(parts, []).kept;
    if (!Object.values(data).some((v) => (Array.isArray(v) ? v.length : v && Object.keys(v).length))) delete w.own[roomId][KEPT];
  }
  if (!session.scope && parts.front.length && frontOf(parts, []).kept.length && !w.own[roomId]?.[KEPT]) own(w, roomId, KEPT).front = frontOf(parts, []).kept;
  keep(w, roomId, kept, null, unread);
  if (counts.made) changes.push(`${plural(counts.made, 'new thought')}`);
  return out;
}

// The formulas KaTeX can't draw in a text: [{ line, tex }], by its line.
export function badMaths(parts) {
  const out = [];
  for (const o of parts.objects) {
    if (!ITEMS[o.kind] || o.kind === 'picture') continue;
    if (o.title) for (const b of broken(o.title)) out.push({ line: o.line, tex: b.tex.trim() });
    for (const b of broken(o.lines.join('\n'))) out.push({ line: (o.first ?? o.line + 1) + b.line, tex: b.tex.trim() });
  }
  return out.sort((x, y) => x.line - y.line);
}

// A copy of the world, for a dry run.
export const copyWorld = (w) => JSON.parse(JSON.stringify(w));

