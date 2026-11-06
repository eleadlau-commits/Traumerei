// The same verbs on whatever is chosen in a room, a thought or a group (and on a room, on the rooms
// page): rename (Ctrl+R), duplicate (Ctrl+D), fold into one (Ctrl+F), close or open (Ctrl+Shift+F), move to another room
// (Ctrl+M), throw back into the tray (Ctrl+Shift+Backspace), group (Ctrl+G), ungroup (Ctrl+Shift+G), join (Ctrl+J, the mode's own) and lock the room (Ctrl+L); Delete deletes (gestures.js). Each is a plain function of the room (c), like editor.js,
// and Room.js puts them in the key map. A key pressed while typing in a field does nothing (the
// key is still taken, so the browser doesn't reload or find).

import { isGroup, groupOf, kindOf, trainThoughts, groupChosen, ungroupChosen, foldInto, room, lock as lockRoom, throwBack as throwBackIn } from './world.js';

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

// Fold: what is chosen (thoughts, and whole groups) becomes one thought, and the old ones go,
// in every mode: the new one takes their place wherever they were (the world's groups.js: fold).
// A chosen group stays and holds just the new one. The new one is then chosen.
export function fold(c, e) {
  if (typing(e) || c.editing || !c.sel) return;
  if (c.locked) { c.toast('This room is locked.'); return; }
  const ids = c.sel.ids || [c.sel.id];
  const n = ids.length;
  const th = foldInto(c.world, c.roomId, ids);
  if (!th || th.why) { c.toast(th?.why || 'Nothing here to fold.'); return; }
  c.sel = { kind: 'thought', id: th.id };
  c.save();
  c.drawWorld();
  c.toast(`Folded into one ${kindOf(th) === 'passage' ? 'passage' : 'thought'}. Ctrl+Z brings ${n > 1 ? 'them' : 'it'} back.`);
}

// Join: the mode's own way to join what is chosen (ontologies/index.js: join; Proust links the two
// chosen). The key is live only in a mode that has it.
export function join(c, e) {
  if (typing(e) || c.editing || !c.ont?.join) return;
  c.ont.join(c);
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

// Throw back: what is chosen goes back into this mode's loose tray, at the top (the world's
// throwBack, each ontology by its own unplace()): a thought leaves its train or chapter, a group
// of this mode waits in the tray, another mode's group loses its place. One step; Ctrl+Z undoes.
// ids: what to throw (a drag onto the tray); otherwise what is chosen.
export function throwBack(c, e, ids = null) {
  if (typing(e) || c.editing) return 0;
  ids ??= c.sel ? (c.sel.ids || [c.sel.id]) : [];
  if (!ids.length) return 0;
  if (c.locked) { c.toast('This room is locked.'); return 0; }
  if (!c.ont.tray) { c.toast(`${c.ont.name} has no loose tray.`); return 0; }
  const n = throwBackIn(c.ont, c.world, c.roomId, ids);
  if (!n) {
    c.toast(c.ont.groups ? 'Already loose, or it can\'t go alone.' : `${c.ont.name} places every thought itself: only another mode's group can go back.`);
    return 0;
  }
  c.sel = null;
  c.save();
  c.drawWorld();
  c.toast(`${n === 1 ? 'Back' : `${n} back`} in the loose tray. Ctrl+Z undoes.`);
  return n;
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

// Lock: this room is locked (nothing in it can change), or unlocked again. One step.
export function lock(c, e) {
  if (typing(e) || c.editing || !c.roomId) return;
  const r = room(c.world, c.roomId);
  if (!r) return;
  const on = !r.locked;
  lockRoom(c.world, r.id, on);
  c.save();
  c.drawRoom();
  c.drawWorld();
  if (c.sel && props(c)) c.openProps(c.sel); // the Editor shows it read only, or writable again
  const key = c.keyMap?.label?.('room.lock');
  c.toast(`${on ? 'Locked' : 'Unlocked'}.${key ? ` ${key} ${on ? 'unlocks' : 'locks'} it.` : ''}`);
}
