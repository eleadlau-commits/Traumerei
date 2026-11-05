// Room Markdown: a room as a plain text file, to write by hand (or have Claude write) and bring in
// at once, and to take a room out again. No screen here, so it can be tested on its own
// (tests/roomfile.test.js); Roomfile.js reads and downloads the files.
//
//   ---                                   front matter (optional): the room's name, its mode, a
//   room: Linear algebra                  line about it, its tags and colour, and its settings for
//   kind: russell                         each mode as mode.key
//   description: Each chapter abstracts the last
//   tags: [maths, book]
//   russell.overlap: false
//   ---
//   - a thought with no group             loose (Pessoa places it; a tray holds it elsewhere)
//
//   ## Matrices {parent="Arrays" forgets="the equations"}
//   > folded                              a group (a train, a chapter), folded; {…} its attributes
//   - a line                              a line thought; indented lines under it stay in it
//   ### A title                           a passage: a title and the paragraphs under it
//   A body with $x_i$ in it.              (a bare ### for no title; a paragraph on its own is a
//                                         passage with no title)
//   ![a caption](data:image/jpeg;base64,…)   a picture
//
// Everything else is kept as written, LaTeX too. Each kind of item says how it reads and writes
// itself (items/: md). A line that would read as structure is written with a backslash in front
// (\## …, \- …) and read back without it.
//
// The thoughts are stamped in the file's order, a millisecond apart. Where they sit is left to the
// room's mode and clear space; Russell's arrows go through link(), so its rules hold, and what it
// refuses is reported, never fatal. Attributes other than Russell's arrows are kept in
// own(w, room, of).headings[group] as [[key, value], …], so nothing is lost on the way back out.

import {
  view, room, create, update, members, groupsIn, roomItems, own, shut, kindOf, isLeaf, addRoom,
  seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, link, arrowsInto, stepAfter,
  remove, leave, groupsOf, isGroup, unlink, setLabel, broken,
} from './world.js';

const RUSSELL = 'russell';
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// ---- Lines that mean something ----

const HEADING = /^##(\s|$)/; // a group (### is a passage)
const IMAGE = /^!\[.*\]\(\S+\)\s*$/;
// What a line in a passage can't start with unless it has a backslash in front.
const LOOKS = /^(#{2,3}(\s|$)|-(\s|$)|!\[|>\s*folded)/i;

const structural = (l) => HEADING.test(l) || /^###(\s|$)/.test(l) || /^-(\s|$)/.test(l) || IMAGE.test(l);
export function escape(l) {
  const m = /^(\\*)(.*)$/s.exec(l);
  return LOOKS.test(m[2]) ? '\\' + l : l;
}
export function unescape(l) {
  const m = /^\\(\\*)(.*)$/s.exec(l);
  return m && LOOKS.test(m[2]) ? m[1] + m[2] : l;
}
const count$$ = (s) => (s.match(/\$\$/g) || []).length;
// Help each kind's md.read gets: display maths ($$ … $$) may run over lines that look like
// structure, as long as it closes before the next group.
const H = {
  structural, escape, unescape,
  mathOpen: (body) => count$$(body.join('\n')) % 2 === 1,
  closesAhead(lines, j) {
    for (let k = j; k < lines.length; k++) {
      if (k > j && HEADING.test(lines[k])) return false;
      if (lines[k].includes('$$')) return true;
    }
    return false;
  },
};
const readers = () => Object.values(ITEMS).filter((k) => k.md?.read).sort((a, b) => a.md.order - b.md.order);

// ---- Values in the front matter and in attributes ----

function scalar(v) {
  const s = String(v).trim();
  if (/^".*"$/s.test(s)) { try { return JSON.parse(s); } catch { return s.slice(1, -1); } }
  if (s === 'true' || s === 'false') return s === 'true';
  if (/^-?\d+(\.\d+)?$/.test(s)) return +s;
  return s;
}
const plain = (s) => s !== '' && !/^\s|\s$|^["[]|\n|^(true|false)$|^-?\d+(\.\d+)?$/.test(s);
const writeScalar = (v) => (typeof v === 'string' ? (plain(v) ? v : JSON.stringify(v)) : JSON.stringify(v));

// A list: [a, "b, c"] (or a, b without the brackets). Its words stay words.
function list(s) {
  s = String(s).trim().replace(/^\[(.*)\]$/s, '$1');
  const out = [];
  const re = /\s*("(?:\\.|[^"\\])*"|[^,]*)\s*(,|$)/g;
  let m;
  while ((m = re.exec(s)) && m[0]) {
    const t = m[1].trim();
    if (t) out.push(t.startsWith('"') ? scalar(t) : t);
    if (!m[2]) break;
  }
  return out.map(String);
}
const writeList = (xs) => `[${xs.map((t) => (/[,[\]"]|^\s|\s$/.test(t) ? JSON.stringify(t) : t)).join(', ')}]`;

// An attribute's value, in "…": \" is a quote and \\ a backslash; any other backslash is itself
// (so LaTeX reads as written).
function writeAttr(v) {
  const s = String(v);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') out += '\\"';
    else if (c === '\\' && (i === s.length - 1 || s[i + 1] === '\\' || s[i + 1] === '"')) out += '\\\\';
    else out += c;
  }
  return `"${out}"`;
}

