// Twin: a room two cells wide whose two sides are rooms of their own, side by side (holds.js), a
// corpus plugin since open core step 1a. It reaches the app only through the plugin API
// (app/core/API.md): it adds one hook, that a Twin may hold its two sides. Switched off, no new
// Twin can be made (the rooms page stops offering one), and the Twins there are kept and still
// open as they were: a saved room inside a room is read whether or not a hook allows making one.
// The side-by-side canvas is still the room's own until the surfaces seam (open core step 3).

import { Feature } from 'folio';
import holds from './holds.js';

export default class Twin extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Twin needs the plugin API');
    t.slots.holds.add(holds);
  }
}
