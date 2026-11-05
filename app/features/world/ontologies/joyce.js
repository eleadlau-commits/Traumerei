// Joyce: thoughts joined by time into trains, each read like a paragraph. Each thought stands on
// its own, joined to the next by a line: taut between quick thoughts, slack after a pause, and
// straight again when pulled far apart (Line tension: each room's own, from the ⚙ beside Joyce in
// the rail). Drag a thought to move it alone (the line follows); double-click a train to choose it
// whole, then drag it. Enter goes on with the same train; Ctrl+Enter starts a new one. In the
// room's Timeline (any mode), a thought's train is its tag.
//
// A train is a group that holds each thought in only one train. A thought in no train (written
// in another mode of a big room) waits in the tray; dragged out of it, it starts a train where it
// is let go. Its arrangement lives on the trains (x, y) and their thoughts (dx, dy). A group
// another mode made (a chapter) is one thought here: in the tray until it is dragged out, then
// where it was let go (Joyce's own data, groups.js). A train made in the tray stays there too.

import { roomTrains, trainThoughts, groupOf, isGroup, isLeaf, kindOf, shut, thoughtText, roomItems, create, join, groupsIn, members } from '../model.js';
import { placedForeign, trayForeign, spot, putAt, place, inForeign } from '../groups.js';

const SVG = 'http://www.w3.org/2000/svg';
const byTime = (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1);

// ---- Where each thought of a train sits ----

// How far below the one before a thought sits, until it is dragged somewhere else.
export const STEP = { line: 58, passage: 190, picture: 270, group: 190 };
const LINE = 29; // each extra line of a thought written over several lines; the gap under a thought

// Each thought's height as drawn (world units), measured after each drawing (measured() below),
// so a thought that wraps onto several lines pushes the next one down by as much.
const HEIGHTS = new Map();

// Takes the heights just measured ({ id: { h } }); true if any changed enough to draw again.
export function setHeights(sizes) {
  let changed = false;
  for (const [id, { h }] of sizes) {
    const was = HEIGHTS.get(id);
    if (!(h > 0)) continue;
    if (was == null || Math.abs(was - h) > 1) { HEIGHTS.set(id, h); changed = true; }
  }
  return changed;
}
export const clearHeights = () => HEIGHTS.clear();

