// The arrows between one ontology's nodes, on the screen: drawing each arrow (through the shared
// lines part, lines.js) with its relation and label beside it, editing an arrow where it is (a
// double-click on it or its label: its relation and its label; Enter keeps, Esc lets go), drawing a
// new arrow by dragging from a point onto another node, and a node's rows in its pop-up (each arrow
// into it). Russell's tree uses it now; a network that allows loops later. What an arrow is, and
// the rules for drawing one, are relations.js (`net`); where it runs between two boxes is arrows.js.
//
// arrowView({ of, net, boxes, pads, nodeAt, name, ends }) gives the functions for one ontology:
//   of                  the ontology's id (its relations are its room setting RELATIONS.key)
//   net                 relations.js's arrowsOf(...) for it: arrows, arrowsInto, link, ...
//   boxes(w, room)      each node's corner and size as drawn: { [id]: { at, size } }
//   pads(w, from, to)   how far off each side an arrow starts and ends (arrows.js's between)
//   nodeAt(w, room, x, y)   the node at a world point, or null (when the pointer is over no node)
//   name(w, id)         a node in words, for its pop-up rows ("From Arrays: ")
//   ends(rel, c)        (optional) a relation's ends: 'none', 'arrow' (default) or 'both'
//   route(c, a, b, from, to)   (optional) the line itself, from box a to box b ({ at, size }):
//                       { d, spot } (its SVG path, and where its label goes: labelSpot's
//                       { x, y, side }). Left out: between the boxes' facing sides (arrows.js)
//   onNode(c, el)       (optional) the node a drawn element stands for, or null (left out: the
//                       group of this ontology it is in, or the node at that point)
//   setting             (optional) the room setting holding its relations (RELATIONS)
//   word                (optional) what a link is called in its words ('arrow')
//   quiet               (optional) true: the room's first relation (the one a new link gets) is
//                       never named beside its links, only the others are
//
// and returns { draw(c, layer), press(c, e), drag(c, e, from, p, shape?), props(c, th),
// pick(c, now, pick, keys), edit(c, from, to), remove(c, from, to), editing(c) }. drag's shape(q), when given, is the
// line drawn while dragging, to the pointer at q (an SVG path); left out, it leaves p downwards.
// edit(c, from, to) opens an arrow's edit box where it is, as a double-click does; remove(c, from,
// to) takes an arrow away (one undo step), as the edit box's Remove and Delete and a pop-up row's × do. Its look is the room's .room-arrow-* classes (with .room-line from lines.js).

import { setRoomSetting } from '../model.js';
import { maths } from '../maths.js';
import { between, path as arrowLine, labelSpot } from './arrows.js';
import * as lines from './lines.js';
import { cleanRelations, relationShown, withRelation, relationName, relationLooks, RELATIONS } from './relations.js';
import { lookClass } from './relationsview.js';

export const arrowKey = (from, to) => `${from}>${to}`;

