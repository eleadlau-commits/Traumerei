// Pessoa: a way of seeing a room (rules.js), a corpus plugin since open core step 1a. It reaches
// the app only through the plugin API (app/core/API.md; world.js lists what it uses) and adds
// itself as a rule, so switching it off takes the mode away: a room seen through Pessoa is then
// seen through the first rule on that sees everything (the core's Rows last), and nothing is lost.

import { Feature } from 'folio';
import { bind } from './world.js';
import rule from './rules.js';

export default class Pessoa extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Pessoa needs the plugin API');
    bind(t.parts);
    t.slots.rules.add(rule);
  }
}
