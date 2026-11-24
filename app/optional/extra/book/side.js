// The Book on a Twin's side, and the canvas it has on the screen. A Twin (the Twin plugin) is two
// rooms side by side; each side is a room placed in its Twin under the rule `twin` (API.md,
// Places). The Book's docks stay while you work on the other half (docks.js), and the book is
// fitted inside its half when you first work there (docks.js settle).

// The other side of the Twin room `r` is a side of, or null (any other room).
export function otherSide(t, r) {
  if (!r) return null;
  const at = t.places.of(r).find((p) => p.rule === 'twin');
  if (!at) return null;
  return t.places.in(at.context, 'twin').map((p) => p.mark).find((id) => id !== r) || null;
}

// The Twin room `r` is a side of, or null.
export const twinOf = (t, r) => (r && t.places.of(r).find((p) => p.rule === 'twin')?.context) || null;

// The zoom that fits something `need` world units wide into `width` pixels, from zoom `z`: never
// in, never under `floor` (in steps of 0.05); null when it fits already (or nothing is known).
export function fitZoom(width, need, z, floor = 0.5) {
  if (!(width > 0) || !(need > 0) || !(z > 0) || width >= need * z) return null;
  return Math.min(z, Math.max(floor, Math.floor((width / need) * 20) / 20));
}

// The room's canvas on the screen: the stage that shows (a Twin's live half, between the docks),
// or null without a screen. Its width is what the book has to fit in.
export function stageBox() {
  if (typeof document === 'undefined') return null;
  const stage = [...document.querySelectorAll('.room-stage')].find((s) => s.offsetParent);
  const b = stage?.getBoundingClientRect();
  return b && b.width ? b : null;
}
