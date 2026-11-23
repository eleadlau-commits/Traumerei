// Reading notes: a Zotero-like library in a room. One room is one library, seen as **Library**:
// each source (a book, an article, a chapter, a web page) has its metadata and a citation key, and
// a stream of notes. The sources are listed in the left dock, the open source's details are in the
// right dock, and the canvas holds each source's notes as a column, the open one in view. Choose a
// source, type, Enter: the note lands at the end of its stream, or right after the chosen note.
//
// A plugin, shipped as reading.traumplug (never built in). It reaches the app only through the
// plugin API (app/core/API.md): slots.groups, slots.rules, slots.commands, slots.menu, the tables,
// carriers (New library), ui.docks, ui.zoom, ui.choose. Saved data: none outside the tables (Law
// 8). No source text is ever kept, in the room or anywhere else. Core gaps sit behind the fallback
// helpers in compat.js (core-gaps.md).

import { Feature, ui } from 'folio';
import { RULE, SOURCE, FIELDS, isSource, tidySource, sourcesIn, notesOf, sourceOf, layout, landing, autoKey, uniqueKey, keysIn, libraryTraum } from './rules.js';
import { onModeChange, roomMode, viewGet, viewGo, stageBox } from './compat.js';
import { installDocks } from './docks.js';

const ICON = '<path d="M5 4h4v16H5zM10 4h4v16h-4z"/><path d="M15.5 4.6l3.8-1 3.6 15.5-3.8 1z"/>';

