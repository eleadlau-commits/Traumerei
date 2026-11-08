// The relations editor: a room's list of relations in its ⚙ (a setting of type 'relations'), shared
// by every ontology that joins things with named lines (Russell's arrows, Proust's links). A row
// for each relation: its name (rename it where it is, and its links follow), its ends (st.ends:
// Proust; Russell's are always arrows), its line (solid, dashed, dotted) and its colour (a few
// swatches; the colours live in Folio's base.css as .rel-colour-*). The first is the one a new link
// gets. Add one in the row at the foot; drag a row (or Alt+↑/↓) to put it elsewhere; × deletes one,
// asking what its links become when it has any.
//
// Keyboard first: ↑/↓ go from row to row, Enter writes in a row's name (Enter keeps, Esc lets go),
// Alt+↑/↓ move the row, Delete deletes it.
//
// relationsRow(st, { el, value, onChange, c, toast }) gives the editor's node:
//   st          the setting: { key, label, default, ends?, note?, uses?(c, name), retag?(c, from, to) }
//   value       the list now (entries as relations.js writes them: "calls up -> | dashed amber")
//   onChange(list)  hears each change (the room keeps it in its setting, then renames on links)
//   c           the room (for uses, retag and save: each change is one step Ctrl+Z takes back), or
//               null (the global settings)
//   toast(text) says why something was refused
// Its layout is the room's .room-rel-* classes.

import { relationEntry, entryText, cleanRelationList, relationName, LINES, COLOURS } from './relations.js';
import * as lines from './lines.js';

const ENDS = [['none', 'Plain'], ['arrow', 'Arrow'], ['both', 'Both ways']];
const WORD = { solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };

// The classes that give a line its look (Folio's base.css).
export const lookClass = ({ line, colour } = {}) => [line && line !== 'solid' ? `rel-line-${line}` : '', colour && colour !== 'ink' ? `rel-colour-${colour}` : ''].filter(Boolean).join(' ');

