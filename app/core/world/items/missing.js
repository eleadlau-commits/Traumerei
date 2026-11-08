// The stand-in for an item whose kind is not there now (its plugin is switched off). It keeps the
// thought exactly as it is, so turning the plugin on again brings it back unchanged.

const label = (kind) => String(kind || 'thing').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const text = (th) => [th.title, th.text, th.body].filter((s) => typeof s === 'string' && s.trim()).join(' — ');
const made = new Map(); // one stand-in per kind

export function missing(kind) {
  if (made.has(kind)) return made.get(kind);
  const name = label(kind);
  const k = Object.freeze({
    kind,
    name,
    missing: true,
    // Every field is kept as it is: nothing about it can be tidied without its kind.
    tidy: (f) => { const { id, parent, at, kind: _k, ...rest } = f; return rest; },
    text: (th) => text(th) || `[${name.toLowerCase()}]`,
    node: (th, el) => el('div', { class: 'room-passage room-missing st-off', 'data-id': th.id, title: `${name}: its plugin is switched off. Turn it on in Settings → Plugins to see and change it.` },
      el('div', { class: 'label room-passage-kind' }, `${name} · plugin off`),
      text(th) ? el('div', { class: 'room-passage-body' }, text(th)) : null),
  });
  made.set(kind, k);
  return k;
}
