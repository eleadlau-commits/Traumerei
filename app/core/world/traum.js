// The .traum carrier: the six tables (tables.js) as plain text, and back (Law 8: the file is the
// tables). Format traum/3, spec in app/plugins/roomfile/FORMAT.md. No plugin is needed to read or
// write a file: every kind of mark goes through as rows. No screen here (tests/traum.test.js).
//
//   ---
//   format: traum/3
//   context: ^1
//   ---
//
//   # Marks
//   ## ^1 room: Linear algebra
//   mode: russell
//
//   ## ^2 line
//   made: 2026-11-08T10:00:00.000Z
//
//   A vector is a list of numbers.
//
//   # Places
//   ^2 in ^1 | rule: pessoa | at: {"x": 120, "y": 40}
//
//   # Links
//   ^2 part of ^3 | order: 0
//
//   # Distance
//   ^1 for others
//
//   # Gaps
//   ^2 open from world | opened: 2026-11-08T10:00:00.000Z
//
//   # Moments
//   2026-11-08T10:00:00.000Z made ^2

import { NAMES } from './tables.js';

export const FORMAT = 'traum/3';
export const GUIDE = 'https://github.com/eleadlau-commits/traumerei/blob/main/app/plugins/roomfile/FORMAT.md';
export const SECTIONS = Object.freeze(['Marks', 'Places', 'Links', 'Distance', 'Gaps', 'Moments']);
const READERS = ['me now', 'me later', 'others', 'machine'];
const DIRECTIONS = ['to world', 'from world', 'to maker'];
const LINKS = ['part of', 'stands for', 'relation'];
const ID = '[A-Za-z0-9_.:-]+';
const KEY = /^[a-z][A-Za-z0-9_-]*$/;
const RESERVED = new Set(['made', 'edited', 'title', 'name', 'text']);

// ---- Values ----

const iso = (ms) => new Date(ms).toISOString();
const time = (raw) => { const n = Date.parse(raw); return Number.isFinite(n) ? n : Number.isFinite(+raw) && String(raw).trim() !== '' ? +raw : NaN; };

