// Joyce: thoughts joined by time into trains, each read like a paragraph. Each thought stands on
// its own, joined to the next by a line: taut between quick thoughts, slack after a pause, and
// straight again when pulled far apart (Settings → Rooms → Line tension). Drag a thought to move it
// alone (the line follows); double-click a train to choose it whole, then drag it. Enter goes on
// with the same train; Ctrl+Enter starts a new one. Timeline (under Joyce in the rail) lists
// everything written in the room, in the order it was last changed, with its train as a tag.
//
// A train is a group that holds each thought in only one train. Joyce places everything, so it
// has no tray. Its arrangement lives on the trains (x, y) and their thoughts (dx, dy).

import { roomTrains, trainThoughts, groupOf, isGroup, isLeaf, kindOf, shut, thoughtText, hash } from '../model.js';

const SVG = 'http://www.w3.org/2000/svg';
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// ---- Where each thought of a train sits ----

// How far below the one before a thought sits, until it is dragged somewhere else.
export const STEP = { line: 58, passage: 190, picture: 270, group: 190 };
const LINE = 29; // each extra line of a thought written over several lines

// How far below a thought the next one sits.
export function stepAfter(th) {
  const kind = kindOf(th);
  if (kind !== 'line') return STEP[kind];
  return STEP.line + LINE * ((String(th.text || '').match(/\n/g) || []).length);
}

// Where each thought of a train sits ({ id: {x, y} }, world units): where it was dragged to, or
// a step below the one before.
export function trainSpots(w, trainId) {
  const t = w.things[trainId];
  const out = {};
  if (!t) return out;
  let x = t.x, y = t.y - STEP.line;
  let step = STEP.line;
  for (const th of trainThoughts(w, trainId)) {
    if (Number.isFinite(th.dx)) { x = t.x + th.dx; y = t.y + th.dy; }
    else y += step;
    out[th.id] = { x, y };
    step = stepAfter(th);
  }
  return out;
}

// Where the next thought of a train goes.
export function nextSpot(w, trainId) {
  const all = trainThoughts(w, trainId);
  const t = w.things[trainId];
  if (!all.length) return { x: t.x, y: t.y };
  const last = all[all.length - 1];
  const p = trainSpots(w, trainId)[last.id];
  return { x: p.x, y: p.y + stepAfter(last) };
}

// Drags one thought of a train to (x, y); its train stays joined.
export function nudge(w, id, x, y, now = Date.now()) {
  const th = w.things[id];
  const t = th && groupOf(w, id, 'joyce');
  if (!t || !isLeaf(th) || shut(w, id)) return false;
  th.dx = Math.round(x - t.x);
  th.dy = Math.round(y - t.y);
  th.edited = now;
  return true;
}

// How slack the line between two thoughts is (0 taut … 1 loose): thoughts written close together
// are joined taut; a longer pause leaves slack. Pulled far apart, the line goes straight again.
export const PAUSE = { quick: 20, long: 3600 }; // seconds
export function slack(a, b, dist = 0, tension = 0.5) {
  const gap = Math.max(0, ((b.at ?? 0) - (a.at ?? 0)) / 1000);
  const fromTime = Math.min(1, Math.log1p(gap / PAUSE.quick) / Math.log1p(PAUSE.long / PAUSE.quick));
  const pulled = Math.max(0, Math.min(1, 1 - (dist - STEP.line) / 520));
  return Math.max(0, Math.min(1, fromTime * pulled * (1 - tension) * 2));
}

// The line from p to q with that slack, as an SVG path: straight when taut, a soft curve when loose.
export function strand(p, q, k) {
  const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
  const bow = k * Math.max(26, d * 0.42);
  const cx = mx + (-dy / d) * bow, cy = my + (dx / d) * bow;
  const r = (v) => Math.round(v * 10) / 10;
  return k < 0.02 ? `M${r(p.x)} ${r(p.y)}L${r(q.x)} ${r(q.y)}` : `M${r(p.x)} ${r(p.y)}Q${r(cx)} ${r(cy)} ${r(q.x)} ${r(q.y)}`;
}

// ---- The timeline: a room's thoughts on one line, in the order they were last changed ----

export const lastChanged = (th) => Math.max(th.at ?? 0, th.edited ?? 0);
export function timeline(w, roomId) {
  return roomTrains(w, roomId)
    .flatMap((t) => trainThoughts(w, t.id).map((th) => ({ th, train: t })))
    .sort((a, b) => lastChanged(a.th) - lastChanged(b.th) || byTime(a.th, b.th));
}

// A train as a tag: its title, or its first words.
export function tagName(w, trainId) {
  const t = w.things[trainId];
  if (!t) return '';
  if (t.title) return t.title;
  const first = trainThoughts(w, trainId)[0];
  const words = first ? thoughtText(w, first).split(/\s+/).slice(0, 3).join(' ') : '';
  return words || 'A train';
}


// ---- The ontology ----

