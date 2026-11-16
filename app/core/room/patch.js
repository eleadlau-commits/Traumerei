// Part of the room feature. Puts a freshly drawn canvas in place by changing only what changed:
// a node drawn exactly as before (same tag, attributes and words) stays where it is, so the
// browser lays out only the new and changed ones. Starting a thought in a room of 1,500 then
// costs one thought, not the whole room. A layer of lines (Joyce's one SVG) is patched one level
// down, line by line, the same way.
//
// parent: the element whose children are the canvas; fresh: the nodes just drawn. The old nodes
// that match are kept (with their listeners: a node is only kept when it is drawn the same, so
// the same thing hears the same events); the rest go, and the new ones go in where they belong.

const LAYERS = new Set(['svg', 'g']);

// Whether two elements are the same box with (maybe) different insides: same tag and attributes.
function sameShell(a, b) {
  if (a.nodeType !== 1 || b.nodeType !== 1 || a.tagName !== b.tagName || !LAYERS.has(a.localName)) return false;
  if (a.attributes.length !== b.attributes.length) return false;
  for (const at of a.attributes) if (b.getAttribute(at.name) !== at.value) return false;
  return true;
}

const keyOf = (n) => (n.nodeType === 1 ? n.outerHTML : `#${n.nodeType}:${n.nodeValue}`);

// Returns how many nodes were put in new (for tests and for the speed check's curiosity).
export function patchChildren(parent, fresh, depth = 0) {
  const old = [...parent.childNodes];
  const pool = new Map();
  for (const n of old) { const k = keyOf(n); const list = pool.get(k); if (list) list.push(n); else pool.set(k, [n]); }
  let placed = 0;
  const kept = new Set();
  const want = fresh.map((n, i) => {
    const list = pool.get(keyOf(n));
    if (list?.length) { const o = list.shift(); kept.add(o); return o; }
    // A layer drawn with a few lines changed: keep the layer, patch its lines.
    const o = depth < 2 ? old[i] : null;
    if (o && !kept.has(o) && sameShell(o, n)) {
      const same = pool.get(keyOf(o)); // (it can no longer stand in for a later node)
      if (same) same.splice(same.indexOf(o), 1);
      kept.add(o);
      placed += patchChildren(o, [...n.childNodes], depth + 1);
      return o;
    }
    placed++;
    return n;
  });
  for (const n of old) if (!kept.has(n)) n.remove();
  let at = parent.firstChild;
  for (const n of want) {
    if (n === at) { at = at.nextSibling; continue; }
    parent.insertBefore(n, at);
  }
  return placed;
}
