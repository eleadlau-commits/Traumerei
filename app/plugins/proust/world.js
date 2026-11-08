// What Proust uses of the app: the plugin API's rules and shared parts (app/core/API.md), by
// name. They are bound from the API when Proust starts (bind, in Proust.start), and its files
// import them from here. This list is everything Proust needs.

export let
  parentOf, shut, isLooseGroup, hash, roomSetting, setRoomSetting, isGroup, isLeaf, create, join, members, itemsIn, within, groupOf, groupsIn, roomItems, thoughtText, view, // model
  placedForeign, trayForeign, inForeign, waiting, wait, spot, putAt, unput, spotsOf, place, unplace, // groups: other modes' groups, as one thing here
  arrowsOf, cleanRelationList, relationEntry, relationEnds, listText, // relations: links and their relations
  lines, arrowView, maths, spiralPoint;

// t: the plugin API (this.use('traumerei').connect(this)), or in a test the same parts from
// surface(lib) (app/core/api/v1.js).
export function bind(t) {
  ({ parentOf, shut, isLooseGroup, hash, roomSetting, setRoomSetting, isGroup, isLeaf, create, join, members, itemsIn, within, groupOf, groupsIn, roomItems, thoughtText, view } = t.model);
  ({ placedForeign, trayForeign, inForeign, waiting, wait, spot, putAt, unput, spotsOf, place, unplace } = t.groups);
  ({ arrowsOf, cleanRelationList, relationEntry, relationEnds, listText } = t.relations);
  ({ arrowView } = t.arrows);
  ({ maths } = t.maths);
  ({ spiralPoint } = t.layout); // Pessoa's spiral: where a thought not yet placed sits
  lines = t.lines;
}