export default {
  id: 'joyce',
  name: 'Joyce',
  note: 'thoughts joined by time',
  order: 10,
  groups: { form: 'train', name: 'Train', membership: 'one' },
  live: true, // a drag moves the thought (or train) at once, so the line follows it

  // Each train's thoughts, or a folded train as one thought.
  units: (w, roomId) => roomTrains(w, roomId).flatMap((t) => (t.folded ? [t] : trainThoughts(w, t.id))),

  point(w, roomId, id) {
    const th = w.things[id];
    if (isGroup(th)) return { x: th.x, y: th.y };
    const t = groupOf(w, id, 'joyce');
    if (!t) return null;
    return t.folded ? { x: t.x, y: t.y } : trainSpots(w, t.id)[id] || null;
  },

  // A train moves whole; a thought moves alone, and its train stays joined.
  drop(w, roomId, id, x, y) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th)) Object.assign(th, { x, y });
    else nudge(w, id, x, y);
  },

  settings: [{ key: 'tension', label: 'Line tension', min: 0, max: 1 }],

  // The canvas: each train's line (an SVG path from thought to thought, with a knot at each), its
  // thoughts, a folded train as one block, and the thought being written.
  draw(c) {
    const w = c.world, el = c.el;
    const nodes = [];
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'create-strands');
    const tension = c.prefs.tension ?? 0.5;
    for (const t of roomTrains(w, c.roomId)) {
      const chosen = (c.sel?.kind === 'train' && c.sel.id === t.id) || c.isSel(t.id);
      if (t.folded) {
        nodes.push(el('div', {
          class: 'create-bead create-folded' + (chosen ? ' selected' : ''), 'data-group': t.id,
          style: `left:${t.x}px;top:${t.y}px`,
        }, c.thoughtNode(t)));
        continue;
      }
      const spots = trainSpots(w, t.id);
      const knots = trainThoughts(w, t.id).map((th) => ({ th, ...spots[th.id] }));
      if (c.draft?.train === t.id) knots.push({ th: { at: Date.now() }, ...nextSpot(w, t.id), draft: true });
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('data-group', t.id);
      g.setAttribute('class', 'create-strand' + (chosen ? ' selected' : ''));
      for (let k = 1; k < knots.length; k++) {
        const a = knots[k - 1], b = knots[k];
        const p = { x: a.x - 14, y: a.y + 15 }, q = { x: b.x - 14, y: b.y + 15 };
        const d = strand(p, q, slack(a.th, b.th, Math.hypot(q.x - p.x, q.y - p.y), tension));
        for (const cls of ['create-strand-hit', 'create-strand-line']) {
          const path = document.createElementNS(SVG, 'path');
          path.setAttribute('d', d);
          path.setAttribute('class', cls);
          g.append(path);
        }
      }
      for (const k of knots) {
        const dot = document.createElementNS(SVG, 'circle');
        dot.setAttribute('cx', k.x - 14);
        dot.setAttribute('cy', k.y + 15);
        dot.setAttribute('r', 2.6);
        dot.setAttribute('class', 'create-knot');
        g.append(dot);
      }
      svg.append(g);
      for (const k of knots) {
        nodes.push(el('div', {
          class: 'create-bead' + (chosen || c.isSel(k.th.id) ? ' selected' : '') + (c.found === k.th.id ? ' found' : ''),
          'data-group': t.id, ...(k.draft ? {} : { 'data-thought': k.th.id }),
          style: `left:${k.x}px;top:${k.y}px`,
        }, k.draft ? c.draftNode() : c.thoughtNode(k.th)));
      }
    }
    if (c.draft && !c.draft.train) {
      nodes.push(el('div', { class: 'create-bead', style: `left:${c.draft.x}px;top:${c.draft.y}px` }, c.draftNode()));
    }
    return [svg, ...nodes];
  },

  // Timeline: a list down the left of everything written in the room, in the order it was last
  // changed (latest at the bottom), each with its time and its train as a tag. A click takes the
  // view to it.
  panel: {
    key: 'timeline',
    label: 'Timeline',
    empty: 'Nothing written here yet',
    render(c) {
      const el = c.el;
      const items = timeline(c.world, c.roomId);
      const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      if (!items.length) return null;
      return el('ol', { class: 'create-history-list' }, items.map(({ th, train }) => el('li', {},
        el('button', {
          type: 'button', class: 'create-history-item' + (c.sel?.id === th.id || c.sel?.id === train.id ? ' on' : ''),
          style: `--tag:hsl(${hash(train.id) % 360} 32% 46%)`,
          onclick: () => c.goTo({ id: th.id, kind: kindOf(th), room: c.roomId }),
        },
          el('span', { class: 'create-history-meta' },
            el('span', { class: 'create-history-time' }, when(lastChanged(th))),
            el('span', { class: 'create-tag' }, tagName(c.world, train.id))),
          el('span', { class: 'create-history-text' }, thoughtText(c.world, th))))));
    },
  },
};
