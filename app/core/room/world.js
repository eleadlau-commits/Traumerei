// What the room uses from the world feature (app/core/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when the room
// starts (bind, in Room.start), and its files import them from here. This list is
// everything the room needs of the world's rules.

export let
  room, view, shut, MESSY, name, create, update, remove, move, closeGroup, openGroup, kindOf, groupOf,
  thoughtText, trainThoughts, roomTrains, randomSpot, isBig, rooms, members, isGroup, startTrain,
  isLeaf, search, addRoom, roomThoughts, peek, roomSetting, setRoomSetting, resetRoomSettings,
  seedRoomSettings, applySettingsToAll, hash, DEFAULT_MODE, ITEMS, kindFor, maths, roomLook, light,
  groupChosen, ungroupChosen, throwBack, setOrder, foldInto, foldPlan, lock, sides, twinOf, otherSide, across, placeName, moveTargets, relationsRow, reading, wait, moveLoose, showSizes, resize;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    room, view, shut, MESSY, name, create, update, remove, move, closeGroup, openGroup, kindOf, groupOf,
    thoughtText, trainThoughts, roomTrains, randomSpot, isBig, rooms, members, isGroup, startTrain,
    isLeaf, search, addRoom, roomThoughts, peek, roomSetting, setRoomSetting, resetRoomSettings,
    seedRoomSettings, applySettingsToAll, hash, DEFAULT_MODE, setOrder, lock, reading,
  } = lib.model);
  ({ ITEMS, kindFor } = lib.items);
  ({ maths, showSizes, resize } = lib.maths);
  ({ roomLook } = lib.look);
  ({ light } = lib.attention);
  ({ groupChosen, ungroupChosen, throwBack } = lib.ontologies);
  ({ fold: foldInto, foldPlan, wait, moveLoose } = lib.groups);
  ({ sides, twinOf, otherSide, across, placeName, moveTargets } = lib.twin);
  ({ relationsRow } = lib.relationsview);
}