// A value as written: a plain string bare when it reads back as itself, anything else as JSON.
export function value(v) {
  if (typeof v === 'string' && v && v === v.trim() && !/[\n|]/.test(v) && parse(v) === v) return v;
  return JSON.stringify(v);
}
// A value as read: JSON, or JSON with bare keys ({x: 1}), else the words themselves.
export function parse(raw) {
  const s = String(raw).trim();
  try { return JSON.parse(s); } catch { /* not JSON */ }
  if (/^[[{]/.test(s)) { try { return JSON.parse(s.replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":')); } catch { /* not that either */ } }
  return s;
}

// A row's parts, cut at ' | ' outside a quoted string.
function split(s) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === '\\') { cur += s[++i] ?? ''; } else if (c === '"') q = false; continue; }
    if (c === '"') { q = true; cur += c; continue; }
    if (s.startsWith(' | ', i)) { out.push(cur); cur = ''; i += 2; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const escape = (line) => (/^[#\\]/.test(line) ? `\\${line}` : line);
const unescape = (line) => (/^\\[#\\]/.test(line) ? line.slice(1) : line);
const oneLine = (s) => typeof s === 'string' && !/\n/.test(s) && s === s.trim();

// ---- Writing ----

const titleKey = (kind) => (kind === 'room' || kind === 'context' ? 'name' : 'title');

// The text of `tables` (tables.js read()) with `root` its context. ids: 'short' (^1, ^2, … in the
// order the marks were made, the root first) or 'real' (the world's own, for editing in place).
export function write(tables, { root = null, ids = 'short' } = {}) {
  const at = (m) => (Number.isFinite(m.at) ? m.at : 0);
  const marks = [...tables.marks].sort((a, b) => (b.id === root) - (a.id === root) || at(a) - at(b) || (a.id < b.id ? -1 : 1));
  const name = new Map(marks.map((m, i) => [m.id, ids === 'real' ? m.id : String(i + 1)]));
  const ref = (id) => `^${name.get(id) ?? id}`;
  const renameIn = (s) => String(s).split(':').map((p) => name.get(p) ?? p).join(':');
  const seg = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => (v === true && k === 'pinned' ? ' | pinned' : ` | ${k}: ${value(v)}`)).join('');
  const out = ['---', `format: ${FORMAT}`, `guide: ${GUIDE}`];
  if (root != null && name.has(root)) out.push(`context: ${ref(root)}`);
  out.push('---', '', '# Marks', '');
  for (const m of marks) {
    const kind = m.body?.kind || 'line';
    const content = { ...(m.body?.content || {}) };
    const tk = titleKey(kind);
    let head = `## ${ref(m.id)} ${kind}`;
    if (oneLine(content[tk])) { head += content[tk] ? `: ${content[tk]}` : ':'; delete content[tk]; }
    const fields = [];
    if (Number.isFinite(m.at)) fields.push(`made: ${iso(m.at)}`);
    if (Number.isFinite(m.edited)) fields.push(`edited: ${iso(m.edited)}`);
    const text = typeof content.text === 'string' && content.text && content.text === content.text.trim() ? content.text : null;
    if (text != null) delete content.text;
    for (const [k, v] of Object.entries(content)) fields.push(`${KEY.test(k) && !RESERVED.has(k) ? k : `content.${k}`}: ${value(v)}`);
    for (const [k, v] of Object.entries(m.material || {})) fields.push(`material.${k}: ${value(v)}`);
    out.push(head, ...fields);
    if (text != null) out.push('', ...text.split('\n').map(escape));
    out.push('');
  }
  // (rows in the order of their words, so a file's rows read the same whatever ids the world had)
  const section = (title, lines, sort = true) => { if (lines.length) out.push(`# ${title}`, ...(sort ? [...lines].sort() : lines), ''); };
  section('Places', tables.places.map((r) => `${ref(r.mark)} in ${ref(r.context)}${seg({ rule: r.rule ?? undefined, at: r.position ?? undefined, pinned: r.pinned || undefined })}`));
  section('Links', tables.links.map((r) => `${ref(r.from)} ${r.kind} ${ref(r.to)}${seg({ order: r.order, rule: r.rule, label: r.label, note: r.note })}`));
  section('Distance', tables.distance.map((r) => `${ref(r.context)} for ${r.reader}`));
  section('Gaps', tables.gaps.map((r) => `${ref(r.mark)} ${r.state} ${r.direction}${seg({ opened: iso(r.openedAt), resolved: r.resolvedAt != null ? iso(r.resolvedAt) : undefined, by: r.resolvedBy != null ? renameIn(r.resolvedBy) : undefined })}`));
  section('Moments', (tables.moments || []).map((r) => `${iso(r.time)} ${r.kind} ${ref(r.mark)}`), false);
  return `${out.join('\n').replace(/\n+$/, '')}\n`;
}

// ---- Reading ----

// The tables a text holds: { tables, root, report } with the file's own ids (no ^), root its
// context (the front matter's, else the first mark), and report the lines not understood (Law 8:
// what is not a row is not kept). Null when the text is not traum/3.
export function read(text) {
  const lines = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const report = [];
  const tables = Object.fromEntries(NAMES.map((n) => [n, []]));
  let i = 0, root = null;
  const front = {};
  if (lines[0]?.trim() === '---') {
    for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = /^([A-Za-z][\w.-]*):\s*(.*)$/.exec(lines[i]);
      if (m) front[m[1].toLowerCase()] = m[2].trim(); else if (lines[i].trim()) report.push(`Line ${i + 1}: not understood: ${lines[i].trim()}`);
    }
    i++;
  }
  if (front.format !== FORMAT) return null;
  for (const k of Object.keys(front)) if (!['format', 'guide', 'context'].includes(k)) report.push(`The front matter's ${k} is not a row of any table, so it was left out.`);
  if (front.context) root = front.context.replace(/^\^/, '');
  const ref = new RegExp(`^\\^(${ID})$`);
  const idOf = (s) => ref.exec(String(s).trim())?.[1] ?? null;
  const segments = (s) => {
    const parts = split(s);
    const o = {};
    for (const p of parts.slice(1)) {
      const m = /^([a-z]+)(?::\s*(.*))?$/.exec(p.trim());
      if (!m) return null;
      o[m[1]] = m[2] === undefined ? true : parse(m[2]);
    }
    return { head: parts[0].trim(), o };
  };
  let section = null, mark = null, phase = 'fields', body = [];
  const endMark = () => {
    if (!mark) return;
    while (body.length && !body[0].trim()) body.shift();
    while (body.length && !body.at(-1).trim()) body.pop();
    if (body.length) mark.body.content.text = body.map(unescape).join('\n');
    tables.marks.push(mark);
    mark = null; body = [];
  };
  const bad = (n, why) => report.push(`Line ${n + 1}: ${why}: ${lines[n].trim()}`);
  for (; i < lines.length; i++) {
    const line = lines[i];
    const h1 = /^#\s+(.+?)\s*$/.exec(line);
    if (h1) { endMark(); section = SECTIONS.find((s) => s.toLowerCase() === h1[1].toLowerCase()) || null; if (!section) bad(i, 'not a table'); continue; }
    if (section === 'Marks') {
      const h2 = new RegExp(`^##\\s+\\^(${ID})\\s+([a-z][a-z0-9-]*)(?::(.*))?\\s*$`).exec(line);
      if (h2) {
        endMark();
        mark = { id: h2[1], body: { kind: h2[2], content: {} } };
        if (h2[3] !== undefined) mark.body.content[titleKey(h2[2])] = h2[3].trim();
        phase = 'fields';
        continue;
      }
      if (!mark) { if (line.trim()) bad(i, 'not part of a mark'); continue; }
      const f = phase === 'fields' ? /^([a-z][\w.-]*):\s?(.*)$/.exec(line) : null;
      if (f) {
        const [k, raw] = [f[1], f[2]];
        if (k === 'made' || k === 'edited') { const t = time(raw); if (Number.isFinite(t)) mark[k === 'made' ? 'at' : 'edited'] = t; else bad(i, 'not a time'); }
        else if (k.startsWith('material.')) (mark.material ||= {})[k.slice(9)] = parse(raw);
        else mark.body.content[k.startsWith('content.') ? k.slice(8) : k] = parse(raw);
        continue;
      }
      phase = 'body';
      body.push(line);
      continue;
    }
    if (!line.trim()) continue;
    if (section === 'Moments') {
      const m = new RegExp(`^(\\S+)\\s+([a-z]+)\\s+\\^(${ID})\\s*$`).exec(line.trim());
      const t = m ? time(m[1]) : NaN;
      if (m && Number.isFinite(t)) tables.moments.push({ time: t, kind: m[2], mark: m[3] }); else bad(i, 'not a moment');
      continue;
    }
    const s = section && segments(line);
    if (!s) { bad(i, section ? 'not a row' : 'outside every table'); continue; }
    const words = s.head.split(/\s+/);
    const first = idOf(words[0]);
    if (section === 'Places') {
      const to = words[1] === 'in' && words.length === 3 ? idOf(words[2]) : null;
      if (!first || !to) { bad(i, 'not a place'); continue; }
      const r = { mark: first, context: to };
      if (s.o.rule != null) r.rule = String(s.o.rule);
      if (s.o.at != null) r.position = s.o.at;
      if (s.o.pinned) r.pinned = true;
      tables.places.push(r);
    } else if (section === 'Links') {
      const kind = words.slice(1, -1).join(' '), to = idOf(words.at(-1));
      if (!first || !to || !LINKS.includes(kind)) { bad(i, 'not a link'); continue; }
      const r = { from: first, to, kind };
      for (const k of ['order', 'rule', 'label', 'note']) if (s.o[k] != null) r[k] = k === 'order' ? +s.o[k] : String(s.o[k]);
      tables.links.push(r);
    } else if (section === 'Distance') {
      const reader = words.slice(2).join(' ');
      if (!first || words[1] !== 'for' || !READERS.includes(reader)) { bad(i, 'not a reader'); continue; }
      tables.distance.push({ context: first, reader });
    } else if (section === 'Gaps') {
      const state = words[1], direction = words.slice(2).join(' ');
      const opened = time(s.o.opened);
      if (!first || !['open', 'resolved'].includes(state) || !DIRECTIONS.includes(direction) || !Number.isFinite(opened)) { bad(i, 'not a gap'); continue; }
      const r = { mark: first, direction, state, openedAt: opened };
      if (state === 'resolved') { r.resolvedAt = Number.isFinite(time(s.o.resolved)) ? time(s.o.resolved) : opened; r.resolvedBy = s.o.by != null ? String(s.o.by) : 'judgement'; }
      tables.gaps.push(r);
    }
  }
  endMark();
  const known = new Set(tables.marks.map((m) => m.id));
  if (root == null || !known.has(root)) root = tables.marks[0]?.id ?? null;
  return { tables, root, report };
}
