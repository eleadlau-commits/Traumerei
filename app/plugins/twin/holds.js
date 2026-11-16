// Twin's hook (the slot 'world.holds', app/core/world/model.js HOLDS): a room two cells wide (its
// saved size 'twin') may hold rooms, its two sides, each a room of its own with its own mode.
// Nothing else holds a room. It reads only the mark it is handed: no world, no state.
export default {
  id: 'twin',
  name: 'Twin',
  holds: (parent, kind) => kind === 'room' && parent?.kind === 'room' && parent.size === 'twin',
};
