// The same verbs on whatever is chosen in a room, a thought or a group (and on a room, on the rooms
// page): rename (Ctrl+R), duplicate (Ctrl+D), fold or unfold (Ctrl+F), move to another room
// (Ctrl+M); Delete deletes (gestures.js). Each is a plain function of the room (c), like editor.js,
// and Room.js puts them in the key map. A key pressed while typing in a field does nothing (the
// key is still taken, so the browser doesn't reload or find).

import { isGroup, groupOf, kindOf, trainThoughts } from './world.js';

const FIELD = 'input, textarea, select, [contenteditable]';
export const typing = (e) => !!e?.target?.matches?.(FIELD);

// The one thing chosen (a thought or a group), or null (nothing, or many).
const one = (c) => (c.sel && c.sel.kind !== 'many' && c.world.things[c.sel.id] ? c.world.things[c.sel.id] : null);

// Where the chosen thing's properties show: the content editor's body, or the pop-up beside it.
const props = (c) => c.editor?.body || (c.bar.hidden ? null : c.bar);

// Rename: a thought is written in where it is; anything else opens its properties with its name
// (or its first words) chosen to type over.
export async function rename(c, e) {
  if (typing(e) || c.editing) return;
  const th = one(c);
  if (!th) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  if (kindOf(th) === 'line' && c.editThought(th.id)) return;
  await c.openProps(c.sel);
  const field = props(c)?.querySelector('.pop-name, input, textarea');
  field?.focus({ preventScroll: true });
  field?.select?.();
}

// Duplicate: a copy of what is chosen, beside the rest, chosen in its place.
export function duplicate(c, e) {
  if (typing(e) || c.editing || !c.sel) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  const units = c.copyOf(c.sel.ids || [c.sel.id]);
  if (!units.length) { c.toast('That can\'t be duplicated here yet.'); return; }
  c.pasteUnits(units);
}

// Fold or unfold: a group, or the group the chosen thought is in (in this mode).
export function fold(c, e) {
  if (typing(e) || c.editing) return;
  const th = one(c);
  if (!th) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  const g = isGroup(th) ? th : groupOf(c.world, th.id, c.mode);
  if (!g) { c.toast('It is in no group to fold.'); return; }
  if (g.folded) { c.unfoldTrain(g.id); return; }
  if (trainThoughts(c.world, g.id).length < 2 && !c.ont.open) { c.toast('One thought: nothing to fold.'); return; }
  c.foldTrain(g.id);
}

// Move to another room: the properties (or the bar for many) open, with Move to… open.
export async function moveTo(c, e) {
  if (typing(e) || c.editing || !c.sel) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  await c.openProps(c.sel);
  const pick = props(c)?.querySelector('.room-edit-move');
  if (!pick) return;
  pick.focus({ preventScroll: true });
  try { pick.showPicker?.(); } catch { /* the list opens with Alt+Down instead */ }
}