// A heading's words: its title, and the {key="value" …} at its end. Braces that don't start with
// key= (LaTeX's) are the title's. Returns { title, attrs, broken }.
function heading(rest) {
  const s = rest.trim();
  for (let p = s.indexOf('{'); p >= 0; p = s.indexOf('{', p + 1)) {
    if (!/^\s*[A-Za-z_][\w.-]*\s*=/.test(s.slice(p + 1))) continue;
    const attrs = [];
    let i = p + 1;
    const ws = () => { while (/\s/.test(s[i] || '')) i++; };
    for (;;) {
      ws();
      if (s[i] === '}') {
        const ok = !s.slice(i + 1).trim();
        return { title: s.slice(0, p).trim(), attrs, broken: !ok };
      }
      const k = /^[A-Za-z_][\w.-]*/.exec(s.slice(i));
      if (!k) break;
      i += k[0].length;
      ws();
      if (s[i] !== '=') break;
      i++;
      ws();
      let v = '';
      if (s[i] === '"') {
        i++;
        let closed = false;
        while (i < s.length) {
          const c = s[i];
          if (c === '\\' && (s[i + 1] === '"' || s[i + 1] === '\\')) { v += s[i + 1]; i += 2; continue; }
          if (c === '"') { closed = true; i++; break; }
          v += c;
          i++;
        }
        if (!closed) break;
      } else {
        const u = /^[^\s"}]+/.exec(s.slice(i));
        if (!u) break;
        v = u[0];
        i += v.length;
      }
      attrs.push([k[0], v]);
    }
    return { title: s.slice(0, p).trim(), attrs, broken: true };
  }
  return { title: s, attrs: [], broken: false };
}

// ---- Reading ----

const META = { room: 'room', kind: 'kind', description: 'description', desc: 'description', tags: 'tags', tint: 'tint', light: 'light', opacity: 'opacity' };

// The file read: { meta, loose: [fields], groups: [{ title, attrs, folded, items, line }], report }.
// Nothing changes yet; report lists what couldn't be read, by line.
export function parse(text) {
  const report = [];
  const lines = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const meta = { settings: {} };
  let i = 0;
  if (lines[0]?.trim() === '---') {
    let end = lines.findIndex((l, k) => k > 0 && /^(---|\.\.\.)\s*$/.test(l));
    let from = end + 1;
    if (end < 0) {
      end = lines.findIndex((l, k) => k > 0 && !/^\s*[\w.-]+\s*:/.test(l));
      if (end < 0) end = lines.length;
      from = end;
      report.push('Line 1: the front matter has no closing ---, so only the settings lines at the top were read.');
    }
    for (let k = 1; k < end; k++) {
      const l = lines[k];
      if (!l.trim() || /^\s*#/.test(l)) continue;
      const m = /^\s*([\w.-]+)\s*:\s?(.*)$/.exec(l);
      if (!m) { report.push(`Line ${k + 1}: "${l.trim()}" isn't a setting (key: value), so it was left out.`); continue; }
      const key = m[1], raw = m[2];
      if (META[key] === 'tags') meta.tags = list(raw);
      else if (META[key]) meta[META[key]] = META[key] === 'light' || META[key] === 'opacity' ? scalar(raw) : String(scalar(raw));
      else if (key.includes('.')) {
        const dot = key.indexOf('.');
        (meta.settings[key.slice(0, dot)] ||= {})[key.slice(dot + 1)] = scalar(raw);
      } else report.push(`Line ${k + 1}: Träumerei doesn't know "${key}", so it was left out.`);
    }
    i = from;
  }
  const loose = [], groups = [];
  let cur = null;
  const kinds = readers();
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (HEADING.test(l)) {
      const h = heading(l.slice(2));
      if (h.broken) report.push(`Line ${i + 1}: the {…} on "${l.trim()}" isn't closed properly; the heading was kept${h.attrs.length ? ` with the attributes before the break` : ''}.`);
      cur = { title: h.title, attrs: h.attrs, folded: false, items: [], line: i + 1 };
      groups.push(cur);
      i++;
      let k = i;
      while (k < lines.length && !lines[k].trim()) k++;
      const f = /^>\s*folded\s*(?::\s*(.*?))?\s*$/i.exec(lines[k] || '');
      if (f) { cur.folded = true; if (f[1] && !cur.title) cur.title = f[1]; i = k + 1; }
      continue;
    }
    for (const kind of kinds) {
      const r = kind.md.read(lines, i, H);
      if (!r) continue;
      (cur ? cur.items : loose).push({ ...r.fields, line: i + 1 });
      i = Math.max(i + 1, r.end);
      break;
    }
  }
  return { meta, loose, groups, report };
}

// A picture that couldn't be brought in, as a line that says so.
export function unfetched(item, report) {
  const where = item.url || 'its data';
  report?.push(`Line ${item.line}: the picture at ${where.length > 60 ? where.slice(0, 57) + '…' : where} couldn't be fetched, so a line says so.`);
  return { kind: 'line', text: `A picture couldn't be fetched${item.text ? `: ${item.text}` : ''} (${item.url || 'unreadable data'})`, line: item.line };
}

// How many of each the file holds: { groups, thoughts, pictures, text }.
export function summary(parsed) {
  const items = [...parsed.loose, ...parsed.groups.flatMap((g) => g.items)];
  const n = { groups: parsed.groups.length, thoughts: items.length, pictures: items.filter((x) => x.kind === 'picture').length };
  return { ...n, text: say(n) };
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export const say = (n) => [plural(n.groups, 'group', 'groups'), plural(n.thoughts, 'thought', 'thoughts'),
  ...(n.pictures ? [plural(n.pictures, 'picture', 'pictures')] : [])].join(', ');

// ---- Bringing it in ----

// The ontology whose groups a mode's ## headings make: its own, or Joyce's trains for a mode
// without groups (Pessoa).
export const groupsFor = (o) => (o?.groups ? o.id : DEFAULT_MODE);
const modeOf = (w, roomId, ontologies) => {
  const id = view(w, roomId).mode;
  return ontologies.find((o) => o.id === id) || ontologies.find((o) => o.id === 'pessoa') || { id, groups: null };
};

// Where each new Joyce train starts: rows of four from `at`, each row below the longest train above.
function spots(w, ids, at = { x: 0, y: 0 }) {
  const out = {};
  let y = at.y, tallest = 0;
  ids.forEach((id, k) => {
    if (k && k % 4 === 0) { y += tallest + 140; tallest = 0; }
    out[id] = { x: at.x + (k % 4) * 440, y };
    const g = w.things[id];
    tallest = Math.max(tallest, g.folded ? 60 : members(w, id).reduce((s, th) => s + stepAfter(th), 0));
  });
  return out;
}

// Adds the file's groups and thoughts to a room, as its own mode sees them (the front matter is
// for new rooms only). at: where new trains start. Returns { report, made: { groups, thoughts,
// pictures } }.
export function importInto(w, roomId, parsed, { ontologies = [], now = Date.now(), at = null } = {}) {
  const report = [...parsed.report];
  const made = { groups: 0, thoughts: 0, pictures: 0 };
  if (!room(w, roomId) || shut(w, roomId)) { report.push('This room is locked, so nothing was brought in.'); return { report, made }; }
  const of = groupsFor(modeOf(w, roomId, ontologies));
  let t = now;
  const add = (parent, f) => {
    const fields = f.kind === 'picture' && !f.src ? unfetched(f, report) : f;
    const th = create(w, parent, fields, t++);
    if (th) { made.thoughts++; if (kindOf(th) === 'picture') made.pictures++; }
    return th;
  };
  for (const f of parsed.loose) add(roomId, f);
  const madeGroups = []; // [{ id, src }]
  const left = new Set();
  for (const src of parsed.groups) {
    const name = src.title ? `"${src.title}"` : 'An untitled heading';
    const g = create(w, roomId, { kind: 'group', of, title: src.title, folded: src.folded }, t++);
    if (!g) continue;
    for (const f of src.items) add(g.id, f);
    if (!members(w, g.id).length) {
      delete w.things[g.id];
      left.add(src.title);
      report.push(`Line ${src.line}: ${name} has nothing under it, so it was left out.`);
      continue;
    }
    made.groups++;
    madeGroups.push({ id: g.id, src });
  }
  // Where new trains start; Russell lays its tree out itself.
  if (of !== RUSSELL) {
    const where = spots(w, madeGroups.map((m) => m.id), at || undefined);
    for (const { id } of madeGroups) Object.assign(w.things[id], where[id]);
  }
  // Attributes: Russell's arrows (parent, then what the child forgets about it), and the rest kept.
  const arrows = [];
  for (const { id, src } of madeGroups) {
    const rest = [];
    for (const [k, v] of src.attrs) {
      if (of === RUSSELL && k === 'parent') arrows.push({ child: id, parent: v, label: '', line: src.line, title: src.title });
      else if (of === RUSSELL && k === 'forgets') {
        const last = arrows.at(-1);
        if (last && last.child === id && !last.labelled) Object.assign(last, { label: v, labelled: true });
        else report.push(`Line ${src.line}: forgets="${v}" has no parent before it, so it was left out.`);
      } else rest.push([k, v]);
    }
    if (rest.length) (own(w, roomId, of).headings ||= {})[id] = rest;
  }
  if (arrows.length) {
    const mine = new Set(madeGroups.map((m) => m.id));
    const named = (title, fromFile) => groupsIn(w, roomId, RUSSELL).filter((g) => mine.has(g.id) === fromFile && g.title === title && members(w, g.id).length);
    for (const a of arrows) {
      const child = a.title ? `"${a.title}"` : 'an untitled chapter';
      let found = named(a.parent, true);
      if (!found.length) found = named(a.parent, false);
      let why = '';
      if (found.length > 1) why = `two chapters are called "${a.parent}"`;
      else if (!found.length) why = left.has(a.parent) ? `"${a.parent}" was left out` : `no chapter is called "${a.parent}"`;
      else why = link(w, roomId, found[0].id, a.child, a.label).replace(/\.$/, '');
      if (why) report.push(`Line ${a.line}: the arrow from "${a.parent}" to ${child} wasn't drawn: ${why[0].toLowerCase()}${why.slice(1)}.`);
    }
  }
  return { report, made };
}

// A new room opens looking at what arrived: the middle of its thoughts as its mode places them,
// zoomed out (not below half) so most of them fit. box: the screen's room for them (px).
export function frame(w, roomId, ontologies = [], box = { w: 1100, h: 640 }) {
  const o = modeOf(w, roomId, ontologies);
  if (typeof o.units !== 'function' || typeof o.point !== 'function') return;
  const ps = o.units(w, roomId).map((u) => o.point(w, roomId, u.id)).filter(Boolean);
  if (!ps.length) return;
  const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 340, y0 = Math.min(...ys) - 40, y1 = Math.max(...ys) + 80;
  const zoom = Math.max(0.5, Math.min(1, box.w / (x1 - x0), box.h / (y1 - y0)));
  Object.assign(view(w, roomId), { x: Math.round((x0 + x1) / 2), y: Math.round(zoom < 0.6 ? y0 + box.h / zoom / 2 : (y0 + y1) / 2), zoom: Math.round(zoom * 100) / 100 });
}

// A new room from the file, on a floor of the rooms page (with no cell yet: the floors feature
// places it), with the file's name, mode, description, tags, colour and settings. globals: the
// settings a new room starts from. Returns { room, report, made }.
export function importRoom(w, parsed, { ontologies = [], now = Date.now(), page = 0, globals = {}, name = 'Untitled' } = {}) {
  const meta = parsed.meta || {};
  const pre = [];
  let kind = meta.kind || DEFAULT_MODE;
  if (!ontologies.some((o) => o.id === kind)) {
    pre.push(`There is no mode called "${kind}", so the room is a ${ontologies.find((o) => o.id === DEFAULT_MODE)?.name || DEFAULT_MODE} room.`);
    kind = DEFAULT_MODE;
  }
  const r = addRoom(w, meta.room || name, now, { page }, kind);
  if (!r) return { room: null, report: [...pre, 'A room couldn\'t be made.'], made: { groups: 0, thoughts: 0, pictures: 0 } };
  const fields = {};
  if (meta.description) fields.desc = meta.description;
  if (meta.tags?.length) fields.tags = meta.tags;
  for (const k of ['tint', 'light', 'opacity']) if (meta[k] != null) fields[k] = meta[k];
  update(w, r.id, fields, now);
  seedRoomSettings(w, r.id, globals);
  for (const [of, set] of Object.entries(meta.settings || {})) for (const [k, v] of Object.entries(set)) setRoomSetting(w, r.id, of, k, v);
  const out = importInto(w, r.id, { ...parsed, report: [...pre, ...parsed.report] }, { ontologies, now: now + 1 });
  frame(w, r.id, ontologies);
  return { room: r, ...out };
}

// ---- Taking it out ----

// A file name for a room: its name, without what file systems refuse.
export const fileName = (name) => `${String(name || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'}.md`;

// pictures (optional): short references in place of each picture's data (shortPictures below).
function writeItem(th, pictures) {
  const kind = ITEMS[kindOf(th)];
  const out = kind?.md?.write ? kind.md.write(th, H) : `- ${String(kind?.text(th) || '').replace(/\n/g, ' ')}`;
  return pictures && th.src ? out.replace(th.src, pictures.ref(th.src)) : out;
}
function writeItems(ths, pictures) {
  let out = '';
  ths.forEach((th, k) => {
    const lineAfterLine = k && kindOf(th) === 'line' && kindOf(ths[k - 1]) === 'line' && !ths[k - 1].text.includes('\n\n');
    out += (k ? (lineAfterLine ? '\n' : '\n\n') : '') + writeItem(th, pictures);
  });
  return out;
}

// The groups a room writes (of ontology `of`), in the order of their first thoughts.
const ordered = (w, roomId, of) => groupsIn(w, roomId, of).filter((g) => members(w, g.id).length)
  .sort((a, b) => byTime(members(w, a.id)[0], members(w, b.id)[0]) || byTime(a, b));
// The thoughts in a room that are in none of its groups of `of`.
function looseIn(w, roomId, of) {
  const inGroup = new Set(ordered(w, roomId, of).flatMap((g) => g.members));
  return roomItems(w, roomId).filter((th) => isLeaf(th) && !inGroup.has(th.id));
}

// One group as a ## block: its heading (Russell's arrows, then the attributes kept), > folded, its
// thoughts.
function writeGroup(w, roomId, g, pictures) {
  const of = g.of;
  const attrs = [];
  if (of === RUSSELL) {
    const { parents, labels } = arrowsInto(w, roomId, g.id);
    for (const p of parents) { attrs.push(['parent', w.things[p]?.title || '']); if (labels[p]) attrs.push(['forgets', labels[p]]); }
  }
  attrs.push(...((own(w, roomId, of, false).headings || {})[g.id] || []));
  const head = ['##', g.title, attrs.length ? `{${attrs.map(([k, v]) => `${k}=${writeAttr(v)}`).join(' ')}}` : ''].filter(Boolean).join(' ');
  return [head, ...(g.folded ? ['> folded'] : []), writeItems(members(w, g.id), pictures)].join('\n');
}

// The room as room Markdown: the groups of the mode it is seen through (a big room, the mode that
// shows), each thought in its order, pictures as data: URLs (or short references, given pictures).
export function exportRoom(w, roomId, { ontologies = [], pictures = null } = {}) {
  const r = room(w, roomId);
  if (!r) return '';
  const o = modeOf(w, roomId, ontologies);
  const of = groupsFor(o);
  const front = ['---', `room: ${writeScalar(r.name || 'Untitled')}`, `kind: ${o.id}`];
  if (r.desc) front.push(`description: ${writeScalar(r.desc)}`);
  if (r.tags?.length) front.push(`tags: ${writeList(r.tags)}`);
  for (const k of ['tint', 'light', 'opacity']) if (r[k] != null) front.push(`${k}: ${writeScalar(r[k])}`);
  for (const [ont, set] of Object.entries(w.settings?.[roomId] || {})) {
    for (const [k, v] of Object.entries(set || {})) if (v !== undefined) front.push(`${ont}.${k}: ${writeScalar(v)}`);
  }
  front.push('---');
  const loose = looseIn(w, roomId, of);
  const blocks = [front.join('\n')];
  if (loose.length) blocks.push(writeItems(loose, pictures));
  for (const g of ordered(w, roomId, of)) blocks.push(writeGroup(w, roomId, g, pictures));
  return blocks.join('\n\n') + '\n';
}

// One group as room Markdown: its ## heading with its attributes, and its thoughts.
export function exportGroup(w, roomId, groupId, { pictures = null } = {}) {
  const g = w.things[groupId];
  if (!isGroup(g) || g.parent !== roomId) return '';
  return writeGroup(w, roomId, g, pictures) + '\n';
}

// ---- Editing as Markdown: a group (or a whole room) written out, changed, and put back ----
//
// exportGroup (or exportRoom) writes it; plan() reads the changed text against the world and says
// what Apply will do, with nothing changed yet; apply() does it. A group replaced keeps its id,
// place, children and arrows; only what differs is changed. A thought whose words are the same is
// kept as it is (its id, time, glow, the other modes' groups it is in); new and changed ones are
// made, and the ones gone are deleted (one another mode's group holds only leaves this group).

// Pictures in the window: short references (![caption](picture:3)) in place of their data, read
// back as the same pictures. full(text) puts the data back (to download).
export function shortPictures() {
  const bySrc = new Map(), byRef = new Map();
  return {
    ref(src) {
      if (!bySrc.has(src)) { const r = `picture:${bySrc.size + 1}`; bySrc.set(src, r); byRef.set(r, src); }
      return bySrc.get(src);
    },
    src: (ref) => byRef.get(String(ref).trim()) || null,
    full: (text) => String(text).replace(/^(!\[.*\]\()(picture:\d+)(\)\s*)$/gm, (m, a, r, b) => (byRef.has(r) ? a + byRef.get(r) + b : m)),
  };
}

// Words tidied as the world keeps them, so a thought typed the same reads as the same.
const oneLine = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();
const tidyLines = (x) => String(x ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
function sameKey(f) {
  const kind = ITEMS[f.kind] ? f.kind : 'line';
  const t = ITEMS[kind].tidy(f, { oneLine, lines: tidyLines });
  return t ? kind + '\u0000' + JSON.stringify(t) : null;
}

// The formulas KaTeX can't draw in a text: [{ line, tex }], by its line.
export function badMaths(text) {
  const parsed = parse(text);
  const lines = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const check = (words, line) => { for (const b of broken(words)) out.push({ line: line + b.line, tex: b.tex.trim() }); };
  const items = (list) => {
    for (const f of list) {
      if (f.kind !== 'passage') { check(f.text, f.line); continue; }
      const titled = /^###(\s|$)/.test(lines[f.line - 1] || '');
      if (f.title) check(f.title, f.line);
      check(f.body, f.line + (titled ? 1 : 0));
    }
  };
  items(parsed.loose);
  for (const g of parsed.groups) { check(g.title, g.line); items(g.items); }
  return out.sort((x, y) => x.line - y.line);
}

const key = (t) => String(t ?? '').trim().toLowerCase();
const ogName = (ontologies, of) => (ontologies.find((o) => o.id === of)?.groups?.name || 'Group').toLowerCase();
const named = (title, word) => (title ? `"${title}"` : `an untitled ${word}`);

// What Apply would do with the text read (parse()), with nothing changed yet. scope:
//   'group'   the text is one group (groupId): its first ## replaces it, further ones are added as
//             new groups, thoughts above the first heading are added as loose. With no ## at all,
//             the thoughts are the group's (its heading stays as it is).
//   'room'    the text is the whole room: each ## is matched to a group of the room's mode by its
//             title (trimmed, any case; untitled ones in order), the loose thoughts are replaced
//             like a group, and the front matter's changes are made. Groups not in the text are
//             listed (missing) and removed only when apply() is asked to.
//   'import'  a file brought into the room: matched as 'room', but its loose thoughts are added
//             and its front matter is not used.
// pictures: the window's short references (shortPictures). Returns { scope, roomId, of, word,
// parsed, replace: [{ id, src }], add: [src], missing: [id], renames: [{ id, from, to }],
// folds: [{ id, folded }], meta: [{ key, from, to, text }], arrowChanges: [text], counts, report }.
export function plan(w, roomId, parsed, { scope = 'group', groupId = null, ontologies = [], pictures = null, now = Date.now() } = {}) {
  const report = [...parsed.report];
  // Pictures by short reference, and the text read as plain lists (parse's result stays as it was).
  const pic = (f) => {
    if (f.kind !== 'picture' || !/^picture:\d+$/.test(f.url || '')) return f;
    const src = pictures?.src(f.url);
    if (src) { const { url, ...rest } = f; return { ...rest, src }; }
    return unfetched(f, report);
  };
  parsed = { ...parsed, loose: parsed.loose.map(pic), groups: parsed.groups.map((g) => ({ ...g, items: g.items.map(pic) })) };
  const p = { scope, roomId, of: null, word: 'group', parsed, replace: [], add: [], missing: [], renames: [], folds: [], meta: [], arrowChanges: [], loose: 'add', report };
  const r = room(w, roomId);
  if (!r) { report.push('That room isn\'t there any more.'); return p; }
  if (shut(w, roomId)) { report.push('This room is locked, so nothing can change.'); return p; }

  if (scope === 'group') {
    const g = w.things[groupId];
    if (!isGroup(g) || g.parent !== roomId) { report.push('That group isn\'t there any more.'); return p; }
    p.of = g.of;
    p.word = ogName(ontologies, g.of);
    const [first, ...rest] = parsed.groups;
    if (!first) p.replace.push({ id: g.id, src: { title: g.title, attrs: [], folded: !!g.folded, items: parsed.loose, line: 1, same: true } });
    else {
      p.replace.push({ id: g.id, src: first });
      p.add.push(...rest);
    }
    if (first && parsed.loose.length) p.looseAdd = parsed.loose;
  } else {
    p.of = groupsFor(modeOf(w, roomId, ontologies));
    p.word = ogName(ontologies, p.of);
    const groups = ordered(w, roomId, p.of);
    const taken = new Set();
    const untitled = groups.filter((g) => !key(g.title));
    for (const src of parsed.groups) {
      let hits;
      if (key(src.title)) hits = groups.filter((g) => key(g.title) === key(src.title));
      else hits = scope === 'room' ? untitled.filter((g) => !taken.has(g.id)).slice(0, 1) : [];
      if (hits.length > 1) {
        report.push(`Line ${src.line}: "${src.title}" matches ${hits.length} ${p.word}s, so it will be added as a new one.`);
        p.add.push(src);
      } else if (hits.length === 1 && taken.has(hits[0].id)) {
        report.push(`Line ${src.line}: "${src.title}" is the second heading for the same ${p.word}, so it will be added as a new one.`);
        p.add.push(src);
      } else if (hits.length === 1) {
        taken.add(hits[0].id);
        p.replace.push({ id: hits[0].id, src });
      } else p.add.push(src);
    }
    if (scope === 'room') {
      p.missing = groups.filter((g) => !taken.has(g.id)).map((g) => g.id);
      p.loose = 'replace';
      p.meta = metaChanges(w, roomId, parsed.meta, p.of, ontologies, report);
    } else if (parsed.loose.length) p.looseAdd = parsed.loose;
  }
  for (const { id, src } of p.replace) {
    const g = w.things[id];
    if (src.same) continue;
    if (!src.items.length) continue; // reported by the dry run
    if (src.title !== (g.title || '')) p.renames.push({ id, from: g.title || '', to: src.title });
    if (!!src.folded !== !!g.folded) p.folds.push({ id, folded: !!src.folded });
  }
  // A dry run on a copy: what Russell refuses, and how many thoughts are kept, made and deleted.
  const dry = run(copyWorld(w), roomId, p, { now, removeMissing: false });
  p.arrowChanges = dry.arrowChanges;
  p.counts = dry.counts;
  report.push(...dry.report);
  return p;
}

// The front matter's changes to the room: [{ key, from, to, text }]. Only when the text has front
// matter; then a description, tags or colour left out are taken away.
function metaChanges(w, roomId, meta, of, ontologies, report) {
  const has = Object.keys(meta || {}).some((k) => k !== 'settings') || Object.keys(meta?.settings || {}).length;
  if (!has) return [];
  const r = room(w, roomId);
  const out = [];
  const say = (v) => (v == null || v === '' ? 'nothing' : Array.isArray(v) ? (v.length ? v.join(', ') : 'nothing') : JSON.stringify(v));
  const diff = (k, label, from, to) => { if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) out.push({ key: k, from, to, text: `${label}: ${say(from)} → ${say(to)}` }); };
  if (meta.room != null) diff('name', 'Name', r.name, oneLine(meta.room) || 'Untitled');
  diff('desc', 'Description', r.desc || '', meta.description ? tidyLines(meta.description) : '');
  diff('tags', 'Tags', r.tags || [], meta.tags || []);
  for (const k of ['tint', 'light', 'opacity']) diff(k, k[0].toUpperCase() + k.slice(1), r[k] ?? null, meta[k] ?? null);
  for (const [ont, set] of Object.entries(meta.settings || {})) {
    for (const [k, v] of Object.entries(set)) {
      const now = w.settings?.[roomId]?.[ont]?.[k];
      if (now !== v) out.push({ key: `setting:${ont}.${k}`, of: ont, k, from: now, to: v, text: `${ont}.${k}: ${say(now)} → ${say(v)} (Ctrl+Z doesn't take settings back)` });
    }
  }
  const mode = view(w, roomId).mode;
  if (meta.kind && meta.kind !== mode && meta.kind !== of) report.push(`The room's mode stays ${mode}: kind can't change here.`);
  return out;
}

// Does what plan() said, in the world: one step for the caller to save. removeMissing: groups not
// in the text go too (room scope). Returns { report, arrowChanges, counts }.
export function apply(w, roomId, p, { now = Date.now(), removeMissing = false } = {}) {
  if (!room(w, roomId) || shut(w, roomId) || !p.of) return { report: [...p.report], arrowChanges: [], counts: null };
  return run(w, roomId, p, { now, removeMissing });
}

function run(w, roomId, p, { now, removeMissing }) {
  const report = [];
  const counts = { kept: 0, made: 0, deleted: 0, groupsAdded: 0, groupsRemoved: 0, pictures: 0 };
  const { of, word } = p;
  let t = now;
  // Thoughts that aren't in the text any more: deleted, unless another group holds them too.
  const drop = (th, from) => {
    if (groupsOf(w, th.id).some((g) => g.id !== from)) { if (from) leave(w, from, th.id); return; }
    remove(w, th.id);
    counts.deleted++;
  };
  const fields = (f) => (f.kind === 'picture' && !f.src ? unfetched(f, report) : f);

  // A list of thoughts (a group's, or the loose ones) made to read as `items`: the same words kept
  // as they are, the rest made (in the text's order) and the ones gone deleted. parent: the group,
  // or the room for loose thoughts.
  const refill = (parent, old, items) => {
    const pool = new Map();
    for (const th of old) { const k = sameKey(th); if (k) (pool.get(k) || pool.set(k, []).get(k)).push(th); }
    const seq = items.map(fields).map((f) => ({ f, th: pool.get(sameKey(f))?.shift() || null }));
    // The kept thoughts already in order keep their times; the others are stamped between them.
    const anchors = increasing(seq.map((s) => (s.th ? s.th.at : null)));
    let k = 0;
    while (k < seq.length) {
      if (anchors.has(k)) { k++; continue; }
      let e = k;
      while (e < seq.length && !anchors.has(e)) e++;
      const a = k > 0 ? seq[k - 1].th.at : null, b = e < seq.length ? seq[e].th.at : null, n = e - k;
      for (let j = 0; j < n; j++) {
        seq[k + j].at = a != null && b != null ? a + (j + 1) * (b - a) / (n + 1)
          : a != null ? Math.max(t, a + 1) + j : b != null ? b - (n - j) : t + j;
      }
      if (a != null && b == null) t = Math.max(t, a + 1) + n;
      else if (a == null && b == null) t += n;
      k = e;
    }
    const keep = new Set();
    for (const s of seq) {
      if (s.th) {
        keep.add(s.th.id);
        counts.kept++;
        if (s.at != null) s.th.at = s.at;
        continue;
      }
      const th = create(w, parent, s.f, s.at);
      if (th) { keep.add(th.id); counts.made++; if (kindOf(th) === 'picture') counts.pictures++; }
    }
    for (const th of old) if (!keep.has(th.id) && w.things[th.id]) drop(th, parent === roomId ? null : parent);
  };

  const keepAttrs = (id, attrs) => {
    const rest = attrs.filter(([k]) => of !== RUSSELL || (k !== 'parent' && k !== 'forgets'));
    const had = own(w, roomId, of, false).headings?.[id];
    if (rest.length) { if (JSON.stringify(had) !== JSON.stringify(rest)) (own(w, roomId, of).headings ||= {})[id] = rest; }
    else if (had) delete own(w, roomId, of).headings[id];
  };

  const arrowsFor = []; // [{ id, src }] whose Russell arrows follow their heading
  for (const { id, src } of p.replace) {
    const g = w.things[id];
    if (!g) continue;
    if (!src.items.length) { report.push(`Line ${src.line}: ${named(src.title, word)} has nothing under it, so that ${word} was left as it is.`); continue; }
    refill(id, members(w, id), src.items);
    if (src.same) continue;
    if (src.title !== (g.title || '')) update(w, id, { title: src.title }, now);
    if (!!src.folded !== !!g.folded) update(w, id, { folded: !!src.folded }, now);
    keepAttrs(id, src.attrs);
    if (of === RUSSELL) arrowsFor.push({ id, src });
  }
  if (p.loose === 'replace') refill(roomId, looseIn(w, roomId, of), p.parsed.loose);
  else for (const f of p.looseAdd || []) { const th = create(w, roomId, fields(f), t++); if (th) counts.made++; }

  const made = [];
  for (const src of p.add) {
    const g = create(w, roomId, { kind: 'group', of, title: src.title, folded: src.folded }, t++);
    if (!g) continue;
    for (const f of src.items) { const th = create(w, g.id, fields(f), t++); if (th) { counts.made++; if (kindOf(th) === 'picture') counts.pictures++; } }
    if (!members(w, g.id).length) {
      delete w.things[g.id];
      report.push(`Line ${src.line}: ${named(src.title, word)} has nothing under it, so it was left out.`);
      continue;
    }
    counts.groupsAdded++;
    made.push(g.id);
    keepAttrs(g.id, src.attrs);
    if (of === RUSSELL) arrowsFor.push({ id: g.id, src, added: true });
  }
  if (of !== RUSSELL && made.length) {
    const below = Math.max(0, ...groupsIn(w, roomId, of).filter((g) => !made.includes(g.id)).map((g) => g.y + (g.folded ? 60 : members(w, g.id).reduce((s, th) => s + stepAfter(th), 0)) + 140));
    const where = spots(w, made, { x: 0, y: below });
    for (const id of made) Object.assign(w.things[id], where[id]);
  }
  if (removeMissing) {
    for (const id of p.missing) {
      const g = w.things[id];
      if (!g) continue;
      for (const th of members(w, id)) drop(th, id);
      if (w.things[id]) remove(w, id);
      counts.groupsRemoved++;
    }
  }
  for (const m of p.meta) {
    const r = room(w, roomId);
    if (m.key.startsWith('setting:')) setRoomSetting(w, roomId, m.of, m.k, m.to);
    else if (m.to == null || (m.key === 'desc' && !m.to)) { delete r[m.key]; }
    else update(w, roomId, { [m.key]: m.to }, now);
  }
  const arrowChanges = arrowsFor.length ? redraw(w, roomId, arrowsFor, new Set(made), report) : [];
  return { report, arrowChanges, counts };
}

// Which of the times (null: not kept) stay as they are: the longest run that already increases.
function increasing(ats) {
  const idx = ats.map((a, i) => (a == null ? -1 : i)).filter((i) => i >= 0);
  const best = new Array(idx.length).fill(1), prev = new Array(idx.length).fill(-1);
  for (let x = 0; x < idx.length; x++) {
    for (let y = 0; y < x; y++) {
      if (ats[idx[y]] < ats[idx[x]] && best[y] + 1 > best[x]) { best[x] = best[y] + 1; prev[x] = y; }
    }
  }
  const out = new Set();
  let at = best.indexOf(Math.max(0, ...best));
  while (at >= 0 && idx.length) { out.add(idx[at]); at = prev[at]; }
  return out;
}

// Russell's arrows into each chapter made to follow its heading's parent and forgets attributes,
// through Russell's own rules. A link it refuses is reported and the arrow it would have taken the
// place of stays. Returns the changes as words ("A1: parent Matrices → Arrays").
function redraw(w, roomId, list, fromText, report) {
  const out = [];
  const title = (id) => w.things[id]?.title || 'an untitled chapter';
  for (const { id, src } of list) {
    const child = src.title || 'An untitled chapter';
    const want = [];
    for (const [k, v] of src.attrs) {
      if (k === 'parent') want.push({ title: v, label: '' });
      else if (k === 'forgets') {
        const last = want.at(-1);
        if (last && !last.labelled) Object.assign(last, { label: oneLine(v), labelled: true });
        else report.push(`Line ${src.line}: forgets="${v}" has no parent before it, so it was left out.`);
      }
    }
    const { parents: had, labels: hadLabels } = arrowsInto(w, roomId, id);
    // Each wanted parent, by its heading: one it already has first, then one from the text, then
    // any chapter of the room with that title.
    const resolved = [];
    for (const a of want) {
      const all = groupsIn(w, roomId, RUSSELL).filter((g) => g.id !== id && members(w, g.id).length);
      let chapters = all.filter((g) => (g.title || '') === a.title);
      if (!chapters.length && key(a.title)) chapters = all.filter((g) => key(g.title) === key(a.title)); // any case
      const mine = chapters.filter((g) => had.includes(g.id));
      let found = mine.length ? mine : chapters.filter((g) => fromText.has(g.id));
      if (!found.length) found = chapters;
      if (found.length !== 1) {
        report.push(`Line ${src.line}: the arrow from "${a.title}" to "${child}" can't be drawn: ${found.length ? `two chapters are called "${a.title}"` : `no chapter is called "${a.title}"`}.`);
        continue;
      }
      resolved.push({ id: found[0].id, label: a.label });
    }
    const wantIds = resolved.map((a) => a.id);
    const gone = had.filter((pId) => !wantIds.includes(pId));
    const fresh = resolved.filter((a) => !had.includes(a.id));
    for (const pId of gone) unlink(w, roomId, pId, id);
    const drawn = [], refused = [];
    for (const a of fresh) {
      const why = link(w, roomId, a.id, id, a.label);
      if (why) refused.push({ ...a, why: why.replace(/\.$/, '') }); else drawn.push(a);
    }
    // A refused link leaves the arrow it would have replaced as it was.
    const back = [];
    if (refused.length) {
      for (const pId of gone) {
        if (!refused.length || back.length >= refused.length) break;
        if (!link(w, roomId, pId, id, hadLabels[pId] || '')) back.push(pId);
      }
    }
    for (const a of resolved) {
      if (!had.includes(a.id)) continue;
      if ((hadLabels[a.id] || '') !== a.label) {
        setLabel(w, roomId, a.id, id, a.label);
        const q = (x) => (x ? `"${x}"` : 'nothing');
        out.push(`${child}: forgets ${q(hadLabels[a.id])} → ${q(a.label)} (about ${title(a.id)})`);
      }
    }
    const lost = gone.filter((pId) => !back.includes(pId));
    // A parent swapped for another reads as one change.
    while (lost.length && drawn.length) out.push(`${child}: parent ${title(lost.shift())} → ${title(drawn.shift().id)}`);
    for (const pId of lost) out.push(`${child}: parent ${title(pId)} removed`);
    for (const a of drawn) out.push(`${child}: parent ${title(a.id)} added`);
    for (const a of refused) {
      out.push(`${child}: parent ${title(a.id)} refused (${a.why[0].toLowerCase()}${a.why.slice(1)}), so the arrow stays as it was`);
      report.push(`Line ${src.line}: the arrow from "${title(a.id)}" to "${child}" wasn't drawn: ${a.why[0].toLowerCase()}${a.why.slice(1)}.`);
    }
  }
  return out;
}

// A copy of the world, for a dry run (the card shows what will arrive before anything changes).
export const copyWorld = (w) => JSON.parse(JSON.stringify(w));
