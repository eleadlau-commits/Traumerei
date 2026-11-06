// Proust: a way of seeing a room (rules.js, drawn by draw.js), added to the world's slot
// 'world.ontologies', so switching this feature off takes the mode away. It uses only the world
// service's lib (world.js lists what), and keeps nothing of its own outside the world.

import { Feature } from 'folio';
import { bind } from './world.js';
import { proust } from './rules.js';
import { draw, press } from './draw.js';

export default class Proust extends Feature {
  start() {
    bind(this.use('world').lib);
    this.add('world.ontologies', { ...proust, draw, press });
  }
}
