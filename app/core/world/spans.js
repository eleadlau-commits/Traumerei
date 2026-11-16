// Spans: the look of words inside a thought. Law 1 says the look is part of the mark, so a span is
// material of the mark, kept on it (`spans: [{ from, to, kind }]`, character offsets into its text,
// `to` not included) and carried in every file; a span of a kind no plugin knows is kept and drawn
// plain. Kinds of span come from plugins (slots.spans: bold, a highlight), and so do decorators
// (slots.decorators): read-only functions that say how to draw a text (every word's first letter
// bold, a wavy line under a misspelt word) and never change it. Both draw only with the room's own
// classes (CLASSES), so the one look holds. No screen here (tests/spans.test.js).

export const CLASSES = Object.freeze(['bold', 'italic', 'underline', 'wavy', 'highlight', 'strike', 'quiet', 'caps', 'mono']);
const KIND = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const KINDS = new Map();
let DECORATORS = [];

// Kinds of span: { kind, name, class, md?: [open, close] }.
export function declareSpans(list = [], warn = () => {}) {
  KINDS.clear();
  for (const k of list) {
    if (!k || !KIND.test(k.kind || '')) { warn(k, 'a kind of lowercase words joined by dashes'); continue; }
    if (!CLASSES.includes(k.class)) { warn(k, `a class, one of ${CLASSES.join(', ')}`); continue; }
    if (KINDS.has(k.kind)) { warn(k, 'a kind of its own'); continue; }
    const md = Array.isArray(k.md) && k.md.length === 2 && k.md.every((s) => typeof s === 'string') ? [...k.md] : null;
    KINDS.set(k.kind, Object.freeze({ kind: k.kind, name: String(k.name || k.kind), class: k.class, md }));
  }
}
export const spanKind = (kind) => KINDS.get(kind) || null;
export const spanKinds = () => [...KINDS.values()];

// Decorators: { id, decorate(text, mark) → [{ from, to, class }] }, read-only.
export function declareDecorators(list = [], warn = () => {}) {
  DECORATORS = list.filter((d) => {
    if (d && typeof d.decorate === 'function') return true;
    warn(d, 'decorate(text, mark)');
    return false;
  });
}
export const decorating = () => DECORATORS.length > 0;

// A mark's spans tidied for a text of length `len`: in the text, from before to, a kind each,
// sorted; null when none is left.
export function clean(spans, len) {
  if (!Array.isArray(spans)) return null;
  const out = [];
  for (const s of spans) {
    if (!s || !KIND.test(s.kind || '')) continue;
    const from = Math.max(0, Math.min(len, Math.floor(+s.from))), to = Math.max(0, Math.min(len, Math.floor(+s.to)));
    if (!(Number.isFinite(from) && Number.isFinite(to)) || to <= from) continue;
    out.push({ from, to, kind: s.kind });
  }
  out.sort((a, b) => a.from - b.from || a.to - b.to || (a.kind < b.kind ? -1 : 1));
  return merge(out).length ? merge(out) : null;
}
// Spans of one kind that touch or overlap become one.
function merge(list) {
  const out = [];
  for (const s of list) {
    const prev = [...out].reverse().find((o) => o.kind === s.kind);
    if (prev && s.from <= prev.to) prev.to = Math.max(prev.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

// The spans of `before` carried over to `after`, the text it became: the part that changed is
// found (what both share at the start and the end), spans after it move with it, spans across it
// stretch or shrink, a span wholly inside what was taken out goes.
export function shift(spans, before, after) {
  if (!Array.isArray(spans) || !spans.length || before === after) return spans || null;
  const a = String(before ?? ''), b = String(after ?? '');
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const d = endB - endA;
  // (a span's start inside what was replaced moves after the new words; its end inside it, to the
  // end of them; typing just before or just after a span stays outside it)
  const from = (i) => (i < start ? i : i >= endA ? i + d : endB);
  const to = (i) => (i <= start ? i : i > endA ? i + d : endB);
  return clean(spans.map((s) => ({ ...s, from: from(s.from), to: to(s.to) })), b.length);
}

// Turns kind on over from..to, or off where all of it has it already. Returns the new spans.
export function toggle(spans, kind, from, to, len) {
  const list = clean(spans, len) || [];
  if (to <= from) return list.length ? list : null;
  const covered = coverage(list.filter((s) => s.kind === kind), from, to);
  if (!covered) return clean([...list, { from, to, kind }], len);
  const out = [];
  for (const s of list) {
    if (s.kind !== kind || s.to <= from || s.from >= to) { out.push(s); continue; }
    if (s.from < from) out.push({ ...s, to: from });
    if (s.to > to) out.push({ ...s, from: to });
  }
  return clean(out, len);
}
function coverage(list, from, to) {
  let at = from;
  for (const s of list.sort((x, y) => x.from - y.from)) { if (s.from > at) return false; at = Math.max(at, s.to); if (at >= to) return true; }
  return at >= to;
}

// How a mark's text is drawn: [{ from, to, class }] from its spans (kinds known) and every
// decorator. A decorator that throws or says something odd is left out.
export function ranges(mark, text = mark?.text) {
  const s = String(text ?? '');
  const out = [];
  for (const sp of Array.isArray(mark?.spans) ? mark.spans : []) {
    const k = KINDS.get(sp.kind);
    if (k) out.push({ from: sp.from, to: sp.to, class: k.class });
  }
  for (const d of DECORATORS) {
    let got = null;
    try { got = d.decorate(s, mark); } catch { got = null; }
    for (const r of Array.isArray(got) ? got : []) {
      if (r && CLASSES.includes(r.class) && Number.isInteger(r.from) && Number.isInteger(r.to) && r.from >= 0 && r.to <= s.length && r.to > r.from) out.push({ from: r.from, to: r.to, class: r.class });
    }
  }
  return out;
}

// The text cut where any range (or an extra cut) begins or ends: [{ from, to, classes: [...] }].
export function segments(len, list, cuts = []) {
  const at = new Set([0, len, ...cuts.filter((c) => c >= 0 && c <= len)]);
  for (const r of list) { at.add(Math.max(0, r.from)); at.add(Math.min(len, r.to)); }
  const points = [...at].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i], to = points[i + 1];
    if (to <= from) continue;
    const classes = [...new Set(list.filter((r) => r.from <= from && r.to >= to).map((r) => r.class))];
    out.push({ from, to, classes });
  }
  return out;
}

// The text with each span written as Markdown, where its kind says how (bold as **…**).
// kinds: the kinds to read (a list), when not the ones declared.
export function markdown(text, spans, kinds = null) {
  const s = String(text ?? '');
  const marks = [];
  const known = kinds ? new Map(kinds.filter((k) => k && k.kind).map((k) => [k.kind, k])) : KINDS;
  for (const sp of Array.isArray(spans) ? spans : []) {
    const k = known.get(sp.kind);
    if (!k?.md) continue;
    // (Markdown's marks hug the words: spaces at a span's ends stay outside it)
    let from = sp.from, to = sp.to;
    while (from < to && /\s/.test(s[from])) from++;
    while (to > from && /\s/.test(s[to - 1])) to--;
    if (to > from) marks.push({ at: from, open: true, md: k.md[0], len: to - from }, { at: to, open: false, md: k.md[1], len: to - from });
  }
  marks.sort((a, b) => a.at - b.at || (a.open - b.open) || (a.open ? b.len - a.len : a.len - b.len));
  let out = '', i = 0;
  for (const m of marks) { out += s.slice(i, m.at) + m.md; i = m.at; }
  return out + s.slice(i);
}
