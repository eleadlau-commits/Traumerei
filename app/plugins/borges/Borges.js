// Borges: the rooms page's own way of seeing its rooms (rules.js), a corpus plugin since open core
// step 1a. It reaches the app only through the plugin API (app/core/API.md; world.js lists what
// it uses). The floor rule itself (cells, shapes, no overlaps) is the floors feature's, in core:
// with Borges off, the rooms page still places and moves rooms by it.

import { Feature } from 'folio';
import { bind } from './world.js';
import rule from './rules.js';

export default class Borges extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Borges needs the plugin API');
    bind(t);
    t.slots.rules.add(rule);
  }
}
