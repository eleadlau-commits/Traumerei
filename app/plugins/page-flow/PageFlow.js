// Page flow: a rule (a mode) that lays a room out as fixed pages side by side, in reading order: each
// group's parts in its order (its title as a heading), then the loose thoughts, oldest first. A
// paragraph that does not fit at the foot of a page runs on to the next one in fragments; the
// bottoms stay ragged. A corpus plugin (open core, step 1): written against app/core/API.md alone,
// it proves a layout row's width and fragments, and t.ui.measure; since step 5, kinds that flow
// (t.ui.size: a table, a figure) sit between paragraphs as blocks. Saves nothing.
import { Feature } from 'folio';

export const PAGE = { w: 480, h: 640, margin: 50, gap: 60 };
const COL = PAGE.w - 2 * PAGE.margin;
const PARA = 0.5; // the space after a paragraph, in lines
const HEAD = 2;   // a heading's height, in lines

// The reading order: [{ heading?: group, mark? }].
function order(reads, context) {
  const all = reads.marks.in(context);
  const seen = new Set(), out = [];
  const groups = all.filter((m) => m.kind === 'group' && !reads.links.holders(m.id).length).sort((a, b) => a.at - b.at);
  const walk = (g) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    out.push({ heading: g });
    for (const id of reads.links.members(g.id)) {
      const m = reads.marks.get(id);
      if (!m || seen.has(id)) continue;
      if (m.kind === 'group') walk(m);
      else { seen.add(id); out.push({ mark: m }); }
    }
  };
  groups.forEach(walk);
  for (const m of all.filter((m) => m.kind !== 'group' && !seen.has(m.id)).sort((a, b) => a.at - b.at)) out.push({ mark: m });
  return out;
}

// Lays the room out: the rows (with fragments) and the pages and headings drawn behind them.
// size(id, width): how tall a mark that is not words draws (t.ui.size), or null to measure its words.
export function paginate(reads, context, measure, size = () => null) {
  const rows = [], boxes = [];
  let page = 0, y = PAGE.margin;
  const left = (n) => n * (PAGE.w + PAGE.gap);
  const bottom = PAGE.h - PAGE.margin;
  const next = () => { page++; y = PAGE.margin; };
  for (const item of order(reads, context)) {
    if (item.heading) {
      const lh = measure('M', COL).lineHeight;
      if (y + HEAD * lh > bottom) next();
      if (item.heading.title) boxes.push({ x: left(page) + PAGE.margin, y, w: COL, h: HEAD * lh * 0.8, label: item.heading.title, style: 'heading' });
      y += item.heading.title ? HEAD * lh : 0;
      continue;
    }
    const m = item.mark;
    // A kind that flows among paragraphs (a table, a figure): one block of its own height, on the
    // next page when it doesn't fit (a block never splits).
    if (m.kind !== 'line' && m.kind !== 'passage') {
      const s = size(m.id, COL);
      if (s && s.height > 0) {
        const lh = measure('M', COL).lineHeight;
        if (y + s.height > bottom && y > PAGE.margin) next();
        rows.push({ mark: m.id, x: left(page) + PAGE.margin + COL / 2, y: y + s.height / 2, width: COL, height: s.height });
        y += s.height + PARA * lh;
        continue;
      }
    }
    const { lines, lineHeight: lh } = measure(reads.marks.text(m.id) || ' ', COL);
    let from = 0;
    while (from < lines) {
      let fits = Math.floor((bottom - y) / lh);
      const rest = lines - from;
      if (fits < Math.min(2, rest)) { if (y > PAGE.margin) { next(); continue; } fits = Math.max(1, fits); }
      const take = Math.min(rest, fits);
      const h = take * lh;
      const row = { mark: m.id, x: left(page) + PAGE.margin + COL / 2, y: y + h / 2, width: COL, align: 'start' };
      if (take < lines) row.lines = [from, from + take];
      rows.push(row);
      from += take;
      y += h;
      if (from < lines) next();
    }
    y += PARA * lh;
  }
  for (let n = 0; n <= page; n++) boxes.unshift({ x: left(n), y: 0, w: PAGE.w, h: PAGE.h, right: String(n + 1), style: 'page' });
  return { rows, boxes };
}

export function install(t) {
  const measure = (text, width) => t.ui.measure(text, width);
  const size = (id, width) => t.ui.size?.(id, width) || null;
  t.slots.rules.add({
    id: 'page-flow', name: 'Page flow', note: 'fixed pages, a paragraph runs on to the next',
    icon: '<path d="M5 3h9l5 5v13H5zM14 3v5h5"/>',
    arrange: (reads, context) => paginate(reads, context, measure, size).rows,
    draw: (reads, context) => paginate(reads, context, measure, size).boxes,
    hand: false,
  });
}

export default class PageFlow extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
