// The docks' keys, for the key map (the keys feature). Docks.js adds them with zone 'everywhere'
// and what each does. They work while typing too: Ctrl+Alt is never a letter (AltGr excepted,
// which the map leaves alone).

export const DOCK_KEYS = [
  { id: 'docks.left', keys: ['Ctrl+Alt+L'], words: 'show or hide the left dock' },
  { id: 'docks.right', keys: ['Ctrl+Alt+E'], words: 'show or hide the right dock' },
  { id: 'docks.canvas', keys: ['Ctrl+Alt+F'], words: 'canvas only: hide every dock, and bring them back' },
].map((k, i) => ({ order: 80 + i, typing: true, ...k }));
