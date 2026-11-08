// Link graph: a tab in the right dock that draws the open room's marks on a circle and every
// link between them (of any kind) as a line, the kinds named in a key. Ctrl+Alt+K opens it, and
// it is drawn again when the links change. A corpus plugin (kernel phase 8): written against
// app/core/API.md alone. Saves nothing.
import { Feature, ui } from 'folio';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); n.append(...kids); return n; };

// The graph as data: the marks on a circle, and the links between two of them.
export function graph(t, context, r = 140) {
  const marks = (t.marks.in(context) || []).filter((m) => m.kind !== 'group');
  const at = new Map(marks.map((m, i) => [m.id, { x: r + r * Math.cos((2 * Math.PI * i) / (marks.length || 1)), y: r + r * Math.sin((2 * Math.PI * i) / (marks.length || 1)) }]));
  const edges = [];
  for (const m of marks) for (const l of t.links.from(m.id)) if (at.has(l.to) && l.kind !== 'part of') edges.push({ from: m.id, to: l.to, kind: l.kind });
  for (const m of marks) for (const g of t.links.holders(m.id)) for (const other of t.links.members(g)) if (other > m.id && at.has(other)) edges.push({ from: m.id, to: other, kind: 'part of' });
  return { marks: marks.map((m) => ({ id: m.id, ...at.get(m.id), words: t.marks.text(m.id) })), edges };
}

function draw(t, context) {
  const g = graph(t, context);
  const kinds = [...new Set(g.edges.map((e) => e.kind))];
  const pos = new Map(g.marks.map((m) => [m.id, m]));
  const art = svg('svg', { viewBox: '-20 -20 320 320', class: 'link-graph' },
    ...g.edges.map((e) => svg('line', { x1: pos.get(e.from).x, y1: pos.get(e.from).y, x2: pos.get(e.to).x, y2: pos.get(e.to).y, 'stroke-dasharray': ['', '4 3', '1 3', '6 2 1 2'][kinds.indexOf(e.kind) % 4] })),
    ...g.marks.map((m) => svg('circle', { cx: m.x, cy: m.y, r: 4 }, svg('title', {}, m.words))));
  return ui.el('div', { class: 'link-graph-tab' }, art,
    ui.el('p', { class: 'hint small' }, kinds.length ? kinds.map((k, i) => `${['——', '- - -', '· · ·', '—·—'][i % 4]} ${t.links.named(k)?.name || k}`).join('   ') : 'No links between these thoughts yet.'));
}

export function install(t) {
  let context = null;
  const open = () => {
    context = t.ui.chosen()?.context;
    if (!context) { t.ui.toast('Open a room first'); return; }
    if (!t.ui.docks) { t.ui.toast(`${graph(t, context).edges.length} links in this room`); return; }
    t.ui.docks.right.open({ key: 'link-graph', kind: 'Graph', title: t.marks.text(context) || 'Links', label: 'Graph', body: draw(t, context) });
  };
  t.slots.commands.add({ id: 'link-graph.open', keys: ['Ctrl+Alt+K'], zone: 'room', order: 63, words: 'Show this room\'s links as a graph', run: open });
  t.links.on(() => { if (context && t.ui.docks?.right.isOpen('link-graph')) t.ui.docks.right.open({ key: 'link-graph', kind: 'Graph', title: t.marks.text(context), label: 'Graph', body: draw(t, context) }); });
}

export default class LinkGraph extends Feature {
  start() { install(this.use('traumerei').connect(this)); }
}
