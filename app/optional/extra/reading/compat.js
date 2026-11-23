// The fallback helpers (core-gaps.md, "Fallback helpers from day one"): each core gap sits behind
// one small helper. A helper uses the new API when the app has it and falls back to the workaround
// when it doesn't, so the plugin works on 1.1.2 and switches over with no rewrite when core ships.
//
//   onModeChange(t, fn)   ui.chosen() carrying `mode` with ui.chosen.on, else watch the canvas's
//                         data-mode (the workaround from Book 0.4.6's docks.js)
//   viewGet(t)            ui.zoom.get() giving x, y, else read the canvas transform (Book's zoom.js)
//   viewGo(t, to)         ui.zoom.go, else eased t.ui.zoom.set steps (Book's zoom.js)
//   fileHandles(t)        ui.files path / show / hash, else a pasted path and picking it again
//
// Only the plugin API and the page's own markup (read, never written).

import { setsFor, between, ease, moveMs, viewFromTransform } from './view.js';

const hasDoc = () => typeof document !== 'undefined';

// The open room and its mode: { room, mode } or null outside a room.
export function roomMode(t) {
  const c = t.ui.chosen?.();
  if (!c?.context) return null;
  return { room: c.context, mode: 'mode' in c ? c.mode : (t.marks.get(c.context)?.mode ?? null) };
}
// Whether the app says the mode itself (the core addition asked for in core-gaps.md).
export const nativeMode = (t) => { const c = t.ui.chosen?.(); return !!c && 'mode' in c; };

// fn({ room, mode }) once after each change of room or of its mode (and fn(null) on leaving every
// room). Returns a function that stops it.
export function onModeChange(t, fn) {
  let was;
  const key = (rm) => (rm ? `${rm.room}|${rm.mode}` : '');
  const check = () => {
    const now = roomMode(t);
    if (key(now) === was) return;
    was = key(now);
    try { fn(now); } catch (err) { console.error(err); }
  };
  was = key(roomMode(t));
  const stops = [];
  if (t.ui.chosen?.on) stops.push(t.ui.chosen.on(check));
  if (t.ui.zoom?.on) stops.push(t.ui.zoom.on(check)); // a change of room is heard here at once
  if (t.marks?.on) stops.push(t.marks.on(check));
  // The workaround: a change of mode has no event in API 3; the room's canvas says it (data-mode).
  if (typeof MutationObserver !== 'undefined' && hasDoc()) {
    const mo = new MutationObserver(() => { if (!nativeMode(t)) check(); });
    mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-mode'] });
    stops.push(() => mo.disconnect());
  }
  return () => { for (const s of stops) try { s?.(); } catch { /* gone already */ } };
}

// The canvas of the open room on the screen (the stage that shows), or null.
export function stageBox() {
  if (!hasDoc()) return null;
  const stage = [...document.querySelectorAll('.room-stage')].find((s) => s.offsetParent);
  const b = stage?.getBoundingClientRect();
  return b && b.width ? { stage, width: b.width, height: b.height } : null;
}

// Where the view is: { x, y, zoom } (the world point at the middle of the canvas), or null.
export function viewGet(t) {
  const z = t.ui.zoom?.get?.();
  if (!z) return null;
  if (Number.isFinite(z.x) && Number.isFinite(z.y)) return { x: z.x, y: z.y, zoom: z.zoom };
  const s = stageBox();
  if (!s) return null;
  try { return viewFromTransform(s.stage.querySelector(':scope > .room-world')?.style.transform, s.width, s.height, z.zoom); } catch { return null; }
}

// The view moved to `to` ({ x, y, zoom? }) in one eased move (at once when the system asks for
// less motion); the person's own wheel or drag stops it. true when it could be done.
let frame = 0;
export function viewGo(t, to, { ms = null } = {}) {
  if (typeof t.ui.zoom?.go === 'function') { const r = t.ui.zoom.go(to, ms == null ? undefined : { ms }); return r?.ok !== false; }
  const from = viewGet(t);
  if (!from) return false;
  const goal = { x: to.x, y: to.y, zoom: to.zoom ?? from.zoom };
  const apply = (a, b) => { for (const s of setsFor(a, b)) t.ui.zoom.set(s.zoom, s.at); };
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const long = ms ?? moveMs(from, goal);
  if (still || typeof requestAnimationFrame !== 'function' || long <= 0) { apply(from, goal); return true; }
  const t0 = performance.now(), room0 = t.ui.chosen?.()?.context;
  let was = from;
  const step = (now) => {
    const cur = viewGet(t);
    if (!cur || t.ui.chosen?.()?.context !== room0 || Math.abs(cur.zoom - was.zoom) > 1e-6 || Math.hypot(cur.x - was.x, cur.y - was.y) * cur.zoom > 1) return;
    const u = Math.min(1, (now - t0) / long);
    const next = u >= 1 ? goal : between(from, goal, ease(u));
    apply(cur, next);
    was = viewGet(t) || next;
    if (u < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return true;
}

// The SHA-256 of some bytes, as 64 hex digits (Web Crypto; no text is kept).
export async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Files outside the room, by path and hash. `native` says whether the app hands out paths.
//   pick(accept)      → { name, bytes, sha256, path } or null (path null without the core addition)
//   show(path, page)  → true when the app opened it; else false (the caller copies path and page)
//   hash(path)        → { sha256, bytes } or null (null without the core addition: pick it again)
export function fileHandles(t) {
  const f = t.ui.files || {};
  const native = typeof f.show === 'function' && typeof f.hash === 'function';
  return {
    native,
    async pick(accept = '') {
      const file = await f.open?.(accept);
      if (!file) return null;
      const buf = await file.arrayBuffer();
      return { name: file.name, bytes: buf.byteLength, sha256: await sha256(buf), path: typeof file.path === 'string' ? file.path : null };
    },
    async show(path, page = null) { return native ? (await f.show(path, page == null ? {} : { page }))?.ok !== false : false; },
    async hash(path) { return native ? (await f.hash(path)) || null : null; },
  };
}
