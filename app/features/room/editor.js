// The content editor: what a right-click (or a long press, or Enter) opens, in the side panel on
// the right (the panel feature), in place of the old pop-up beside the thing. At the top, what the
// pop-up had: the name, folding, the ontology's own rows (Russell's arrows), moves, Move to and
// Delete. Under it, the content: a group's thoughts as paragraphs to write in (document.js), or a
// thought's own words. At the foot, a small "Source" opens the group as room Markdown in the source
// editor, in the same panel (the roomfile feature).
//
// While it shows, a click on another thought, group or train switches it there (followEditor, from
// drawBar). It is a plain function of the room (c), like document.js, not a part mixed onto Room.

import { isGroup, groupOf, shut, thoughtText } from './world.js';
import { paragraphs } from './document.js';

// Opens (or switches) the editor to thing `id`. Resolves once it shows.
export async function openEditor(c, id) {
  const th = c.world.things[id];
  if (!th || !c.panel) return;
  const group = isGroup(th);
  const locked = !!shut(c.world, id);
  const top = c.el('div', { class: 'room-editor-top' });
  const content = c.el('div', { class: 'room-editor-content' });
  const foot = c.el('div', { class: 'room-editor-foot' });
  const body = c.el('div', { class: 'room-editor', tabindex: '-1' }, top, content, foot);
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
  // Source: the group (or the group a thought is in, in this mode) as room Markdown.
  const sourceOf = () => (group ? id : groupOf(c.world, id, c.mode)?.id || null);
  const drawFoot = () => {
    const gid = c.files?.canEdit ? sourceOf() : null;
    foot.replaceChildren(gid ? c.el('button', { type: 'button', class: 'word room-editor-source', title: 'Edit as room Markdown', onclick: () => c.editAsMarkdown(gid) }, locked ? 'Source (read only)' : 'Source') : '');
  };
  const refresh = () => {
    const now = c.world.things[id];
    if (!now) { close(); return; }
    // What is being typed in stays as it is.
    if (!top.contains(document.activeElement)) top.replaceChildren(...c.propRows(now, true));
    if (paras && !paras.writing) paras.draw();
    drawFoot();
    handle?.setTitle(title(now));
  };
  const words = (x) => { const t = thoughtText(c.world, x).replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.slice(0, 57) + '…' : t || c.kindName(x); };
  const title = (x) => (isGroup(x) ? x.title || `An untitled ${c.groupName(x).toLowerCase()}` : words(x));
  const close = () => { handle?.close(true); };
  const editor = { id, body, refresh, keep: () => paras?.keep() };
  const handle = await c.panel.open({
    key: 'content', kind: group ? c.groupName(th) : c.kindName(th), title: title(th), body,
    beforeClose: () => { paras?.keep(); return true; },
    onClose: () => { if (c.editor === editor) { c.editor = null; c.drawWorld(); } },
  });
  if (!handle) return;
  c.editor = editor;
  refresh();
}
