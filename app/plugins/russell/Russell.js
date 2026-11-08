// Russell: chapters joined into a tree (rules.js), a plugin. It reaches the app only through the
// plugin API (app/core/API.md; world.js lists what it uses) and adds itself as a mode, so
// switching it off takes the mode away: a room seen through Russell is then seen through Pessoa,
// and its chapters, arrows and labels wait, kept, until it is on again.

import { Feature } from 'folio';
import { bind } from './world.js';
import russell from './rules.js';

export default class Russell extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Russell needs the plugin API');
    bind(t.parts);
    t.slots.rules.add(russell);
  }
}
