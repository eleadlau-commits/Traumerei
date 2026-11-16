// What Joyce uses of the app: the plugin API's shared parts (app/core/API.md), by name. They are
// bound from the API when Joyce starts (bind, in Joyce.start), and rules.js imports them from
// here. This list is everything Joyce needs.

export let
  startTrain, roomTrains, trainThoughts, groupOf, isGroup, isLeaf, kindOf, shut, thoughtText, roomItems, create, join, groupsIn, members, spotOf, setSpot, unsetSpot, isLooseGroup, offsetOf, setOffset, unsetOffset, // model
  placedForeign, trayForeign, spot, putAt, place, inForeign, unplace, // groups: other modes' groups, as one thing here
  stepAfter, setHeights, STEP, // trains: the rhythm a train's thoughts are read in
  lines;

export function bind(t) { // t: the plugin API's parts (t.parts), or surface(lib) in a test
  ({ startTrain, roomTrains, trainThoughts, groupOf, isGroup, isLeaf, kindOf, shut, thoughtText, roomItems, create, join, groupsIn, members, spotOf, setSpot, unsetSpot, isLooseGroup, offsetOf, setOffset, unsetOffset } = t.model);
  ({ placedForeign, trayForeign, spot, putAt, place, inForeign, unplace } = t.groups);
  ({ stepAfter, setHeights, STEP } = t.trains);
  lines = t.lines;
}
