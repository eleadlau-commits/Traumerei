// File formats: what plugins add to the slot 'world.formats' (the plugin API's t.formats), put
// together as one thing the rooms page and a room ask: can this file come in, bring it in, take a
// room out, edit it as text. Shaped:
//
//   id, name                 'traum', 'Room file (.traum)'
//   accepts(file)            whether a dropped or picked file is this format's
//   importRoom?(o)           a new room from o.file (or one it asks for when there is none):
//                            { file, cell, page, ok() } → the room, or null
//   importInto?(roomId, o)   the file's things into a room: { file, at(), ok(), before() } → true or false
//   exportRoom?(id)          downloads the room in this format
//   canEdit?()               whether a room or group can be edited as text in this format now
//   editRoom?(roomId, o), editGroup?(roomId, groupId, o)   that editing: → true once applied
//   cancel?()                closes anything it shows (its card)
//
// With no formats, `any` is false and every call does nothing (null, false). A format's mistake
// is reported against the plugin that added it, never thrown into the page.

export function formatsOf(slot) {
  const all = () => slot.items;
  const has = (what) => (f) => typeof f[what] === 'function';
  const ask = (f, fn, fallback) => slot.run(f, fn, fallback);
  // The same for a call that may wait: a promise that fails is reported too.
  const wait = async (f, fn, fallback) => {
    try { return await fn(); } catch (err) { slot.app.report(slot.ownerOf(f), err, `in "${slot.name}"`); return fallback; }
  };
  const forFile = (file) => all().find((f) => ask(f, () => f.accepts(file) === true, false)) || null;
  const first = (what) => all().find(has(what)) || null;
  const editor = () => all().find((f) => has('canEdit')(f) && ask(f, () => f.canEdit(), false)) || null;
  return Object.freeze({
    get any() { return all().length > 0; },
    get list() { return all().map((f) => ({ id: f.id, name: f.name })); },
    isRoomFile: (file) => !!forFile(file),
    importRoom: async (o = {}) => {
      const f = o.file ? forFile(o.file) : first('importRoom');
      return f && has('importRoom')(f) ? (await wait(f, () => f.importRoom(o), null)) ?? null : null;
    },
    importInto: async (roomId, o = {}) => {
      const f = o.file ? forFile(o.file) : first('importInto');
      return f && has('importInto')(f) ? !!(await wait(f, () => f.importInto(roomId, o), false)) : false;
    },
    get canExport() { return !!first('exportRoom'); },
    exportRoom: (id) => { const f = first('exportRoom'); if (f) ask(f, () => f.exportRoom(id)); },
    get canEdit() { return !!editor(); },
    editRoom: async (roomId, o) => { const f = editor(); return f && has('editRoom')(f) ? !!(await wait(f, () => f.editRoom(roomId, o), false)) : false; },
    editGroup: async (roomId, groupId, o) => { const f = editor(); return f && has('editGroup')(f) ? !!(await wait(f, () => f.editGroup(roomId, groupId, o), false)) : false; },
    cancel: () => { for (const f of all()) if (has('cancel')(f)) ask(f, () => f.cancel()); },
  });
}
