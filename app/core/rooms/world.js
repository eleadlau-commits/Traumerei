// What rooms uses from the world feature (app/core/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when rooms
// starts (bind, in Rooms.start), and its files import them from here. This list is
// everything rooms needs of the world's rules.

export let
  room, parentOf, floorOf, isArchived, archivedAt, MESSY, remove, shut, DEFAULT_MODE, addRoom, name, update, move, fold, roomThoughts,
  search, cells, cellOf, roomAt, lock, archive, archived, restore, peek,
  DESC, roomsOn, pageCount, addPage, isBig, rooms, roomTags, addTag, removeTag, hasTag,
  tidyTag, tagsByGroup, tagGroup, setTagGroup, ONTOLOGY, makeTag, makeGroup, seedRoomSettings,
  allTags, groupNames, copyRoom, span, addTwin, sides, pageLook, roomLook, rgb, squareLook, toOklch, light, openGaps;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({
    room, parentOf, floorOf, isArchived, archivedAt, MESSY, remove, shut, DEFAULT_MODE, addRoom, name, update, move, fold, roomThoughts,
    search, cells, cellOf, roomAt, lock, archive, archived, restore, peek,
    DESC, roomsOn, pageCount, addPage, isBig, rooms, roomTags, addTag, removeTag, hasTag,
    tidyTag, tagsByGroup, tagGroup, setTagGroup, ONTOLOGY, makeTag, makeGroup, seedRoomSettings,
    allTags, groupNames, copyRoom, span,
  } = lib.model);
  ({ addTwin, sides } = lib.twin);
  ({ pageLook, roomLook, rgb, squareLook, toOklch } = lib.look);
  ({ light } = lib.attention);
  ({ opened: openGaps } = lib.gaps);
}
