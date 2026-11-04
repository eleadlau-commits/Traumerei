// What roomfile uses from the world feature (app/features/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when roomfile
// starts (bind, in Roomfile.start), and its files import them from here. This list is
// everything roomfile needs of the world's rules.

export let
  room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, addRoom,
  seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, keepOrShrink, stepAfter, link, arrowsInto;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, addRoom,
    seedRoomSettings, setRoomSetting, DEFAULT_MODE,
  } = lib.model);
  ({ ITEMS } = lib.items);
  ({ keepOrShrink } = lib.picture);
  ({ stepAfter } = lib.joyce);
  ({ link, arrowsInto } = lib.russell);
}
