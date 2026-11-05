// Arrows between two boxes ({ x, y, w, h }, world units), as Russell draws them. An arrow leaves
// the midpoint of the side of one box that faces the other and ends at the midpoint of the facing
// side: bottom to top when the other box is below, right to left when it is beside. Lines are
// straight or a soft curve that leaves and enters square to its sides. Plain maths, no screen.

export const PAD = 12; // how far off a side an arrow starts or ends

const NORMAL = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
const r1 = (v) => Math.round(v * 10) / 10;
const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

// The sides of a and b that face each other: { from, to }. The way they are furthest apart wins
// (up and down on a tie); boxes that overlap face the way their centres lie.
export function facing(a, b) {
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const ca = centre(a), cb = centre(b);
  const upDown = gapX <= 0 && gapY <= 0 ? Math.abs(cb.y - ca.y) >= Math.abs(cb.x - ca.x) : gapY >= gapX;
  if (upDown) return cb.y >= ca.y ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  return cb.x >= ca.x ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
}

// The midpoint of one side of a box, `pad` out from it.
export function sidePoint(b, side, pad = 0) {
  if (side === 'top') return { x: b.x + b.w / 2, y: b.y - pad };
  if (side === 'bottom') return { x: b.x + b.w / 2, y: b.y + b.h + pad };
  if (side === 'left') return { x: b.x - pad, y: b.y + b.h / 2 };
  return { x: b.x + b.w + pad, y: b.y + b.h / 2 };
}

// An arrow from box a to box b: { p, q, from, to }. pads: how far off each side it starts and
// ends, as { from: (side) => number, to: (side) => number } or numbers.
export function between(a, b, pads = {}) {
  const { from, to } = facing(a, b);
  const pad = (f, side) => (typeof f === 'function' ? f(side) : f ?? PAD);
  return { p: sidePoint(a, from, pad(pads.from, from)), q: sidePoint(b, to, pad(pads.to, to)), from, to };
}

// The two control points of a curve from p (leaving side `from`) to q (entering side `to`).
function controls(p, q, from, to) {
  const d = Math.max(24, Math.hypot(q.x - p.x, q.y - p.y) * 0.4);
  const [ax, ay] = NORMAL[from], [bx, by] = NORMAL[to];
  return [{ x: p.x + ax * d, y: p.y + ay * d }, { x: q.x + bx * d, y: q.y + by * d }];
}

// The SVG path of an arrow: line is 'straight' or 'curved'.
export function path({ p, q, from, to }, line = 'straight') {
  if (line !== 'curved') return `M${r1(p.x)} ${r1(p.y)}L${r1(q.x)} ${r1(q.y)}`;
  const [c1, c2] = controls(p, q, from, to);
  return `M${r1(p.x)} ${r1(p.y)}C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(q.x)} ${r1(q.y)}`;
}

// The point a fraction t of the way along an arrow (halfway by default).
export function middle({ p, q, from, to }, line = 'straight', t = 0.5) {
  if (line !== 'curved') return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  const [c1, c2] = controls(p, q, from, to);
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p.x + b * c1.x + c * c2.x + d * q.x, y: a * p.y + b * c1.y + c * c2.y + d * q.y };
}

// Where an arrow's label goes: { x, y, side }, by the point a fraction t along it (its middle by
// default). Beside an arrow that runs up or down: on the side it leans to (right when it runs
// nearly straight), or on `prefer` ('left' or 'right') when given. A slanting arrow's label sits
// in the corner beside that point that the line stays out of (side 'right-up', 'left-down', ...);
// a nearly upright one's is centred up and down ('right', 'left'). Above an arrow that runs
// across, centred over it ('above'). The label's own box hangs from (x, y): a 'right' side starts
// there, a 'left' one ends there; '-up' sits on top of it and '-down' under it.
export function labelSpot(arrow, line = 'straight', { gap = 12, prefer = null, t = 0.5 } = {}) {
  const m = middle(arrow, line, t);
  const { from, p, q } = arrow;
  if (from !== 'top' && from !== 'bottom') return { x: m.x, y: m.y - gap / 2, side: 'above' };
  const dx = q.x - p.x, dy = q.y - p.y;
  const side = prefer || (dx < -24 ? 'left' : 'right');
  if (Math.abs(dx) < Math.abs(dy) * 0.3) return { x: m.x + (side === 'left' ? -gap : gap), y: m.y, side };
  // Going down, a line leaning right fills the upper left and lower right of the point.
  const leansRight = (dx > 0) === (dy > 0);
  const up = (side === 'right') === leansRight;
  return { x: m.x + (side === 'left' ? -gap / 2 : gap / 2), y: m.y + (up ? -gap / 3 : gap / 3), side: `${side}-${up ? 'up' : 'down'}` };
}
