// Room types: a read file (file.js) → a rule for t.slots.rules.add (app/core/API.md, A rule of
// your own). The words arrange the marks; the ```js block's hooks win over them. A hook that
// throws is caught: arrange falls back to rows and the error is told to onError for the page.
// Plain functions, no app (tests/room-types.test.js).
//
// ruleOf is self-contained on purpose (it names nothing outside itself): Export writes its source
// into the .traumplug (pack.js), so the exported type runs the same code as the page.

export function ruleOf(file, onError = () => {}) {
  const { lines, hooks = {} } = file;
  const { w, h } = lines.cell, cols = lines.columns;
  const ordered = (reads, context) => {
    const marks = reads.marks.in(context).filter((m) => m.kind !== 'group');
    if (lines.order === 'by text') return marks.sort((a, b) => reads.marks.text(a.id).localeCompare(reads.marks.text(b.id)) || a.at - b.at);
    if (lines.order === 'open gaps first') { const open = (m) => (reads.gaps.of(m.id)?.state === 'open' ? 0 : 1); return marks.sort((a, b) => open(a) - open(b) || a.at - b.at); }
    if (lines.order === 'newest first') return marks.sort((a, b) => b.at - a.at);
    return marks.sort((a, b) => a.at - b.at);
  };
  // A tree: each mark under the first mark of the room it links to (part of left out).
  const byLinks = (reads, marks) => {
    const here = new Set(marks.map((m) => m.id)), up = new Map(), kids = new Map(), out = [], seen = new Set();
    for (const m of marks) { const r = reads.links.from(m.id).find((l) => l.kind !== 'part of' && here.has(l.to) && l.to !== m.id); if (r) up.set(m.id, r.to); }
    for (const m of marks) { const p = up.get(m.id); if (p) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(m.id); } }
    const walk = (id, depth) => { if (seen.has(id)) return; seen.add(id); out.push({ mark: id, x: depth * Math.round(w / 2), y: out.length * h }); for (const k of kids.get(id) || []) walk(k, depth + 1); };
    for (const m of marks) if (!up.has(m.id)) walk(m.id, 0);
    for (const m of marks) walk(m.id, 0); // a loop of links: what is left starts at the left
    return out;
  };
  // The arrangements in words: [{ mark, x, y }] (a mark's x, y is its centre).
  const inWords = (how) => (reads, context) => {
    const marks = ordered(reads, context);
    if (how === 'rows') return marks.map((m, i) => ({ mark: m.id, x: 0, y: i * h }));
    if (how === 'columns') { const per = Math.max(1, Math.ceil(marks.length / cols)); return marks.map((m, i) => ({ mark: m.id, x: Math.floor(i / per) * w, y: (i % per) * h })); }
    if (how === 'spiral') return marks.map((m, i) => { const a = i * 2.399963, r = Math.sqrt(i) * Math.max(w, h) * 0.75; return { mark: m.id, x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) }; });
    if (how === 'by links') return byLinks(reads, marks);
    return marks.map((m, i) => ({ mark: m.id, x: (i % cols) * w, y: Math.floor(i / cols) * h }));
  };
  const guard = (name, fn, fallback) => (...args) => { try { return fn(...args); } catch (err) { onError(name, err); return fallback(...args); } };
  const rule = { id: file.id, name: file.name, note: file.note || '', icon: file.icon, hand: lines.hand !== false };
  rule.arrange = hooks.arrange ? guard('arrange', hooks.arrange, inWords('rows')) : inWords(lines.arrange);
  const kinds = lines.links;
  const own = hooks.admit ? guard('admit', hooks.admit, () => true) : null;
  if (kinds || own) {
    rule.admit = (reads, p) => {
      if (kinds && p?.kind === 'link' && !kinds.includes(p.link) && p.link !== 'part of' && p.link !== 'stands for') return `This room takes only ${kinds.join(', ')} links`;
      return own ? own(reads, p) : true;
    };
  }
  for (const k of ['draw', 'drop', 'land']) if (hooks[k]) rule[k] = guard(k, hooks[k], () => (k === 'draw' ? [] : null));
  return rule;
}
