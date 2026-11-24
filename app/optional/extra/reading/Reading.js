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
import { RULE, SOURCE, QUOTE, COMMENT, EDITION, FIELDS, isSource, tidySource, sourcesIn, notesOf, sourceOf, layout, landing, dropAt,
  autoKey, uniqueKey, keysIn, libraryTraum, parseQuote, isQuote, aboutOf, streamOf, quoteOf, COLUMN } from './rules.js';
import { asQuote, toggleQuote, move, nest, unnest, step as stepNote, tidy, newEdition, setEditionOf, syncTags } from './notes.js';
import { TAG, tagSpans } from './find.js';
import { onModeChange, roomMode, viewGet, viewGo, stageBox, fileHandles } from './compat.js';
import { attachment, fullPath, pathAndPage, filePage, verify as sameFile, linkOf } from './files.js';
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
  t.slots.groups.add({ id: TAG, name: 'Tag', membership: 'many', order: 'time' });

  // The source open in each library (this session's: which one you are reading is not content).
  const opened = new Map();
  const openOf = (r) => {
    const s = opened.get(r);
    if (s && isSource(t.marks.get(s)) && t.places.home(s) === r) return s;
    return sourcesIn(t, r)[0]?.id || null;
  };

  t.slots.linkKinds.add({ kind: QUOTE, name: 'quotes', note: 'a quote from a source; its label the printed page', quiet: true,
    admit: (from, to, reads) => (isSource(reads.marks.get(to)) ? true : 'A quote is from a source') });
  t.slots.linkKinds.add({ kind: COMMENT, name: 'comments on', note: 'a comment under the quote it is about', quiet: true });
  t.slots.linkKinds.add({ kind: EDITION, name: 'edition of', note: 'a source that is another edition of a source', quiet: true,
    admit: (from, to, reads) => (isSource(reads.marks.get(from)) && isSource(reads.marks.get(to)) ? true : 'An edition joins two sources') });

  // Something done just after a gesture, as its own step (no proposal links a note): Book's way.
  const later = (fn) => setTimeout(() => say(fn()), 0);

  // ---- The Library rule ----
  // The layout last drawn in each library: a drop asked of it (the room's clear-space nudges a
  // mark it finds too close by calling drop) costs no new layout.
  const last = new Map();
  const laid = (reads, context) => { const L = layout(reads, context, measure); last.set(context, L); return L; };
  t.slots.rules.add({
    id: RULE, name: 'Library', note: 'a library of sources: each one\'s notes in a column, its details in the docks', icon: ICON, order: 32,
    claims: [SOURCE, TAG],
    arrange: (reads, context) => laid(reads, context).rows,
    draw: (reads, context) => (last.get(context) || laid(reads, context)).boxes,
    land: (reads, context, mark, x, y) => {
      const L = layout(reads, context, measure);
      const p = landing(reads, context, mark, x, y, openOf(context), L);
      // Just after: a quote typed ('"…" p. 112') linked with its page; a note written after a quote
      // (or a comment under it) a comment under that quote.
      const after = L.rows.find((r) => r.mark !== mark && Math.abs(r.x - x) < 1 && Math.abs(r.y - y) < 1)?.mark || null;
      later(() => kept(mark, after));
      return p;
    },
    // A note dragged: where it is let go reads as a place in a stream (dropAt), done just after
    // the gesture as one step (a comment's link moves with it, which no proposal can do).
    drop: (reads, context, mark, x, y) => {
      const L = last.get(context);
      if (!L || ownRow(L, mark, x, y)) return null;
      const to = dropAt(reads, context, mark, x, y, L);
      if (to) later(() => move(t, mark, to));
      return null;
    },
    hand: false,
  });
  // Inside its own row (half a row's air): no move (the room's clear-space nudges, Book 0.4.7).
  const ownRow = (L, mark, x, y) => L.rows.some((r) => r.mark === mark && Math.abs(r.x - x) <= r.width / 2 && Math.abs(r.y - y) <= r.height / 2 + 14);

  // A note just kept with Enter: a quote, or a comment under the quote it was written after.
  // And its #tags: in each tag it names. All one step.
  const kept = (mark, after) => {
    const m = t.marks.get(mark);
    if (!m || m.kind !== 'line') return null;
    return t.together(() => { const r = shape(mark, after, m); syncTags(t, mark); return r; });
  };
  const shape = (mark, after, m) => {
    if (parseQuote(m.text)) return asQuote(t, mark);
    const src = sourceOf(t, mark);
    if (!after || !src || sourceOf(t, after) !== src) return null;
    const q = isQuote(t, after) ? after : aboutOf(t, after);
    if (!q || !isQuote(t, q) || sourceOf(t, q) !== src) return null;
    const kids = streamOf(t, src).filter((n) => n.under === q).map((n) => n.id).filter((id) => id !== mark);
    const before = after === q ? (kids[0] || null) : (kids[kids.indexOf(after) + 1] || null);
    return move(t, mark, { source: src, under: q, before });
  };

  // A note edited to read as a quote ('"…" p. 113'): its page taken off its words into the link;
  // edited to name other #tags: in those tags. Done just after, as one step.
  t.marks.on(({ rows, undone }) => {
    if (undone || (rows || []).some((r) => r.kind === 'undone' || r.kind === 'redone')) return;
    for (const r of rows || []) {
      if (r.kind !== 'edited' || !r.mark) continue;
      const m = t.marks.get(r.mark);
      if (!m || m.kind !== 'line') continue;
      const home = t.places.home(r.mark);
      if (!home || t.marks.get(home)?.mode !== RULE) continue;
      const id = r.mark;
      const q = sourceOf(t, id) ? parseQuote(m.text) : null;
      later(() => t.together(() => { const a = q && (q.anchor || !isQuote(t, id)) ? asQuote(t, id) : null; syncTags(t, id); return a; }));
    }
  });

  // Quotes read as quotes: in italic (the room's class), known once per change of links.
  let quotes = null;
  t.links.on(() => { quotes = null; });
  t.slots.decorators.add({ id: 'reading.quotes', decorate: (text, mark) => {
    if (!mark?.id || !text) return [];
    if (!quotes) quotes = new Set();
    let q = quotes.has(mark.id);
    if (!q && !quotes.has(`-${mark.id}`)) { q = isQuote(t, mark.id); quotes.add(q ? mark.id : `-${mark.id}`); }
    return q ? [{ from: 0, to: text.length, class: 'italic' }] : [];
  } });
  // #tags read as tags (the room's quiet class), in the thought being written too.
  t.slots.decorators.add({ id: 'reading.tags', decorate: (text) => (text && text.includes('#') && inLibrary() ? tagSpans(text).map((sp) => ({ ...sp, class: 'quiet' })) : []) });

  // ---- Opening a source: the docks follow, the view slides to its column, its last note chosen ----
  // The view slid to a point of the canvas (x the column's middle, y the point to put at `top` of
  // the canvas, else in its middle), the whole column in view: zoomed out when the canvas between
  // the docks is narrower.
  const slide = (x, y, top = true) => {
    const box = stageBox();
    const now = viewGet(t)?.zoom || t.ui.zoom?.get?.()?.zoom || 1;
    const z = box?.width ? Math.min(now, box.width / (COLUMN.width + 48)) : now;
    const h = (box?.height || 800) / z;
    return viewGo(t, { x, y: top ? y - 80 + h / 2 : y, zoom: z });
  };
  const jump = (r, id) => {
    const col = layout(t, r, measure).columns.find((c) => c.source === id);
    return col ? slide(col.x, col.top) : false;
  };
  // A note gone to (a result of Find): its source opened, the view slid to it, it chosen.
  const goTo = (id) => {
    const r = t.places.home(id);
    const src = sourceOf(t, id);
    if (!r || !t.marks.get(id)) return false;
    if (here() !== r) { t.ui.open?.mark?.(id); return true; }
    if (src) opened.set(r, src);
    const L = layout(t, r, measure);
    const row = L.rows.find((x) => x.mark === id);
    const col = L.columns.find((c) => c.notes.includes(id));
    if (row && col) slide(col.x, row.y, false);
    t.ui.choose?.([id]);
    docks.draw(); docks.lit();
    return true;
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

  // ---- Linked files: the room keeps path, name, size, SHA-256 and page offset; the library folder
  // is this computer's (t.store, one per library), never in the .traum ----
  const handles = fileHandles(t);
  const folderOf = (r) => (r ? String(t.store?.get?.(`folder.${r}`, '') || '') : '');
  const setFolder = (r, v) => { if (!r) return; if (v) t.store?.set?.(`folder.${r}`, v); else t.store?.remove?.(`folder.${r}`); };
  const fileOf = (id) => { const s = t.marks.get(id); return isSource(s) && s.file?.rel ? s.file : null; };
  const pick = async () => { try { return await handles.pick(); } catch { t.ui.toast('The file could not be read.'); return null; } };
  const attach = (id, got, path) => {
    const r = t.places.home(id);
    const { file, folder } = attachment(got, path || got.path, folderOf(r), fileOf(id)?.pageOffset || 0);
    if (folder) setFolder(r, folder);
    const out = say(t.marks.edit(id, { file }));
    if (out?.ok !== false) t.ui.toast(folder ? `Attached. The library folder on this computer is now ${folder}.` : 'Attached.');
    return out;
  };
  const setOffset = (id, n) => { const f = fileOf(id); if (f && f.pageOffset !== n) say(t.marks.edit(id, { file: { ...f, pageOffset: n } })); };
  const detach = (id) => { if (fileOf(id)) say(t.marks.edit(id, { file: null })); };
  const copy = async (words) => {
    if (!words) return false;
    try { await navigator.clipboard.writeText(words); t.ui.toast(`Copied: ${words}`); return true; } catch { t.ui.toast(words); return false; }
  };
  const copyPath = (id) => { const f = fileOf(id); return f ? copy(pathAndPage(f, folderOf(t.places.home(id)))) : (t.ui.toast('This source has no file.'), false); };
  const verifyFile = async (id) => {
    const f = fileOf(id);
    if (!f) return null;
    const got = await pick();
    if (!got) return null;
    const v = sameFile(f, got);
    t.ui.toast(v === 'same' ? `The same file (${f.name}).` : v === 'changed' ? `${got.name} has changed since it was attached. Attach it again to keep the new one.` : `That is another file (${got.name}), not ${f.name}.`);
    return v;
  };
  const showFile = (id, anchor = '') => {
    const f = fileOf(id);
    if (!f) return false;
    const page = anchor ? filePage(anchor, f.pageOffset) : null;
    return handles.show(fullPath(folderOf(t.places.home(id)), f.rel), page);
  };
  const openLink = (id) => { const url = linkOf(t.marks.get(id)); if (!url) { t.ui.toast('This source has no DOI or https URL.'); return false; } return t.ui.link(url) !== false; };
  // The chosen quote's path and page (Alt+Shift+P): its source's file, its page and the file's page.
  const copyQuote = () => {
    const c = t.ui.chosen();
    const id = c?.mark;
    const r = here();
    const src = id ? (isSource(t.marks.get(id)) ? id : sourceOf(t, id)) : (r ? openOf(r) : null);
    if (!src) { t.ui.toast('Choose a quote or a source first.'); return false; }
    const f = fileOf(src);
    if (!f) { t.ui.toast('Its source has no file: attach one in Details.'); return false; }
    const anchor = id && id !== src ? (quoteOf(t, id)?.label || '') : '';
    return copy(pathAndPage(f, folderOf(t.places.home(src)), anchor));
  };

  const docks = installDocks(t, { room: here, inLibrary, openOf, open, goTo, newSource,
    folder: folderOf, setFolder, pick, attach, setOffset, copyPath, showFile, canShow: () => handles.native, verify: verifyFile, detach, openLink, newEdition: () => edition(), setEditionOf: (src, main) => say(setEditionOf(t, src, main)) });

  // In a room seen as Library: the docks, and the first source in view (once per visit).
  let visit = null;
  const settle = (rm) => {
    const opening = docks.sync(rm);
    if (!rm || rm.mode !== RULE || visit === rm.room) { if (!rm || rm.mode !== RULE) visit = null; return; }
    visit = rm.room;
    // Once the docks are open (the canvas between them is its width then), the open source in view.
    const go = () => { if (here() === rm.room) { const s = openOf(rm.room); if (s) open(s); } };
    const soon = () => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(go)); else go(); };
    Promise.resolve(opening).then(soon, soon);
  };
  onModeChange(t, settle);
  settle(roomMode(t));

  // ---- Keys ----
  const cmd = (o) => t.slots.commands.add({ order: 74, ...o });
  cmd({ id: 'reading.new-source', keys: ['Alt+Shift+N'], zone: 'room', words: 'a new source in this library', when: inLibrary, run: () => newSource() });
  cmd({ id: 'reading.next-source', keys: ['Alt+ArrowDown'], zone: 'room', words: 'open the next source', when: inLibrary, run: () => step(1) });
  cmd({ id: 'reading.previous-source', keys: ['Alt+ArrowUp'], zone: 'room', words: 'open the previous source', when: inLibrary, run: () => step(-1) });
  const chosen = () => { const c = t.ui.chosen(); return c?.mark && t.marks.get(c.mark)?.kind === 'line' ? c.mark : null; };
  const onNote = () => inLibrary() && !!chosen();
  const keep = (fn) => () => { const id = chosen(); if (id) say(fn(id)); };
  cmd({ id: 'reading.quote', keys: ['Alt+Q'], zone: 'room', words: 'the chosen note a quote, or a quote a note again', when: onNote, run: keep((id) => toggleQuote(t, id)) });
  cmd({ id: 'reading.nest', keys: ['Alt+ArrowRight'], zone: 'room', words: 'the chosen note a comment on the quote before it', when: onNote, run: keep((id) => nest(t, id)) });
  cmd({ id: 'reading.unnest', keys: ['Alt+ArrowLeft'], zone: 'room', words: 'the chosen comment out from under its quote', when: onNote, run: keep((id) => unnest(t, id)) });
  cmd({ id: 'reading.note-up', keys: ['Alt+Shift+ArrowUp'], zone: 'room', words: 'move the chosen note up its stream', when: onNote, run: keep((id) => stepNote(t, id, -1)) });
  cmd({ id: 'reading.note-down', keys: ['Alt+Shift+ArrowDown'], zone: 'room', words: 'move the chosen note down its stream', when: onNote, run: keep((id) => stepNote(t, id, 1)) });
  const edition = () => {
    const r = here(), src = r ? openOf(r) : null;
    const out = say(src ? newEdition(t, src) : { ok: false, reason: 'Open a source first.' });
    if (out?.ok) { open(out.id); docks.focus('edition'); }
    return out?.id || null;
  };
  cmd({ id: 'reading.new-edition', keys: ['Alt+Shift+E'], zone: 'room', words: 'a new edition of the open source', when: inLibrary, run: () => edition() });
  cmd({ id: 'reading.copy-path', keys: ['Alt+Shift+P'], zone: 'room', words: 'copy the chosen quote\'s file path and page', when: inLibrary, run: () => copyQuote() });
  cmd({ id: 'reading.open-link', keys: ['Alt+Shift+O'], zone: 'room', words: 'open the open source\'s DOI or URL in the browser', when: inLibrary, run: () => { const r = here(); const s = r ? openOf(r) : null; if (s) openLink(s); } });
  cmd({ id: 'reading.find', keys: ['Alt+F'], zone: 'room', words: 'find in this library\'s notes: words, #tag', when: inLibrary, run: () => docks.focusFind() });
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

  return { open, openOf, goTo, newSource, newLibrary, newEdition: edition, sourceOf: (id) => sourceOf(t, id), kept, attach, setOffset, detach, folderOf, setFolder, copyQuote, openLink };
}

export default class Reading extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Reading notes needs the plugin API');
    install(t);
  }
}
