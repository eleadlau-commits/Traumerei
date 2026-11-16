// Sketch: a kind of mark that is a small drawing made with the pen, in any room. Its strokes are
// a field like any other (each a flat list of numbers, x0, y0, x1, y1, …, on a pad 240 wide and
// 160 tall), so a .traum file carries the drawing (Law 8). On the canvas the mark is drawn by the
// surface 'sketch': click into it and draw; each stroke, pointer down to pointer up, is one edit
// and one Ctrl+Z; Backspace or Delete takes the last stroke away. Everywhere else it shows as a
// still picture of the same strokes. A corpus plugin (open core, step 4): written against
// app/core/API.md alone, it proves a kind with a surface. Saves nothing outside its marks.
import { Feature } from 'folio';

export const PAD = Object.freeze({ width: 240, height: 160 });
export const MOST = Object.freeze({ strokes: 2000, numbers: 20000 });
const NEAR = 1; // a point closer than this to the last one is skipped (pad units)
const SVG = 'http://www.w3.org/2000/svg';

const round = (v) => Math.round(v * 10) / 10;
const clamp = (v, most) => Math.min(most, Math.max(0, v));

// One stroke kept as it should be saved: finite numbers on the pad, rounded to a tenth, an even
// count of at least two (one point is a dot); null when nothing of it is left.
export function tidyStroke(s) {
  if (!Array.isArray(s) || s.length < 2 || s.length > MOST.numbers || s.length % 2) return null;
  if (!s.every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  return s.map((v, i) => round(clamp(v, i % 2 ? PAD.height : PAD.width)));
}

// The strokes worth keeping, in order, at most MOST.strokes of them.
export function tidyStrokes(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    const t = tidyStroke(s);
    if (t) out.push(t);
    if (out.length >= MOST.strokes) break;
  }
  return out;
}

// A stroke as an SVG path: a line through its points, or a dot for a single point.
export function svgPath(s) {
  if (!Array.isArray(s) || s.length < 2) return '';
  let d = `M${s[0]} ${s[1]}`;
  if (s.length === 2) return `${d}l0 0`;
  for (let i = 2; i + 1 < s.length; i += 2) d += `L${s[i]} ${s[i + 1]}`;
  return d;
}

// Folio's ui.el makes HTML elements; a drawing needs SVG ones.
function svg(tag, attrs = {}, ...kids) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, String(v));
  for (const kid of kids) if (kid) node.append(kid);
  return node;
}

// The picture of a list of strokes: the pad, one path per stroke, in the text's colour.
// stretch: fill the element it is drawn in, whatever its shape (the surface), so the pad's
// units meet the pointer's.
export function picture(strokes, { stretch = false } = {}) {
  // (Inline, since the app's own rule for icons sizes every svg and its strokes.)
  const size = stretch ? '100%' : `${PAD.width}px`, tall = stretch ? '100%' : `${PAD.height}px`;
  return svg('svg', {
    class: 'sketch-pad', viewBox: `0 0 ${PAD.width} ${PAD.height}`,
    width: stretch ? '100%' : PAD.width, height: stretch ? '100%' : PAD.height,
    preserveAspectRatio: stretch ? 'none' : null,
    style: `width:${size};height:${tall};fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round`,
    'aria-label': `A sketch of ${strokes.length} ${strokes.length === 1 ? 'stroke' : 'strokes'}`, role: 'img',
  }, ...strokes.map((s) => svg('path', { d: svgPath(s), 'vector-effect': stretch ? 'non-scaling-stroke' : null })));
}

const count = (n) => `${n} ${n === 1 ? 'stroke' : 'strokes'}`;