export function relationsRow(st, { el, value, onChange, c = null, toast = () => {} }) {
  const withEnds = !!st.ends;
  const none = st.none || 'arrow';
  let list = cleanRelationList(value, st.default, withEnds).map(relationEntry);
  let focus = null;     // after a redraw: { i, part } to put the focus back
  let asking = null;    // a relation being deleted that has links: { i, n }
  let dragged = null;   // the row being dragged

  const box = el('div', { class: 'room-rel-list', role: 'list', 'aria-label': st.label });
  const root = el('div', { class: 'renderer-slider room-rel-editor' }, el('span', {}, st.label), box,
    st.note ? el('span', { class: 'room-list-note' }, st.note) : null);

  function commit(next, at) {
    list = next;
    focus = at;
    onChange(list.map((e) => entryText(e, withEnds)));
    c?.save?.();
    draw();
  }
  const taken = (name, except) => list.some((e, j) => j !== except && e.name.toLowerCase() === name.toLowerCase());
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next, { i: j });
  };
  function remove(i) {
    if (list.length === 1) { toast('A room keeps at least one relation.'); return; }
    const n = c && st.uses ? st.uses(c, list[i].name) : 0;
    if (n && !asking) { asking = { i, n }; focus = { i, part: 'into' }; draw(); return; }
    asking = null;
    commit(list.filter((_, j) => j !== i), { i: Math.min(i, list.length - 2) });
  }

  // A small line in the row's look, with its ends.
  function sample(e) {
    const svg = lines.svg('svg', { class: 'room-rel-sample', width: 34, height: 12, viewBox: '0 0 34 12', 'aria-hidden': 'true' });
    const [ln] = lines.line('M3 6 L31 6', { ends: withEnds ? (e.ends || none) : 'arrow', cls: `room-line ${lookClass(e)}` });
    svg.append(ln);
    return svg;
  }

  function row(e, i) {
    if (asking?.i === i) {
      const others = list.filter((_, j) => j !== i);
      const into = el('select', { class: 'room-rel-into', 'aria-label': 'What its links become', onkeydown: (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { asking = null; focus = { i }; draw(); } } },
        ...others.map((o, j) => el('option', { value: String(j) }, o.name)), el('option', { value: 'none' }, '(no relation)'));
      return el('div', { class: 'room-rel-row room-rel-asking', role: 'listitem', 'data-i': i },
        el('span', { class: 'pop-note' }, `${asking.n} link${asking.n === 1 ? '' : 's'} ${asking.n === 1 ? 'is' : 'are'} “${e.name}”. ${asking.n === 1 ? 'It becomes' : 'They become'}`), into,
        el('button', { type: 'button', class: 'word danger', onclick: () => {
          const v = into.value;
          st.retag?.(c, e.name, v === 'none' ? '' : others[Number(v)].name);
          remove(i);
        } }, 'Delete'),
        el('button', { type: 'button', class: 'word', onclick: () => { asking = null; focus = { i }; draw(); } }, 'Cancel'));
    }
    const name = el('input', {
      class: 'room-edit-text room-rel-name', value: e.name, spellcheck: 'false', 'aria-label': `Relation ${i + 1}'s name`,
      onkeydown: (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); r.focus(); }
        if (ev.key === 'Escape') { ev.preventDefault(); ev.target.value = e.name; r.focus(); }
      },
      onchange: (ev) => {
        const n = relationName(ev.target.value);
        if (!n || taken(n, i)) {
          toast(n === null ? 'A relation can\'t hold [[, ]] or |.' : n ? `There is a “${n}” already.` : 'A relation needs a name.');
          ev.target.value = e.name;
          return;
        }
        if (n === e.name) return;
        commit(list.map((x, j) => (j === i ? { ...x, name: n } : x)), { i });
      },
    });
    const set = (k, v) => commit(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)), { i, part: k });
    const select = (k, options, now, label) => el('select', {
      class: `room-rel-${k}`, 'aria-label': `${e.name}: ${label}`, 'data-part': k,
      onkeydown: (ev) => ev.stopPropagation(), onchange: (ev) => set(k, ev.target.value),
    }, ...options.map(([v, w]) => el('option', { value: v, selected: v === now }, w)));
    const swatches = el('span', { class: 'room-rel-swatches', role: 'radiogroup', 'aria-label': `${e.name}: colour` },
      ...COLOURS.map((k) => el('button', {
        type: 'button', role: 'radio', class: `room-rel-swatch rel-swatch rel-colour-${k}`, title: k[0].toUpperCase() + k.slice(1),
        'aria-checked': String((e.colour || 'ink') === k), 'aria-label': k, 'data-part': k === (e.colour || 'ink') ? 'colour' : null,
        onclick: () => set('colour', k === 'ink' ? null : k),
      })));
    const r = el('div', {
      class: 'room-rel-row', role: 'listitem', tabindex: '0', draggable: 'true', 'data-i': i,
      title: i === 0 ? 'A new link gets this one. Drag to put another first.' : 'Drag to put it elsewhere',
      onkeydown: (ev) => {
        if (ev.target !== r) return;
        ev.stopPropagation();
        const rows = [...box.querySelectorAll('.room-rel-row')];
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          if (ev.altKey) move(i, ev.key === 'ArrowUp' ? -1 : 1);
          else rows[i + (ev.key === 'ArrowUp' ? -1 : 1)]?.focus();
        } else if (ev.key === 'Enter') { ev.preventDefault(); name.focus(); name.select(); }
        else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); remove(i); }
      },
      ondragstart: (ev) => { dragged = i; ev.dataTransfer?.setData('text/plain', String(i)); r.classList.add('room-rel-dragging'); },
      ondragend: () => { dragged = null; r.classList.remove('room-rel-dragging'); },
      ondragover: (ev) => { if (dragged != null) ev.preventDefault(); },
      ondrop: (ev) => {
        ev.preventDefault();
        if (dragged == null || dragged === i) return;
        const next = [...list];
        const [x] = next.splice(dragged, 1);
        next.splice(i, 0, x);
        dragged = null;
        commit(next, { i });
      },
    },
    el('span', { class: 'room-rel-grip', 'aria-hidden': 'true' }, '⋮⋮'),
    sample(e), name,
    el('span', { class: 'room-rel-look' },
      withEnds ? select('ends', ENDS, e.ends || none, 'ends') : null,
      select('line', LINES.map((k) => [k, WORD[k]]), e.line || 'solid', 'line'),
      swatches),
    el('button', { type: 'button', class: 'word room-rel-delete', title: `Delete “${e.name}”`, 'aria-label': `Delete ${e.name}`, onclick: () => remove(i) }, '×'));
    return r;
  }

  // The row at the foot: a new relation's name; Enter adds it at the end.
  function adder() {
    return el('input', {
      class: 'room-edit-text room-rel-add', placeholder: '+ A new relation', spellcheck: 'false', 'aria-label': 'Add a relation',
      onkeydown: (ev) => {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.target.value = ''; ev.target.blur(); return; }
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        const n = relationName(ev.target.value);
        if (!n) { if (n === null) toast('A relation can\'t hold [[, ]] or |.'); return; }
        if (taken(n, -1)) { toast(`There is a “${n}” already.`); return; }
        commit([...list, { name: n, ends: null, line: null, colour: null }], { add: true });
      },
    });
  }

  function draw() {
    box.replaceChildren(...list.map(row), adder());
    const f = focus;
    focus = null;
    if (!f) return;
    requestAnimationFrame(() => {
      if (f.add) { box.querySelector('.room-rel-add')?.focus(); return; }
      const r = box.querySelector(`[data-i="${f.i}"]`);
      const part = f.part === 'into' ? r?.querySelector('.room-rel-into') : f.part ? r?.querySelector(`[data-part="${f.part}"]`) : null;
      (part || r)?.focus?.();
    });
  }

  draw();
  return root;
}
