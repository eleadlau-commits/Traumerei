// What roomfile uses from the world feature (app/core/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when roomfile
// starts (bind, in Roomfile.start), and its files import them from here. This list is
// everything roomfile needs of the world's rules. (Each ontology reads and writes its own section
// of a .traum file itself, through its `traum` member: roomfile names no mode.)

export let
  room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, isGroup, addRoom,
  seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, kindFor, keepOrShrink, remove, groupsOf, setOrder, join,
  within, groupLabel, broken, isTwin, addTwin, sides;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, isGroup, addRoom,
    seedRoomSettings, setRoomSetting, DEFAULT_MODE, remove, groupsOf, setOrder, join, within, groupLabel,
  } = lib.model);
  ({ ITEMS, kindFor } = lib.items);
  ({ keepOrShrink } = lib.picture);
  ({ broken } = lib.maths);
  ({ isTwin, addTwin, sides } = lib.twin);
}
