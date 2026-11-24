// Reading notes' two docks, in a room seen as Library. Left, Sources: every source of the library
// (citation key, author and year, title, how many notes), the open one lit; a click or Enter opens
// one, ArrowUp / ArrowDown walk the list, New source makes one. Right, Details: the open source's
// metadata, written in place. Keyboard first: Enter keeps a field, Ctrl+Enter is a new line in the
// fields that take several (title, authors), Escape puts it back as it was. No floating windows.
// Only the plugin API (t.ui.docks) and Folio's ui.el; the look is Folio's classes.

import { ui } from 'folio';
import { RULE, TYPES, isSource, sourcesIn, notesOf, authorYear, autoKey, uniqueKey, validKey, keysIn, editionOf, editionsOf } from './rules.js';

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

// docks({ room, inLibrary, openOf, open, newSource, newEdition, setEditionOf }) → { sync, draw, focus, closeAll }
export function installDocks(t, o) {
  const docks = () => t.ui.docks || null;
  let left = null, right = null; // the bodies, while open
  let busy = false;

  const btn = (label, fn, cls = '') => el('button', { type: 'button', class: `box-btn ${cls}`.trim(), onclick: fn }, label);

  // ---- Left: Sources ----
  // A source's editions fold into its line ("2 editions"); unfolded with → (or a click on the
  // count), folded with ←; the open one's always shown. This session's, per source.
  const unfolded = new Set();
  const drawLeft = () => {
    if (!left) return;
    const r = o.room();
    const srcs = r ? sourcesIn(t, r) : [];
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
        onclick: () => o.open(s.id),
      },
      el('span', { class: 'reading-src-key' }, s.citekey || '—'),
      el('span', { class: 'reading-src-who pick-note' }, main ? `${s.edition ? `${s.edition} ed., ` : ''}${s.year || 'n.d.'}` : authorYear(s)),
      el('span', { class: 'reading-src-title' }, s.title || 'Untitled'),
      el('span', { class: 'reading-src-n pick-note' }, `${n} ${n === 1 ? 'note' : 'notes'}`), fold);
    }));
    list.addEventListener('keydown', (e) => {
      const items = [...list.querySelectorAll('.reading-src')];
      const i = items.indexOf(document.activeElement);
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && i >= 0) {
        const id = items[i].dataset.id, main = editionOf(t, id) || id;
        if (e.key === 'ArrowRight' && !unfolded.has(main) && editionsOf(t, main).length) { e.preventDefault(); toggle(main, id); }
        else if (e.key === 'ArrowLeft' && unfolded.has(main)) { e.preventDefault(); toggle(main, main); }
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const next = items[Math.max(0, Math.min(items.length - 1, (i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1))))];
      if (next) { e.preventDefault(); next.focus(); }
    });
    left.replaceChildren(
      el('div', { class: 'box-btns reading-actions' }, btn('New source', () => o.newSource()), open ? btn('New edition', () => o.newEdition?.()) : null),
      srcs.length ? list : el('p', { class: 'hint' }, 'No sources yet. New source (Alt+Shift+N) makes the first.'),
      el('p', { class: 'hint reading-keys' }, 'Alt+↓ / Alt+↑: the next or previous source. → / ←: show or fold its editions. Alt+Shift+E: a new edition.'));
  };
  // Fold or unfold a source's editions; the focus stays on `keep` (a line's id).
  const toggle = (main, keep = main) => {
    if (unfolded.has(main)) unfolded.delete(main); else unfolded.add(main);
    drawLeft();
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
      el('div', { class: 'reading-form' }, ...FORM.map((f) => field(src, f, locked)), editionField(src, locked)),
      el('p', { class: 'hint' }, `${n} ${n === 1 ? 'note' : 'notes'}. Enter keeps a field; Ctrl+Enter is a new line in Title and Authors.`));
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
  const sync = (rm) => { if (rm && rm.mode === RULE) return openAll(); if (left || right) closeAll(); return null; };

  // The open source's Title, ready to write (a new source).
  const focus = (key = 'title') => { drawRight(true); const f = right?.querySelector(`#reading-f-${key}`); if (f) { f.focus(); f.select?.(); } };
  // The open source's line in the list, focused (Alt+↓ / Alt+↑ keep the list in step).
  const lit = () => left?.querySelector('.reading-src[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });

  for (const on of [t.marks.on, t.links.on]) on?.(() => { if (left || right) draw(); });
  return { sync, draw, focus, lit, closeAll, showing: () => !!(left || right) };
}
