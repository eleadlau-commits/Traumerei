// Joyce: thoughts joined by time into trains, each read like a paragraph. Each thought stands on
// its own, joined to the next by a line (model.js: trainSpots, slack, strand). Enter goes on with
// the same train; Ctrl+Enter starts a new one. A train is a group that holds each thought in only
// one train. Joyce places everything, so it has no tray.
//
// For now Create draws Joyce's canvas itself (its line, its trains, Timeline); they move in here
// next.

import { roomTrains, trainThoughts, trainSpots, groupOf, isGroup, nudge, shut } from '../model.js';

export default {
  id: 'joyce',
  name: 'Joyce',
  note: 'thoughts joined by time',
  order: 10,
  groups: { form: 'train', name: 'Train', membership: 'one' },

  // Each train's thoughts, or a folded train as one thought.
  units: (w, roomId) => roomTrains(w, roomId).flatMap((t) => (t.folded ? [t] : trainThoughts(w, t.id))),

  point(w, roomId, id) {
    const th = w.things[id];
    if (isGroup(th)) return { x: th.x, y: th.y };
    const t = groupOf(w, id, 'joyce');
    if (!t) return null;
    return t.folded ? { x: t.x, y: t.y } : trainSpots(w, t.id)[id] || null;
  },

  // A train moves whole; a thought moves alone, and its train stays joined.
  drop(w, roomId, id, x, y) {
    const th = w.things[id];
    if (!th || shut(w, id)) return;
    if (isGroup(th)) Object.assign(th, { x, y });
    else nudge(w, id, x, y);
  },

  settings: [{ key: 'tension', label: 'Line tension', min: 0, max: 1 }],
};
