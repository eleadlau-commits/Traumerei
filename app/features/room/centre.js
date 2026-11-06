// Part of the room feature. Bringing the view to things, in every mode: Home fits the view to
// everything in the room, and Ctrl+Shift+C glides it to what is chosen. Only the view moves (its
// x, y and zoom); nothing in the room changes. Plain functions of the room (c), like verbs.js.
// What is shown is measured as drawn, so every mode works without telling it anything.

import { view } from './world.js';
import { ZOOM } from './shared.js';

const GLIDE_MS = 320;

// The view (x, y at the middle of the screen, zoom) that shows `box` (world units) inside a stage
// `width` × `height` pixels, with `pad` pixels clear all round. The zoom never goes above `most`
// (so a small thing isn't blown up), nor outside the room's zoom range; with `keep`, it stays at
// that zoom unless the box would not fit.
export function fitView(box, width, height, { pad = 48, most = 1, keep = null } = {}) {
  const w = Math.max(box.w, 1), h = Math.max(box.h, 1);
  const fits = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  let zoom = keep != null ? Math.min(keep, fits) : Math.min(most, fits);
  zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom || ZOOM.min));
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, zoom };
}

// The box (world units) round every drawn node that matches `selector`, or null if none shows.
export function drawnBox(c, selector) {
  const origin = c.world$.getBoundingClientRect(), zoom = view(c.world, c.roomId).zoom || 1;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of c.world$.querySelectorAll(selector)) {
    const r = n.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
  }
  if (x0 === Infinity) return null;
  return { x: (x0 - origin.left) / zoom, y: (y0 - origin.top) / zoom, w: (x1 - x0) / zoom, h: (y1 - y0) / zoom };
}

// Home: the view fits everything in the room (thoughts, groups, lines, labels).
export function fitAll(c) {
  const box = drawnBox(c, '[data-thought], [data-group], [data-measure]');
  if (!box) { c.toast('Nothing on the canvas yet.'); return; }
  const { width, height } = c.stage.getBoundingClientRect();
  glide(c, fitView(box, width, height));
}

// Ctrl+Shift+C: the mode's own centre (Proust: a layout round what is chosen), or else the view
// glides to what is chosen, at the same zoom, zooming out only if it
// would not fit.
export function centreChosen(c) {
  // A mode may lay things out round what is chosen instead (ontologies/index.js: centre).
  if (c.ont?.centre?.(c)) return;
  const box = c.sel && drawnBox(c, '.selected');
  if (!box) { c.toast('Choose something first: Ctrl+Shift+C brings the view to it.'); return; }
  const v = view(c.world, c.roomId);
  const { width, height } = c.stage.getBoundingClientRect();
  glide(c, fitView(box, width, height, { keep: v.zoom }));
}

// Moves the view to `to` ({ x, y, zoom }) smoothly (at once if the system asks for less motion),
// and saves it when it gets there. A new glide, or the room left, stops the one before.
export function glide(c, to) {
  const v = view(c.world, c.roomId);
  const roomId = c.roomId;
  cancelAnimationFrame(c.glideFrame);
  const from = { x: v.x, y: v.y, zoom: v.zoom };
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const end = () => { Object.assign(v, to); c.place(); c.save(); };
  if (still) { end(); return; }
  const t0 = performance.now();
  const step = (now) => {
    if (c.roomId !== roomId) return;
    const t = Math.min(1, (now - t0) / GLIDE_MS);
    if (t >= 1) { end(); return; }
    const k = 1 - (1 - t) ** 3; // eases out
    // The zoom moves on a log scale, so zooming in and out feel the same.
    v.zoom = from.zoom * (to.zoom / from.zoom) ** k;
    v.x = from.x + (to.x - from.x) * k;
    v.y = from.y + (to.y - from.y) * k;
    c.place();
    c.glideFrame = requestAnimationFrame(step);
  };
  c.glideFrame = requestAnimationFrame(step);
}
