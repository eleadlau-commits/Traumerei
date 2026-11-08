// What Russell uses of the app: the plugin API's rules and shared parts (app/core/API.md), by
// name. They are bound from the API when Russell starts (bind, in Russell.start), and rules.js
// imports them from here. This list is everything Russell needs.

export let
  groupsIn, parentOf, members, groupOf, isGroup, isLeaf, shut, thoughtText, roomItems, create, join, setOrder, groupLabel, isLooseGroup, spotOf, setSpot, unsetSpot, // model
  trayForeign, place, inForeign, unplace, // groups: other modes' groups, as one thing here
  stepAfter, setHeights, STEP, // trains: the rhythm a chapter's thoughts are read in
  relationName, splitList, listText, cleanRelations, relationShown, withRelation, RELATIONS, arrowsOf, // relations
  lines, PAD, arrowView, maths;

// t: the plugin API (this.use('traumerei').connect(this)), or in a test the same parts from
// surface(lib) (app/core/api/v2.js).
export function bind(t) { // t: the plugin API's parts (t.parts), or surface(lib) in a test
  ({ groupsIn, parentOf, members, groupOf, isGroup, isLeaf, shut, thoughtText, roomItems, create, join, setOrder, groupLabel, isLooseGroup, spotOf, setSpot, unsetSpot } = t.model);
  ({ trayForeign, place, inForeign, unplace } = t.groups);
  ({ stepAfter, setHeights, STEP } = t.trains);
  ({ relationName, splitList, listText, cleanRelations, relationShown, withRelation, RELATIONS, arrowsOf } = t.relations);
  ({ arrowView } = t.arrows);
  ({ maths } = t.maths);
  lines = t.lines;
  ({ PAD } = t.lines);
}
