// The thought being written, as the tables' reads see it (since 1.1.1): never a mark, never in the
// tables, never saved. The room that writes says where its draft is read from (setSource); a thin
// rule's arrange reads it through reads.marks.draft(context) to leave room for it (a manuscript's
// column growing as the words wrap). No screen here.

let source = null; // (context) → { text, at?, after?, height? } or null
let asked = 0;     // how often the draft was read: a layout knows whether its rule read it
export const reads = () => asked;

// The room says how its draft is read: fn(context), or null when no room writes.
export function setSource(fn) { source = typeof fn === 'function' ? fn : null; }

// The draft in a context, frozen: { text, at?: { x, y }, after?: mark, height? }, or null.
export function of(context) {
  asked++;
  if (!source || context == null) return null;
  let d = null;
  try { d = source(context); } catch { d = null; }
  if (!d || typeof d.text !== 'string') return null;
  const out = { text: d.text };
  if (d.at && Number.isFinite(d.at.x) && Number.isFinite(d.at.y)) out.at = Object.freeze({ x: d.at.x, y: d.at.y });
  if (typeof d.after === 'string') out.after = d.after;
  if (Number.isFinite(d.height) && d.height > 0) out.height = Math.round(d.height);
  return Object.freeze(out);
}

// What a layout that read the draft remembers it by: whether there is one, and its box's height
// (the words change at every key; the layout follows only when the box grows or shrinks).
export function key(context) {
  const d = of(context);
  asked--; // (not a rule's read)
  return d ? `d${d.height || 0}` : '';
}
