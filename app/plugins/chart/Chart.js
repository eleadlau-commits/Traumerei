// Chart: a rule (a mode) that lays a room's thoughts out in rows, six to a row in reading order,
// and draws above them a bar chart of the room's words: one bar for each group (its parts' words)
// and one for the loose thoughts (in no group). A room with no groups gets a bar for each of its
// wordiest thoughts. The chart is a surface in the rule's box: the room hands it an element and it
// draws an SVG there, read from the tables. A corpus plugin (open core, step 4): written against
// app/core/API.md alone, it proves a rule's box that asks for a surface. Saves nothing, and the
// surface writes nothing: a click on a bar only marks it until the chart is drawn again.
import { Feature } from 'folio';

export const CELL = { w: 240, h: 140, across: 6 };
export const BOX = { x: -100, y: -280, w: 560, h: 220 };
const MOST = 12; // bars at most, in a room with no groups
const PAD = 16, TOP = 24, FOOT = 28; // the chart's margins, in its own units
const SVG = 'http://www.w3.org/2000/svg';

export const words = (text) => (String(text || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;

// The reading order: each group no other group holds, then its parts (a group in it after its
// own parts), then the marks in no group, oldest first. Only marks of the room itself.
function order(reads, context) {
  const all = [...reads.marks.in(context)].sort((a, b) => a.at - b.at);
  const here = new Map(all.map((m) => [m.id, m]));
  const seen = new Set(), out = [];
  const walk = (g) => {
    if (seen.has(g.id)) return;
    seen.add(g.id);
    out.push(g);
    for (const id of reads.links.members(g.id)) {
      const m = here.get(id);
      if (!m || seen.has(id)) continue;
      if (m.kind === 'group') walk(m);
      else { seen.add(id); out.push(m); }
    }
  };
  for (const m of all) if (m.kind === 'group' && !reads.links.holders(m.id).length) walk(m);
  for (const m of all) if (!seen.has(m.id)) out.push(m);
  return out;
}

// Where each mark sits: a plain grid under the chart, cell by cell in reading order.
export function arrange(reads, context) {
  return order(reads, context).map((m, i) => ({ mark: m.id, x: (i % CELL.across) * CELL.w, y: Math.floor(i / CELL.across) * CELL.h }));
}

// The bars: [{ id, label, words }]. One for each group in the room (the words of its parts,
// counted through a group inside it too), then one for the loose thoughts when there are any; in
// a room with no groups, one for each thought, the wordiest first. `reads` may be a rule's reads
// or the plugin's own t, which has the same read names.
export function barsOf(reads, context) {
  const all = reads.marks.in(context);
  const count = (id) => words(reads.marks.text(id));
  const groups = all.filter((m) => m.kind === 'group');
  if (!groups.length) {
    return all.map((m) => ({ id: m.id, label: reads.marks.text(m.id), words: count(m.id) }))
      .filter((b) => b.words > 0).sort((a, b) => b.words - a.words).slice(0, MOST);
  }
  const inGroup = (g, seen) => {
    let n = 0;
    for (const id of reads.links.members(g)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const m = reads.marks.get(id);
      if (m) n += m.kind === 'group' ? inGroup(id, seen) : count(id);
    }
    return n;
  };
  const bars = groups.map((g, i) => ({ id: g.id, label: g.title || `Group ${i + 1}`, words: inGroup(g.id, new Set([g.id])) }));
  const loose = all.filter((m) => m.kind !== 'group' && !reads.links.holders(m.id).length);
  if (loose.length) bars.push({ id: null, label: 'Loose', words: loose.reduce((n, m) => n + count(m.id), 0) });
  return bars;
}

const node = (name, attrs = {}, text) => {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text != null) n.textContent = text;
  return n;
};
const clip = (s, room) => { const w = String(s).replace(/\s+/g, ' ').trim(); const most = Math.max(3, Math.floor(room / 6.5)); return w.length > most ? `${w.slice(0, most - 1)}…` : w; };

// The chart as an SVG the size of the surface: a bar each, its words above it and its label
// below. Only currentColor and opacity, so it takes the room's colours in either theme.
export function svgOf(bars, width, height) {
  const svg = node('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'aria-label': 'Words in this room', fill: 'currentColor' });
  if (!bars.length) {
    svg.append(node('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', 'font-size': 13, opacity: 0.6 }, 'No words yet'));
    return svg;
  }
  const most = Math.max(1, ...bars.map((b) => b.words));
  const slot = (width - 2 * PAD) / bars.length, bw = Math.max(4, slot * 0.6), tall = height - TOP - FOOT;
  bars.forEach((b, i) => {
    const h = Math.max(1, (tall * b.words) / most), x = PAD + i * slot + (slot - bw) / 2, y = height - FOOT - h;
    const rect = node('rect', { x, y, width: bw, height: h, rx: 2, opacity: 0.45, 'data-bar': i });
    rect.append(node('title', {}, `${b.label}: ${b.words} ${b.words === 1 ? 'word' : 'words'}`));
    svg.append(rect,
      node('text', { x: x + bw / 2, y: y - 6, 'text-anchor': 'middle', 'font-size': 12 }, String(b.words)),
      node('text', { x: x + bw / 2, y: height - FOOT + 16, 'text-anchor': 'middle', 'font-size': 11, opacity: 0.7 }, clip(b.label, slot)));
  });
  svg.append(node('line', { x1: PAD, x2: width - PAD, y1: height - FOOT, y2: height - FOOT, stroke: 'currentColor', opacity: 0.3 }));
  return svg;
}

export function install(t) {
  t.slots.rules.add({
    id: 'chart', name: 'Chart', note: 'rows of thoughts under a chart of their words',
    icon: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    arrange,
    // The bars are worked out here, from the world being drawn (a moment of the time scrub too),
    // and handed to the surface with the box.
    draw: (reads, context) => [{ ...BOX, label: 'Words', style: 'quiet', surface: 'chart', data: { bars: barsOf(reads, context) } }],
    hand: false,
  });
  t.slots.surfaces.add({
    id: 'chart', width: BOX.w, height: BOX.h,
    draw(el, ctx) {
      if (!el) return;
      const bars = ctx.box?.data?.bars ?? barsOf(t, ctx.context);
      el.replaceChildren(svgOf(Array.isArray(bars) ? bars : [], ctx.width, ctx.height));
    },
    // A click let go over a bar marks it; it chooses nothing in the room, and the mark goes when
    // the chart is drawn again.
    pointer(e, ctx) {
      if (e.type !== 'up') return;
      const rects = [...(ctx.el?.querySelectorAll('rect[data-bar]') || [])];
      if (!rects.length) return;
      const i = Math.floor((e.x - PAD) / ((ctx.width - 2 * PAD) / rects.length));
      rects.forEach((r, n) => r.setAttribute('opacity', n === i ? 0.85 : 0.45));
    },
  });
}

export default class Chart extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
