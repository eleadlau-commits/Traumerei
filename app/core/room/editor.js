// The content editor: what a right-click (or a long press, or Enter) opens, in the side panel on
// the right (the panel feature), in place of the old pop-up beside the thing. At the top, what the
// pop-up had: the name, folding, the ontology's own rows (Russell's arrows), moves, Move to and
// Delete. Under it, the content: a group's thoughts as paragraphs to write in (document.js), or a
// thought's own words. At the foot, a small "Source" opens the group as .traum text in the source
// editor, in the same panel (the roomfile feature).
//
// Between the content and the foot, the sections plugins add to the slot 'room.editor' (the plugin
// API's t.editor): { id, order, when?(x), render(x) → a node, or null }, where x is
// { world, roomId, mode, id, thing, locked, refresh() }. A section being typed in isn't redrawn.
//
// While it shows, a click on another thought, group or train switches it there (followEditor, from
// drawBar). It is a plain function of the room (c), like document.js, not a part mixed onto Room.

import { isGroup, groupOf, shut } from './world.js';
import { paragraphs } from './document.js';

// Opens (or switches) the editor to thing `id`. Resolves once it shows.
export async function openEditor(c, id) {
  const th = c.world.things[id];
  if (!th || !c.panel) return;
  const group = isGroup(th);
  const locked = !!shut(c.world, id);
  const top = c.el('div', { class: 'room-editor-top' });
  const content = c.el('div', { class: 'room-editor-content' });
  const extra = c.el('div', { class: 'room-editor-sections' });
  const foot = c.el('div', { class: 'room-editor-foot' });
  const body = c.el('div', { class: 'room-editor', tabindex: '-1' }, top, content, extra, foot);
  let paras = null;
  if (group) {
    paras = paragraphs(c, id, {
      locked,
      kept: () => { c.drawWorld(); },
      gone: () => close(),
      escaped: () => body.focus?.({ preventScroll: true }),
    });
    content.append(c.el('div', { class: 'label' }, 'Thoughts'), paras.node, ...(paras.more ? [paras.more] : []));
  }
  // Source: the group (or the group a thought is in, in this mode) as .traum text.
  const sourceOf = () => (group ? id : groupOf(c.world, id, c.mode)?.id || null);
  const drawFoot = () => {
    const gid = c.files?.canEdit ? sourceOf() : null;
    foot.replaceChildren(gid ? c.el('button', { type: 'button', class: 'word room-editor-source', title: 'Edit as .traum text', onclick: () => c.editAsMarkdown(gid) }, locked ? 'Source (read only)' : 'Source') : '');
  };
  // The plugins' sections, each in its own box (so one being typed in stays as it is).
  const drawSections = (now) => {
    const x = { world: c.world, roomId: c.roomId, mode: c.mode, id, thing: now, locked, refresh: () => refresh() };
    const slot = c.slot('room.editor');
    const keep = new Map([...extra.children].map((n) => [n.dataset.section, n]));
    const boxes = slot.map((s) => {
      if (s.when && !slot.run(s, () => s.when(x), false)) return null;
      const old = keep.get(s.id);
      if (old?.contains(document.activeElement)) return old;
      const node = slot.run(s, () => s.render(x), null);
      return node ? c.el('section', { class: 'room-editor-section', 'data-section': s.id }, node) : null;
    });
    extra.replaceChildren(...boxes);
  };
  const refresh = () => {
    const now = c.world.things[id];
    if (!now) { close(); return; }
    // What is being typed in stays as it is.
    if (!top.contains(document.activeElement)) top.replaceChildren(...c.propRows(now, true));
    if (paras && !paras.writing) paras.draw();
    drawSections(now);
    drawFoot();
    handle?.setKind(kindWord(now));
  };
  const close = () => { handle?.close(true); };
  const editor = { id, body, refresh, keep: () => paras?.keep() };
  // The dock's head names only what it is and in which mode; the title is the field at the top.
  const kindWord = (x) => `${isGroup(x) ? c.groupName(x) : c.kindName(x)} · ${c.ont.name}`;
  const handle = await c.panel.open({
    key: 'content', kind: kindWord(th), title: '', body,
    beforeClose: () => { paras?.keep(); return true; },
    onClose: () => { if (c.editor === editor) { c.editor = null; c.drawWorld(); } },
  });
  if (!handle) return;
  c.editor = editor;
  refresh();
}
