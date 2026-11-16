// Part of the room feature. Surfaces (open core, step 4): a kind of mark (slots.kinds, `surface`)
// or a rule's box (a thin rule's draw(), `surface`) asks for a surface by its id, and the room
// gives the plugin that added it an element of its own, sized by the layout, to draw in (a canvas
// or an SVG it owns). Clicked into, the surface is focused: it hears the pointer, the wheel and
// the keys until Esc or a click outside gives them back to the room. Pointer down to pointer up
// is one gesture, and every propose the plugin makes in it lands as one step (one Ctrl+Z): the
// plugin API holds its saves (api/v2.js surfaceFor), the room only says when a gesture begins and
// ends. What a surface keeps goes through proposes (marks.edit of its kind's fields), so nothing
// is kept outside the tables, and a surface whose plugin is off is the kind's quiet stand-in.
//
// The slot 'room.surfaces' holds what the plugin API made of each surface (surfaceFor): { id,
// width, height, draw(el, ctx), pointer?, wheel?, key?, focus?, blur?, leave?, hold() → done }.
// view.js calls mountSurfaces() after each drawing; nothing else in the room names a surface.
// Its methods join the Room class (see mixIn in Room.js), so `this` is the feature.

import { kindFor, kindOf } from './world.js';
import { el } from './shared.js';

// The size a surface gets when the layout says none (world units).
export const SIZE = Object.freeze({ width: 240, height: 160 });

