// The default system: Träumerei's own AI, as one plugin shipped apart (tools/corpus.py APART) and
// imported as default.traumplug. It adds one provider, id `default` (provider.js), which the AI
// framework tries first on every task it does (app/core/AI.md). Its engine (engine/) is a program
// the desktop app downloads and runs beside it once the person allows it; its models are
// downloaded into the plugin's store on first use (models.js). On the web copy it is listed but
// never available, and Provoke's reader answers. Once allowed, it warms the open room's vectors
// in the background, so a room read while someone waits costs only its new thoughts.
//
// A plugin: it reaches the app only through the plugin API (app/core/API.md), and only answers
// tasks; it never writes a table. Saved data: none in the .traum file; the store keeps the models
// and engine.json (README).

import { Feature } from 'folio';
import { makeDefault, ID } from './provider.js';

const WAIT = 2000; // ms after a room opens or changes before its vectors are warmed

export default class Default extends Feature {
  start() {
    const t = this.use('traumerei')?.connect(this);
    if (!t) throw new Error('Needs the plugin API');
    this.t = t;
    const provider = makeDefault({ sidecar: t.ai.sidecar, store: t.store, machine: () => t.ai.machine() });
    t.slots.providers.add(provider);

    // Warm the open room: embed its thoughts in the background, so the engine has their vectors
    // saved (engine/src/memory.rs) before anyone waits on them, and later only new thoughts cost.
    // Only once the person has allowed the engine and the models this session: it never asks.
    const warm = () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        const room = t.ui.chosen()?.context;
        if (room == null || !provider.prepared?.()) return;
        const items = t.marks.in(room).map((m) => t.ai.item(m.id)).filter((x) => x && x.text);
        if (items.length) t.ai.call('embed', { items }, { context: room, priority: 'idle', only: ID }).catch(() => {});
      }, WAIT);
    };
    this.on('room:open', warm);
    this.on('world:changed', warm);
  }

  stop() { clearTimeout(this.timer); }
}
