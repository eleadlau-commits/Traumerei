// What roomfile uses of the app's world: its rules, by name, from the plugin API (app/core/API.md).
// They are bound when roomfile starts (bind, in Roomfile.start), and its files import them from
// here. This list is everything roomfile needs of the world's rules. (Each mode reads and writes
// its own section of a .traum file itself, through its `traum` member: roomfile names no mode.)

export let
  room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, isGroup, addRoom,
  seedRoomSettings, setRoomSetting, DEFAULT_MODE, ITEMS, kindFor, keepOrShrink, remove, groupsOf, setOrder, join,
  within, groupLabel, broken, isTwin, addTwin, sides, leave, replaceIn;

// t: the plugin API, or surface(lib) from app/core/api/v1.js in a test.
export function bind(t) {
  ({
    room, shut, view, create, update, members, groupsIn, roomItems, own, kindOf, isLeaf, isGroup, addRoom,
    seedRoomSettings, setRoomSetting, DEFAULT_MODE, remove, groupsOf, setOrder, join, within, groupLabel, leave, replaceIn,
  } = t.model);
  ({ ITEMS, kindFor } = t.kinds);
  ({ keepOrShrink } = t.pictures);
  ({ broken } = t.maths);
  ({ isTwin, addTwin, sides } = t.twins);
}
