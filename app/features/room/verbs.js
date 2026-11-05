// The same verbs on whatever is chosen in a room, a thought or a group (and on a room, on the rooms
// page): rename (Ctrl+R), duplicate (Ctrl+D), close or open (Ctrl+F), move to another room
// (Ctrl+M), group (Ctrl+G) and ungroup (Ctrl+Shift+G); Delete deletes (gestures.js). Each is a plain function of the room (c), like editor.js,
// and Room.js puts them in the key map. A key pressed while typing in a field does nothing (the
// key is still taken, so the browser doesn't reload or find).

import { isGroup, groupOf, kindOf, trainThoughts, groupChosen, ungroupChosen } from './world.js';

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

// Close or open: a group, or the group the chosen thought is in (in this mode).
export function close(c, e) {
  if (typing(e) || c.editing) return;
  const th = one(c);
  if (!th) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  const g = isGroup(th) ? th : groupOf(c.world, th.id, c.mode);
  if (!g) { c.toast('It is in no group to close.'); return; }
  if (g.closed) { c.openTrain(g.id); return; }
  if (trainThoughts(c.world, g.id).length < 2 && !c.ont.open) { c.toast('One thought: nothing to close.'); return; }
  c.closeTrain(g.id);
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

// Group: what is chosen becomes one group of this mode, by the mode's own rule (the world's
// groupChosen: a Joyce train, a Russell chapter); the group is then chosen. A mode without groups
// (Pessoa) says so.
export function group(c, e) {
  if (typing(e) || c.editing || !c.sel) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  if (!c.ont.groups) { c.toast(`${c.ont.name} keeps each thought on its own: it has no groups.`); return; }
  const ids = c.sel.ids || [c.sel.id];
  // Chosen in the tray (none of them placed here yet): the new group stays in the tray.
  const loose = !!c.ont.placed && ids.every((id) => !c.ont.placed(c.world, c.roomId, id));
  const g = groupChosen(c.ont, c.world, c.roomId, ids, Date.now(), { loose });
  if (!g) { c.toast('Nothing here to group.'); return; }
  c.sel = { kind: 'train', id: g.id };
  c.save();
  c.drawWorld();
  c.toast(`One ${c.ont.groups.name.toLowerCase()} of ${trainThoughts(c.world, g.id).length}.`);
}

// Ungroup: what is chosen comes out of its groups of this mode (a whole group chosen: all of it),
// by the mode's own rule (Joyce: each its own train; Russell: loose again).
export function ungroup(c, e) {
  if (typing(e) || c.editing || !c.sel) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  if (!c.ont.groups) { c.toast(`${c.ont.name} has no groups.`); return; }
  const n = ungroupChosen(c.ont, c.world, c.roomId, c.sel.ids || [c.sel.id]);
  if (!n) { c.toast(`Not in a ${c.ont.groups.name.toLowerCase()} with others.`); return; }
  c.sel = null;
  c.save();
  c.drawWorld();
  c.toast(`${n} out of their ${c.ont.groups.name.toLowerCase()}.`);
}
