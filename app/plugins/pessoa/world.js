// What Pessoa uses of the app: the plugin API's shared parts (app/core/API.md), by name. They are
// bound from the API when Pessoa starts (bind, in Pessoa.start), and rules.js imports them from
// here. This list is everything Pessoa needs.

export let
  roomUnits, shut, isGroup, // model
  placedForeign, trayForeign, spot, putAt, unput, spotsOf, unplace, inForeign, waiting, wait, // groups
  spiralPoint; // layout: the spiral

export function bind(t) { // t: the plugin API's parts (t.parts), or surface(lib) in a test
  ({ roomUnits, shut, isGroup } = t.model);
  ({ placedForeign, trayForeign, spot, putAt, unput, spotsOf, unplace, inForeign, waiting, wait } = t.groups);
  ({ spiralPoint } = t.layout);
}
