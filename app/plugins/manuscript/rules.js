// Manuscript's rules: plain functions of the tables' reads, with no screen, so the tests and the
// rule share them. A room read as a manuscript: its chapters (groups of the family
// `manuscript-chapter`, nested by part-of links, never folders) as headings in reading order, their
// parts beneath, the loose thoughts last. One column.

export const FAMILY = 'manuscript-chapter';
export const RULE = 'manuscript';
export const COL = 520;   // the column's width (world units)
const GAP = 14;           // the space after a paragraph
const HEAD = 44;          // a heading's height
const BREAK = 22;         // the space a break's rule line takes above a chapter
const LINE = 24;          // a line, when nothing is measured
const LEFT = -COL / 2;

export const NUMBERS = [{ id: 'none', name: 'None' }, { id: 'arabic', name: '1 / 1.1' }, { id: 'roman', name: 'I / i' }];

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n) {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}

// A chapter's number: path is its place at each depth ([2, 1]: the first part of the second).
export function numberOf(path, how) {
  if (how === 'arabic') return path.join('.');
  if (how === 'roman') return path.length === 1 ? roman(path[0]) : path.length === 2 ? roman(path[1]).toLowerCase() : path.slice(2).join('.');
  return '';
}

export const isChapter = (m) => !!m && m.kind === 'group' && m.of === FAMILY;
const byAt = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// The room laid out: rows for arrange, boxes for draw, and where each chapter's part of the column
// runs ({ chapter, top, bottom, heading }) for land and drop. measure(text, width) → { height }.
// The thought being written (reads.marks.draft) after a mark pushes what follows down by its box.
export function lay(reads, context, settings = {}, measure = null) {
  const rows = [], boxes = [], spans = [];
  const all = reads.marks.in(context);
  const chapters = all.filter(isChapter);
  const top = chapters.filter((g) => !reads.links.holders(g.id).some((h) => isChapter(reads.marks.get(h)))).sort(byAt);
  const draft = reads.marks.draft ? reads.marks.draft(context) : null;
  const seen = new Set(), placed = new Set();
  let y = 0;
  const para = (m) => {
    const h = Math.max(LINE, measure ? measure(reads.marks.text(m.id) || ' ', COL)?.height || LINE : LINE);
    rows.push({ mark: m.id, x: 0, y: y + h / 2, width: COL, align: 'start' });
    y += h + GAP;
    if (draft && draft.after === m.id) y += (draft.height || LINE) + GAP; // room for the words being written under it
  };
  const walk = (g, path) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    const start = y;
    if (g.break) { boxes.push({ x: LEFT, y: y + BREAK / 2 - 1, w: COL, h: 2, style: 'line' }); y += BREAK; }
    const number = numberOf(path, settings.numbers);
    boxes.push({ x: LEFT, y, w: COL, h: HEAD - 8, label: `${number ? `${number}  ` : ''}${g.title || 'Untitled'}`, style: 'heading', level: Math.min(3, path.length) });
    const heading = [y, y + HEAD];
    y += HEAD;
    let n = 0;
    for (const id of reads.links.members(g.id)) {
      const m = reads.marks.get(id);
      if (!m) continue;
      if (isChapter(m)) walk(m, [...path, ++n]);
      else if (m.kind !== 'group' && !placed.has(id)) { placed.add(id); para(m); }
    }
    spans.push({ chapter: g.id, top: start, bottom: y, heading, depth: path.length });
  };
  top.forEach((g, i) => walk(g, [i + 1]));
  const loose = all.filter((m) => m.kind !== 'group' && !placed.has(m.id)).sort(byAt);
  if (top.length && loose.length) y += HEAD / 2;
  for (const m of loose) para(m);
  return { rows, boxes, spans };
}

// The chapter a point of the column is in: the innermost one whose part runs over y, or null.
export function chapterAt(spans, y) {
  const inside = spans.filter((s) => y >= s.top && y < s.bottom);
  return inside.sort((a, b) => b.depth - a.depth)[0] || null;
}

// The chapter a mark is a part of (the first, when it sits in several), or null.
export function chapterOf(reads, mark) {
  return reads.links.holders(mark).find((h) => isChapter(reads.marks.get(h))) || null;
}

// A new thought kept after the mark at x, y (or with a heading's box chosen): into that chapter,
// just after that mark, or at the chapter's end when its heading was chosen; loose when written
// below every chapter.
export function landing(reads, context, mark, x, y, settings, measure) {
  const { rows, spans } = lay(reads, context, settings, measure);
  const s = chapterAt(spans, y);
  if (!s) return null;
  if (y >= s.heading[0] && y < s.heading[1]) return { join: s.chapter };
  const near = rows.filter((r) => r.mark !== mark).reduce((best, r) => (Math.abs(r.y - y) < Math.abs((best?.y ?? Infinity) - y) ? r : best), null);
  const members = reads.links.members(s.chapter).filter((id) => id !== mark);
  const i = near ? members.indexOf(near.mark) : -1;
  return i < 0 ? { join: s.chapter } : { join: s.chapter, at: i + 1 };
}

// A mark let go at x, y: into the chapter there, before the first of its parts below y, leaving the
// chapter it came from (a move, not a copy). Let go below every chapter: nothing is proposed.
export function dropping(reads, context, mark, x, y, settings, measure) {
  const { rows, spans } = lay(reads, context, settings, measure);
  const s = chapterAt(spans, y);
  if (!s) return null;
  const at = new Map([...rows.map((r) => [r.mark, r.y]), ...spans.map((c) => [c.chapter, c.top])]); // a chapter inside it: where its heading starts
  const members = reads.links.members(s.chapter).filter((id) => id !== mark);
  let i = members.findIndex((id) => (at.has(id) ? at.get(id) > y : false));
  if (i < 0) i = members.length;
  const from = chapterOf(reads, mark);
  return { join: s.chapter, at: i, ...(from && from !== s.chapter ? { from } : {}) };
}
