// What Borges uses of the app: the plugin API's shared parts (app/core/API.md) and one write
// through the tables, by name. They are bound when Borges starts (bind, in Borges.start), and
// rules.js imports them from here. This list is everything Borges needs.

export let room, cellOf, floorOf, roomsOn, span, shapeOf; // model: a room, its cell, its floor
export let put; // put(id, 'floor:<n>', { col, row }): true when the room went there (places.put)

// t: the plugin API (or, in a test, { parts: surface(lib), places }).
export function bind(t) {
  ({ room, cellOf, floorOf, roomsOn, span, shapeOf } = t.parts.model);
  put = (id, context, cell) => t.places.put(id, context, 'borges', cell)?.ok === true;
}
