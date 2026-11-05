// The .traum grammar: a room file as plain text, read into parts and written back, with no world
// and no screen (tests/grammar.test.js). traum.js turns the parts into a room and back.
//
//   ---                                  front matter: `key: value` lines (format, guide, room,
//   format: room/2                       modes or twin, description, tags, colour, mode.key
//   room: Linear algebra                 settings). Values with odd characters go in "quotes",
//   modes: [russell, joyce]              lists in [ ].
//   ---
//
//   # Objects                            every thing in the room, once
//
//   ## ^1 line                           an object: ## ^id kind, or ## ^id kind: title. The id is
//   A vector is a list of numbers.       any word; it only has to be unique in the file. What
//                                        follows is the object's body (an item's words) or its
//   ## ^arrays group: Arrays             key lines (a group's), as its kind says
//   made in: russell
//   holds: ^1 ^2
//   closed                               a key with no colon is a flag
//
//   # In russell                         one section per ontology: where things sit there
//   on canvas: ^arrays
//   arrow: ^arrays -> ^matrices | forgets | the equations
//
// One line shape everywhere outside bodies: `key: value value …` (or a bare `key`). Values are
// typed (values()): ^refs (^a, ^a#2 an occurrence, ^a@"words" a span), numbers, dates, "quoted
// text", [lists], bare words, and the signs -> and |. A body line that starts with `## ^` or `# `
// is written with a backslash in front and read back without it. Nothing here knows a kind or an
// ontology: anything is read, and whoever uses the parts says what it understood.

// ---- Lines ----

export const OBJECT = /^##\s+\^(\S+)\s+([A-Za-z][\w-]*)(?::\s?(.*?))?\s*$/; // ## ^id kind: title
export const SECTION = /^#\s+(.*?)\s*$/; // # Objects, # In joyce, # Left: joyce
const LOOKS = /^(##\s+\^|#\s)/; // what a body line can't start with unless it has a backslash in front
const KEY = /^([A-Za-z][\w.-]*(?: [A-Za-z][\w.-]*){0,3})\s*:(?:\s+(.*?))?\s*$|^([A-Za-z][\w-]*)$/; // key: values, or a one-word flag

export function escape(l) {
  const m = /^(\\*)(.*)$/s.exec(l);
  return LOOKS.test(m[2]) ? '\\' + l : l;
}
export function unescape(l) {
  const m = /^\\(\\*)(.*)$/s.exec(l);
  return m && LOOKS.test(m[2]) ? m[1] + m[2] : l;
}

// A key line read: { key, raw, values } (raw: the words after the colon, as written; values: them
// typed), or null when the line isn't one. A bare word is a flag: { key, raw: '', values: [], flag }.
export function keyLine(l) {
  const m = KEY.exec(String(l).trim());
  if (!m) return null;
  if (m[3] != null) return { key: m[3].trim().toLowerCase(), raw: '', values: [], flag: true };
  const raw = m[2] ?? '';
  return { key: m[1].trim().toLowerCase(), raw, values: values(raw) };
}

// ---- Values ----
//
// Each value is one of:
//   { t: 'ref', id, occ?, span? }   ^a, ^a#2 (its second occurrence), ^a@"some words" (those words in it)
//   { t: 'num', v }                 12, -3.5
//   { t: 'date', v }                2026-11-05 (or with a time: 2026-11-05T14:30)
//   { t: 'text', v }                "quoted text" (\" is a quote, \\ a backslash)
//   { t: 'list', v: [values] }      [a, "b, c", 3]
//   { t: 'sign', v }                -> or |
//   { t: 'word', v }                anything else, up to a space

const DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
const NUM = /^-?\d+(\.\d+)?$/;

function quoted(s, i) {
  let v = '';
  for (i++; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && (s[i + 1] === '"' || s[i + 1] === '\\')) { v += s[++i]; continue; }
    if (c === '"') return { v, end: i + 1 };
    v += c;
  }
  return { v, end: s.length, open: true };
}

// The values in some words, in order.
export function values(raw, stop = '') {
  const s = String(raw ?? '');
  const out = [];
  let i = 0;
  const read = () => {
    while (/\s/.test(s[i] || '')) i++;
    if (i >= s.length || stop.includes(s[i])) return null;
    const c = s[i];
    if (c === '"') { const q = quoted(s, i); i = q.end; return { t: 'text', v: q.v }; }
    if (c === '[') {
      i++;
      const list = [];
      for (;;) {
        while (/[\s,]/.test(s[i] || '')) i++;
        if (i >= s.length) break;
        if (s[i] === ']') { i++; break; }
        const v = read();
        if (!v) { i++; continue; }
        list.push(v);
      }
      return { t: 'list', v: list };
    }
    if (c === '^') {
      const m = /^\^([^\s#@,\]]+)(?:#(\d+))?/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const ref = { t: 'ref', id: m[1] };
        if (m[2]) ref.occ = +m[2];
        if (s[i] === '@' && s[i + 1] === '"') { const q = quoted(s, i + 1); ref.span = q.v; i = q.end; }
        return ref;
      }
    }
    const m = /^[^\s,\]]+/.exec(s.slice(i)) || /^\S/.exec(s.slice(i));
    i += m[0].length;
    const w = m[0];
    if (w === '->' || w === '|') return { t: 'sign', v: w };
    if (NUM.test(w)) return { t: 'num', v: +w };
    if (DATE.test(w)) return { t: 'date', v: w };
    return { t: 'word', v: w };
  };
  for (;;) {
    const v = read();
    if (!v) break;
    out.push(v);
  }
  return out;
}

