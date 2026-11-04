// A closed chapter, opened as a document: a pop-up over the room with the chapter's title and its
// thoughts in order, read as flowing paragraphs, maths drawn. It is a view of the group, not a
// copy: each paragraph is one of the chapter's thoughts, so search, the Timeline and every other
// mode still see them one by one.
//
// Click a paragraph to write in it. Enter keeps it and starts the next thought just after it;
// Ctrl+Enter (Cmd+Enter) puts a new line inside it; Backspace in an empty one goes back into the
// end of the one before. A thought emptied goes. Escape stops writing, and Escape again (or a click
// outside) closes the document. A passage or picture in the chapter shows as it is, not written in.

import { members, isGroup, update, remove, create, name, kindOf, shut, maths } from './world.js';

// The `at` for a thought written just after `prev` (and before `next`): members are kept in the
// order they were written, so a thought put between two takes a time between theirs.
export function between(prev, next, now = Date.now()) {
  if (!prev) return next ? next.at - 1 : now;
  if (!next) return Math.max(now, prev.at + 1);
  return prev.at + (next.at - prev.at) / 2;
}

// Keeps a paragraph's words: changes the thought, makes it (after `prev`), or lets an emptied one
// go. Returns the thought, or null when there is none.
export function keepWords(w, chapterId, id, text, prev = null, now = Date.now()) {
  const words = String(text ?? '').replace(/\r\n?/g, '\n');
  if (id) {
    const th = w.things[id];
    if (!th) return null;
    if (!words.trim()) { remove(w, id); return null; }
    if (words === th.text) return th;
    return update(w, id, { text: words }, now);
  }
  if (!words.trim()) return null;
  const list = members(w, chapterId);
  const i = prev ? list.findIndex((th) => th.id === prev) : -1;
  const at = between(list[i] || null, list[i + 1] || null, now);
  const th = create(w, chapterId, { kind: 'line', text: words }, now);
  if (th) th.at = at;
  return th;
}

export function openDocument(c, chapterId) {
  const w = () => c.world;
  const g = w().things[chapterId];
  if (!isGroup(g)) return;
  if (c.draft) c.commit();
  const locked = !!shut(w(), chapterId);
  let writing = null; // { id | null, prev, box }
  let paras = null;

  const grow = (t) => { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; };
  const thoughts = () => members(w(), chapterId);

  // Keeps the paragraph being written, if any. Returns the thought it became, or null.
  const keep = () => {
    if (!writing) return null;
    const { id, prev, box } = writing;
    writing = null;
    const th = keepWords(w(), chapterId, id, box.value, prev);
    c.save();
    return th;
  };

  const close = () => {
    keep();
    if (!w().things[chapterId] || !members(w(), chapterId).length) c.sel = null;
    c.editing = null;
    c.docEl.hidden = true;
    c.docEl.replaceChildren();
    document.removeEventListener('pointerdown', outside, true);
    c.drawWorld();
  };
  const outside = (e) => { if (!sheet.contains(e.target)) close(); };

  // Starts writing in a paragraph (id), or in a new one after `prev` (id null).
  const write = (id, prev = null, caret = 'end') => {
    if (locked) return;
    const before = keep();
    if (!w().things[chapterId]) { close(); return; }
    // A new thought after one that was just emptied (and so went) follows the one before that.
    if (!id && prev && !w().things[prev]) prev = before?.id || null;
    const th = id ? w().things[id] : null;
    const box = c.el('textarea', { class: 'room-doc-box', rows: 1, 'aria-label': 'A thought', placeholder: id ? '' : 'The next thought' });
    box.value = th?.text || '';
    writing = { id, prev, box };
    box.addEventListener('input', () => grow(box));
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); keep(); draw(); sheet.focus({ preventScroll: true }); return; }
      if (e.key === 'Backspace' && !box.value && !e.isComposing) {
        // Back into the end of the thought before (this one, empty, goes).
        const list = thoughts();
        const here = id ? list.findIndex((t) => t.id === id) : list.findIndex((t) => t.id === prev) + 1;
        const back = list[here - 1];
        if (back && kindOf(back) === 'line') { e.preventDefault(); keep(); write(back.id); }
        return;
      }
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { box.setRangeText('\n', box.selectionStart, box.selectionEnd, 'end'); grow(box); return; }
      if (!box.value.trim() && !id) { keep(); draw(); return; } // Enter on an empty new one: done writing
      const kept = keep();
      write(null, kept?.id || prev);
    });
    draw();
    box.focus({ preventScroll: true });
    const at = caret === 'end' ? box.value.length : 0;
    box.setSelectionRange(at, at);
    grow(box);
    box.scrollIntoView?.({ block: 'nearest' });
  };

  // The paragraphs, with the one being written as a box in its place.
  const draw = () => {
    if (!w().things[chapterId]) { close(); return; }
    const list = thoughts();
    const out = [];
    const fresh = writing && !writing.id ? writing : null;
    if (fresh && !fresh.prev) out.push(c.el('div', { class: 'room-doc-para writing' }, fresh.box));
    for (const th of list) {
      if (writing?.id === th.id) out.push(c.el('div', { class: 'room-doc-para writing' }, writing.box));
      else if (kindOf(th) === 'line') {
        out.push(c.el('div', {
          class: 'room-doc-para', 'data-id': th.id, title: locked ? '' : 'Click to write in it',
          onclick: () => write(th.id),
        }, maths(th.text || '')));
      } else out.push(c.el('div', { class: 'room-doc-para room-doc-item' }, c.thoughtNode(th)));
      if (fresh && fresh.prev === th.id) out.push(c.el('div', { class: 'room-doc-para writing' }, fresh.box));
    }
    paras.replaceChildren(...out);
    if (writing) requestAnimationFrame(() => writing && grow(writing.box));
  };

  const title = c.el('input', {
    class: 'room-doc-title', value: g.title || '', placeholder: 'Name this chapter', 'aria-label': 'The chapter\'s name',
    onkeydown: (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); title.blur(); sheet.focus({ preventScroll: true }); }
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); title.blur(); const list = thoughts(); if (!list.length) write(null); }
    },
    onchange: () => { name(w(), chapterId, title.value); c.save(); },
  });
  if (locked) title.setAttribute('readonly', '');
  paras = c.el('div', { class: 'room-doc-paras' });
  const more = locked ? null : c.el('button', {
    type: 'button', class: 'room-doc-more', 'aria-label': 'Write the next thought',
    onclick: () => { const list = thoughts(); write(null, list.at(-1)?.id || null); },
  }, '+');
  const sheet = c.el('div', { class: 'room-doc', role: 'dialog', 'aria-label': 'Chapter', tabindex: '-1' },
    c.el('div', { class: 'room-doc-head' },
      c.el('span', { class: 'room-doc-kind' }, 'Chapter'),
      c.el('button', { type: 'button', class: 'room-doc-close', 'aria-label': 'Close', onclick: close }, '×')),
    title, paras, more,
    c.el('div', { class: 'room-keys' }, locked ? 'This room is locked · Esc closes'
      : 'Click a paragraph to write · Enter keeps it · Ctrl+Enter a new line · Esc closes'));
  sheet.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });

  c.sel = null;
  c.editing = { kind: 'document', id: chapterId, close };
  c.docEl.replaceChildren(sheet);
  c.docEl.hidden = false;
  draw();
  sheet.focus({ preventScroll: true });
  // A click outside closes it (after this click, which opened it, is over).
  setTimeout(() => { if (!c.docEl.hidden) document.addEventListener('pointerdown', outside, true); }, 0);
}
