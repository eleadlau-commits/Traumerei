// The room's keys, for the key map (the keys feature): what the ? list says inside a room, in
// order. Room.js adds them with zone 'room'. The room presses these itself (writing.js,
// gestures.js); `keys` is what each is, so the map can show it and catch a clash. `shows` is
// what the list says where a key alone doesn't say it (a click, typing).

export const ROOM_KEYS = [
  { id: 'room.write', shows: 'Type anywhere', words: 'write a thought' },
  { id: 'room.keep', shows: 'Enter', words: 'keep it, and go on with the train' },
  { id: 'room.train', keys: ['Ctrl+Enter'], words: 'a new train' },
  { id: 'room.passage', keys: ['Alt+P', 'Alt+I'], words: 'a passage · a picture' },
  { id: 'room.choose', shows: 'Click · double-click', words: 'choose a thought · its whole train' },
  { id: 'room.write-in', shows: 'Triple-click', words: 'write in a thought, where it is' },
  { id: 'room.properties', keys: ['Enter', 'ContextMenu', 'Shift+F10'], shows: 'Right-click · Enter', words: 'the properties of what is chosen' },
  { id: 'room.add', shows: 'Right-click the canvas', words: 'Add, just there' },
  { id: 'room.box', shows: 'Drag the canvas', words: 'a box to choose many' },
  { id: 'room.pan', shows: 'Ctrl+drag', words: 'move around' },
  { id: 'room.all', keys: ['Ctrl+A'], words: 'choose everything' },
  { id: 'room.more', shows: 'Shift+click · Ctrl+click', words: 'add to the choice · in or out of it' },
  { id: 'room.copy', keys: ['Ctrl+C', 'Ctrl+V'], words: 'copy what is chosen · put a copy here' },
  { id: 'room.delete', keys: ['Delete'], words: 'delete what is chosen' },
  { id: 'room.rename', keys: ['Ctrl+R'], words: 'rename what is chosen (a thought: write in it)', typing: true },
  { id: 'room.duplicate', keys: ['Ctrl+D'], words: 'duplicate what is chosen', typing: true },
  { id: 'room.fold', keys: ['Ctrl+F'], words: 'fold or unfold its group', typing: true },
  { id: 'room.move', keys: ['Ctrl+M'], words: 'move what is chosen to another room', typing: true },
  { id: 'room.back-into', shows: 'Backspace in an empty thought', words: 'back into the one before' },
  { id: 'room.nudge', keys: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift+ArrowLeft', 'Shift+ArrowRight', 'Shift+ArrowUp', 'Shift+ArrowDown'], shows: 'Arrows · Shift+arrows', words: 'nudge what is chosen' },
  { id: 'room.search', keys: ['Ctrl+K'], words: 'search every room' },
  { id: 'room.timeline', keys: ['Ctrl+Alt+T'], words: 'the Timeline: show it, bring it to the front, or hide it', typing: true },
  { id: 'room.undo', keys: ['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y'], shows: 'Ctrl+Z · Ctrl+Shift+Z', words: 'undo · redo' },
  { id: 'room.escape', keys: ['Escape'], words: 'let go, or go back' },
].map((k, i) => ({ order: 10 + i, ...k }));
