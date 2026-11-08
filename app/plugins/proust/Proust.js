// Proust: a way of seeing a room (rules.js, drawn by draw.js), a plugin. It reaches the app only
// through the plugin API (app/core/API.md; world.js lists what it uses) and adds itself as a
// mode, so switching it off takes the mode away. It keeps nothing of its own outside the world.

import { Feature } from 'folio';
import { bind } from './world.js';
import { proust } from './rules.js';
import { draw, press, join, props, centreWeb, escape } from './draw.js';

export default class Proust extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Proust needs the plugin API');
    bind(t.parts);
    t.slots.rules.add({ ...proust, draw, press, join, props, centre: centreWeb, escape });
  }
}