export function arrowView({ of, net, boxes, pads, nodeAt, name, ends = () => 'arrow', route = null, onNode = null, setting = RELATIONS, word = 'arrow', quiet = false }) {
  const { arrows, arrowsInto, parentsOf, childrenOf, link, unlink, setLabel, setRelation } = net;
  const box = ({ at, size }) => ({ x: at.x, y: at.y, w: size.w, h: size.h });

  // An arrow being edited where it is: { room, from, to, text, rel, fresh }. Drawn by draw(), so
  // a redraw keeps it open with what was typed.
  let editing = null;
  let lastArrow = null; // the arrow pressed last, { key, at }, to hear a double-click

  function startEdit(c, from, to) {
    const a = arrowsInto(c.world, c.roomId, to);
    if (!a.parents.includes(from)) return;
    editing = { room: c.roomId, from, to, text: a.labels[from] || '', rel: a.rel[from], fresh: true };
    c.drawWorld();
  }

  function finishEdit(c, keep) {
    const e = editing;
    editing = null;
    if (keep && e && e.room === c.roomId && !c.locked) {
      setLabel(c.world, c.roomId, e.from, e.to, e.text);
      setRelation(c.world, c.roomId, e.from, e.to, e.rel);
      c.save();
    }
    c.drawWorld();
  }

  // Takes an arrow away (Ctrl+Z brings it back: the save is one undo step).
  function remove(c, from, to) {
    if (editing && editing.room === c.roomId && editing.from === from && editing.to === to) editing = null;
    if (c.locked || !unlink(c.world, c.roomId, from, to)) { c.drawWorld(); return false; }
    c.save();
    c.drawWorld();
    c.toast(`${word[0].toUpperCase()}${word.slice(1)} removed. Ctrl+Z brings it back.`);
    return true;
  }

  // A relation picker: the room's relations (and the arrow's own, if the list no longer has it),
  // no relation, and "+ New…", which turns the picker into a field: Enter adds the name to the
  // room's list and picks it, Esc goes back. pick(name) hears the choice ('' for none); keys(ev)
  // hears the picker's other keys (the edit box's Enter and Esc).
  function pick(c, now, chosen, keys = () => {}) {
    const names = cleanRelations(c.setting(setting.key), setting.default);
    const list = names.includes(now) || !now ? names : [...names, now];
    const wrap = c.el('span', { class: 'room-arrow-rel-pick' });
    const select = c.el('select', {
      class: 'room-arrow-pick-rel', 'aria-label': `The ${word}'s relation`, onkeydown: keys,
      onchange: (ev) => {
        const v = ev.target.value;
        if (v === 'new') { wrap.replaceChildren(field); field.focus(); return; }
        chosen(v === 'none' ? '' : list[Number(v)]);
      },
    },
    ...list.map((n, i) => c.el('option', { value: String(i), selected: n === now }, n)),
    c.el('option', { value: 'none', selected: !now }, '(no relation)'),
    c.el('option', { value: 'new' }, '+ New…'));
    const back = () => { select.value = now ? String(list.indexOf(now)) : 'none'; wrap.replaceChildren(select); select.focus(); };
    const field = c.el('input', {
      class: 'room-edit-text room-arrow-new', placeholder: 'is a case of', spellcheck: 'false', 'aria-label': 'A new relation',
      onkeydown: (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); back(); return; }
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        const n = relationName(field.value);
        if (!n) { if (n === null) c.toast('A relation can\'t hold [[, ]] or |.'); back(); return; }
        const next = withRelation(c.setting(setting.key), n, setting.default);
        if (!c.locked && next.length !== names.length) { setRoomSetting(c.world, c.roomId, of, setting.key, next); c.save(); }
        chosen(cleanRelations(next, setting.default).find((x) => x.toLowerCase() === n.toLowerCase()));
      },
    });
    wrap.append(select);
    return wrap;
  }

  // The box an arrow is edited in: its relation, its label and Remove. Delete takes the arrow
  // away when it has nothing else to do: on the picker, or in the label with the caret at its end.
  function editBox(c, spot) {
    const e = editing;
    const keys = (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); finishEdit(c, true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finishEdit(c, false); }
      else if (ev.key === 'Delete' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey) {
        const t = ev.target;
        const atEnd = t.tagName !== 'INPUT' || (t.selectionStart === t.selectionEnd && t.selectionEnd === t.value.length);
        if (atEnd) { ev.preventDefault(); remove(c, e.from, e.to); }
      }
    };
    const input = c.el('input', {
      class: 'room-edit-text', value: e.text, placeholder: 'the coordinates', spellcheck: 'false',
      'aria-label': `The ${word}'s label`, oninput: (ev) => { e.text = ev.target.value; }, onkeydown: keys,
    });
    const picker = pick(c, e.rel, (n) => { e.rel = n; input.focus(); }, keys);
    const out = c.el('div', {
      class: `panel room-arrow-edit side-${spot.side}`, style: `left:${Math.round(spot.x)}px;top:${Math.round(spot.y)}px`,
    }, picker, input,
    // Pressed through press() (the canvas holds the pointer).
    c.el('button', { type: 'button', class: 'word room-arrow-remove', 'data-arrow-remove': '', title: `Take this ${word} away (Delete)` }, 'Remove'));
    requestAnimationFrame(() => {
      if (!out.isConnected || out.contains(document.activeElement)) return;
      input.focus();
      if (e.fresh) input.select(); else input.setSelectionRange(input.value.length, input.value.length);
      e.fresh = false;
    });
    return out;
  }

  // The node under a pointer: the drawn node it is over, or the one at that point.
  function nodeUnder(c, ev) {
    const at = document.elementFromPoint(ev.clientX, ev.clientY);
    const own = at && onNode ? onNode(c, at) : null;
    if (own) return own;
    const n = at?.closest?.('[data-group]');
    const g = n && c.world.things[n.dataset.group];
    if (g && g.of === of) return g.id;
    const p = c.toWorld(ev.clientX, ev.clientY);
    return nodeAt(c.world, c.roomId, p.x, p.y);
  }

  // Draws a new arrow by dragging from point p (world units, leaving downwards) of node `from`
  // onto another node; the layer is the canvas's .room-lines layer.
  function drag(c, e, from, p, shape = null) {
    const layer = c.world$?.querySelector('.room-lines');
    if (!layer) return;
    const line = c.setting('line') || 'straight';
    const first = cleanRelations(c.setting(setting.key), setting.default)[0] || '';
    const [drawn] = lines.line('', { ends: ends(first, c), cls: 'room-arrow room-arrow-drawing' });
    layer.append(drawn);
    const move = (ev) => {
      const q = c.toWorld(ev.clientX, ev.clientY);
      drawn.setAttribute('d', shape ? shape(q) : arrowLine({ p, q, from: 'bottom', to: 'top' }, line));
    };
    const up = (ev) => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      drawn.remove();
      if (ev.type !== 'pointerup') return;
      const to = nodeUnder(c, ev);
      if (!to || to === from) { c.drawWorld(); return; }
      const why = link(c.world, c.roomId, from, to);
      if (why) c.toast(why);
      c.save();
      c.drawWorld();
    };
    move(e);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // The legend (the room's ⚙ Legend): each relation's line beside its name, over the top left
  // of what is drawn, so it stays with the web.
  function legend(c, all, names, looks) {
    const bs = Object.values(all);
    if (!bs.length) return null;
    const x = Math.min(...bs.map((b) => b.at.x)), y = Math.min(...bs.map((b) => b.at.y)) - 30;
    const rows = names.map((n) => {
      const svg = lines.svg('svg', { width: 30, height: 10, viewBox: '0 0 30 10', 'aria-hidden': 'true' });
      svg.append(lines.line('M2 5 L28 5', { ends: ends(n, c), cls: `room-arrow ${lookClass(looks[n])}` })[0]);
      return c.el('div', { class: 'room-arrow-legend-row' }, svg, c.el('span', {}, n));
    });
    return c.el('div', { class: 'panel room-arrow-legend', style: `left:${Math.round(x)}px;top:${Math.round(y)}px` }, ...rows);
  }

  return {
    pick,
    drag,
    nodeUnder,
    edit: startEdit,
    remove,

    // Whether an arrow is being edited in this room.
    editing: (c) => !!editing && editing.room === c.roomId,

    // A press on the canvas: one in the edit box is its own, anywhere else keeps the edit; a
    // double-click on an arrow or its label edits it. True when the press was the arrows'.
    press(c, e) {
      if (editing && editing.room === c.roomId) {
        if (e.target.closest?.('[data-arrow-remove]')) { e.preventDefault(); remove(c, editing.from, editing.to); return true; }
        if (e.target.closest?.('.room-arrow-edit')) return true;
        finishEdit(c, true);
      }
      // The canvas is redrawn between the two presses, so the arrow is heard by its key, not its node.
      const hit = e.target.closest?.('[data-arrow]');
      if (!hit) { lastArrow = null; return false; }
      const key = hit.dataset.arrow, now = Date.now();
      if (lastArrow?.key === key && now - lastArrow.at < 400) {
        lastArrow = null;
        e.preventDefault();
        const [from, to] = key.split('>');
        startEdit(c, from, to);
        return true;
      }
      lastArrow = { key, at: now };
      return false;
    },

    // Each arrow on the canvas, into `layer` (lines.layer): from the side of the parent that faces
    // the child to the child's facing side, its label at its middle. Returns the label nodes.
    draw(c, layer, all = boxes(c.world, c.roomId)) {
      const w = c.world, roomId = c.roomId, el = c.el;
      const nodes = [];
      const line = c.setting('line') || 'straight';
      const names = cleanRelations(c.setting(setting.key), setting.default);
      const looks = relationLooks(c.setting(setting.key));
      for (const { from, to, label, rel } of arrows(w, roomId)) {
        const a = all[from], b = all[to];
        if (!a || !b) continue;
        const arrow = route ? null : between(box(a), box(b), pads(w, from, to));
        const routed = route ? route(c, a, b, from, to) : null;
        if (route && !routed) continue;
        const d = routed ? routed.d : arrowLine(arrow, line), key = arrowKey(from, to);
        const look = lookClass(looks[rel]);
        const [drawn, hit] = lines.line(d, { ends: ends(rel, c), cls: `room-arrow${look ? ` ${look}` : ''}`, hit: { cls: 'room-arrow-hit', 'data-arrow': key } });
        layer.append(drawn, hit);
        const mid = routed ? routed.spot : labelSpot(arrow, line);
        if (editing && editing.room === roomId && editing.from === from && editing.to === to && !c.locked) {
          nodes.push(editBox(c, mid));
          continue;
        }
        // The relation shows beside the label when it tells arrows apart (relationShown).
        const shown = quiet && rel === names[0] ? '' : relationShown(names, rel);
        if (!label && !shown && !c.locked) {
          // An arrow with nothing to show: a faint hint of its relation when the pointer is on it.
          const hint = el('div', { class: `room-arrow-label room-arrow-hint side-${mid.side}`, 'data-arrow': key, title: `Double-click to write this ${word}'s label`, style: `left:${Math.round(mid.x)}px;top:${Math.round(mid.y)}px` }, `${rel ? `${rel} ` : ''}…`);
          hit.addEventListener('pointerenter', () => hint.classList.add('show'));
          hit.addEventListener('pointerleave', () => hint.classList.remove('show'));
          nodes.push(hint);
        }
        if (label || shown) {
          // A junction's two arrows lean towards each other, so each label goes on the side its
          // parent is on, away from the other arrow. Arrows fanning out of one foot are close
          // together at their middles, so their labels sit further down, where they have spread.
          // (A line routed by its ontology puts its label where the route says.)
          let spot = mid;
          if (!routed) {
            const prefer = parentsOf(w, roomId, to).length > 1 ? (arrow.p.x < arrow.q.x ? 'left' : 'right') : null;
            const fan = arrow.from === 'bottom' && childrenOf(w, roomId, from).length > 1;
            spot = labelSpot(arrow, line, { prefer, t: fan ? 0.7 : 0.5 });
          }
          nodes.push(el('div', {
            class: `room-arrow-label side-${spot.side}${look.includes('rel-colour') ? ` ${look}` : ''}`, 'data-group': to, 'data-arrow': key, title: `${[rel, label].filter(Boolean).join(' ')} (double-click to edit)`,
            style: `left:${Math.round(spot.x)}px;top:${Math.round(spot.y)}px`,
          }, shown ? el('span', { class: 'room-arrow-rel' }, label ? `${shown} ` : shown) : null, label ? maths(label) : null));
        }
      }
      if (c.setting('legend')) { const l = legend(c, all, names, looks); if (l) nodes.push(l); }
      return nodes;
    },

    // In a node's pop-up: each arrow into it, its relation (any of the room's, none, or a new one)
    // and its label.
    props(c, th) {
      const { parents, labels, rel } = arrowsInto(c.world, c.roomId, th.id);
      return parents.map((p) => {
        const from = name(c.world, p);
        const picker = pick(c, rel[p], (r) => { setRelation(c.world, c.roomId, p, th.id, r); c.save(); c.drawWorld(); });
        return c.el('label', { class: 'room-arrow-row' },
          c.el('span', { class: 'pop-note' }, `From ${from}: `, picker, c.locked ? null : c.el('button', {
            type: 'button', class: 'close-x room-arrow-x', 'aria-label': `Remove the ${word} from ${from}`, title: `Remove this ${word} (Ctrl+Z brings it back)`,
            onclick: (e) => { e.preventDefault(); e.currentTarget.blur(); remove(c, p, th.id); },
          })),
          c.el('input', {
            class: 'room-edit-text', value: labels[p] || '', placeholder: 'the coordinates', 'aria-label': `The label of the arrow from ${from}`,
            onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); },
            onchange: (e) => { setLabel(c.world, c.roomId, p, th.id, e.target.value); c.save(); c.drawWorld(); },
          }));
      });
    },
  };
}