// A point on the screen as the surface's own units: (0, 0) its top-left corner, (width, height)
// its foot on the right, however far the room is zoomed. rect: the element's screen box.
export function localPoint(rect, width, height, clientX, clientY) {
  const sx = rect.width ? width / rect.width : 1, sy = rect.height ? height / rect.height : 1;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

// What a plugin hears of a pointer event: plain numbers and words, in the surface's units.
export function pointerOf(type, e, at) {
  return Object.freeze({ type, x: at.x, y: at.y, pressure: Number.isFinite(e.pressure) ? e.pressure : 0.5, buttons: e.buttons | 0,
    pointer: e.pointerType || 'mouse', shift: !!e.shiftKey, alt: !!e.altKey, ctrl: !!(e.ctrlKey || e.metaKey) });
}

// The size a mark's surface is drawn at: the rule's (a unit's width and height), else the
// surface's own. style: the unit's inline style (view.js sizeOf).
export function sizeFor(style, s) {
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  return { width: px(style?.width) || s.width || SIZE.width, height: px(style?.minHeight) || s.height || SIZE.height };
}

// A key a focused surface never takes: Esc gives the room back; Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z
// undo and redo, so a stroke is taken back like any step.
const isUndo = (e) => (e.ctrlKey || e.metaKey) && !e.altKey && ['z', 'y'].includes((e.key || '').toLowerCase());

export class Surfaces {
  // The surfaces there are now, by id.
  surfaceItems() {
    const out = new Map();
    for (const s of this.slot('room.surfaces')?.items || []) if (s?.id && !out.has(s.id)) out.set(s.id, s);
    return out;
  }

  // After each drawing (view.js drawWorld): every mark whose kind asks for a surface, and every
  // rule box that does, gets its element: the one it had (so a canvas keeps what it drew and a
  // focused surface stays focused), or a new one. Those no longer drawn are left. Costs nothing
  // in a room without surfaces.
  mountSurfaces() {
    const live = (this.liveSurfaces ||= new Map());
    const items = this.surfaceItems();
    if (!items.size && !live.size) return;
    const seen = new Set();
    if (items.size) {
      for (const node of this.world$.querySelectorAll('[data-thought]')) {
        if (node.classList.contains('room-fragment')) continue; // a unit in pieces shows its kind's own picture
        const th = this.world.things[node.dataset.thought];
        const s = th && items.get(kindFor(kindOf(th)).surface);
        if (!s) continue;
        const key = `${s.id} ${th.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { width, height } = sizeFor(node.style, s);
        node.style.maxWidth = 'none';
        const host = this.surfaceHost(key, s, { mark: th.id, box: null, width, height, stamp: th.edited ?? th.at ?? 0, thing: th });
        const shown = node.firstElementChild;
        if (shown?.classList?.contains('room-gap')) host.classList.add('room-gap'); else host.classList.remove('room-gap');
        if (shown !== host) { if (shown) shown.replaceWith(host); else node.append(host); }
        this.keepSurfaceFocus(key);
      }
      const boxes = this.ont?.boxes?.(this.world, this.roomId) || [];
      for (const node of this.world$.querySelectorAll('[data-box][data-surface]')) {
        const b = boxes[+node.dataset.box];
        const s = b && items.get(b.surface);
        if (!s) continue;
        const key = `${s.id} ${this.roomId} ${node.dataset.box}`;
        seen.add(key);
        const host = this.surfaceHost(key, s, { mark: null, box: b, width: b.w, height: b.h, stamp: `${JSON.stringify(b)}|${this.tablesStamp()}`, thing: null });
        host.classList.add('room-surface-box');
        if (host.parentNode !== node) node.append(host);
        this.keepSurfaceFocus(key);
      }
    }
    for (const [key, h] of live) if (!seen.has(key)) this.leaveSurface(key, h);
  }

  // Which version of the tables is drawn: a box's surface reads the whole room (a chart of its
  // words), so it is drawn again after each change to the marks or links.
  tablesStamp() {
    const L = this.w?.lib;
    try { return L ? `${L.model.marksVersion(this.world)}.${L.links.version(this.world)}` : ''; } catch { return ''; }
  }

  // A focused surface moved into a freshly drawn element keeps the keys.
  keepSurfaceFocus(key) {
    const h = this.liveSurfaces.get(key);
    if (h?.focused && document.activeElement !== h.keys) h.keys.focus({ preventScroll: true });
  }

  // The element for one surface (key: its id and what it is drawn for), drawn again when what it
  // shows has changed (its mark's fields, its box, its size) and no gesture is under way.
  surfaceHost(key, s, o) {
    const live = this.liveSurfaces;
    let h = live.get(key);
    if (h && h.s !== s) { this.leaveSurface(key, h); h = null; }
    if (!h) {
      const keys = el('textarea', { class: 'room-surface-keys', tabindex: '-1', 'aria-label': 'Keys for this surface', readonly: true, inputmode: 'none' });
      const paper = el('div', { class: 'room-surface-paper' });
      const node = el('div', { class: 'room-surface', 'data-surface': s.id }, paper, keys);
      h = { key, s, node, paper, keys, o: null, drawn: null, gesture: null, focused: false };
      live.set(key, h);
      this.wireSurface(h);
    }
    const resized = !h.o || h.o.width !== o.width || h.o.height !== o.height;
    h.o = o;
    h.node.style.width = `${o.width}px`;
    h.node.style.height = `${o.height}px`;
    if (resized || h.drawn !== o.stamp) {
      if (h.gesture) h.stale = true; // drawn again once the gesture ends
      else this.drawSurface(h);
    }
    return h.node;
  }

  // What a surface's functions are handed: frozen plain data (ids, never rows).
  surfaceContext(h) {
    const o = h.o || {};
    return Object.freeze({ surface: h.s.id, mark: o.mark ?? null, context: this.roomId, box: o.box ?? null,
      width: o.width, height: o.height, focused: !!h.focused, el: h.paper });
  }

  // Calls one of a surface's functions; a function that throws changes nothing in the room.
  callSurface(h, name, ...args) {
    const fn = h.s[name];
    if (typeof fn !== 'function') return undefined;
    try { return fn(...args, this.surfaceContext(h)); } catch (err) { console.warn(`Surface ${h.s.id}: ${name}`, err); return undefined; }
  }

  drawSurface(h) {
    h.drawn = h.o?.stamp ?? null;
    h.stale = false;
    this.callSurface(h, 'draw', h.paper);
  }

  // The pointer, the wheel and the keys for one surface. Not focused, a press goes to the room
  // (choose it, drag it); a press let go where it began (a click) focuses it.
  wireSurface(h) {
    const { node, keys } = h;
    node.addEventListener('pointerdown', (e) => {
      if (!h.focused) {
        if (e.button !== 0 || this.locked) return;
        const from = { x: e.clientX, y: e.clientY, id: e.pointerId };
        const up = (u) => {
          if (u.pointerId !== from.id) return;
          window.removeEventListener('pointerup', up, true);
          if (Math.hypot(u.clientX - from.x, u.clientY - from.y) < 5 && node.isConnected) this.focusSurface(h);
        };
        window.addEventListener('pointerup', up, true);
        return;
      }
      e.preventDefault(); // (and no mousedown: the keys box keeps the focus)
      e.stopPropagation();
      if (h.gesture || (e.button !== 0 && e.pointerType === 'mouse')) return;
      try { node.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ }
      h.gesture = { id: e.pointerId, done: h.s.hold?.() || (() => {}) };
      this.callSurface(h, 'pointer', pointerOf('down', e, this.surfacePoint(h, e)));
    });
    const moveOrEnd = (type) => (e) => {
      if (!h.gesture || e.pointerId !== h.gesture.id) return;
      e.stopPropagation();
      this.callSurface(h, 'pointer', pointerOf(type, e, this.surfacePoint(h, e)));
      if (type !== 'move') this.endGesture(h);
    };
    node.addEventListener('pointermove', moveOrEnd('move'));
    node.addEventListener('pointerup', moveOrEnd('up'));
    node.addEventListener('pointercancel', moveOrEnd('cancel'));
    node.addEventListener('lostpointercapture', (e) => { if (h.gesture?.id === e.pointerId) { this.callSurface(h, 'pointer', pointerOf('cancel', e, this.surfacePoint(h, e))); this.endGesture(h); } });
    node.addEventListener('dblclick', (e) => { if (h.focused) e.stopPropagation(); });
    node.addEventListener('wheel', (e) => {
      if (!h.focused) return;
      const at = this.surfacePoint(h, e);
      const used = this.callSurface(h, 'wheel', Object.freeze({ x: at.x, y: at.y, dx: e.deltaX, dy: e.deltaY, ctrl: !!(e.ctrlKey || e.metaKey), shift: !!e.shiftKey }));
      if (used === true) { e.preventDefault(); e.stopPropagation(); }
    }, { passive: false });
    keys.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); this.blurSurface(h); return; }
      if (isUndo(e)) { e.preventDefault(); if (!h.gesture) this.undo(e.key.toLowerCase() === 'z' && !e.shiftKey); return; }
      const used = this.callSurface(h, 'key', Object.freeze({ key: e.key, code: e.code, shift: !!e.shiftKey, alt: !!e.altKey, ctrl: !!(e.ctrlKey || e.metaKey) }));
      if (used === true || e.key === 'Tab' || e.key === ' ') e.preventDefault();
    });
    // The keys box loses the focus when the room draws again and the surface is moved into its
    // new element (the same task puts it back), or when the focus goes somewhere else: only then
    // is the room given back.
    keys.addEventListener('blur', () => setTimeout(() => {
      if (!h.focused) return;
      const now = document.activeElement;
      if (now && now !== document.body && now !== keys) this.blurSurface(h);
      else if (h.node.isConnected) keys.focus({ preventScroll: true });
      else this.blurSurface(h);
    }, 0));
  }

  surfacePoint(h, e) {
    return localPoint(h.node.getBoundingClientRect(), h.o?.width || SIZE.width, h.o?.height || SIZE.height, e.clientX, e.clientY);
  }

  // A gesture over: its proposes land as one step, and the surface is drawn again if what it
  // shows changed meanwhile.
  endGesture(h) {
    const g = h.gesture;
    if (!g) return;
    h.gesture = null;
    try { h.node.releasePointerCapture?.(g.id); } catch { /* already let go */ }
    try { g.done(); } catch (err) { console.warn(`Surface ${h.s.id}: its step`, err); }
    if (h.stale && h.node.isConnected) this.drawSurface(h);
  }

  // Focused: the pointer, the wheel and the keys are the surface's until Esc or a click outside.
  focusSurface(h) {
    if (h.focused) return;
    for (const other of this.liveSurfaces?.values() || []) if (other !== h) this.blurSurface(other);
    h.focused = true;
    h.node.classList.add('room-surface-on');
    h.keys.focus({ preventScroll: true });
    h.outside = (e) => { if (!h.node.contains(e.target)) this.blurSurface(h); };
    document.addEventListener('pointerdown', h.outside, true);
    this.frame?.hint?.('Esc or a click outside gives the room back');
    this.callSurface(h, 'focus');
  }

  blurSurface(h) {
    if (!h.focused) return;
    this.endGesture(h);
    h.focused = false;
    h.node.classList.remove('room-surface-on');
    document.removeEventListener('pointerdown', h.outside, true);
    this.frame?.clearHint?.();
    if (document.activeElement === h.keys) h.keys.blur();
    this.callSurface(h, 'blur');
  }

  // A surface no longer drawn (its mark gone, the room left, its plugin off).
  leaveSurface(key, h) {
    this.blurSurface(h);
    this.liveSurfaces.delete(key);
    this.callSurface(h, 'leave', h.paper);
    h.node.remove();
  }

  // Whether a surface has the keys now (the room's own keys wait).
  surfaceFocused() { for (const h of this.liveSurfaces?.values() || []) if (h.focused) return true; return false; }
}