// How far below a thought the next one sits: its real height and a gap, once it has been drawn;
// until then, a guess from the lines written.
export function stepAfter(th) {
  const kind = kindOf(th);
  const guess = kind !== 'line' ? STEP[kind] : STEP.line + LINE * ((String(th.text || '').match(/\n/g) || []).length);
  const h = HEIGHTS.get(th.id);
  return h > 0 ? Math.max(STEP[kind] ?? STEP.line, Math.ceil(h) + LINE) : guess;
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
  if (!t || !(isLeaf(th) || isGroup(th)) || shut(w, id)) return false;
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


// ---- Clear space: what moves together ----

// A train's blocks: { id, thoughts, group, tail, hand, at }. id is the train (its start) or the
// thought dragged on its own that starts the run; tail marks the run the train's next thought
// joins; a closed train is one block.
export function joyceBlocks(w, roomId) {
  const out = [];
  for (const t of roomTrains(w, roomId)) {
    const all = trainThoughts(w, t.id);
    const at = (ths) => Math.max(t.at ?? 0, ...ths.map((th) => th.at ?? 0));
    if (t.closed) { out.push({ id: t.id, thoughts: [], group: t.id, tail: true, hand: !!t.hand, at: at(all) }); continue; }
    let run = { id: t.id, thoughts: [], group: t.id, hand: !!t.hand };
    const runs = [run];
    for (const th of all) {
      if (Number.isFinite(th.dx) && run.thoughts.length) runs.push(run = { id: th.id, thoughts: [], group: t.id, hand: true });
      else if (Number.isFinite(th.dx)) { run.id = th.id; run.hand = true; }
      run.thoughts.push(th.id);
    }
    run.tail = true;
    for (const r of runs) out.push({ ...r, at: at(r.thoughts.map((id) => w.things[id])) });
  }
  return out;
}

// ---- In a .traum file (the roomfile feature): its # In joyce section ----
//
//   at: ^t 120 40 [hand]   a train at a point (hand: placed by hand); another mode's group placed
//                          here; or a thought in no train, which starts a train there
//   offset: ^a 10 -6       a thought dragged within its train (dx, dy from where it would sit)
//   tray: ^a ^b            waiting in the tray: a train made there (the rest wait there anyway)
//
// A train with no at: line goes where new trains start: rows of four, below what is there.
// c (from the roomfile feature): ref(id) → '^n' (null when not in the file), thing(value) → id,
// report(line, words), keep(line), fresh: the ids just brought in, at: where new trains start.

// Where each new train starts: rows of four from `at`, each row below the longest train above.
function spots(w, ids, at = { x: 0, y: 0 }) {
  const out = {};
  let y = at.y, tallest = 0;
  ids.forEach((id, k) => {
    if (k && k % 4 === 0) { y += tallest + 140; tallest = 0; }
    out[id] = { x: at.x + (k % 4) * 440, y };
    const g = w.things[id];
    tallest = Math.max(tallest, g.closed ? 60 : members(w, id).reduce((s, th) => s + stepAfter(th), 0));
  });
  return out;
}
const bottom = (w, g) => g.y + (g.closed ? 60 : members(w, g.id).reduce((s, th) => s + stepAfter(th), 0)) + 140;

const traum = {
  write(w, roomId, c) {
    const out = [];
    const trains = groupsIn(w, roomId, 'joyce').filter((g) => members(w, g.id).length && c.ref(g.id));
    for (const g of trains) if (!g.loose && !groupOf(w, g.id, 'joyce')) out.push(`at: ${c.ref(g.id)} ${g.x} ${g.y}${g.hand === true ? ' hand' : ''}`);
    for (const g of placedForeign(w, roomId, 'joyce')) { const p = spot(w, roomId, 'joyce', g.id); if (c.ref(g.id)) out.push(`at: ${c.ref(g.id)} ${p.x} ${p.y}`); }
    for (const g of trains) for (const th of members(w, g.id)) if (Number.isFinite(th.dx) && c.ref(th.id)) out.push(`offset: ${c.ref(th.id)} ${th.dx} ${th.dy}`);
    const tray = joyce.tray(w, roomId).map((th) => c.ref(th.id)).filter(Boolean);
    if (tray.length) out.push(`tray: ${tray.join(' ')}`);
    return out;
  },
  read(w, roomId, lines, c) {
    const placed = new Set();
    const there = groupsIn(w, roomId, 'joyce').filter((g) => !c.fresh.has(g.id) && !g.loose && members(w, g.id).length);
    const num = (v) => (v?.t === 'num' ? v.v : null);
    for (const l of lines) {
      if (l.key === 'at' || l.key === 'offset') {
        const id = c.thing(l.values[0], l.line), x = num(l.values[1]), y = num(l.values[2]);
        if (!id) continue;
        if (x == null || y == null) { c.report(l.line, `${l.key}: needs a ^reference and two numbers.`); continue; }
        const th = w.things[id];
        if (l.key === 'offset') { th.dx = Math.round(x); th.dy = Math.round(y); continue; }
        if (placed.has(id)) { c.report(l.line, 'Joyce places a thing once; this second at: was left out.'); continue; }
        placed.add(id);
        const hand = l.values.slice(3).some((v) => v.t === 'word' && v.v === 'hand');
        if (isGroup(th) && th.of === 'joyce') {
          Object.assign(th, { x: Math.round(x), y: Math.round(y) });
          if (hand) th.hand = true;
          delete th.loose;
        } else if (isGroup(th)) putAt(w, roomId, 'joyce', id, x, y);
        else if (!groupOf(w, id, 'joyce')) {
          const t = create(w, roomId, { kind: 'group', of: 'joyce', x: Math.round(x), y: Math.round(y) }, th.at);
          if (t) { join(w, t.id, id); if (hand) t.hand = true; }
        } else c.report(l.line, 'that thought is in a train already, so its train\'s at: places it.');
      } else if (l.key === 'tray') {
        for (const v of l.values) {
          const id = c.thing(v, l.line);
          const g = id && w.things[id];
          if (isGroup(g) && g.of === 'joyce') { g.loose = true; placed.add(id); }
        }
      } else c.keep(l);
    }
    // New trains with no place: side by side in clear space, below what was there.
    const fresh = groupsIn(w, roomId, 'joyce').filter((g) => c.fresh.has(g.id) && !placed.has(g.id) && !g.loose && !groupOf(w, g.id, 'joyce'));
    if (!fresh.length) return;
    const below = Math.max(0, ...there.map((g) => bottom(w, g)));
    const where = spots(w, fresh.map((g) => g.id), c.at || { x: 0, y: below });
    for (const g of fresh) Object.assign(g, where[g.id]);
  },
};

// ---- The ontology ----

const joyce = {
  id: 'joyce',
  name: 'Joyce',
  note: 'thoughts joined by time',
  icon: '<circle cx="5" cy="7" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="17" r="2"/><path d="M6.7 8.2l3.6 2.6M13.7 13.2l3.6 2.6"/>', // thoughts on a line
  order: 10,
  groups: { form: 'train', name: 'Train', membership: 'one' },
  live: true, // a drag moves the thought (or train) at once, so the line follows it

  // Each train's thoughts, or a closed train as one thought.
  units: (w, roomId) => [...roomTrains(w, roomId).flatMap((t) => (t.closed ? [t] : trainThoughts(w, t.id))), ...placedForeign(w, roomId, 'joyce')],

  point(w, roomId, id) {
    const th = w.things[id];
    if (isGroup(th) && th.of !== 'joyce' && !groupOf(w, id, 'joyce')) return spot(w, roomId, 'joyce', id);
    if (isGroup(th) && !groupOf(w, id, 'joyce')) return { x: th.x, y: th.y };
    const t = groupOf(w, id, 'joyce');
    if (!t) return null;
    return t.closed ? { x: t.x, y: t.y } : trainSpots(w, t.id)[id] || null;
  },

  // A train moves whole (and counts as placed by hand); a thought moves alone, and its train
  // stays joined. A thought from the tray starts a train there.
  drop(w, roomId, id, x, y) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th) && groupOf(w, id, 'joyce')) nudge(w, id, x, y); // a group in a train moves in it, as a thought does
    else if (isGroup(th) && th.of !== 'joyce') putAt(w, roomId, 'joyce', id, x, y);
    else if (isGroup(th)) { Object.assign(th, { x, y, hand: true }); place(w, id); }
    else if (isLeaf(th) && !groupOf(w, id, 'joyce')) {
      const t = create(w, roomId, { kind: 'group', of: 'joyce', x: Math.round(x), y: Math.round(y) }, th.at);
      if (t) { join(w, t.id, id); t.hand = true; }
    } else nudge(w, id, x, y);
  },

  // Ctrl+Shift+G: every thought in Joyce is in a train, so each one taken out of its train starts
  // a train of its own, just where it was.
  ungroup(w, roomId, items, now) {
    let n = 0;
    for (const th of items) {
      const t = groupOf(w, th.id, 'joyce');
      if (!t || trainThoughts(w, t.id).length < 2) continue;
      const at = trainSpots(w, t.id)[th.id] || { x: t.x, y: t.y };
      const own = create(w, roomId, { kind: 'group', of: 'joyce', x: Math.round(at.x), y: Math.round(at.y) }, now);
      if (own && join(w, own.id, th.id)) { own.hand = true; n++; }
    }
    return n;
  },

  // The thoughts in no train yet, trains made in the tray, and other modes' groups not placed
  // here yet, oldest first.
  // A thought inside another mode's shared group is not loose here too: the group stands for it.
  tray(w, roomId) {
    const inside = inForeign(w, roomId, 'joyce');
    return [
      ...roomItems(w, roomId).filter((th) => !groupOf(w, th.id, 'joyce')),
      ...groupsIn(w, roomId, 'joyce').filter((g) => g.loose && members(w, g.id).length),
      ...trayForeign(w, roomId, 'joyce'),
    ].filter((th) => !inside(th.id)).sort(byTime);
  },
  placed(w, roomId, id) {
    const th = w.things[id];
    if (isGroup(th)) return th.of === 'joyce' ? !th.loose : !!spot(w, roomId, 'joyce', id);
    return !!groupOf(w, id, 'joyce');
  },

  // Clear space (clear.js): a train is one block from its start, and one more from each thought
  // dragged on its own (the thoughts after it follow it). Those dragged, or a train dragged whole,
  // were placed by hand.
  blocks: (w, roomId) => [...joyceBlocks(w, roomId),
    ...placedForeign(w, roomId, 'joyce').map((g) => ({ id: g.id, thoughts: [], group: g.id, hand: true, at: g.at ?? 0 }))],

  // Each thought's height as drawn: the steps in a train follow them.
  measured: (sizes) => setHeights(sizes),

  shift(w, roomId, id, dx, dy) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th) && groupOf(w, id, 'joyce')) { if (Number.isFinite(th.dx)) { th.dx += dx; th.dy += dy; } } // in a train: as a thought
    else if (isGroup(th) && th.of !== 'joyce') {
      const p = spot(w, roomId, 'joyce', id);
      if (p) putAt(w, roomId, 'joyce', id, p.x + dx, p.y + dy);
    } else if (isGroup(th)) {
      th.x += dx; th.y += dy;
      // Thoughts dragged on their own stay where they are.
      for (const m of trainThoughts(w, id)) if (Number.isFinite(m.dx)) { m.dx -= dx; m.dy -= dy; }
    } else if (Number.isFinite(th.dx)) { th.dx += dx; th.dy += dy; }
  },

  // A thought's tag in the room's Timeline: its train.
  tag(w, id) {
    const t = groupOf(w, id, 'joyce');
    return t ? { id: t.id, name: tagName(w, t.id) } : null;
  },

  settings: [{ key: 'tension', label: 'Line tension', min: 0, max: 1, default: 0.5 }],

  // The canvas: each train's line (an SVG path from thought to thought, with a knot at each), its
  // thoughts, a closed train as one block, and the thought being written.
  draw(c) {
    const w = c.world, el = c.el;
    const nodes = [];
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'room-strands');
    const tension = c.setting('tension');
    for (const t of roomTrains(w, c.roomId)) {
      const chosen = (c.sel?.kind === 'train' && c.sel.id === t.id) || c.isSel(t.id);
      if (t.closed) {
        nodes.push(el('div', {
          class: 'room-bead room-closed' + (chosen ? ' selected' : ''), 'data-group': t.id,
          style: `left:${t.x}px;top:${t.y}px`,
        }, c.thoughtNode(t)));
        continue;
      }
      const spots = trainSpots(w, t.id);
      const knots = trainThoughts(w, t.id).map((th) => ({ th, ...spots[th.id] }));
      if (c.draft?.train === t.id && !c.draft.edit) knots.push({ th: { at: Date.now() }, ...nextSpot(w, t.id), draft: true });
      const g = document.createElementNS(SVG, 'g');
      g.setAttribute('data-group', t.id);
      g.setAttribute('class', 'room-strand' + (chosen ? ' selected' : ''));
      for (let k = 1; k < knots.length; k++) {
        const a = knots[k - 1], b = knots[k];
        const p = { x: a.x - 14, y: a.y + 15 }, q = { x: b.x - 14, y: b.y + 15 };
        const d = strand(p, q, slack(a.th, b.th, Math.hypot(q.x - p.x, q.y - p.y), tension));
        for (const cls of ['room-strand-hit', 'room-strand-line']) {
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
        dot.setAttribute('class', 'room-knot');
        g.append(dot);
      }
      svg.append(g);
      for (const k of knots) {
        nodes.push(el('div', {
          class: 'room-bead' + (chosen || c.isSel(k.th.id) ? ' selected' : '') + (c.found === k.th.id ? ' found' : ''),
          'data-group': t.id, ...(k.draft ? {} : { 'data-thought': k.th.id }),
          style: `left:${k.x}px;top:${k.y}px`,
        }, k.draft ? c.draftNode() : c.thoughtNode(k.th)));
      }
    }
    // Other modes' groups placed here: each one closed thought, where it was let go.
    for (const g of placedForeign(w, c.roomId, 'joyce')) {
      const at = spot(w, c.roomId, 'joyce', g.id);
      nodes.push(el('div', {
        class: 'room-bead room-closed room-foreign' + ((c.sel?.kind === 'train' && c.sel.id === g.id) || c.isSel(g.id) ? ' selected' : ''),
        'data-group': g.id, style: `left:${at.x}px;top:${at.y}px`,
      }, c.thoughtNode(g)));
    }
    if (c.draft && !c.draft.train) {
      nodes.push(el('div', { class: 'room-bead', style: `left:${c.draft.x}px;top:${c.draft.y}px` }, c.draftNode()));
    }
    return [svg, ...nodes];
  },

  traum,
};

export default joyce;
