// What Proust uses from the world feature (app/features/world): its rules, by name. A feature
// can't import another's files, so these are bound from the world service's `lib` when Proust
// starts (bind, in Proust.start), and its files import them from here. This list is everything
// Proust needs of the world's rules.

export let
  own, shut, hash, roomSetting, setRoomSetting, isGroup, isLeaf, create, join, members, itemsIn, within, groupOf, groupsIn, roomItems, thoughtText, view, // model
  placedForeign, trayForeign, spot, putAt, place, unplace, // groups: other modes' groups, as one thing here
  arrowsOf, cleanRelationList, relationEntry, relationEnds, listText, // relations: links and their relations
  lines, arrowView, maths, spiralPoint;

// lib: the world service's lib (world/lib.js), or the same modules in a test.
export function bind(lib) {
  ({ own, shut, hash, roomSetting, setRoomSetting, isGroup, isLeaf, create, join, members, itemsIn, within, groupOf, groupsIn, roomItems, thoughtText, view } = lib.model);
  ({ placedForeign, trayForeign, spot, putAt, place, unplace } = lib.groups);
  ({ arrowsOf, cleanRelationList, relationEntry, relationEnds, listText } = lib.relations);
  ({ arrowView } = lib.arrowview);
  ({ maths } = lib.maths);
  ({ spiralPoint } = lib.pessoa); // Pessoa's spiral: where a thought not yet placed sits
  lines = lib.lines;
}
