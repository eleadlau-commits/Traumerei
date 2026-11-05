// The rooms page's keys, for the key map (the keys feature): what the ? list says on the rooms
// page, in order. Rooms.js adds them with zone 'rooms'. The page presses these itself (Rooms.js);
// `keys` is what each is, so the map can show it and catch a clash. `shows` is what the list says
// where a key alone doesn't say it (a click, typing).

export const ROOMS_KEYS = [
  { id: 'rooms.write', shows: 'Type anywhere', words: 'a thought in Messy thoughts' },
  { id: 'rooms.choose', shows: 'Click a room', words: 'choose it' },
  { id: 'rooms.open', keys: ['Enter'], shows: 'Double-click · Enter', words: 'go into the chosen room' },
  { id: 'rooms.properties', keys: ['ContextMenu', 'Shift+F10'], shows: 'Right-click', words: 'the properties of a room' },
  { id: 'rooms.delete', keys: ['Delete'], words: 'delete the chosen room' },
  { id: 'rooms.rename', keys: ['Ctrl+R'], words: 'rename the chosen room', typing: true },
  { id: 'rooms.floor', keys: ['PageUp', 'PageDown'], words: 'the floor above · below' },
  { id: 'rooms.search', keys: ['Ctrl+K'], words: 'search every room' },
  { id: 'rooms.undo', keys: ['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y'], shows: 'Ctrl+Z · Ctrl+Shift+Z', words: 'undo · redo' },
  { id: 'rooms.escape', keys: ['Escape'], words: 'let go, or go back' },
].map((k, i) => ({ order: 10 + i, ...k }));
