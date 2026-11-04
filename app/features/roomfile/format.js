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

// A new room from the file, on a page of the rooms page (in `cell` if it is free, or the first free
// one), with the file's name, mode, description, tags, colour and settings. globals: the settings
// a new room starts from. Returns { room, report, made }.
export function importRoom(w, parsed, { ontologies = [], now = Date.now(), cell = null, cols = 6, page = 0, globals = {}, name = 'Untitled' } = {}) {
  const meta = parsed.meta || {};
  const pre = [];
  let kind = meta.kind || DEFAULT_MODE;
  if (!ontologies.some((o) => o.id === kind)) {
    pre.push(`There is no mode called "${kind}", so the room is a ${ontologies.find((o) => o.id === DEFAULT_MODE)?.name || DEFAULT_MODE} room.`);
    kind = DEFAULT_MODE;
  }
  const r = addRoom(w, meta.room || name, now, cell, cols, { page }, kind);
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

function writeItem(th) {
  const kind = ITEMS[kindOf(th)];
  return kind?.md?.write ? kind.md.write(th, H) : `- ${String(kind?.text(th) || '').replace(/\n/g, ' ')}`;
}
function writeItems(ths) {
  let out = '';
  ths.forEach((th, k) => {
    const lineAfterLine = k && kindOf(th) === 'line' && kindOf(ths[k - 1]) === 'line' && !ths[k - 1].text.includes('\n\n');
    out += (k ? (lineAfterLine ? '\n' : '\n\n') : '') + writeItem(th);
  });
  return out;
}

// The room as room Markdown: the groups of the mode it is seen through (a big room, the mode that
// shows), each thought in its order, pictures as data: URLs.
export function exportRoom(w, roomId, { ontologies = [] } = {}) {
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
  const groups = groupsIn(w, roomId, of).filter((g) => members(w, g.id).length)
    .sort((a, b) => byTime(members(w, a.id)[0], members(w, b.id)[0]) || byTime(a, b));
  const inGroup = new Set(groups.flatMap((g) => g.members));
  const loose = roomItems(w, roomId).filter((th) => isLeaf(th) && !inGroup.has(th.id));
  const blocks = [front.join('\n')];
  if (loose.length) blocks.push(writeItems(loose));
  const kept = own(w, roomId, of, false).headings || {};
  const title = (id) => w.things[id]?.title || '';
  for (const g of groups) {
    const attrs = [];
    if (of === RUSSELL) {
      const { parents, labels } = arrowsInto(w, roomId, g.id);
      for (const p of parents) { attrs.push(['parent', title(p)]); if (labels[p]) attrs.push(['forgets', labels[p]]); }
    }
    attrs.push(...(kept[g.id] || []));
    const head = ['##', g.title, attrs.length ? `{${attrs.map(([k, v]) => `${k}=${writeAttr(v)}`).join(' ')}}` : ''].filter(Boolean).join(' ');
    blocks.push([head, ...(g.folded ? ['> folded'] : []), writeItems(members(w, g.id))].join('\n'));
  }
  return blocks.join('\n\n') + '\n';
}

// A copy of the world, for a dry run (the card shows what will arrive before anything changes).
export const copyWorld = (w) => JSON.parse(JSON.stringify(w));