export function install(t) {
  // How words wrap is pure (the same words and width, the same answer): remembered.
  const wraps = new Map();
  const measure = (text, width) => {
    const k = `${width}|${text}`;
    let m = wraps.get(k);
    if (!m) { if (wraps.size > 6000) wraps.clear(); m = t.ui.measure(text, width); wraps.set(k, m); }
    return m;
  };
  const here = () => t.ui.chosen()?.context || null;
  const inLibrary = () => { const r = here(); return !!r && t.marks.get(r)?.mode === RULE; };
  const say = (r) => { if (r && r.ok === false && r.reason) t.ui.toast(r.reason); return r; };

  // ---- The shape: a source is a group of its own family, its metadata the group's fields ----
  t.slots.groups.add({ id: SOURCE, name: 'Source', membership: 'one', order: 'kept', fields: [...FIELDS], tidy: tidySource });

  // The source open in each library (this session's: which one you are reading is not content).
  const opened = new Map();
  const openOf = (r) => {
    const s = opened.get(r);
    if (s && isSource(t.marks.get(s)) && t.places.home(s) === r) return s;
    return sourcesIn(t, r)[0]?.id || null;
  };

  // ---- The Library rule ----
  t.slots.rules.add({
    id: RULE, name: 'Library', note: 'a library of sources: each one\'s notes in a column, its details in the docks', icon: ICON, order: 32,
    claims: [SOURCE],
    arrange: (reads, context) => layout(reads, context, measure).rows,
    draw: (reads, context) => layout(reads, context, measure).boxes,
    land: (reads, context, mark, x, y) => landing(reads, context, mark, x, y, openOf(context), layout(reads, context, measure)),
    hand: false,
  });

  // ---- Opening a source: the docks follow, the view slides to its column, its last note chosen ----
  const jump = (r, id) => {
    const col = layout(t, r, measure).columns.find((c) => c.source === id);
    if (!col) return false;
    const z = viewGet(t)?.zoom || t.ui.zoom?.get?.()?.zoom || 1;
    const h = (stageBox()?.height || 800) / z;
    return viewGo(t, { x: col.x, y: col.top - 80 + h / 2, zoom: z });
  };
  // draw: false when a dock field is being written (its own dock keeps the caret).
  const open = (id, { go = true, draw = true } = {}) => {
    const r = t.places.home(id);
    if (!r || !isSource(t.marks.get(id))) return false;
    opened.set(r, id);
    if (here() === r) {
      const last = notesOf(t, id).at(-1);
      if (last && draw && t.ui.chosen()?.mark !== last) t.ui.choose?.([last]);
      if (go) jump(r, id);
    }
    if (draw) docks.draw(true);
    docks.lit();
    return true;
  };
  const step = (dir) => {
    const r = here();
    if (!r) return;
    const all = sourcesIn(t, r);
    if (!all.length) { t.ui.toast('No sources yet. Alt+Shift+N makes one.'); return; }
    const i = all.findIndex((s) => s.id === openOf(r));
    open(all[Math.max(0, Math.min(all.length - 1, i + dir))].id);
  };

  // A new source in the open library, opened, its Title ready to write; one step.
  const newSource = () => {
    const r = here();
    if (!r || !inLibrary()) return null;
    if (t.distance.shut(r)) { t.ui.toast('This library is locked.'); return null; }
    const citekey = uniqueKey(autoKey({ title: 'Untitled' }), keysIn(t, r));
    const made = say(t.marks.make({ kind: 'group', content: { title: 'Untitled', of: SOURCE, type: 'book', citekey }, in: r }));
    if (!made?.ok) return null;
    open(made.id);
    docks.focus('title');
    return made.id;
  };

  // A new library: a room already seen as Library, landed from a .traum (a plugin can't set a
  // room's mode; the file carries it), then gone into.
  const newLibrary = () => {
    const got = t.carriers.read(libraryTraum('Library'));
    const out = got ? say(t.carriers.land(got)) : { ok: false };
    if (!out?.ok) { if (!got) t.ui.toast('The new library could not be made.'); return null; }
    t.ui.open?.room?.(out.id);
    return out.id;
  };

  const docks = installDocks(t, { room: here, inLibrary, openOf, open, newSource });

  // In a room seen as Library: the docks, and the first source in view (once per visit).
  let visit = null;
  const settle = (rm) => {
    docks.sync(rm);
    if (!rm || rm.mode !== RULE || visit === rm.room) { if (!rm || rm.mode !== RULE) visit = null; return; }
    visit = rm.room;
    const go = () => { if (here() === rm.room) { const s = openOf(rm.room); if (s) open(s); } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else go();
  };
  onModeChange(t, settle);
  settle(roomMode(t));

  // ---- Keys ----
  const cmd = (o) => t.slots.commands.add({ order: 74, ...o });
  cmd({ id: 'reading.new-source', keys: ['Alt+Shift+N'], zone: 'room', words: 'a new source in this library', when: inLibrary, run: () => newSource() });
  cmd({ id: 'reading.next-source', keys: ['Alt+ArrowDown'], zone: 'room', words: 'open the next source', when: inLibrary, run: () => step(1) });
  cmd({ id: 'reading.previous-source', keys: ['Alt+ArrowUp'], zone: 'room', words: 'open the previous source', when: inLibrary, run: () => step(-1) });
  cmd({ id: 'reading.new-library', zone: 'everywhere', words: 'a new library: a room seen as Library', run: () => newLibrary() });
  t.slots.menu.add({ id: 'reading.library', label: 'New library', icon: 'book', order: 64, onClick: () => newLibrary() });

  // A note chosen (clicked, or walked to) opens its source: the docks follow, the view stays.
  t.ui.chosen.on?.((c) => {
    if (!c?.context || !c.mark || t.marks.get(c.context)?.mode !== RULE) return;
    const src = sourceOf(t, c.mark);
    if (src && opened.get(c.context) !== src) { opened.set(c.context, src); docks.draw(); docks.lit(); }
  });

  // The first note of an empty source: the room set the thought where the view was, so the view
  // goes back to the column it now heads.
  t.links.on(({ rows, undone }) => {
    const r = here();
    if (undone || !r || !inLibrary()) return;
    for (const row of rows || []) {
      const l = row.link ? t.links.get(row.link) : null;
      if (l?.kind !== 'part of' || l.to !== openOf(r) || notesOf(t, l.to).length !== 1) continue;
      const go = () => jump(r, l.to);
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); else go();
    }
  });

  return { open, openOf, newSource, newLibrary, sourceOf: (id) => sourceOf(t, id) };
}

export default class Reading extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Reading notes needs the plugin API');
    install(t);
  }
}