// A value written back, so values() reads it as the same.
export function writeValue(x) {
  if (x == null) return '';
  if (typeof x === 'number') return String(Math.round(x * 1000) / 1000);
  if (typeof x === 'string') return plainWord(x) ? x : quote(x);
  switch (x.t) {
    case 'ref': return `^${x.id}${x.occ ? `#${x.occ}` : ''}${x.span != null ? `@${quote(x.span)}` : ''}`;
    case 'num': return writeValue(x.v);
    case 'date': return x.v;
    case 'text': return quote(x.v);
    case 'list': return `[${x.v.map(writeValue).join(', ')}]`;
    default: return String(x.v);
  }
}
export const quote = (s) => `"${String(s).replace(/\\(?=["\\]|$)/g, '\\\\').replace(/"/g, '\\"')}"`;
const plainWord = (s) => s !== '' && /^[^\s"[\],^]+$/.test(s) && !NUM.test(s) && !DATE.test(s) && s !== '->' && s !== '|';
export const ref = (id) => `^${id}`;

// ---- Front matter values ----

export function scalar(v) {
  const s = String(v).trim();
  if (/^".*"$/s.test(s)) return quoted(s, 0).v;
  if (s === 'true' || s === 'false') return s === 'true';
  if (NUM.test(s)) return +s;
  return s;
}
// A list: [a, "b, c"] (or a, b without the brackets). Its words stay words.
export function list(s) {
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
const plainScalar = (s) => s !== '' && !/^\s|\s$|^["[#]|\n|^(true|false)$|^-?\d+(\.\d+)?$/.test(s);
export const writeScalar = (v) => (typeof v === 'string' ? (plainScalar(v) ? v : quote(v)) : JSON.stringify(v));
export const writeList = (xs) => `[${xs.map((t) => (/[,[\]"]|^\s|\s$/.test(t) ? quote(t) : t)).join(', ')}]`;
// A front matter value as written: a list in [ ], else one value.
export const frontValue = (raw) => (/^\s*\[/.test(raw) ? list(raw) : scalar(raw));
export const writeFront = (v) => (Array.isArray(v) ? writeList(v.map(String)) : writeScalar(v));

// ---- Reading a file ----

// The file in parts:
//   front     [{ key, raw, line }]                         the front matter's lines, in order
//   objects   [{ id, kind, title, lines, line, first }]     lines: its body as written (unescaped),
//                                                          blank lines at either end left off;
//                                                          line: its ## line; first: its first body line
//   sections  [{ name, lines: [{ ...keyLine, text, line }], line }]   each # section but Objects;
//                                                          a line that isn't key: values has key null
//   report    ['Line 3: …']                                what couldn't be read
// Nothing is dropped: whoever uses the parts says what it didn't understand.
export function parse(text) {
  const report = [];
  const lines = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const front = [];
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
      front.push({ key: m[1], raw: m[2].trim(), line: k + 1 });
    }
    i = from;
  }
  const objects = [], sections = [];
  let obj = null, sec = null, stray = 0;
  const close = () => {
    if (!obj) return;
    while (obj.lines.length && !obj.lines.at(-1).trim()) obj.lines.pop();
    while (obj.lines.length && !obj.lines[0].trim()) { obj.lines.shift(); obj.first++; }
    obj = null;
  };
  for (; i < lines.length; i++) {
    const l = lines[i];
    const o = !sec && OBJECT.exec(l);
    if (o) {
      close();
      obj = { id: o[1], kind: o[2].toLowerCase(), title: o[3] ?? null, lines: [], line: i + 1, first: i + 2 };
      objects.push(obj);
      continue;
    }
    const s = SECTION.exec(l);
    if (s) {
      close();
      if (/^objects$/i.test(s[1])) { sec = null; continue; }
      sec = { name: s[1], lines: [], line: i + 1 };
      sections.push(sec);
      continue;
    }
    if (obj) { obj.lines.push(unescape(l)); continue; }
    if (!l.trim()) continue;
    if (sec) { sec.lines.push({ ...(keyLine(l) || { key: null }), text: l, line: i + 1 }); continue; }
    if (!stray++) report.push(`Line ${i + 1}: "${l.trim().slice(0, 40)}" is outside any object or section, so it was left out.`);
  }
  close();
  if (stray > 1) report[report.length - 1] = report.at(-1).replace(/, so it was left out\.$/, `, and so ${stray - 1 === 1 ? 'is 1 more line' : `are ${stray - 1} more lines`}; they were left out.`);
  return { front, objects, sections, report };
}

// An object's body as key lines (a group's, a relation's): [{ key, raw, values, flag?, line }],
// and the lines that aren't key lines ([{ text, line }]).
export function keysOf(obj) {
  const keys = [], other = [];
  obj.lines.forEach((l, k) => {
    if (!l.trim()) return;
    const kl = keyLine(l);
    const line = (obj.first ?? obj.line + 1) + k;
    if (kl) keys.push({ ...kl, line });
    else other.push({ text: l, line });
  });
  return { keys, other };
}

// ---- Writing a file ----

// The parts written as text: front [[key, value]] (value: written as is, a string), objects
// [{ id, kind, title, lines }] (lines: the body, escaped here), sections [{ name, lines }].
export function write({ front = [], objects = [], sections = [] }) {
  const out = [];
  if (front.length) out.push(['---', ...front.map(([k, v]) => `${k}: ${v}`), '---'].join('\n'));
  out.push('# Objects');
  for (const o of objects) {
    const head = `## ^${o.id} ${o.kind}${o.title ? `: ${o.title}` : ''}`;
    out.push([head, ...(o.lines || []).map(escape)].join('\n'));
  }
  for (const s of sections) out.push([`# ${s.name}`, ...s.lines].join('\n'));
  return out.join('\n\n') + '\n';
}
