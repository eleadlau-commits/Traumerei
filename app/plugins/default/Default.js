// The default system: Träumerei's own AI, as one plugin shipped apart (tools/corpus.py APART) and
// imported as default.traumplug. It adds one provider, id `default` (provider.js), which the AI
// framework tries first on every task it does (app/core/AI.md). Its engine (engine/) is a program
// the desktop app downloads and runs beside it once the person allows it; its models are
// downloaded into the plugin's store on first use (models.js). On the web copy it is listed but
// never available, and Provoke's reader answers.
//
// A plugin: it reaches the app only through the plugin API (app/core/API.md), and only answers
// tasks; it never writes a table. Saved data: none in the .traum file; the store keeps the models
// and engine.json (README).

import { Feature } from 'folio';
import { makeDefault } from './provider.js';

export default class Default extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    t.slots.providers.add(makeDefault({ sidecar: t.ai.sidecar, store: t.store, machine: () => t.ai.machine() }));
  }

  stop() {}
}
