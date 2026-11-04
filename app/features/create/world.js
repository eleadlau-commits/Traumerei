// What Create uses from the world feature (app/features/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when Create
// starts (bind, in Create.start), and every file here imports them from this one place. This list
// is everything Create needs of the world's rules; the service itself (this.w) is the rest.

export let
  DEFAULT_MODE, DESC, MESSY, ONTOLOGY, addPage, addRoom, addTag, allTags, applySettingsToAll,
  archive, archived, cells, create, fold, gridRooms, groupOf, groupsIn, hasTag, hash, isBig,
  isGroup, isLeaf, kindOf, lock, makeGroup, makeTag, members, move, name, own, pageCount, peek,
  placeRoom, randomSpot, remove, removeTag, resetRoomSettings, restore, room, roomAt, roomItems,
  roomSetting, roomTags, roomThoughts, roomTrains, rooms, roomsOn, search, seedRoomSettings,
  setRoomSetting, setTagGroup, shut, sizeRoom, startTrain, tagGroup, tagsByGroup, thoughtText,
  tidyTag, toPage, trainThoughts, unfold, update, view, ITEMS, maths, pageLook, rgb, roomLook,
  squareLook, toOklch, light, keepOrShrink, shrinkPicture, stepAfter, arrowsInto, link;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    DEFAULT_MODE, DESC, MESSY, ONTOLOGY, addPage, addRoom, addTag, allTags, applySettingsToAll,
    archive, archived, cells, create, fold, gridRooms, groupOf, groupsIn, hasTag, hash, isBig,
    isGroup, isLeaf, kindOf, lock, makeGroup, makeTag, members, move, name, own, pageCount, peek,
    placeRoom, randomSpot, remove, removeTag, resetRoomSettings, restore, room, roomAt,
    roomItems, roomSetting, roomTags, roomThoughts, roomTrains, rooms, roomsOn, search,
    seedRoomSettings, setRoomSetting, setTagGroup, shut, sizeRoom, startTrain, tagGroup,
    tagsByGroup, thoughtText, tidyTag, toPage, trainThoughts, unfold, update, view,
  } = lib.model);
  ({ ITEMS } = lib.items);
  ({ maths } = lib.maths);
  ({ pageLook, rgb, roomLook, squareLook, toOklch } = lib.look);
  ({ light } = lib.attention);
  ({ keepOrShrink, shrinkPicture } = lib.picture);
  ({ stepAfter } = lib.joyce);
  ({ arrowsInto, link } = lib.russell);
}
