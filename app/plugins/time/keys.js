// Time's keys, for the key map (the keys feature). Time.js adds them with zone 'everywhere', live
// while a place shows (a room, or the rooms page).

export const TIME_KEYS = [
  { id: 'time.toggle', keys: ['Ctrl+Alt+T'], words: 'Time: show it, bring it to the front, or hide it' },
].map((k, i) => ({ order: 86 + i, ...k }));
