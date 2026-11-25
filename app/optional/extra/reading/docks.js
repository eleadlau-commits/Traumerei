// Reading notes' two docks, in a room seen as Library. Left, Sources: every source of the library
// (citation key, author and year, title, how many notes), the open one lit; a click or Enter opens
// one, ArrowUp / ArrowDown walk the list, New source makes one. Right, Details: the open source's
// metadata, written in place. Keyboard first: Enter keeps a field, Ctrl+Enter is a new line in the
// fields that take several (title, authors), Escape puts it back as it was. No floating windows.
// Only the plugin API (t.ui.docks) and Folio's ui.el; the look is Folio's classes.

import { ui } from 'folio';
import { find, tagsOf, snippet } from './find.js';
import { collectionTree, sourcesUnder, collectionsOf, collectionLanding, zoneOf } from './collections.js';
import { fullPath, sizeOf, linkOf, offsetOf, isAbsolute } from './files.js';
import { isLibraryMode, TYPES, isSource, sourcesIn, notesOf, authorYear, autoKey, uniqueKey, validKey, keysIn, editionOf, editionsOf } from './rules.js';

const { el } = ui;
export const LEFT = 'reading.sources';
export const RIGHT = 'reading.details';

// The fields of the Details dock: [field, label, how it is written]. `many`: Ctrl+Enter is a new line.
export const FORM = Object.freeze([
  ['title', 'Title', 'many'],
  ['authors', 'Authors (one a line: Family, Given)', 'many'],
  ['year', 'Year'],
  ['type', 'Type', 'choice'],
  ['citekey', 'Citation key'],
  ['container', 'Journal or book'],
  ['edition', 'Edition'],
  ['volume', 'Volume'],
  ['issue', 'Issue'],
  ['pages', 'Pages'],
  ['publisher', 'Publisher'],
  ['doi', 'DOI'],
  ['url', 'URL'],
  ['isbn', 'ISBN'],
]);

// A field's words as the dock shows them.
export function shown(src, field) {
  if (field === 'authors') return (src.authors || []).join('\n');
  return src[field] == null ? '' : String(src[field]);
}

// The edit a field's new words make on a source, as { fields } to pass to marks.edit, or
// { reason } when they can't be kept, or null when nothing changes. A citation key still as it
// was made follows the authors, year and title (made unique in the library); one typed stays.
// taken: the keys of the library's other sources.
export function editFor(src, field, words, taken) {
  const now = shown(src, field);
  const typed = String(words ?? '');
  if (typed === now) return null;
  if (field === 'citekey') {
    const k = typed.trim();
    if (!k) return { reason: 'A source needs a citation key.' };
    if (!validKey(k)) return { reason: 'A citation key takes letters, digits and _ : . - only.' };
    if (taken.has(k)) return { reason: `Another source has the key ${k}.` };
    return { fields: { citekey: k } };
  }
  const value = field === 'authors' ? typed.split('\n') : field === 'title' ? (typed.replace(/\s*\n\s*/g, ' ').trim() || 'Untitled') : typed;
  const fields = { [field]: field === 'title' ? value : (Array.isArray(value) ? value : (value.trim() === '' ? null : value)) };
  if (['authors', 'year', 'title'].includes(field) && followsAuto(src, taken)) {
    const next = { authors: src.authors, year: src.year, title: src.title, ...fields };
    if (field === 'authors') next.authors = value.map((s) => s.trim()).filter(Boolean);
    fields.citekey = uniqueKey(autoKey(next), taken);
  }
  return { fields };
}
// Whether a source's key is still the one it was given (its auto key, or that with a letter added).
export function followsAuto(src, taken) {
  const base = autoKey(src);
  const k = String(src.citekey || '');
  return k === base || (k.startsWith(base) && /^[a-z]+$/.test(k.slice(base.length)));
}

