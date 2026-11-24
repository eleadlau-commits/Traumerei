// The app's own words for the open room, the view and files (app 1.1.4; core-gaps.md gaps 1 to 3),
// in one place. Until 0.6.1 each had a fallback for 1.1.2 (the canvas's markup, a pasted path);
// 0.6.2 needs 1.1.4 and keeps only these.
//
//   roomMode(t) / onModeChange(t, fn)   the open room and its mode, from ui.chosen (and chosen.on)
//   stageBox()                          the canvas's size on the screen (to fit a column in view)
//   viewGet(t) / viewGo(t, to)          ui.zoom.get (x, y, zoom) and ui.zoom.go (eased)
//   fileHandles(t)                      a file picked (its name, size, SHA-256 and, in the desktop
//                                       app, its path), shown in its own app, hashed again

// The open room and its mode: { room, mode } or null outside a room.
export function roomMode(t) {
  const c = t.ui.chosen?.();
  return c?.context ? { room: c.context, mode: c.mode ?? t.marks.get(c.context)?.mode ?? null } : null;
}

// fn({ room, mode }) once after each change of room or of its mode (fn(null) on leaving every
// room). Returns a function that stops it.
export function onModeChange(t, fn) {
  const key = (rm) => (rm ? `${rm.room}|${rm.mode}` : '');
  let was = key(roomMode(t));
  const check = () => {
    const now = roomMode(t);
    if (key(now) === was) return;
    was = key(now);
    try { fn(now); } catch (err) { console.error(err); }
  };
  // ui.zoom.on hears a room opened at once, before the choice settles.
  const stops = [t.ui.chosen.on(check), t.ui.zoom?.on?.(check)];
  return () => { for (const s of stops) s?.(); };
}

// The canvas of the open room on the screen (the stage that shows), or null. (The API gives the
// view's centre and zoom, not the canvas's size.)
export function stageBox() {
  if (typeof document === 'undefined') return null;
  const stage = [...document.querySelectorAll('.room-stage')].find((s) => s.offsetParent);
  const b = stage?.getBoundingClientRect();
  return b && b.width ? { stage, width: b.width, height: b.height } : null;
}

// Where the view is: { x, y, zoom } (the world point at the middle of the canvas), or null.
export function viewGet(t) {
  const z = t.ui.zoom?.get?.();
  return z && Number.isFinite(z.x) ? { x: z.x, y: z.y, zoom: z.zoom } : null;
}
// The view moved to `to` ({ x, y, zoom? }) in one eased move. true when it could be done.
export const viewGo = (t, to, ms) => t.ui.zoom?.go?.(to, ms == null ? undefined : { ms })?.ok === true;

// The SHA-256 of some bytes, as 64 hex digits (Web Crypto; no text is kept).
export async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Files outside the room, by path and hash. `native`: the app hands out paths (the desktop app; in
// a browser show and hash are there but refuse, so it is known from the first file picked).
//   pick(accept)      → { name, bytes, sha256, path } or null (path null in a browser)
//   show(path, page)  → true when the app opened it; else false (the caller copies path and page)
//   hash(path)        → { sha256 (64 hex digits), bytes } or null
export function fileHandles(t) {
  const f = t.ui.files || {};
  let native = false;
  return {
    get native() { return native; },
    async pick(accept = '') {
      const file = await f.open?.(accept);
      if (!file) return null;
      const buf = await file.arrayBuffer();
      const path = typeof file.path === 'string' && file.path ? file.path : null;
      if (path) native = true;
      return { name: file.name, bytes: buf.byteLength, sha256: await sha256(buf), path };
    },
    async show(path, page = null) { return typeof f.show === 'function' ? (await f.show(path, page == null ? {} : { page }))?.ok === true : false; },
    async hash(path) {
      const h = typeof f.hash === 'function' ? await f.hash(path) : null;
      return h ? { sha256: String(h.sha256 || '').replace(/^sha256:/i, ''), bytes: h.bytes } : null;
    },
  };
}
