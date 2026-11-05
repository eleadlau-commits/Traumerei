// What floors uses from the world feature (app/features/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when floors
// starts (bind, in Floors.start), and its files import them from here. This list is
// everything floors needs of the world's rules.

export let room, roomsOn, cells, roomAt, addPage, pageCount, archive, MESSY;

// Every room, on the grid or in the Archive.
export let allRooms;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({ room, roomsOn, cells, roomAt, addPage, pageCount, archive, MESSY } = lib.model);
  allRooms = (w) => [...lib.model.rooms(w), ...lib.model.archived(w)];
}