// docks({ room, inLibrary, openOf, open, goTo, newSource, deleteSource, newEdition, setEditionOf, folder, setFolder,
//   pick, attach, setOffset, copyPath, showFile, canShow, verify, detach, openLink }) → { sync, draw, focus, lit, focusFind, closeAll }
export function installDocks(t, o) {
  const docks = () => t.ui.docks || null;
  let left = null, right = null; // the bodies, while open
  let busy = false;

  const btn = (label, fn, cls = '') => el('button', { type: 'button', class: `box-btn ${cls}`.trim(), onclick: fn }, label);

  // ---- Left: Sources ----
  // A source's editions fold into its line ("2 editions"); unfolded with → (or a click on the
  // count), folded with ←; the open one's always shown. This session's, per source.
  const unfolded = new Set();
  // Find: words and #tags across the library's notes and sources (this session's query). The field
  // is made once, so redrawing the dock never takes the caret from it.
  let query = '';
  let findBox = null, tagRow = null, body = null;
  const makeFind = () => {
    const input = el('input', { type: 'search', id: 'reading-find', class: 'reading-find', placeholder: 'Find: words, #tag', 'aria-label': 'Find in notes', spellcheck: 'false', autocomplete: 'off' });
    input.addEventListener('input', () => { query = input.value; drawBody(); drawTags(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (input.value) { input.value = query = ''; drawBody(); drawTags(); } else input.blur(); }
      else if (e.key === 'Enter') { e.preventDefault(); body?.querySelector('.pick')?.click(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); body?.querySelector('.pick')?.focus(); }
    });
    return input;
  };
  const setQuery = (q) => { query = q; if (findBox) findBox.value = q; drawBody(); drawTags(); };
  // The library's tags, each a word that adds itself to (or takes itself out of) the query.
  const drawTags = () => {
    if (!tagRow) return;
    const r = o.room();
    const tags = r ? tagsOf(t, r) : [];
    const on = new Set((query.match(/#[^\s#]+/g) || []).map((w) => w.slice(1).toLowerCase()));
    tagRow.replaceChildren(...tags.map((g) => el('button', { type: 'button', class: `box-btn reading-tag${on.has(g.word) ? ' st-sel' : ''}`, 'aria-pressed': on.has(g.word) ? 'true' : 'false', title: `${g.notes} ${g.notes === 1 ? 'note' : 'notes'}`,
      onclick: () => {
        const tag = `#${g.word}`;
        const parts = query.split(/\s+/).filter(Boolean);
        const next = on.has(g.word) ? parts.filter((p) => p.toLowerCase() !== tag) : [...parts, tag];
        setQuery(next.join(' '));
      } }, `#${g.word}`, el('span', { class: 'pick-note' }, ` ${g.notes}`))));
    tagRow.hidden = !tags.length;
  };
  // The list under the field: the sources, or what the query finds.
  const drawBody = () => {
    if (!body) return;
    const r = o.room();
    if (!query.trim()) { body.replaceChildren(sourceList(r)); return; }
    const got = r ? find(t, r, query) : { sources: [], notes: [], words: [] };
    const hits = [
      ...got.sources.map(({ source }) => { const s = t.marks.get(source); return el('button', { type: 'button', class: 'reading-hit pick', 'data-id': source, onclick: () => o.open(source) },
        el('span', { class: 'reading-hit-where pick-note' }, `Source · ${s.citekey || '—'}`), el('span', { class: 'reading-hit-text' }, s.title || 'Untitled')); }),
      ...got.notes.map((n) => { const s = t.marks.get(n.source); return el('button', { type: 'button', class: 'reading-hit pick', 'data-id': n.note, onclick: () => o.goTo(n.note) },
        el('span', { class: 'reading-hit-where pick-note' }, [s?.citekey || '—', n.anchor].filter(Boolean).join(', ')), el('span', { class: 'reading-hit-text' }, snippet(n.text, got.words))); }),
    ];
    const list = el('div', { class: 'reading-list', role: 'listbox', 'aria-label': 'Found' }, ...hits);
    walk(list, () => findBox?.focus());
    const n = got.notes.length;
    body.replaceChildren(el('p', { class: 'hint' }, hits.length ? `${n} ${n === 1 ? 'note' : 'notes'}${got.sources.length ? `, ${got.sources.length} ${got.sources.length === 1 ? 'source' : 'sources'}` : ''}. Enter goes to one; Escape clears.` : 'Nothing found.'), list);
  };
  // ArrowUp / ArrowDown walk a list; up from the first goes to `top`.
  const walk = (list, top) => list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...list.querySelectorAll('.pick')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowUp' && i <= 0 && top) { e.preventDefault(); top(); return; }
    const next = items[Math.max(0, Math.min(items.length - 1, (i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1))))];
    if (next) { e.preventDefault(); next.focus(); }
  });
  // ---- Collections: a tree above the list; one chosen shows only its sources (and those of the
  // collections inside it). A source dragged onto a collection goes in it; a collection dragged
  // onto another goes inside it (the middle of its line) or beside it (its top or bottom third).
  const SRC_DRAG = 'application/x-reading-source', COLL_DRAG = 'application/x-reading-collection';
  const shownColl = new Map(); // room → the collection shown (this session's), or none
  let renaming = null; // the collection whose name is being written
  let collBox = null;
  const collOf = (r) => { const c = r ? shownColl.get(r) : null; return c && collectionTree(t, r).some((n) => n.id === c) ? c : null; };
  const showColl = (r, c) => { if (c) shownColl.set(r, c); else shownColl.delete(r); drawLeft(); left?.querySelector(`.reading-coll[aria-selected="true"]`)?.focus(); };
  const dropZone = (row, target) => {
    row.addEventListener('dragover', (e) => {
      const types = [...(e.dataTransfer?.types || [])];
      if (!types.includes(SRC_DRAG) && !(types.includes(COLL_DRAG))) return;
      e.preventDefault();
      row.classList.add('st-drop');
    });
    row.addEventListener('dragleave', () => row.classList.remove('st-drop'));
    row.addEventListener('drop', (e) => {
      row.classList.remove('st-drop');
      const src = e.dataTransfer.getData(SRC_DRAG), coll = e.dataTransfer.getData(COLL_DRAG);
      if (!src && !coll) return;
      e.preventDefault();
      if (src && target) o.putIn?.(src, target);
      else if (coll && coll !== target) {
        const box = row.getBoundingClientRect();
        const to = collectionLanding(t, coll, target, target ? zoneOf(e.clientY, box.top, box.height) : 'into');
        if (to.reason) t.ui.toast(to.reason); else o.moveCollection?.(coll, to.parent);
      }
    });
  };
  const drawColls = () => {
    if (!collBox || collBox.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') return; // never under the caret
    const r = o.room();
    const nodes = r ? collectionTree(t, r) : [];
    const on = collOf(r);
    const all = r ? sourcesIn(t, r).length : 0;
    const row = (id, label, n, depth) => {
      const b = el('button', { type: 'button', role: 'treeitem', 'data-id': id || '', 'aria-level': String(depth || 1), 'aria-selected': (id || null) === on ? 'true' : 'false',
        class: `reading-coll pick reading-coll-d${depth || 0}${(id || null) === on ? ' st-sel' : ''}`, draggable: id ? 'true' : 'false', onclick: () => showColl(r, id) },
      el('span', { class: 'reading-coll-name' }, label), el('span', { class: 'pick-note' }, ` ${n}`));
      if (id) b.addEventListener('dragstart', (e) => { e.dataTransfer.setData(COLL_DRAG, id); e.dataTransfer.effectAllowed = 'move'; });
      dropZone(b, id);
      return b;
    };
    const items = [row(null, 'All sources', all, 0), ...nodes.map((n) => {
      if (n.id !== renaming) return row(n.id, n.name, n.all, n.depth);
      const input = el('input', { type: 'text', class: `reading-field reading-coll-d${n.depth}`, 'aria-label': 'Collection name', spellcheck: 'false', autocomplete: 'off' });
      input.value = n.name;
      const done = (keepIt) => { if (renaming !== n.id) return; renaming = null; if (keepIt) o.renameCollection?.(n.id, input.value); input.blur(); drawColls(); left?.querySelector(`.reading-coll[data-id="${n.id}"]`)?.focus(); };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); } });
      input.addEventListener('blur', () => done(true));
      setTimeout(() => { input.focus(); input.select(); }, 0);
      return input;
    })];
    const tree = el('div', { class: 'reading-list reading-colls', role: 'tree', 'aria-label': 'Collections' }, ...items);
    // Keys on a collection: Enter shows it, F2 renames it, Delete deletes it (its sources stay),
    // Alt+→ puts it inside the one above it, Alt+← takes it up a level.
    tree.addEventListener('keydown', (e) => {
      const id = document.activeElement?.dataset?.id;
      if (!id) return;
      if (e.key === 'F2') { e.preventDefault(); e.stopPropagation(); renaming = id; drawColls(); }
      else if (e.key === 'Delete') { e.preventDefault(); e.stopPropagation(); o.removeCollection?.(id); }
      else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault(); e.stopPropagation();
        const i = nodes.findIndex((n) => n.id === id), me = nodes[i];
        if (e.key === 'ArrowLeft') { if (me.parent) o.moveCollection?.(id, nodes.find((n) => n.id === me.parent)?.parent || null); }
        else { const above = nodes.slice(0, i).reverse().find((n) => n.depth === me.depth); if (above) o.moveCollection?.(id, above.id); }
        setTimeout(() => left?.querySelector(`.reading-coll[data-id="${id}"]`)?.focus(), 0);
      }
    });
    walk(tree, null);
    collBox.replaceChildren(
      el('div', { class: 'reading-colls-head' }, el('span', { class: 'label' }, 'Collections'),
        btn('New collection', () => { const c = o.newCollection?.(on); if (c) { renaming = c; drawColls(); } })),
      tree);
  };
  // A new collection's name, ready to write (Alt+Shift+C).
  const nameNew = (c) => { if (c) { renaming = c; drawColls(); } };
  // The collections tree, focused on the one shown (Alt+Shift+L).
  const focusColls = () => (left?.querySelector('.reading-coll[aria-selected="true"]') || left?.querySelector('.reading-coll'))?.focus();

  const drawLeft = () => {
    if (!left) return;
    if (!findBox) { findBox = makeFind(); tagRow = el('div', { class: 'reading-tags', 'aria-label': 'Tags' }); body = el('div', { class: 'reading-body' }); collBox = el('div', { class: 'reading-colls-box' }); }
    const r = o.room();
    const open = r ? o.openOf(r) : null;
    left.replaceChildren(
      el('div', { class: 'box-btns reading-actions' }, btn('New source', () => o.newSource()), open ? btn('New edition', () => o.newEdition?.()) : null),
      collBox, findBox, tagRow, body,
      el('details', { class: 'reading-io' }, el('summary', { class: 'label' }, 'In and out'),
        el('div', { class: 'box-btns' }, btn('Import BibTeX…', () => o.bibIn?.()), btn('Import Zotero notes…', () => o.zoteroIn?.())),
        el('div', { class: 'box-btns' }, btn('BibTeX', () => o.bibOut?.()), btn('Markdown', () => o.mdOut?.()), btn('Word', () => o.wordOut?.())),
        el('p', { class: 'hint' }, 'Zotero: its metadata through Export → BibTeX; its annotations through Add Note from Annotations, then the note exported as Markdown, into the open source. Markdown cites with Pandoc keys; Word in Chicago author-date, with References.')),
      el('p', { class: 'hint reading-keys' }, 'Delete: the source chosen in the list, with its notes. Alt+Shift+R: its book in the Book tab; Alt+Shift+P: a quote\'s page there. Alt+B: columns or blocks. Alt+Shift+C: a new collection. Alt+Shift+L: the collections (F2 renames, Delete deletes, Alt+→ / Alt+← nests). Alt+F: find. Alt+↓ / Alt+↑: the next or previous source. → / ←: show or fold its editions. Alt+Shift+E: a new edition.'));
    drawColls();
    drawTags();
    drawBody();
  };
  const sourceList = (r) => {
    const coll = collOf(r);
    const inColl = coll ? new Set(sourcesUnder(t, coll)) : null;
    const srcs = r ? sourcesIn(t, r).filter((s) => !inColl || inColl.has(s.id)) : [];
    const open = r ? o.openOf(r) : null;
    const openMain = open ? (editionOf(t, open) || open) : null;
    const shownSrc = srcs.filter((s) => { const m = editionOf(t, s.id); return !m || unfolded.has(m) || m === openMain && open === s.id; });
    const list = el('div', { class: 'reading-list', role: 'listbox', 'aria-label': 'Sources' }, ...shownSrc.map((s) => {
      const n = notesOf(t, s.id).length;
      const main = editionOf(t, s.id);
      const eds = main ? 0 : editionsOf(t, s.id).length;
      const fold = eds ? el('span', { class: 'reading-src-eds pick-note', title: unfolded.has(s.id) ? 'Fold the editions (←)' : 'Show the editions (→)',
        onclick: (e) => { e.stopPropagation(); toggle(s.id); } }, `${unfolded.has(s.id) ? '▾' : '▸'} ${eds} ${eds === 1 ? 'edition' : 'editions'}`) : null;
      return el('button', {
        type: 'button', role: 'option', 'data-id': s.id, 'aria-expanded': eds ? String(unfolded.has(s.id)) : null,
        'aria-selected': s.id === open ? 'true' : 'false', title: s.title || 'Untitled', class: `reading-src pick${s.id === open ? ' st-sel' : ''}${main ? ' reading-src-edition' : ''}`,
        onclick: () => o.open(s.id), draggable: 'true', ondragstart: (e) => { e.dataTransfer.setData(SRC_DRAG, s.id); e.dataTransfer.effectAllowed = 'link'; },
      },
      el('span', { class: 'reading-src-key' }, s.citekey || '—'),
      el('span', { class: 'reading-src-who pick-note' }, main ? `${s.edition ? `${s.edition} ed., ` : ''}${s.year || 'n.d.'}` : authorYear(s)),
      el('span', { class: 'reading-src-title' }, s.title || 'Untitled'),
      el('span', { class: 'reading-src-n pick-note' }, `${n} ${n === 1 ? 'note' : 'notes'}`), fold);
    }));
    list.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('.reading-src')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Delete' && i >= 0 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        o.deleteSource?.(items[i].dataset.id);
        setTimeout(() => left?.querySelector('.reading-src[aria-selected="true"]')?.focus(), 0);
        return;
      }
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && i >= 0) {
        const id = items[i].dataset.id, main = editionOf(t, id) || id;
        if (e.key === 'ArrowRight' && !unfolded.has(main) && editionsOf(t, main).length) { e.preventDefault(); toggle(main, id); }
        else if (e.key === 'ArrowLeft' && unfolded.has(main)) { e.preventDefault(); toggle(main, main); }
        return;
      }
    });
    walk(list, () => findBox?.focus());
    if (!srcs.length && coll) return el('p', { class: 'hint' }, 'No sources in this collection yet. Drag one onto it, or tick it in Details; New source makes one in it.');
    return srcs.length ? list : el('p', { class: 'hint' }, 'No sources yet. New source (Alt+Shift+N) makes the first.');
  };

  // Fold or unfold a source's editions; the focus stays on `keep` (a line's id).
  const toggle = (main, keep = main) => {
    if (unfolded.has(main)) unfolded.delete(main); else unfolded.add(main);
    drawBody();
    left?.querySelector(`.reading-src[data-id="${keep}"]`)?.focus();
  };

  // ---- Right: Details ----
  const field = (src, [key, label, how], locked) => {
    const id = `reading-f-${key}`;
    let input;
    if (how === 'choice') {
      input = el('select', { id, disabled: locked, onchange: () => keep(src.id, key, input.value) },
        ...TYPES.map(([v, name]) => el('option', { value: v, selected: (src.type || 'book') === v }, name)));
    } else {
      input = el('textarea', { id, rows: how === 'many' ? 2 : 1, class: 'reading-field', readonly: locked, spellcheck: key === 'title' ? 'true' : 'false' });
      input.value = shown(src, key);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          if (how !== 'many') return;
          const a = input.selectionStart, b = input.selectionEnd;
          input.value = input.value.slice(0, a) + '\n' + input.value.slice(b);
          input.selectionStart = input.selectionEnd = a + 1;
        } else if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          keep(src.id, key, input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault(); e.stopPropagation();
          input.value = shown(t.marks.get(src.id) || src, key);
          input.blur();
        }
      });
      input.addEventListener('blur', () => { if (t.marks.get(src.id)) keep(src.id, key, input.value, true); });
    }
    return el('label', { class: 'kv reading-kv', for: id }, el('span', { class: 'label' }, label), input);
  };

  // A field's words kept on the source (one step), or the reason it can't be, said.
  const keep = (id, key, words, quiet = false) => {
    const src = t.marks.get(id);
    if (!isSource(src) || busy) return;
    const r = t.places.home(id);
    const e = editFor(src, key, words, keysIn(t, r, id));
    if (!e) return;
    if (e.reason) { if (!quiet) t.ui.toast(e.reason); return; }
    busy = true;
    try {
      const out = t.marks.edit(id, e.fields);
      if (out && out.ok === false) t.ui.toast(out.reason || 'It could not be kept.');
    } finally { busy = false; }
    drawLeft();
    if (e.fields.citekey && key !== 'citekey') { const k = right?.querySelector('#reading-f-citekey'); if (k) k.value = e.fields.citekey; }
    if (e.fields.citekey) o.open(id, { draw: false }); // a new key moves its column: the view follows
  };

  const drawRight = (force = false) => {
    if (!right) return;
    if (!force && right.contains(document.activeElement)) return; // never under the caret
    const r = o.room();
    const id = r ? o.openOf(r) : null;
    const src = id ? t.marks.get(id) : null;
    if (!isSource(src)) { right.replaceChildren(el('p', { class: 'hint' }, 'Open a source in the list to see its details.')); return; }
    const locked = !!t.distance.shut(id);
    const n = notesOf(t, id).length;
    right.replaceChildren(
      el('div', { class: 'reading-form' }, ...FORM.map((f) => field(src, f, locked)), linkRow(src), editionField(src, locked)),
      collSection(src, locked),
      fileSection(src, locked),
      el('p', { class: 'hint' }, `${n} ${n === 1 ? 'note' : 'notes'}. Enter keeps a field; Ctrl+Enter is a new line in Title and Authors.`),
      locked ? null : el('section', { class: 'reading-src-actions' }, el('h3', { class: 'label' }, 'Actions'),
        el('div', { class: 'box-btns' }, btn(n ? `Delete source and its ${n} ${n === 1 ? 'note' : 'notes'}` : 'Delete source', () => o.deleteSource?.(id), 'danger'))));
  };

  // The collections the source is in: each a box to tick (Space), indented as in the tree.
  const collSection = (src, locked) => {
    const r = t.places.home(src.id);
    const nodes = collectionTree(t, r);
    if (!nodes.length) return null;
    const mine = new Set(collectionsOf(t, src.id));
    return el('section', { class: 'reading-in-colls' }, el('h3', { class: 'label' }, 'In collections'),
      ...nodes.map((n) => {
        const id = `reading-c-${n.id}`;
        const box = el('input', { type: 'checkbox', id, checked: mine.has(n.id), disabled: locked, onchange: () => (box.checked ? o.putIn?.(src.id, n.id) : o.takeOut?.(src.id, n.id)) });
        return el('label', { class: `reading-in-coll reading-coll-d${n.depth}`, for: id }, box, ` ${n.name}`);
      }));
  };

  // "Edition of": nothing, or another source of the library (one that is no edition itself).
  const editionField = (src, locked) => {
    const r = t.places.home(src.id);
    const main = editionOf(t, src.id);
    const hasOwn = editionsOf(t, src.id).length > 0;
    const others = sourcesIn(t, r).filter((s) => s.id !== src.id && !editionOf(t, s.id));
    const sel = el('select', { id: 'reading-f-editionof', disabled: locked || hasOwn,
      onchange: () => { o.setEditionOf?.(src.id, sel.value || null); drawLeft(); } },
    el('option', { value: '', selected: !main }, hasOwn ? '— (its editions are listed under it)' : '— (none)'),
    ...others.map((s) => el('option', { value: s.id, selected: main === s.id }, `${s.citekey || '—'}: ${s.title || 'Untitled'}`)));
    return el('label', { class: 'kv reading-kv', for: 'reading-f-editionof' }, el('span', { class: 'label' }, 'Edition of'), sel);
  };

  // The DOI or URL, opened in the browser (Alt+Shift+O).
  const linkRow = (src) => {
    const url = linkOf(src);
    return url ? el('div', { class: 'box-btns' }, btn(src.doi ? 'Open the DOI' : 'Open the URL', () => o.openLink?.(src.id))) : null;
  };

  // ---- The source's file: kept outside the room, by path and hash ----
  // Attach: pick the file (its size and SHA-256 worked out here; nothing of it kept but those),
  // then its path, pasted once (a browser is never told it). Verify: pick it again. Copy path.
  // The library folder is this computer's (t.store), never in the room.
  let pending = null; // a file picked, waiting for its path: { id, got }
  const fileSection = (src, locked) => {
    const r = t.places.home(src.id);
    const folder = o.folder?.(r) || '';
    const f = src.file;
    const head = el('h3', { class: 'label reading-file-head' }, 'File');
    const folderRow = el('label', { class: 'kv reading-kv', for: 'reading-f-folder' }, el('span', { class: 'label' }, 'Library folder on this computer'),
      textField('reading-f-folder', folder, (v) => { o.setFolder?.(r, v.trim()); drawRight(true); }, 'C:\\Users\\you\\Library'));
    if (pending && pending.id === src.id) {
      const g = pending.got;
      return el('section', { class: 'reading-file' }, head,
        el('p', { class: 'hint' }, `${g.name}, ${sizeOf(g.bytes)}. Paste its whole path (in Explorer: Shift+right-click, Copy as path), then Enter.`),
        el('label', { class: 'kv reading-kv', for: 'reading-f-path' }, el('span', { class: 'label' }, 'Its path'),
          textField('reading-f-path', g.path || '', (v) => { const got = pending.got; pending = null; o.attach?.(src.id, got, v); drawRight(true); }, folder ? fullPath(folder, g.name) : 'C:\\…\\file.pdf', true)),
        el('div', { class: 'box-btns' }, btn('Cancel', () => { pending = null; drawRight(true); })), folderRow);
    }
    if (!f?.rel) {
      return el('section', { class: 'reading-file' }, head,
        el('p', { class: 'hint' }, 'No file. The file stays where it is: the library keeps its path and fingerprint, never its text.'),
        locked ? null : el('div', { class: 'box-btns' }, btn('Attach file…', async () => { const got = await o.pick?.(); if (!got) return; if (got.path) { o.attach?.(src.id, got, got.path); drawRight(true); return; } pending = { id: src.id, got }; drawRight(true); right?.querySelector('#reading-f-path')?.focus(); })),
        folderRow);
    }
    const whole = fullPath(folder, f.rel);
    return el('section', { class: 'reading-file' }, head,
      el('p', { class: 'reading-file-name' }, f.name || f.rel),
      el('p', { class: 'hint reading-file-path', title: whole }, `${whole}${!folder && !isAbsolute(f.rel) ? ' (set the library folder below)' : ''}`),
      el('p', { class: 'hint' }, `${sizeOf(f.bytes)} · SHA-256 ${String(f.sha256 || '').slice(0, 12)}…`),
      el('label', { class: 'kv reading-kv', for: 'reading-f-offset' }, el('span', { class: 'label' }, 'Page offset (file page − printed page)'),
        textField('reading-f-offset', String(f.pageOffset || 0), (v) => { o.setOffset?.(src.id, offsetOf(v)); }, '0')),
      el('div', { class: 'box-btns' },
        btn('Copy path', () => o.copyPath?.(src.id)),
        o.canRead?.(src.id) ? btn('Read here', () => o.readHere?.(src.id)) : null,
        o.canShow?.() ? btn('Open', () => o.showFile?.(src.id)) : null,
        locked ? null : btn('Verify…', () => o.verify?.(src.id)),
        locked ? null : btn('Detach', () => o.detach?.(src.id))),
      folderRow);
  };
  // A one-line field: Enter keeps it (keep(words)), Escape puts it back.
  const textField = (id, value, keepIt, placeholder = '', focusNow = false) => {
    const input = el('input', { id, type: 'text', class: 'reading-field', placeholder, spellcheck: 'false', autocomplete: 'off' });
    input.value = value;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); keepIt(input.value); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); input.value = value; input.blur(); }
    });
    if (focusNow) setTimeout(() => input.focus(), 0);
    return input;
  };

  const draw = (force = false) => { drawLeft(); drawRight(force); };

  // ---- Opening and closing with the room ----
  const openAll = async () => {
    const d = docks();
    if (!d) return;
    if (!left) {
      const body = el('div', { class: 'reading reading-left' });
      left = body;
      const h = await d.left.open({ key: LEFT, tab: 'Sources', kind: 'Library', title: '', label: 'Sources', body, onClose: () => { if (left === body) left = null; } });
      if (!h && left === body) left = null;
    } else d.left.show(LEFT);
    if (!right) {
      const body = el('div', { class: 'reading reading-right' });
      right = body;
      const h = await d.right.open({ key: RIGHT, tab: 'Details', kind: 'Source', title: '', label: 'Details', body, onClose: () => { if (right === body) right = null; } });
      if (!h && right === body) right = null;
    } else d.right.show(RIGHT);
    draw(true);
  };
  const closeAll = () => {
    const d = docks();
    if (left) d?.left?.close(LEFT, true);
    if (right) d?.right?.close(RIGHT, true);
    left = right = null;
  };
  // Open in a room seen as Library, closed anywhere else.
  const sync = (rm) => { if (rm && isLibraryMode(rm.mode)) return openAll(); if (left || right) closeAll(); return null; };

  // The open source's Title, ready to write (a new source).
  const focus = (key = 'title') => { drawRight(true); const f = right?.querySelector(`#reading-f-${key}`); if (f) { f.focus(); f.select?.(); } };
  // The open source's line in the list, focused (Alt+↓ / Alt+↑ keep the list in step).
  const lit = () => left?.querySelector('.reading-src[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  // The Find field, ready to type (Alt+F); `q` put in it first when given.
  const focusFind = async (q = null) => { if (!left) await openAll(); if (q != null) setQuery(q); findBox?.focus(); findBox?.select?.(); };

  // The tables changed: one redraw once the step is over (a step changes marks and links together,
  // and Enter is two steps: the note, then its quote or nesting).
  let queued = false;
  const redraw = () => {
    if (queued || !(left || right)) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (left || right) draw(); });
  };
  for (const on of [t.marks.on, t.links.on]) on?.(redraw);
  return { sync, draw, focus, lit, focusFind, closeAll, showing: () => !!(left || right), collection: () => collOf(o.room()), nameNew, focusColls, showColl: (c) => showColl(o.room(), c), ready: async () => { if (!left) await openAll(); } };
}
