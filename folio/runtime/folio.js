// Folio: apps made of feature folders.
//
// Everything a feature needs from the framework comes from this one module:
//
//   import { Feature, ui, time } from 'folio';
//
// See folio/README.md for the full guide.

export { App } from './App.js';
export { Feature } from './Feature.js';
export * as ui from './ui.js';
export * as time from './time.js';
export const VERSION = '1.10.0';
