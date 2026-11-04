// What Create uses from the world feature (app/features/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when Create
// starts (bind, in Create.start), and its files import them from here. This list is
// everything Create needs of the world's rules.

export let
  room, view, shut, MESSY, name, create, update, remove, move, fold, unfold, kindOf, groupOf,
  thoughtText, trainThoughts, roomTrains, randomSpot, isBig, rooms, members, isGroup, startTrain,
  isLeaf, search, addRoom, roomThoughts, peek, roomSetting, setRoomSetting, resetRoomSettings,
  seedRoomSettings, applySettingsToAll, hash, DEFAULT_MODE, gridRooms, placeRoom, sizeRoom, cells,
  roomAt, lock, archive, archived, restore, DESC, roomsOn, toPage, pageCount, addPage, roomTags,
  addTag, removeTag, hasTag, tidyTag, tagsByGroup, tagGroup, setTagGroup, ONTOLOGY, makeTag,
  makeGroup, allTags, ITEMS, maths, pageLook, roomLook, rgb, squareLook, toOklch, light,
  shrinkPicture;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    room, view, shut, MESSY, name, create, update, remove, move, fold, unfold, kindOf, groupOf,
    thoughtText, trainThoughts, roomTrains, randomSpot, isBig, rooms, members, isGroup, startTrain,
    isLeaf, search, addRoom, roomThoughts, peek, roomSetting, setRoomSetting, resetRoomSettings,
    seedRoomSettings, applySettingsToAll, hash, DEFAULT_MODE, gridRooms, placeRoom, sizeRoom, cells,
    roomAt, lock, archive, archived, restore, DESC, roomsOn, toPage, pageCount, addPage, roomTags,
    addTag, removeTag, hasTag, tidyTag, tagsByGroup, tagGroup, setTagGroup, ONTOLOGY, makeTag,
    makeGroup, allTags,
  } = lib.model);
  ({ ITEMS } = lib.items);
  ({ maths } = lib.maths);
  ({ pageLook, roomLook, rgb, squareLook, toOklch } = lib.look);
  ({ light } = lib.attention);
  ({ shrinkPicture } = lib.picture);
}
