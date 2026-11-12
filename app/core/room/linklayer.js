// Part of the room feature. The links a plugin declares (cites, contradicts, Provoke's, the link
// hand's own `link`), on the canvas, in every mode: a quiet dashed line between two marks that both
// show here, and a small ↗ on a mark whose other end is somewhere else (another room, or folded
// away). A click on the ↗, or Alt+L with the mark chosen, follows the link there (Alt+L again: the
// next one). The structure kinds (part of, stands for, relation) are each mode's own to draw.
// plan() is pure (tests/linklayer.test.js); drawLinks() measures what the canvas drew.

import { el } from './shared.js';
import { linksFrom, linksTo, LINK_KINDS, roomOf, thoughtText } from './world.js';

const SVG = 'http://www.w3.org/2000/svg';
const short = (s) => (s.length > 48 ? `${s.slice(0, 47)}…` : s) || '(empty)';

// A plugin's kind: anything that is not structure.
export const isPluginKind = (kind, structure = LINK_KINDS) => !structure.includes(kind);

// What to draw for the marks that show: { lines: [{ id, from, to, kind }], stubs: Map mark →
// [{ id, kind, other, out }] }. ends(w, id) gives the rows touching a mark; shown is a Set of ids.
export function plan(shown, ends) {
  const lines = [], stubs = new Map(), seen = new Set();
  for (const id of shown) {
    for (const r of ends(id)) {
      const out = r.from === id, other = out ? r.to : r.from;
      if (shown.has(other)) {
        if (!seen.has(r.id)) { seen.add(r.id); lines.push({ id: r.id, from: r.from, to: r.to, kind: r.kind }); }
      } else {
        let s = stubs.get(id);
        if (!s) stubs.set(id, (s = []));
        s.push({ id: r.id, kind: r.kind, other, out });
      }
    }
  }
  return { lines, stubs };
}

// Where a line between two boxes leaves the first: its centre's ray cut at the box's edge.
export function edge(a, b) {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2, dx = b.x + b.w / 2 - ax, dy = b.y + b.h / 2 - ay;
  if (!dx && !dy) return { x: ax, y: ay };
  const k = Math.min(dx ? a.w / 2 / Math.abs(dx) : Infinity, dy ? a.h / 2 / Math.abs(dy) : Infinity);
  return { x: ax + dx * k, y: ay + dy * k };
}

export class RoomLinks {
  // The rows of plugin kinds touching a mark.
  pluginLinks(id) {
    const w = this.world;
    return [...linksFrom(w, id), ...linksTo(w, id)].filter((r) => isPluginKind(r.kind));
  }

  // A kind's name, as its plugin declares it.
  linkName(kind) {
    const k = this.slot('links.kinds')?.items?.map((e) => (e && e.item && e.owner !== undefined ? e.item : e)).find((d) => d?.kind === kind);
    return k?.name || kind;
  }

  // Draws the lines and the ↗ marks over what the canvas holds. Cheap when no plugin link shows.
  drawLinks() {
    const box = this.world$;
    const nodes = new Map();
    for (const n of box.querySelectorAll('[data-thought]')) if (!nodes.has(n.dataset.thought)) nodes.set(n.dataset.thought, n);
    if (!nodes.size) return;
    const { lines, stubs } = plan(new Set(nodes.keys()), (id) => this.pluginLinks(id));
    if (!lines.length && !stubs.size) return;
    const rect = new Map();
    const at = (id) => {
      if (rect.has(id)) return rect.get(id);
      let n = nodes.get(id), x = 0, y = 0;
      const w = n.offsetWidth, h = n.offsetHeight;
      while (n && n !== box) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      const r = { x, y, w, h };
      rect.set(id, r);
      return r;
    };
    if (lines.length) {
      const svg = document.createElementNS(SVG, 'svg');
      svg.setAttribute('class', 'room-plinks');
      for (const l of lines) {
        const a = at(l.from), b = at(l.to), p = edge(a, b), q = edge(b, a);
        const line = document.createElementNS(SVG, 'line');
        line.setAttribute('class', 'room-plink');
        for (const [k, v] of Object.entries({ x1: p.x, y1: p.y, x2: q.x, y2: q.y })) line.setAttribute(k, String(v));
        const word = document.createElementNS(SVG, 'text');
        word.setAttribute('class', 'room-plink-word');
        word.setAttribute('x', String((p.x + q.x) / 2));
        word.setAttribute('y', String((p.y + q.y) / 2 - 4));
        word.textContent = this.linkName(l.kind);
        svg.append(line, word);
      }
      box.prepend(svg);
    }
    for (const [id, list] of stubs) {
      const r = at(id);
      const says = list.map((s) => `${s.out ? '' : '← '}${this.linkName(s.kind)}: ${short(this.endText(s.other))}${this.endRoom(s.other)}`).join('\n');
      box.append(el('button', {
        type: 'button', class: 'room-plink-stub', style: `left:${r.x + r.w - 6}px;top:${r.y - 10}px`,
        title: `${says}\n(Alt+L follows)`, 'aria-label': `Follow a link: ${says}`,
        onpointerdown: (e) => e.stopPropagation(),
        onclick: (e) => { e.stopPropagation(); this.followLink(id); },
      }, list.length > 1 ? `↗${list.length}` : '↗'));
    }
  }

  endText(id) { const th = this.world.things[id]; return th ? thoughtText(this.world, th) : ''; }
  endRoom(id) { const r = roomOf(this.world, id); return r && r.id !== this.roomId ? ` (in ${r.name || 'a room'})` : ''; }

  // Follows one of a mark's plugin links to its other end. Alt+L again where it landed: the
  // first mark's next link (so a mark with three links is walked through from where each lands).
  followLink(id) {
    const f = this.followAt;
    const again = f && f.landed === id && f.n > 1;
    const from = again ? f.mark : id;
    const list = this.pluginLinks(from);
    if (!list.length) { this.toast('No links to follow from here'); return false; }
    const i = again ? (f.i + 1) % list.length : 0;
    const r = list[i], other = r.from === from ? r.to : r.from;
    const room = roomOf(this.world, other);
    if (!room) { this.toast('That end is in no room'); return false; }
    this.followAt = { mark: from, i, n: list.length, landed: other };
    this.goTo(room.id === other ? { id: other, kind: 'room' } : { id: other, room: room.id });
    if (list.length > 1) this.toast(`${this.linkName(r.kind)} · ${i + 1} of ${list.length} (Alt+L: the next)`);
    return true;
  }
}