export function kind() {
  return {
    kind: 'sketch', name: 'Sketch', surface: 'sketch',
    // Both fields are always given back, so clearing the caption or the last stroke takes it away.
    // A new one from Add (no strokes yet, maybe no caption) is a blank pad to draw in.
    tidy: (f, h) => {
      const strokes = tidyStrokes(f.strokes), text = h.oneLine(f.text);
      return strokes.length || text || !('strokes' in f) ? { strokes, text } : null;
    },
    text: (th) => th.text || `Sketch (${count(Array.isArray(th.strokes) ? th.strokes.length : 0)})`,
    node: (th, el) => {
      const strokes = tidyStrokes(th.strokes);
      const pic = typeof document === 'undefined' ? null : picture(strokes);
      return el('figure', { class: 'sketch-kind' }, pic, th.text ? el('figcaption', {}, th.text) : null);
    },
    fields: [{ key: 'text', type: 'line', label: 'Caption' }],
    add: { note: 'A drawing made with the pen' },
    step: 190,
  };
}

// The surface: the pad drawn from the mark's strokes, and the pen. The stroke under way lives
// here only, by mark, drawn live into the pad (ctx.el), and goes when it is kept or dropped; the
// strokes field is the drawing.
export function surface(t) {
  const drawing = new Map(); // mark → { points, path }: the stroke under way
  // A point from the pointer, on the pad: the layout may draw the surface at another size.
  const onPad = (e, ctx) => [
    round(clamp(e.x * PAD.width / (ctx.width || PAD.width), PAD.width)),
    round(clamp(e.y * PAD.height / (ctx.height || PAD.height), PAD.height)),
  ];
  const strokesOf = (mark) => tidyStrokes(t.marks.get(mark)?.strokes);
  return {
    id: 'sketch', width: PAD.width, height: PAD.height,
    draw(el, ctx) {
      const pad = picture(ctx.mark ? strokesOf(ctx.mark) : [], { stretch: true });
      el.replaceChildren(pad);
      drawing.delete(ctx.mark);
    },
    pointer(e, ctx) {
      const mark = ctx.mark;
      if (!mark || !t.marks.get(mark)) return;
      if (e.type === 'down') {
        const points = onPad(e, ctx);
        const pad = ctx.el?.querySelector('svg');
        const path = pad ? svg('path', { d: svgPath(points), 'vector-effect': 'non-scaling-stroke' }) : null;
        if (pad) pad.append(path);
        drawing.set(mark, { points, path });
        return;
      }
      const s = drawing.get(mark);
      if (!s) return;
      if (e.type === 'cancel') { s.path?.remove(); drawing.delete(mark); return; }
      const [x, y] = onPad(e, ctx);
      const n = s.points.length;
      if (Math.hypot(x - s.points[n - 2], y - s.points[n - 1]) >= NEAR && n + 2 <= MOST.numbers) {
        s.points.push(x, y);
        s.path?.setAttribute('d', svgPath(s.points));
      }
      if (e.type !== 'up') return;
      drawing.delete(mark);
      const old = strokesOf(mark);
      if (old.length >= MOST.strokes) { s.path?.remove(); t.ui.toast(`A sketch holds ${MOST.strokes} strokes at most`); return; }
      const r = t.marks.edit(mark, { strokes: [...old, s.points] });
      if (!r.ok) { s.path?.remove(); t.ui.toast(r.reason); }
    },
    key(e, ctx) {
      if (!ctx.mark || (e.key !== 'Backspace' && e.key !== 'Delete') || e.ctrl || e.alt) return false;
      const m = t.marks.get(ctx.mark);
      if (!m) return false;
      const old = strokesOf(ctx.mark);
      if (!old.length) return true;
      // The last stroke of a sketch with no caption stays: taking it would take the mark away.
      if (old.length === 1 && !m.text) { t.ui.toast('A sketch keeps its last stroke; delete the mark to take it away'); return true; }
      const r = t.marks.edit(ctx.mark, { strokes: old.slice(0, -1) });
      if (!r.ok) t.ui.toast(r.reason);
      return true;
    },
    leave(el, ctx) { drawing.delete(ctx.mark); },
  };
}

export function install(t) {
  t.slots.kinds.add(kind());
  t.slots.surfaces.add(surface(t));
}

export default class Sketch extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
