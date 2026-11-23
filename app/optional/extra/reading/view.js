// Copied from Book 0.4.6 (app/optional/extra/book/zoom.js): the arithmetic of a smooth jump.
// Kept as Book has it, so a later Book fix can be carried over on purpose. Plain functions, no
// screen; tested in tests/compat.test.js.

const MIN = 0.25, MAX = 4; // the zoom's limits (t.ui.zoom)

// The calls of t.ui.zoom.set that take the view from `a` to `b` ({ x, y, zoom }: the world point
// at the middle of the screen, and the zoom) at once. A set(z, at) keeps `at` still on the screen,
// so the new middle is at + (V − at)·z0/z; solved for `at`. When the zoom does not change, a first
// step a hair's zoom about the middle (within its band, so nothing redraws for it) and the second
// back: in one frame, nothing between them is ever drawn. → [{ zoom, at }]
const EDGES = [0.5, 1.75]; // where the zoom's bands meet (t.ui.zoom.bands)
const bandAt = (z) => EDGES.filter((e) => z >= e).length;
export function setsFor(a, b) {
  const z = Math.min(MAX, Math.max(MIN, b.zoom));
  let z0 = a.zoom;
  const steps = [];
  if (Math.abs(z - z0) <= z * 1e-4) {
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) return z === z0 ? [] : [{ zoom: z, at: { x: a.x, y: a.y } }];
    let z1 = z * 1.002;
    if (z1 > MAX || bandAt(z1) !== bandAt(z)) z1 = z / 1.002;
    steps.push({ zoom: z1, at: { x: a.x, y: a.y } });
    z0 = z1;
  }
  const at = (p, c) => (c * z - p * z0) / (z - z0);
  steps.push({ zoom: z, at: { x: at(a.x, b.x), y: at(a.y, b.y) } });
  return steps;
}

// The view k of the way (0 to 1, eased) from `a` to `b`: the zoom on a log scale, so zooming in
// and out feel the same, and the middle on the straight line between them.
export function between(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, zoom: a.zoom * (b.zoom / a.zoom) ** k };
}
// Eased in and out: a move that starts and stops softly.
export const ease = (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
// How long a move takes (ms): longer the further it goes on the screen and the more it zooms,
// within 260 to 520.
export function moveMs(a, b) {
  const px = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.zoom, b.zoom);
  const zoom = Math.abs(Math.log2(b.zoom / a.zoom));
  return Math.round(Math.min(520, 260 + px * 0.12 + zoom * 160));
}

// Where the view is, { x, y, zoom }, read off the canvas: the room's world layer is drawn
// translate(…) scale(zoom) from the stage's top-left corner. `transform` the layer's style,
// `width`, `height` the stage's size in px. null when it doesn't read.
export function viewFromTransform(transform, width, height, zoom) {
  const m = /translate\(\s*(-?[\d.e+-]+)px,\s*(-?[\d.e+-]+)px\)\s*scale\(\s*([\d.e+-]+)\)/.exec(transform || '');
  if (!m || !zoom || Math.abs(+m[3] - zoom) > 1e-6) return null;
  return { x: (width / 2 - +m[1]) / zoom, y: (height / 2 - +m[2]) / zoom, zoom };
}
