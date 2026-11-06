// Lines on a canvas, shared by every ontology that joins things with a line: Joyce's strands from
// thought to thought, Russell's arrows from chapter to chapter, and any mode after them. One part
// makes a line's shape (straight, a soft curve square to its sides, or a strand that sags with
// time) and draws it with its ends (none, an arrowhead, or one at both ends), a wide unseen line
// to catch the pointer, and knots. Where the lines go (which boxes, which sides) is arrows.js.
//
//   shape:  slack(a, b, dist, tension, rest)  how loose a strand is, from the pause between a and b
//           strand(p, q, k)                   a strand from p to q with that slack, as an SVG path
//           path(arrow, 'straight'|'curved')  a line between two boxes (arrows.js), as an SVG path
//   screen: layer(cls)                        an SVG layer for the canvas, with its arrowheads
//           group(attrs)                      an SVG group in it (a train, say)
//           line(d, { ends, cls, hit })       a line's nodes: what shows, and what catches the pointer
//           knot(p, cls)                      a small dot where a line meets a thing
//
// The look is the room's (style.css: .room-line, .room-line-hit, .room-line-head, .room-knot);
// each mode adds its own class for how strong its lines are.

export { path, middle, between, labelSpot, sidePoint, facing, PAD } from './arrows.js';

const SVG = 'http://www.w3.org/2000/svg';
const r1 = (v) => Math.round(v * 10) / 10;

// ---- A line's ends ----

// What a line has at its ends: nothing (a plain line), an arrowhead where it ends, or one at both.
export const ENDS = ['none', 'arrow', 'both'];
export const ENDS_WORDS = { none: 'Plain line', arrow: 'Arrow', both: 'Arrow both ways' };
export const cleanEnds = (v, fallback = 'arrow') => (ENDS.includes(v) ? v : fallback);

// ---- Shapes ----

// How slack a strand between two thoughts is (0 taut … 1 loose): thoughts written close together
// are joined taut; a longer pause leaves slack. Pulled far apart (past `rest`, the usual step
// between two, by 520 more), it goes straight again. tension 0 … 1 (a room's Line tension).
export const PAUSE = { quick: 20, long: 3600 }; // seconds
export function slack(a, b, dist = 0, tension = 0.5, rest = 58) {
  const gap = Math.max(0, ((b.at ?? 0) - (a.at ?? 0)) / 1000);
  const fromTime = Math.min(1, Math.log1p(gap / PAUSE.quick) / Math.log1p(PAUSE.long / PAUSE.quick));
  const pulled = Math.max(0, Math.min(1, 1 - (dist - rest) / 520));
  return Math.max(0, Math.min(1, fromTime * pulled * (1 - tension) * 2));
}

// The strand from p to q with slack k, as an SVG path: straight when taut, a soft bow when loose.
export function strand(p, q, k) {
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  const bow = k * Math.max(26, d * 0.42);
  const cx = mx + (-dy / d) * bow, cy = my + (dx / d) * bow;
  return k < 0.02 ? `M${r1(p.x)} ${r1(p.y)}L${r1(q.x)} ${r1(q.y)}` : `M${r1(p.x)} ${r1(p.y)}Q${r1(cx)} ${r1(cy)} ${r1(q.x)} ${r1(q.y)}`;
}

// ---- On the screen ----

export const HEAD = 'room-line-head'; // the arrowhead's marker id (the same in every layer)

export function svg(name, attrs = {}) {
  const n = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  return n;
}

// The SVG layer lines are drawn in, the size of nothing and showing all (class room-strands), with
// the arrowhead its lines' ends use. cls: the mode's own class for it.
export function layer(cls = '') {
  const out = svg('svg', { class: `room-strands room-lines${cls ? ` ${cls}` : ''}` });
  const defs = svg('defs');
  const mark = svg('marker', { id: HEAD, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  mark.append(svg('path', { d: 'M0 1L9 5L0 9', class: 'room-line-head' }));
  defs.append(mark);
  out.append(defs);
  return out;
}

export const group = (attrs = {}) => svg('g', attrs);

// A line along path d: [what shows, what catches the pointer]. ends: 'none', 'arrow' (a head
// where it ends) or 'both'. cls: the mode's class for the line. hit: false for none, or
// { cls, ...attributes } for a wide unseen line over it (to press, hover or double-click).
export function line(d, { ends = 'none', cls = '', hit = false } = {}) {
  const e = cleanEnds(ends, 'none');
  const shown = svg('path', {
    d, class: `room-line${cls ? ` ${cls}` : ''}`,
    'marker-end': e !== 'none' ? `url(#${HEAD})` : null,
    'marker-start': e === 'both' ? `url(#${HEAD})` : null,
  });
  if (!hit) return [shown];
  const { cls: hitCls = '', ...attrs } = hit;
  return [shown, svg('path', { d, class: `room-line-hit${hitCls ? ` ${hitCls}` : ''}`, ...attrs })];
}

// A small dot at p, where a line meets a thing.
export const knot = (p, cls = '', r = 2.6) => svg('circle', { cx: p.x, cy: p.y, r, class: `room-knot${cls ? ` ${cls}` : ''}` });
